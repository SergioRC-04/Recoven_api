import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecyclerDto } from './dto/create-recycler.dto';
import { UpdateRecyclerDto } from './dto/update-recycler.dto';
import {
  EstadoVinculacion,
  EstadoMicrorruta,
  ClasificacionRecycler,
  Municipio,
  Prisma,
} from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generarCertificadoGeneralPdf } from './utils/recycler-certificado.util';
import { generarExcelCierreCenso } from './utils/recyclers-export.util';
import { streamToBuffer } from '../common/utils/stream-to-buffer.util';
import { waitUntil } from '@vercel/functions';

export interface EstadoReporteCertificados {
  actualizando: boolean;
  url: string | null;
}

@Injectable()
export class RecyclersService {
  private supabase: SupabaseClient;

  // Ya no es una sola ruta fija — cada regeneración sube un archivo con
  // nombre NUEVO (prefijo + timestamp) y borra los anteriores. Esto es lo
  // que de raíz evita el problema de caché: una URL que nunca se pidió
  // antes no puede estar cacheada por el navegador ni por la CDN, a
  // diferencia de sobrescribir siempre el mismo path.
  private readonly REPORTE_CARPETA = 'reportes';
  private readonly REPORTE_PREFIJO = 'certificados-recicladores-';
  // Mientras este archivo exista, hay una regeneración en curso — el
  // frontend lo consulta (indirectamente, vía obtenerEstadoReporteCertificados)
  // para saber cuándo dejar de mostrar "Actualizando certificados...".
  private readonly REPORTE_MARCADOR_PATH = 'reportes/.regenerando';

  constructor(private prisma: PrismaService) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error(
        'Faltan SUPABASE_URL o SUPABASE_KEY en las variables de entorno',
      );
    }
    this.supabase = createClient<any, 'public', 'public'>(url, key);
  }

  // Las dimensiones de filtro son independientes y se combinan entre sí
  // (AND) — antes "tab" era una sola pestaña excluyente (con_ruta O
  // sin_ruta O nuevos O ...), lo que no permitía, por ejemplo, ver "con
  // ruta" + "censados" a la vez. search ahora también hace match contra
  // el nombre del barrio y el nombre de la ruta asignados a cada
  // reciclador, no solo nombre/cédula.
  //
  // municipio ("BARRANQUILLA" | "PUERTO_COLOMBIA") se apoya en la MISMA
  // relación que barrioId (Recycler -> RecyclerBarrio -> Barrio), solo
  // que sube un nivel más hasta Localidad.municipio — no hace falta una
  // consulta aparte, Prisma arma el JOIN encadenado con este filtro
  // anidado.
  async findAll(filters: {
    desvinculados?: boolean;
    rutas?: 'con_ruta' | 'sin_ruta';
    clasificacion?: ClasificacionRecycler;
    censado?: boolean;
    barrioId?: string;
    municipio?: Municipio | 'SIN_CIUDAD';
    search?: string;
  }) {
    const {
      desvinculados,
      rutas,
      clasificacion,
      censado,
      barrioId,
      municipio,
      search,
    } = filters;

    const andConditions: Prisma.RecyclerWhereInput[] = [];

    if (desvinculados) {
      andConditions.push({
        OR: [
          { estadoVinculacion: EstadoVinculacion.INACTIVO },
          { deletedAt: { not: null } },
        ],
      });
    } else {
      andConditions.push({
        deletedAt: null,
        estadoVinculacion: EstadoVinculacion.ACTIVO,
      });
    }

    if (rutas === 'con_ruta') andConditions.push({ microrrutas: { some: {} } });
    if (rutas === 'sin_ruta') andConditions.push({ microrrutas: { none: {} } });

    if (clasificacion) {
      andConditions.push({ clasificacion });
    }

    if (censado !== undefined) {
      andConditions.push({ censado });
    }

    if (barrioId) {
      andConditions.push({ barrios: { some: { barrioId } } });
    }

    // "SIN_CIUDAD" no es un valor del enum Municipio: son los recicladores
    // sin ningún barrio asignado, que por eso no caen en ninguna ciudad.
    if (municipio === 'SIN_CIUDAD') {
      andConditions.push({ barrios: { none: {} } });
    } else if (municipio) {
      andConditions.push({
        barrios: {
          some: {
            barrio: {
              localidadRel: { municipio },
            },
          },
        },
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          { nombreCompleto: { contains: search, mode: 'insensitive' } },
          { cedula: { contains: search } },
          {
            barrios: {
              some: {
                barrio: { nombre: { contains: search, mode: 'insensitive' } },
              },
            },
          },
          {
            microrrutas: {
              some: {
                microrruta: {
                  nombre: { contains: search, mode: 'insensitive' },
                },
              },
            },
          },
        ],
      });
    }

    const where: Prisma.RecyclerWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const recyclers = await this.prisma.recycler.findMany({
      where,
      include: {
        barrios: {
          include: {
            barrio: { select: { nombre: true } },
          },
        },
        microrrutas: {
          include: {
            microrruta: {
              select: { id: true, nombre: true, diasFrecuencia: true },
            },
          },
        },
      },
      orderBy: { nombreCompleto: 'asc' },
    });

    return recyclers.map((r) => ({
      id: r.id,
      tipoDocumento: r.tipoDocumento,
      cedula: r.cedula,
      nombreCompleto: r.nombreCompleto,
      telefono: r.telefono,
      censado: r.censado,
      clasificacion: r.clasificacion,
      detalleUbicacion: r.detalleUbicacion,
      estadoVinculacion: r.estadoVinculacion,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      barrios: r.barrios.map((b) => ({
        barrioId: b.barrioId,
        nombreBarrio: b.barrio?.nombre ?? '',
      })),
      microrrutas: r.microrrutas.map((m) => ({
        id: m.microrruta.id,
        nombre: m.microrruta.nombre,
        diasFrecuencia: m.microrruta.diasFrecuencia,
      })),
      fechaIngreso: r.fechaIngreso,
    }));
  }

  // Regla del censo: un reciclador NUEVO nunca puede estar censado (solo
  // entran al informe vigente los ya censados; los nuevos van al informe
  // nuevo hasta que se cierre el censo).
  private validarReglaNuevoNoCensado(
    clasificacion: ClasificacionRecycler,
    censado: boolean | undefined,
  ) {
    if (clasificacion === ClasificacionRecycler.NUEVO && censado === true) {
      throw new BadRequestException(
        'Un reciclador nuevo no puede estar censado.',
      );
    }
  }

  async create(dto: CreateRecyclerDto) {
    const { barriosIds, microrrutasIds, ...data } = dto;
    this.validarReglaNuevoNoCensado(
      data.clasificacion ?? ClasificacionRecycler.NUEVO,
      data.censado,
    );

    try {
      const nuevo = await this.prisma.recycler.create({
        data: {
          ...data,
          fechaIngreso: data.fechaIngreso
            ? new Date(data.fechaIngreso)
            : new Date('2025-01-01'),
          barrios: barriosIds
            ? {
                create: barriosIds.map((bId) => ({ barrioId: bId })),
              }
            : undefined,
          microrrutas: microrrutasIds
            ? {
                create: microrrutasIds.map((mId) => ({ microrrutaId: mId })),
              }
            : undefined,
        },
      });

      this.dispararRegeneracionReporteCertificados();

      return nuevo;
    } catch (error) {
      // P2002 = violación de restricción única. cedula es la única
      // columna @unique en este modelo, así que un P2002 aquí siempre es
      // por una cédula repetida.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'La cédula ya está registrada para otro reciclador.',
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateRecyclerDto) {
    const { barriosIds, microrrutasIds, ...data } = dto;

    // Estado efectivo tras la edición: si un solo campo llega en el DTO se
    // combina con el valor actual. Al pasar a NUEVO, el censo se apaga.
    const actual = await this.prisma.recycler.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Reciclador no encontrado');
    const clasificacionEfectiva = data.clasificacion ?? actual.clasificacion;
    if (clasificacionEfectiva === ClasificacionRecycler.NUEVO) {
      this.validarReglaNuevoNoCensado(clasificacionEfectiva, data.censado);
      data.censado = false;
    }

    try {
      const actualizado = await this.prisma.$transaction(async (tx) => {
        if (barriosIds !== undefined) {
          await tx.recyclerBarrio.deleteMany({ where: { recyclerId: id } });
          if (barriosIds.length > 0) {
            await tx.recyclerBarrio.createMany({
              data: barriosIds.map((bId) => ({
                recyclerId: id,
                barrioId: bId,
              })),
            });
          }
        }

        let rutasAfectadas: number[] = [];
        if (microrrutasIds !== undefined) {
          const previas = await tx.recyclerMicrorruta.findMany({
            where: { recyclerId: id },
            select: { microrrutaId: true },
          });
          rutasAfectadas = [
            ...new Set([
              ...previas.map((p) => p.microrrutaId),
              ...microrrutasIds,
            ]),
          ];
          await tx.recyclerMicrorruta.deleteMany({ where: { recyclerId: id } });
          if (microrrutasIds.length > 0) {
            await tx.recyclerMicrorruta.createMany({
              data: microrrutasIds.map((mId) => ({
                recyclerId: id,
                microrrutaId: mId,
              })),
            });
          }
        }

        const r = await tx.recycler.update({
          where: { id },
          data: {
            ...data,
            ...(data.fechaIngreso && {
              fechaIngreso: new Date(data.fechaIngreso),
            }),
          },
        });
        await this.sincronizarEstadoMicrorrutas(tx, rutasAfectadas);
        return r;
      });

      this.dispararRegeneracionReporteCertificados();

      return actualizado;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'La cédula ya está registrada para otro reciclador.',
        );
      }
      throw error;
    }
  }

  // ─── Cierre de censo ─────────────────────────────────────────────────────
  // Se cierra por ciudad (Barranquilla y Puerto Colombia se reportan en
  // fechas distintas). Qué hace: los A_QUITAR se desvinculan, los NUEVO
  // pasan a REGULAR y todos los del informe nuevo (NUEVO + REGULAR) quedan
  // censados. La ciudad de un reciclador se deduce de sus barrios (ver
  // findAll), así que uno con barrios en ambas ciudades entra en el cierre
  // de la primera que se cierre.

  private async datosCierreCenso(municipio: Municipio) {
    const activos = await this.findAll({ municipio });
    const censadosAntes = activos.filter((r) => r.censado);
    const aQuitar = activos.filter(
      (r) => r.clasificacion === ClasificacionRecycler.A_QUITAR,
    );
    const nuevos = activos.filter(
      (r) => r.clasificacion === ClasificacionRecycler.NUEVO,
    );
    const informeNuevo = activos.filter(
      (r) => r.clasificacion !== ClasificacionRecycler.A_QUITAR,
    );
    // Así quedarán tras el cierre — se calcula antes de aplicarlo para
    // poder generar (y guardar) el Excel antes de tocar nada.
    const censadosDespues = informeNuevo.map((r) => ({
      ...r,
      clasificacion: ClasificacionRecycler.REGULAR,
      censado: true,
    }));
    return { censadosAntes, aQuitar, nuevos, informeNuevo, censadosDespues };
  }

  private async rutasQueQuedarianInactivas(idsQueSalen: number[]) {
    if (idsQueSalen.length === 0) return 0;
    const salen = new Set(idsQueSalen);
    const rutas = await this.prisma.recyclerMicrorruta.findMany({
      where: { recyclerId: { in: idsQueSalen } },
      select: { microrrutaId: true },
    });
    const rutaIds = [...new Set(rutas.map((r) => r.microrrutaId))];
    if (rutaIds.length === 0) return 0;

    const activas = await this.prisma.recyclerMicrorruta.findMany({
      where: {
        microrrutaId: { in: rutaIds },
        recycler: {
          deletedAt: null,
          estadoVinculacion: EstadoVinculacion.ACTIVO,
        },
      },
      select: { microrrutaId: true, recyclerId: true },
    });
    const porRuta = new Map<number, number[]>();
    activas.forEach((a) => {
      porRuta.set(a.microrrutaId, [
        ...(porRuta.get(a.microrrutaId) ?? []),
        a.recyclerId,
      ]);
    });
    // Queda inactiva si todos sus recicladores activos son de los que salen.
    return rutaIds.filter((id) =>
      (porRuta.get(id) ?? []).every((rid) => salen.has(rid)),
    ).length;
  }

  async previsualizarCierreCenso(municipio: Municipio) {
    const d = await this.datosCierreCenso(municipio);
    return {
      municipio,
      censadosAntes: d.censadosAntes.length,
      censadosDespues: d.censadosDespues.length,
      desvinculados: d.aQuitar.length,
      nuevosARegulares: d.nuevos.length,
      rutasQueQuedanInactivas: await this.rutasQueQuedarianInactivas(
        d.aQuitar.map((r) => r.id),
      ),
    };
  }

  /**
   * Orden pensado para no cerrar nada si algo falla: primero se calcula
   * todo y se genera el Excel; en modo real se sube a Supabase; solo
   * entonces se aplica el cierre en una transacción. Si la transacción
   * falla, se borra el archivo subido. `simular` genera el Excel sin subir
   * ni aplicar nada (para revisarlo antes de un cierre real).
   */
  async cerrarCenso(municipio: Municipio, simular = false) {
    const d = await this.datosCierreCenso(municipio);
    const fecha = new Date();
    const ciudad =
      municipio === Municipio.BARRANQUILLA ? 'Barranquilla' : 'Puerto Colombia';

    const buffer = await generarExcelCierreCenso({
      antes: d.censadosAntes,
      despues: d.censadosDespues,
      fecha,
      ciudad,
    });

    const resumen = {
      municipio,
      censadosAntes: d.censadosAntes.length,
      censadosDespues: d.censadosDespues.length,
      desvinculados: d.aQuitar.length,
      nuevosARegulares: d.nuevos.length,
    };
    const nombreArchivo = `censo-${municipio.toLowerCase()}-${fecha.toISOString().slice(0, 10)}-${fecha.getTime()}.xlsx`;

    if (simular) {
      return { simulado: true as const, buffer, nombreArchivo, resumen, fecha };
    }

    const bucket = process.env.SUPABASE_BUCKET || 'certificados';
    const ruta = `cierres-censo/${nombreArchivo}`;
    const { error: uploadError } = await this.supabase.storage
      .from(bucket)
      .upload(ruta, buffer, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      });
    if (uploadError) {
      throw new BadRequestException(
        `No se pudo guardar el Excel del cierre, no se cerró el censo: ${uploadError.message}`,
      );
    }
    const url = this.supabase.storage.from(bucket).getPublicUrl(ruta)
      .data.publicUrl;

    try {
      const idsQuitar = d.aQuitar.map((r) => r.id);
      const idsRegular = d.informeNuevo.map((r) => r.id);
      await this.prisma.$transaction(async (tx) => {
        const rutas = await tx.recyclerMicrorruta.findMany({
          where: { recyclerId: { in: idsQuitar } },
          select: { microrrutaId: true },
        });
        await tx.recycler.updateMany({
          where: { id: { in: idsQuitar } },
          data: {
            estadoVinculacion: EstadoVinculacion.INACTIVO,
            deletedAt: fecha,
          },
        });
        await tx.recycler.updateMany({
          where: { id: { in: idsRegular } },
          data: { clasificacion: ClasificacionRecycler.REGULAR, censado: true },
        });
        await this.sincronizarEstadoMicrorrutas(tx, [
          ...new Set(rutas.map((r) => r.microrrutaId)),
        ]);
        await tx.cierreCenso.create({
          data: {
            municipio,
            fechaCierre: fecha,
            desvinculados: resumen.desvinculados,
            nuevosARegulares: resumen.nuevosARegulares,
            censadosAntes: resumen.censadosAntes,
            censadosDespues: resumen.censadosDespues,
            nombreArchivo,
            urlArchivo: url,
          },
        });
      });
    } catch (error) {
      await this.supabase.storage
        .from(bucket)
        .remove([ruta])
        .catch(() => undefined);
      throw error;
    }

    this.dispararRegeneracionReporteCertificados();
    return { simulado: false as const, url, nombreArchivo, resumen, fecha };
  }

  async toggleCenso(id: number) {
    const recycler = await this.prisma.recycler.findUnique({ where: { id } });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');
    this.validarReglaNuevoNoCensado(recycler.clasificacion, !recycler.censado);

    const actualizado = await this.prisma.recycler.update({
      where: { id },
      data: { censado: !recycler.censado },
    });

    this.dispararRegeneracionReporteCertificados();

    return actualizado;
  }

  // Mantiene el estado de las microrrutas dado quién las tiene asignadas:
  // INACTIVA si tiene al menos un reciclador asignado y NINGUNO está activo
  // (todos desvinculados); ACTIVA en cualquier otro caso — incluida una
  // ruta sin ningún reciclador asignado, que es normal y debe seguir
  // visible. Solo toca las rutas indicadas, nunca el resto. No borra nada:
  // reactivar a un reciclador y volver a llamar esto la devuelve a ACTIVA.
  private async sincronizarEstadoMicrorrutas(
    client: Prisma.TransactionClient,
    microrrutaIds: number[],
  ) {
    if (microrrutaIds.length === 0) return;

    const [conActivo, conAlguno] = await Promise.all([
      client.microrruta.findMany({
        where: {
          id: { in: microrrutaIds },
          recyclers: {
            some: {
              recycler: {
                deletedAt: null,
                estadoVinculacion: EstadoVinculacion.ACTIVO,
              },
            },
          },
        },
        select: { id: true },
      }),
      client.microrruta.findMany({
        where: { id: { in: microrrutaIds }, recyclers: { some: {} } },
        select: { id: true },
      }),
    ]);

    const idsConActivo = new Set(conActivo.map((m) => m.id));
    const inactivas = conAlguno
      .map((m) => m.id)
      .filter((id) => !idsConActivo.has(id));
    const inactivasSet = new Set(inactivas);
    const activas = microrrutaIds.filter((id) => !inactivasSet.has(id));

    await client.microrruta.updateMany({
      where: { id: { in: activas } },
      data: { estado: EstadoMicrorruta.ACTIVA },
    });
    await client.microrruta.updateMany({
      where: { id: { in: inactivas } },
      data: { estado: EstadoMicrorruta.INACTIVA },
    });
  }

  async softDelete(id: number) {
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const r = await tx.recycler.update({
        where: { id },
        data: {
          estadoVinculacion: EstadoVinculacion.INACTIVO,
          deletedAt: new Date(),
        },
      });
      // Sus rutas quedan INACTIVAS si no les queda otro reciclador activo.
      const rutas = await tx.recyclerMicrorruta.findMany({
        where: { recyclerId: id },
        select: { microrrutaId: true },
      });
      await this.sincronizarEstadoMicrorrutas(
        tx,
        rutas.map((x) => x.microrrutaId),
      );
      return r;
    });

    // Un reciclador desvinculado ya no debe aparecer en el certificado
    // general — regenerar aquí también, no solo en create/update.
    this.dispararRegeneracionReporteCertificados();

    return actualizado;
  }

  async reactivate(id: number) {
    const recycler = await this.prisma.recycler.findUnique({ where: { id } });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const r = await tx.recycler.update({
        where: { id },
        data: {
          estadoVinculacion: EstadoVinculacion.ACTIVO,
          deletedAt: null,
        },
      });
      // Sus rutas vuelven a ACTIVA.
      const rutas = await tx.recyclerMicrorruta.findMany({
        where: { recyclerId: id },
        select: { microrrutaId: true },
      });
      await this.sincronizarEstadoMicrorrutas(
        tx,
        rutas.map((x) => x.microrrutaId),
      );
      return r;
    });

    this.dispararRegeneracionReporteCertificados();

    return actualizado;
  }

  /**
   * Asigna una microrruta a un reciclador — a diferencia de update(), que
   * REEMPLAZA la lista completa de microrrutasIds (borra todas las que
   * tenía y crea las que vengan en el payload), esto solo AGREGA esta una,
   * sin tocar las demás rutas que el reciclador ya tuviera asignadas. Se
   * usa desde el flujo de "¿asignar un trabajador?" justo después de crear
   * una microrruta nueva, donde solo se conoce esa ruta puntual, no la
   * lista completa de rutas de cada reciclador.
   *
   * findFirst + create condicional (no upsert): evita depender de conocer
   * el nombre exacto de la clave compuesta que Prisma generó para el
   * índice único de RecyclerMicrorruta. Si la asignación ya existiera (el
   * reciclador ya tenía esta ruta), no hace nada — no es un error, solo
   * ya está hecho.
   */
  async asignarMicrorruta(recyclerId: number, microrrutaId: number) {
    const recycler = await this.prisma.recycler.findUnique({
      where: { id: recyclerId },
    });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');

    const yaAsignada = await this.prisma.recyclerMicrorruta.findFirst({
      where: { recyclerId, microrrutaId },
    });

    if (!yaAsignada) {
      await this.prisma.$transaction(async (tx) => {
        await tx.recyclerMicrorruta.create({
          data: { recyclerId, microrrutaId },
        });
        await this.sincronizarEstadoMicrorrutas(tx, [microrrutaId]);
      });
    }

    return { success: true };
  }

  // Ahora también trae los barrios asignados (solo el nombre, ya
  // aplanado) — los usa el certificado individual de vinculación en vez
  // de clasificación/estado de censo.
  async findOne(id: number) {
    const recycler = await this.prisma.recycler.findUnique({
      where: { id },
      select: {
        id: true,
        tipoDocumento: true,
        cedula: true,
        nombreCompleto: true,
        censado: true,
        clasificacion: true,
        createdAt: true,
        fechaIngreso: true,
        barrios: {
          select: {
            barrio: { select: { nombre: true } },
          },
        },
      },
    });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');

    return {
      ...recycler,
      barrios: recycler.barrios
        .map((b) => b.barrio?.nombre ?? '')
        .filter(Boolean),
    };
  }

  /**
   * Dispara la regeneración del reporte combinado sin bloquear al llamador
   * ni depender de que "algo más" mantenga viva la ejecución después de
   * responder — waitUntil() (de @vercel/functions) le garantiza a Vercel
   * que termine esta promesa antes de congelar la instancia, algo que un
   * simple ".catch()" sin await NO asegura en funciones serverless.
   * Consolidado aquí porque los cinco métodos que mutan un reciclador
   * necesitan disparar exactamente lo mismo.
   */
  private dispararRegeneracionReporteCertificados(): void {
    const promesa = this.regenerarReporteCertificadosGeneral().catch((err) =>
      console.error(
        'Error regenerando el reporte general de certificados:',
        err,
      ),
    );
    waitUntil(promesa);
  }

  /**
   * Junta el certificado de vinculación de todos los recicladores ACTIVOS
   * (mismo criterio que la pestaña "Todos": no desvinculados) en un solo
   * PDF y lo sube a Supabase Storage — con un nombre NUEVO cada vez
   * (timestamp incluido), no siempre el mismo path. Esto es lo que
   * resuelve el problema de caché de raíz: una URL jamás solicitada antes
   * no puede venir de una copia en caché, a diferencia de sobrescribir
   * siempre el mismo archivo. Los archivos de versiones anteriores se
   * borran al final, para no acumular basura en el bucket.
   *
   * El archivo marcador (.regenerando) se sube ANTES de empezar y se
   * quita SIEMPRE al terminar (en el finally, incluso si algo falla) —
   * es lo único que el frontend consulta (indirectamente, vía
   * obtenerEstadoReporteCertificados) para saber cuándo mostrar
   * "Actualizando certificados..." y cuándo dejar de hacerlo. Si no se
   * quitara también en el error, el botón quedaría bloqueado para
   * siempre ante cualquier falla.
   *
   * Se llama en fire-and-forget (ver dispararRegeneracionReporteCertificados)
   * desde create/update/toggleCenso/softDelete/reactivate — nunca se
   * espera desde el request que originó el cambio, para no hacer más
   * lenta esa respuesta.
   */
  private async regenerarReporteCertificadosGeneral(): Promise<void> {
    const bucketName = process.env.SUPABASE_BUCKET || 'certificados';

    await this.supabase.storage
      .from(bucketName)
      .upload(this.REPORTE_MARCADOR_PATH, Buffer.from('1'), {
        upsert: true,
        cacheControl: '0',
      });

    try {
      const recyclers = await this.findAll({});

      // generarCertificadoGeneralPdf es async (cede el control entre cada
      // reciclador para no bloquear el event loop de punta a punta con
      // listas grandes) — hace falta el await aquí, si no `doc` sería la
      // Promise en vez del PDFDocument.
      const doc = await generarCertificadoGeneralPdf(
        recyclers.map((r) => ({
          nombreCompleto: r.nombreCompleto,
          tipoDocumento: r.tipoDocumento,
          cedula: r.cedula,
          barrios: r.barrios.map((b) => b.nombreBarrio).filter(Boolean),
          fechaVinculacion: r.fechaIngreso,
        })),
      );
      doc.end();
      const buffer = await streamToBuffer(doc);

      const nuevoNombre = `${this.REPORTE_PREFIJO}${Date.now()}.pdf`;
      const nuevaRuta = `${this.REPORTE_CARPETA}/${nuevoNombre}`;

      const { error } = await this.supabase.storage
        .from(bucketName)
        .upload(nuevaRuta, buffer, {
          contentType: 'application/pdf',
          upsert: true,
          cacheControl: '0',
        });

      if (error) {
        throw new Error(
          `No se pudo guardar el reporte general de certificados: ${error.message}`,
        );
      }

      // Limpieza: borra cualquier versión anterior (mismo prefijo, salvo
      // la que se acaba de subir).
      const { data: listado } = await this.supabase.storage
        .from(bucketName)
        .list(this.REPORTE_CARPETA);
      const anteriores = (listado ?? [])
        .filter(
          (f) =>
            f.name.startsWith(this.REPORTE_PREFIJO) && f.name !== nuevoNombre,
        )
        .map((f) => `${this.REPORTE_CARPETA}/${f.name}`);
      if (anteriores.length > 0) {
        await this.supabase.storage.from(bucketName).remove(anteriores);
      }
    } finally {
      await this.supabase.storage
        .from(bucketName)
        .remove([this.REPORTE_MARCADOR_PATH]);
    }
  }

  /**
   * Estado actual del reporte combinado — de solo lectura, no dispara
   * ninguna regeneración ni escribe nada en Storage. El frontend la usa
   * de dos formas: (1) una vez al cargar la página, para saber la URL
   * vigente sin esperar nada; (2) en sondeo (polling) después de crear o
   * editar un reciclador, hasta que actualizando pase a false — ese es el
   * "estar a la escucha" de que la regeneración en segundo plano ya
   * terminó, sin que el propio botón de exportar dispare ni espere nada.
   */
  async obtenerEstadoReporteCertificados(): Promise<EstadoReporteCertificados> {
    const bucketName = process.env.SUPABASE_BUCKET || 'certificados';

    const { data: listado } = await this.supabase.storage
      .from(bucketName)
      .list(this.REPORTE_CARPETA);
    const archivos = listado ?? [];

    const marcadorExiste = archivos.some((f) => f.name === '.regenerando');
    if (marcadorExiste) {
      return { actualizando: true, url: null };
    }

    const actual = archivos
      .filter((f) => f.name.startsWith(this.REPORTE_PREFIJO))
      // El timestamp va en el nombre — el más reciente ordena último
      // alfabéticamente porque Date.now() siempre crece.
      .sort((a, b) => b.name.localeCompare(a.name))[0];

    if (!actual) {
      return { actualizando: false, url: null };
    }

    const { data } = this.supabase.storage
      .from(bucketName)
      .getPublicUrl(`${this.REPORTE_CARPETA}/${actual.name}`);

    return { actualizando: false, url: data.publicUrl };
  }
}

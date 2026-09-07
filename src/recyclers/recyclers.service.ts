import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecyclerDto } from './dto/create-recycler.dto';
import { UpdateRecyclerDto } from './dto/update-recycler.dto';
import {
  EstadoVinculacion,
  ClasificacionRecycler,
  Prisma,
} from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generarCertificadoGeneralPdf } from './utils/recycler-certificado.util';
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
  async findAll(filters: {
    desvinculados?: boolean;
    rutas?: 'con_ruta' | 'sin_ruta';
    clasificacion?: ClasificacionRecycler;
    censado?: boolean;
    barrioId?: string;
    search?: string;
  }) {
    const { desvinculados, rutas, clasificacion, censado, barrioId, search } =
      filters;

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

  async create(dto: CreateRecyclerDto) {
    const { barriosIds, microrrutasIds, ...data } = dto;

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

        if (microrrutasIds !== undefined) {
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

        return tx.recycler.update({
          where: { id },
          data: {
            ...data,
            ...(data.fechaIngreso && {
              fechaIngreso: new Date(data.fechaIngreso),
            }),
          },
        });
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

  async toggleCenso(id: number) {
    const recycler = await this.prisma.recycler.findUnique({ where: { id } });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');

    const actualizado = await this.prisma.recycler.update({
      where: { id },
      data: { censado: !recycler.censado },
    });

    this.dispararRegeneracionReporteCertificados();

    return actualizado;
  }

  async softDelete(id: number) {
    const actualizado = await this.prisma.recycler.update({
      where: { id },
      data: {
        estadoVinculacion: EstadoVinculacion.INACTIVO,
        deletedAt: new Date(),
      },
    });

    // Un reciclador desvinculado ya no debe aparecer en el certificado
    // general — regenerar aquí también, no solo en create/update.
    this.dispararRegeneracionReporteCertificados();

    return actualizado;
  }

  async reactivate(id: number) {
    const recycler = await this.prisma.recycler.findUnique({ where: { id } });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');

    const actualizado = await this.prisma.recycler.update({
      where: { id },
      data: {
        estadoVinculacion: EstadoVinculacion.ACTIVO,
        deletedAt: null,
      },
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
      await this.prisma.recyclerMicrorruta.create({
        data: { recyclerId, microrrutaId },
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

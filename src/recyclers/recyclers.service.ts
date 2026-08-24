import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecyclerDto } from './dto/create-recycler.dto';
import { UpdateRecyclerDto } from './dto/update-recycler.dto';
import {
  EstadoVinculacion,
  ClasificacionRecycler,
  Prisma,
} from '@prisma/client';

@Injectable()
export class RecyclersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    tab?: 'con_ruta' | 'sin_ruta' | 'nuevos' | 'a_quitar' | 'desvinculados';
    censado?: boolean;
    search?: string;
  }) {
    const { tab, censado, search } = filters;

    const andConditions: Prisma.RecyclerWhereInput[] = [];

    if (tab === 'desvinculados') {
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

      if (tab === 'con_ruta') andConditions.push({ microrrutas: { some: {} } });
      if (tab === 'sin_ruta') andConditions.push({ microrrutas: { none: {} } });
      if (tab === 'nuevos')
        andConditions.push({ clasificacion: ClasificacionRecycler.NUEVO });
      if (tab === 'a_quitar')
        andConditions.push({ clasificacion: ClasificacionRecycler.A_QUITAR });
    }

    if (censado !== undefined) {
      andConditions.push({ censado });
    }

    if (search) {
      andConditions.push({
        OR: [
          { nombreCompleto: { contains: search, mode: 'insensitive' } },
          { cedula: { contains: search } },
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
      cedula: r.cedula,
      nombreCompleto: r.nombreCompleto,
      censado: r.censado,
      clasificacion: r.clasificacion,
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

    return this.prisma.recycler.create({
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
  }

  async update(id: number, dto: UpdateRecyclerDto) {
    const { barriosIds, microrrutasIds, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (barriosIds !== undefined) {
        await tx.recyclerBarrio.deleteMany({ where: { recyclerId: id } });
        if (barriosIds.length > 0) {
          await tx.recyclerBarrio.createMany({
            data: barriosIds.map((bId) => ({ recyclerId: id, barrioId: bId })),
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
  }

  async toggleCenso(id: number) {
    const recycler = await this.prisma.recycler.findUnique({ where: { id } });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');

    return this.prisma.recycler.update({
      where: { id },
      data: { censado: !recycler.censado },
    });
  }

  async softDelete(id: number) {
    return this.prisma.recycler.update({
      where: { id },
      data: {
        estadoVinculacion: EstadoVinculacion.INACTIVO,
        deletedAt: new Date(),
      },
    });
  }

  async reactivate(id: number) {
    const recycler = await this.prisma.recycler.findUnique({ where: { id } });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');

    return this.prisma.recycler.update({
      where: { id },
      data: {
        estadoVinculacion: EstadoVinculacion.ACTIVO,
        deletedAt: null,
      },
    });
  }
  async findOne(id: number) {
    const recycler = await this.prisma.recycler.findUnique({
      where: { id },
      select: {
        id: true,
        cedula: true,
        nombreCompleto: true,
        censado: true,
        clasificacion: true,
        createdAt: true,
        fechaIngreso: true,
      },
    });
    if (!recycler) throw new NotFoundException('Reciclador no encontrado');
    return recycler;
  }
}

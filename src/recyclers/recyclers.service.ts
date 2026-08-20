import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecyclerDto } from './dto/create-recycler.dto';
import {
  Prisma,
  EstadoVinculacion,
  ClasificacionRecycler,
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

    if (tab === 'desvinculados') {
      return this.prisma.recycler.findMany({
        where: {
          OR: [
            { estadoVinculacion: EstadoVinculacion.INACTIVO },
            { deletedAt: { not: null } },
          ],
        },
        include: {
          barrios: true,
          microrrutas: { include: { microrruta: true } },
        },
      });
    }

    // Tipado estricto usando el tipo generado por Prisma
    const where: Prisma.RecyclerWhereInput = {
      deletedAt: null,
      estadoVinculacion: EstadoVinculacion.ACTIVO,
    };

    if (censado !== undefined) where.censado = censado;

    if (search) {
      where.OR = [
        { nombreCompleto: { contains: search, mode: 'insensitive' } },
        { cedula: { contains: search } },
      ];
    }

    if (tab === 'con_ruta') {
      where.microrrutas = { some: {} };
    } else if (tab === 'sin_ruta') {
      where.microrrutas = { none: {} };
    } else if (tab === 'nuevos') {
      where.clasificacion = ClasificacionRecycler.NUEVO;
    } else if (tab === 'a_quitar') {
      where.clasificacion = ClasificacionRecycler.A_QUITAR;
    }

    return this.prisma.recycler.findMany({
      where,
      include: {
        barrios: true,
        microrrutas: {
          select: {
            microrruta: { select: { id: true, nombre: true } },
          },
        },
      },
    });
  }

  async create(dto: CreateRecyclerDto) {
    const { barriosIds, microrrutasIds, ...data } = dto;

    return this.prisma.recycler.create({
      data: {
        ...data,
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

  async toggleCenso(id: number) {
    const recycler = await this.prisma.recycler.findUnique({ where: { id } });
    return this.prisma.recycler.update({
      where: { id },
      data: { censado: !recycler?.censado },
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
}

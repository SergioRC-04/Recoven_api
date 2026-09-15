import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Municipio } from '@prisma/client';
import { CreateUsuarioMicrorrutaDto } from './dto/create-usuario-microrruta.dto';
import { UpdateUsuarioMicrorrutaDto } from './dto/update-usuario-microrruta.dto';

@Injectable()
export class UsuariosMicrorrutaService {
  constructor(private prisma: PrismaService) {}

  // municipio filtra a través de MicrorrutaBarrio -> Barrios -> Localidades
  // (mismo camino que usa MicrorrutasService.construirFiltroEspacial para
  // su propio filtro de municipio), no comparando geometría directamente
  // — así el filtro nunca puede contradecir a qué municipio pertenece la
  // microrruta según el resto del panel.
  findAll(params: { microrrutaId?: number; municipio?: string }) {
    return this.prisma.usuarioMicrorruta.findMany({
      where: {
        ...(params.microrrutaId && { microrrutaId: params.microrrutaId }),
        ...(params.municipio && {
          microrruta: {
            barrios: {
              some: {
                barrio: {
                  localidadRel: { municipio: params.municipio as Municipio },
                },
              },
            },
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateUsuarioMicrorrutaDto) {
    return this.prisma.usuarioMicrorruta.create({ data: dto });
  }

  update(id: number, dto: UpdateUsuarioMicrorrutaDto) {
    return this.prisma.usuarioMicrorruta.update({ where: { id }, data: dto });
  }

  delete(id: number) {
    return this.prisma.usuarioMicrorruta.delete({ where: { id } });
  }
}

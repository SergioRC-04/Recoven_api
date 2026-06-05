import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMetricDto } from './dto/update-metric.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    return await this.prisma.metric.findMany({
      // Opcional: Ordenarlos por año y luego por ID para que al front lleguen organizados
      orderBy: [{ year: 'asc' }, { id: 'asc' }],
    });
  }

  async updateOrCreateMetric(dto: UpdateMetricDto) {
    const { sede, mes, year, aprovechamiento, rechazo } = dto;

    return await this.prisma.metric.upsert({
      where: {
        sede_mes_year: { sede, mes, year }, // Usamos el índice único compuesto para buscar la métrica existente
      },
      update: {
        aprovechamiento,
        rechazo,
      },
      create: {
        sede,
        mes,
        year,
        aprovechamiento,
        rechazo,
      },
    });
  }
}

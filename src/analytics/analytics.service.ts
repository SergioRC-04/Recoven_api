import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMetricDto } from './dto/update-metric.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    return await this.prisma.metric.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async updateOrCreateMetric(dto: UpdateMetricDto) {
    const { sede, mes, aprovechamiento, rechazo } = dto;

    return await this.prisma.metric.upsert({
      where: {
        sede_mes: { sede, mes },
      },
      update: {
        aprovechamiento,
        rechazo,
      },
      create: {
        sede,
        mes,
        aprovechamiento,
        rechazo,
      },
    });
  }
}

import { Body, Controller, Get, Put } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { UpdateMetricDto } from './dto/update-metric.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('metrics')
  async getAllMetrics() {
    return await this.analyticsService.getMetrics();
  }

  @Put('update')
  async updateMetric(@Body() updateMetricDto: UpdateMetricDto) {
    return await this.analyticsService.updateOrCreateMetric(updateMetricDto);
  }
}

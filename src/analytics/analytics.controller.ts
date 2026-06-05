import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { UpdateMetricDto } from './dto/update-metric.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('metrics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('')
  async getAllMetrics() {
    return await this.analyticsService.getMetrics();
  }

  @UseGuards(JwtAuthGuard)
  @Put('')
  async updateMetric(@Body() updateMetricDto: UpdateMetricDto) {
    return await this.analyticsService.updateOrCreateMetric(updateMetricDto);
  }
}

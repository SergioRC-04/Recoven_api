import { Controller, Get, Query } from '@nestjs/common';
import { GeoTerritorioService } from './geo-territorio.service';
import { FilterBarriosDto, FilterViasDto } from './dto/geo-territorio.dto';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('geo-territorio')
export class GeoTerritorioController {
  constructor(private readonly geoTerritorioService: GeoTerritorioService) {}

  @SkipThrottle()
  @Get('localidades')
  async getLocalidades() {
    return this.geoTerritorioService.getLocalidadesGeoJson();
  }

  @SkipThrottle()
  @Get('barrios')
  async getBarrios(@Query() query: FilterBarriosDto) {
    return this.geoTerritorioService.getBarriosGeoJson(query);
  }

  @SkipThrottle()
  @Get('vias')
  async getVias(@Query() query: FilterViasDto) {
    return this.geoTerritorioService.getViasGeoJson(query);
  }
}

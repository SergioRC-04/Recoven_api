import { Controller, Get, Query } from '@nestjs/common';
import { GeoTerritorioService } from './geo-territorio.service';
import { FilterBarriosDto, FilterViasDto } from './dto/geo-territorio.dto';

@Controller('geo-territorio')
export class GeoTerritorioController {
  constructor(private readonly geoTerritorioService: GeoTerritorioService) {}

  @Get('localidades')
  async getLocalidades() {
    return this.geoTerritorioService.getLocalidadesGeoJson();
  }

  /**
   * GET /geo-territorio/barrios?localidadCod=05
   * Capa de barrios (opcionalmente filtrada por código de localidad)
   */
  @Get('barrios')
  async getBarrios(@Query() query: FilterBarriosDto) {
    return this.geoTerritorioService.getBarriosGeoJson(query);
  }

  /**
   * GET /geo-territorio/vias?localidadCod=05&barrioCod=077
   * Capa de vías (opcionalmente filtrada por código de localidad o código de barrio)
   */
  @Get('vias')
  async getVias(@Query() query: FilterViasDto) {
    return this.geoTerritorioService.getViasGeoJson(query);
  }
}

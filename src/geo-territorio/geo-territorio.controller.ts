import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GeoTerritorioService } from './geo-territorio.service';
import { FilterBarriosDto, FilterViasDto } from './dto/geo-territorio.dto';
import { SkipThrottle } from '@nestjs/throttler';
import {
  responderExportGeo,
  parseFormatoExport,
} from '../common/utils/geo-export.util';

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

  @SkipThrottle()
  @Get('localidades/exportar')
  async exportarLocalidades(
    @Query('formato') formato: string | undefined,
    @Res() res: Response,
  ) {
    const geojson =
      await this.geoTerritorioService.getLocalidadesGeoJsonNativo();
    await responderExportGeo(
      res,
      geojson,
      parseFormatoExport(formato),
      'localidades',
      'polygon',
    );
  }

  @SkipThrottle()
  @Get('barrios/exportar')
  async exportarBarrios(
    @Query() query: FilterBarriosDto,
    @Query('formato') formato: string | undefined,
    @Res() res: Response,
  ) {
    const geojson =
      await this.geoTerritorioService.getBarriosGeoJsonNativo(query);
    await responderExportGeo(
      res,
      geojson,
      parseFormatoExport(formato),
      'barrios',
      'polygon',
    );
  }

  @SkipThrottle()
  @Get('vias/exportar')
  async exportarVias(
    @Query() query: FilterViasDto,
    @Query('formato') formato: string | undefined,
    @Res() res: Response,
  ) {
    const geojson = await this.geoTerritorioService.getViasGeoJsonNativo(query);
    await responderExportGeo(
      res,
      geojson,
      parseFormatoExport(formato),
      'vias',
      'polyline',
    );
  }
}

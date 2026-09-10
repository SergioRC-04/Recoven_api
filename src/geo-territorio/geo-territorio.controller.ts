import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GeoTerritorioService } from './geo-territorio.service';
import {
  FilterLocalidadesDto,
  FilterBarriosDto,
  FilterViasDto,
} from './dto/geo-territorio.dto';
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
  async getLocalidades(@Query() query: FilterLocalidadesDto) {
    return this.geoTerritorioService.getLocalidadesGeoJson(query);
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
    @Query() query: FilterLocalidadesDto,
    @Query('formato') formato: string | undefined,
    @Res() res: Response,
  ) {
    const geojson =
      await this.geoTerritorioService.getLocalidadesGeoJsonNativo(query);
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

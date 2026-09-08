// microrrutas.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MicrorrutasService } from './microrrutas.service';
import { CreateMicrorrutaDto } from './dto/create-microrruta.dto';
import { UpdateMicrorrutaDto } from './dto/update-microrruta.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  responderExportGeo,
  parseFormatoExport,
} from '../common/utils/geo-export.util';

@Controller('/microrrutas')
export class MicrorrutasController {
  constructor(private readonly microrrutasService: MicrorrutasService) {}

  @Get()
  findAll(
    @Query('barrioCod') barrioCod?: string,
    @Query('localidadCod') localidadCod?: string,
    @Query('macrorrutaNumero') macrorrutaNumero?: string,
  ) {
    return this.microrrutasService.findAll({
      barrioCod,
      localidadCod,
      macrorrutaNumero,
    });
  }

  // Lista de macrorrutas activas (con al menos una microrruta) — para
  // poblar el select de filtro del admin. Sin guard, igual que findAll:
  // esta info no es sensible y el mapa público podría llegar a
  // necesitarla más adelante.
  @Get('macrorrutas')
  obtenerMacrorrutas() {
    return this.microrrutasService.obtenerMacrorrutas();
  }

  // GeoJSON de las localidades con macrorruta activa, para el reporte en
  // mapa de macrorrutas — cada feature trae su nombre y su número de
  // macrorruta como propiedades, listo para dibujar sin más consultas.
  @Get('macrorrutas/mapa')
  obtenerMacrorrutasGeoJson() {
    return this.microrrutasService.obtenerMacrorrutasGeoJson();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateMicrorrutaDto) {
    return this.microrrutasService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMicrorrutaDto,
  ) {
    return this.microrrutasService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/geometria')
  updateGeom(
    @Param('id', ParseIntPipe) id: number,
    @Body('geojson') geojson: object,
  ) {
    return this.microrrutasService.updateGeom(id, geojson);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.microrrutasService.delete(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('exportar-excel')
  async exportarExcel(
    @Query('barrioCod') barrioCod: string | undefined,
    @Query('localidadCod') localidadCod: string | undefined,
    @Query('macrorrutaNumero') macrorrutaNumero: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.microrrutasService.exportarExcel({
      barrioCod,
      localidadCod,
      macrorrutaNumero,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="microrrutas.xlsx"',
    );
    res.send(buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get('exportar-capa')
  async exportarCapa(
    @Query('barrioCod') barrioCod: string | undefined,
    @Query('localidadCod') localidadCod: string | undefined,
    @Query('macrorrutaNumero') macrorrutaNumero: string | undefined,
    @Query('formato') formato: string | undefined,
    @Res() res: Response,
  ) {
    const geojson = await this.microrrutasService.exportarCapaGeoJson({
      barrioCod,
      localidadCod,
      macrorrutaNumero,
    });
    await responderExportGeo(
      res,
      geojson,
      parseFormatoExport(formato),
      'microrrutas',
      'polyline',
    );
  }
}

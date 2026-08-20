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
} from '@nestjs/common';
import { MicrorrutasService } from './microrrutas.service';
import { CreateMicrorrutaDto } from './dto/create-microrruta.dto';

@Controller('/microrrutas')
export class MicrorrutasController {
  constructor(private readonly microrrutasService: MicrorrutasService) {}

  @Get()
  findAll(
    @Query('barrioCod') barrioCod?: string,
    @Query('localidadCod') localidadCod?: string,
  ) {
    return this.microrrutasService.findAll({ barrioCod, localidadCod });
  }

  @Post()
  create(@Body() dto: CreateMicrorrutaDto) {
    return this.microrrutasService.create(dto);
  }

  @Put(':id/geometria')
  updateGeom(
    @Param('id', ParseIntPipe) id: number,
    @Body('geojson') geojson: object,
  ) {
    return this.microrrutasService.updateGeom(id, geojson);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.microrrutasService.delete(id);
  }
}

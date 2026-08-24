import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RecyclersService } from './recyclers.service';
import { CreateRecyclerDto } from './dto/create-recycler.dto';
import { UpdateRecyclerDto } from './dto/update-recycler.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  generarExcelRecyclers,
  parseTipoExportRecyclers,
  mapearTipoAFiltrosFindAll,
} from './utils/recyclers-export.util';
import { generarCertificadoPdf } from './utils/recycler-certificado.util';

@UseGuards(JwtAuthGuard)
@Controller('/recyclers')
export class RecyclersController {
  constructor(private readonly recyclersService: RecyclersService) {}

  @Get()
  findAll(
    @Query('tab')
    tab?: 'con_ruta' | 'sin_ruta' | 'nuevos' | 'a_quitar' | 'desvinculados',
    @Query('censado') censado?: string,
    @Query('search') search?: string,
  ) {
    const isCensado = censado !== undefined ? censado === 'true' : undefined;
    return this.recyclersService.findAll({ tab, censado: isCensado, search });
  }

  @Post()
  create(@Body() dto: CreateRecyclerDto) {
    return this.recyclersService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecyclerDto,
  ) {
    return this.recyclersService.update(id, dto);
  }

  @Patch(':id/toggle-censo')
  toggleCenso(@Param('id', ParseIntPipe) id: number) {
    return this.recyclersService.toggleCenso(id);
  }

  @Delete(':id')
  softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.recyclersService.softDelete(id);
  }

  @Patch(':id/reactivar')
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.recyclersService.reactivate(id);
  }

  @Get('exportar')
  async exportar(
    @Query('tipo') tipoRaw: string | undefined,
    @Res() res: Response,
  ) {
    const tipo = parseTipoExportRecyclers(tipoRaw);
    const filtros = mapearTipoAFiltrosFindAll(tipo);
    const recyclers = await this.recyclersService.findAll(filtros);
    const buffer = await generarExcelRecyclers(recyclers, tipo);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="recicladores-${tipo}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get(':id/certificado')
  async descargarCertificado(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const recycler = await this.recyclersService.findOne(id);
    const doc = generarCertificadoPdf({
      nombreCompleto: recycler.nombreCompleto,
      cedula: recycler.cedula,
      clasificacion: recycler.clasificacion,
      censado: recycler.censado,
      fechaVinculacion: recycler.createdAt,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="certificado-${recycler.cedula}.pdf"`,
    );
    doc.pipe(res);
    doc.end();
  }
}

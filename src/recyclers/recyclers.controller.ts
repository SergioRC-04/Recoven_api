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
import { ClasificacionRecycler } from '@prisma/client';
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

  // Las cinco dimensiones de filtro son independientes y se combinan
  // entre sí (a diferencia de la antigua pestaña única y excluyente) —
  // se puede filtrar por ruta, censo, clasificación y barrio a la vez.
  @Get()
  findAll(
    @Query('desvinculados') desvinculadosRaw?: string,
    @Query('rutas') rutas?: 'con_ruta' | 'sin_ruta',
    @Query('clasificacion') clasificacion?: ClasificacionRecycler,
    @Query('censado') censadoRaw?: string,
    @Query('barrioId') barrioId?: string,
    @Query('search') search?: string,
  ) {
    const desvinculados = desvinculadosRaw === 'true';
    const censado =
      censadoRaw !== undefined ? censadoRaw === 'true' : undefined;
    return this.recyclersService.findAll({
      desvinculados,
      rutas,
      clasificacion,
      censado,
      barrioId,
      search,
    });
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

  // Agrega una microrruta a las que ya tiene el reciclador, sin
  // reemplazar la lista completa (a diferencia de PUT /recyclers/:id) —
  // usado en el flujo de "¿asignar un trabajador?" justo después de crear
  // una microrruta.
  @Patch(':id/asignar-microrruta')
  asignarMicrorruta(
    @Param('id', ParseIntPipe) id: number,
    @Body('microrrutaId', ParseIntPipe) microrrutaId: number,
  ) {
    return this.recyclersService.asignarMicrorruta(id, microrrutaId);
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

  // De solo lectura — no dispara ninguna regeneración. El frontend la usa
  // para saber la URL vigente al cargar la página, y para sondear
  // (polling) después de crear/editar un reciclador hasta que
  // actualizando pase a false.
  @Get('certificados-estado')
  async certificadosEstado() {
    return this.recyclersService.obtenerEstadoReporteCertificados();
  }

  @Get(':id/certificado')
  async descargarCertificado(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const recycler = await this.recyclersService.findOne(id);
    const doc = generarCertificadoPdf({
      nombreCompleto: recycler.nombreCompleto,
      tipoDocumento: recycler.tipoDocumento,
      cedula: recycler.cedula,
      barrios: recycler.barrios,
      fechaVinculacion: recycler.fechaIngreso,
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

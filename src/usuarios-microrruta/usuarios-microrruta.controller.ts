import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UsuariosMicrorrutaService } from './usuarios-microrruta.service';
import { CreateUsuarioMicrorrutaDto } from './dto/create-usuario-microrruta.dto';
import { UpdateUsuarioMicrorrutaDto } from './dto/update-usuario-microrruta.dto';

// Direcciones y pólizas de las personas atendidas en cada microrruta —
// datos personales, no información pública del mapa, así que a
// diferencia de MicrorrutasController todo el módulo queda detrás del
// guard (mismo criterio que RecyclersController).
@UseGuards(JwtAuthGuard)
@Controller('/usuarios-microrruta')
export class UsuariosMicrorrutaController {
  constructor(
    private readonly usuariosMicrorrutaService: UsuariosMicrorrutaService,
  ) {}

  @Get()
  findAll(
    @Query('microrrutaId') microrrutaId?: string,
    @Query('municipio') municipio?: string,
  ) {
    return this.usuariosMicrorrutaService.findAll({
      microrrutaId: microrrutaId ? Number(microrrutaId) : undefined,
      municipio,
    });
  }

  @Post()
  create(@Body() dto: CreateUsuarioMicrorrutaDto) {
    return this.usuariosMicrorrutaService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioMicrorrutaDto,
  ) {
    return this.usuariosMicrorrutaService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosMicrorrutaService.delete(id);
  }
}

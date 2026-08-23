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
} from '@nestjs/common';
import { RecyclersService } from './recyclers.service';
import { CreateRecyclerDto } from './dto/create-recycler.dto';
import { UpdateRecyclerDto } from './dto/update-recycler.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

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
}

import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PqrsdfService } from './pqrsdf.service';
import { CreatePqrsdfDto } from './dto/create-pqrsdf.dto';
import { SearchPqrsdfDto } from './dto/search-pqrsdf.dto';
import { UpdatePqrsdfStatusDto } from './dto/update-pqrsdf.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pqrsdf')
export class PqrsdfController {
  constructor(private readonly pqrsdfService: PqrsdfService) {}

  // --- ENDPOINTS PÚBLICOS ---

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Body() dto: CreatePqrsdfDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.pqrsdfService.create(dto, file);
  }

  @Post('consultar')
  @HttpCode(HttpStatus.OK)
  searchStatus(@Body() dto: SearchPqrsdfDto) {
    return this.pqrsdfService.searchStatus(dto);
  }

  // --- ENDPOINTS PRIVADOS (PANEL ADMIN) ---

  @UseGuards(JwtAuthGuard)
  @Get('/list')
  findAllAdmin() {
    return this.pqrsdfService.findAllAdmin();
  }

  @UseGuards(JwtAuthGuard)
  @Patch('estado/:id')
  @UseInterceptors(FileInterceptor('file'))
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePqrsdfStatusDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.pqrsdfService.updateStatus(id, dto, file);
  }
}

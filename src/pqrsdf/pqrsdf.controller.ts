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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PqrsdfService } from './pqrsdf.service';
import { CreatePqrsdfDto } from './dto/create-pqrsdf.dto';
import { SearchPqrsdfDto } from './dto/search-pqrsdf.dto';
import { UpdatePqrsdfStatusDto } from './dto/update-pqrsdf.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

const PQRSDF_ALLOWED_MIMETYPES = [
  // Documentos y PDFs
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  // Hojas de cálculo
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // Imágenes
  'image/jpeg',
  'image/png',
  'image/webp',
];

@Controller('pqrsdf')
export class PqrsdfController {
  constructor(private readonly pqrsdfService: PqrsdfService) {}

  // --- ENDPOINTS PÚBLICOS ---

  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
      fileFilter: (req, file, cb) => {
        if (PQRSDF_ALLOWED_MIMETYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `El formato ${file.mimetype} no está permitido. Adjunte PDF, Word, Excel, JPG o PNG.`,
            ),
            false,
          );
        }
      },
    }),
  )
  create(
    @Body() dto: CreatePqrsdfDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.pqrsdfService.create(dto, file);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
      fileFilter: (req, file, cb) => {
        if (PQRSDF_ALLOWED_MIMETYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `El formato ${file.mimetype} no está permitido. Adjunte PDF, Word, Excel, JPG o PNG.`,
            ),
            false,
          );
        }
      },
    }),
  )
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePqrsdfStatusDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.pqrsdfService.updateStatus(id, dto, file);
  }
}

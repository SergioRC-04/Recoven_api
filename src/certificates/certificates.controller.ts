import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CertificatesService } from './certificates.service';
import { UploadCertificateDto } from './dto/upload-certificate.dto';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  // 🔒 Privado/Admin - Subir archivo y disparar el envío inmediato
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCertificate(
    @Body() dto: UploadCertificateDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.certificatesService.uploadAndSend(dto, file);
  }

  // 🔒 Privado/Admin - Obtener el historial completo para rellenar la tabla del panel
  @Get('history')
  async getHistoryLog() {
    return this.certificatesService.getHistory();
  }
}

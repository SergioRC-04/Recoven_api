import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsuariosMicrorrutaService } from './usuarios-microrruta.service';
import { UsuariosMicrorrutaController } from './usuarios-microrruta.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UsuariosMicrorrutaController],
  providers: [UsuariosMicrorrutaService],
})
export class UsuariosMicrorrutaModule {}

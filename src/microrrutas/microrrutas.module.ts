import { Module } from '@nestjs/common';
import { MicrorrutasService } from './microrrutas.service';
import { MicrorrutasController } from './microrrutas.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MicrorrutasController],
  providers: [MicrorrutasService],
})
export class MicrorrutasModule {}

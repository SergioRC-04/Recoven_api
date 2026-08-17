import { Module } from '@nestjs/common';
import { GeoTerritorioController } from './geo-territorio.controller';
import { GeoTerritorioService } from './geo-territorio.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GeoTerritorioController],
  providers: [GeoTerritorioService],
  exports: [GeoTerritorioService],
})
export class GeoTerritorioModule {}

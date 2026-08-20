import { Module } from '@nestjs/common';
import { RecyclersService } from './recyclers.service';
import { RecyclersController } from './recyclers.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RecyclersController],
  providers: [RecyclersService],
})
export class RecyclersModule {}

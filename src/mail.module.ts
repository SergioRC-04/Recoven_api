import { Module } from '@nestjs/common';
import { AppController } from './mail.controller';
import { AppService } from './mail.service';

@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

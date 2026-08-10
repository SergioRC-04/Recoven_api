import { Module } from '@nestjs/common';
import { PqrsdfService } from './pqrsdf.service';
import { PqrsdfController } from './pqrsdf.controller';
import { MailModule } from 'src/mail/mail.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [MailModule],
  controllers: [PqrsdfController],
  providers: [PqrsdfService, PrismaService],
})
export class PqrsdfModule {}

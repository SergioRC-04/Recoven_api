import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: parseInt(process.env.MAIL_PORT || '587'),
        secure: process.env.MAIL_SECURE === 'false',
        auth: {
          user: process.env.MAIL_USER || '',
          pass: process.env.MAIL_PASSWORD || '',
        },
      },
      defaults: {
        from: process.env.MAIL_FROM || 'noreply@recoven.com',
      },
    }),
    PrismaModule,
  ],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

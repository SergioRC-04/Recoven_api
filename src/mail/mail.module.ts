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
        // Usamos base 10 para parsear el puerto correctamente
        port: parseInt(process.env.MAIL_PORT || '587', 10),
        // Si es 'true' (para puerto 465) será true, de lo contrario false (para puerto 587)
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
          user: process.env.MAIL_USER || '',
          pass: process.env.MAIL_PASSWORD || '',
        },
        // 🟢 ESTE ES EL BLINDAJE PARA VERCEL:
        // Evita que el handshake de STARTTLS falle por restricciones de certificados del host
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3', // Compatibilidad extra con servidores SMTP corporativos
        },
      },
      defaults: {
        from: process.env.MAIL_FROM,
      },
    }),
    PrismaModule,
  ],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

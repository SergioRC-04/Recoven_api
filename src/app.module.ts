import { Module } from '@nestjs/common';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { CertificatesModule } from './certificates/certificates.module';

@Module({
  imports: [
    MailModule,
    PrismaModule,
    AnalyticsModule,
    AuthModule,
    CustomersModule,
    CertificatesModule,
  ],
})
export class AppModule {}

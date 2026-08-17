import { Module } from '@nestjs/common';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { CertificatesModule } from './certificates/certificates.module';
import { PqrsdfModule } from './pqrsdf/pqrsdf.module';
import { LeadsModule } from './leads/leads.module';
import { GeoTerritorioModule } from './geo-territorio/geo-territorio.module';

@Module({
  imports: [
    MailModule,
    PrismaModule,
    AnalyticsModule,
    AuthModule,
    CustomersModule,
    CertificatesModule,
    PqrsdfModule,
    LeadsModule,
    GeoTerritorioModule,
  ],
})
export class AppModule {}

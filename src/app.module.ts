import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
    // Límite global por defecto: 60 peticiones/min por IP.
    // Los endpoints sensibles se sobreescriben con @Throttle() en su propio controller.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minuto en ms
        limit: 60,
      },
    ]),
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

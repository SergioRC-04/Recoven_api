import { config } from 'dotenv';
config();

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Necesario para que el ThrottlerGuard identifique la IP real del cliente
  // cuando la app corre detrás de un proxy/CDN (Vercel, etc.)
  app.set('trust proxy', 1);

  // Cabeceras de seguridad HTTP estándar
  app.use(helmet());

  const corsEnv = process.env.CORS_ORIGINS;
  const allowedOrigins = corsEnv ? corsEnv.split(',') : [];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

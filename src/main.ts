import { config } from 'dotenv';
config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Obtenemos el string de la variable de entorno
  const corsEnv = process.env.CORS_ORIGINS;

  // 2. Si existe, lo convertimos en Array con .split(','). Si no existe, usamos local por defecto.
  const allowedOrigins = corsEnv ? corsEnv.split(',') : [];

  // 3. Pasamos el array directamente a la configuración de CORS
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

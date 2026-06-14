import { config } from 'dotenv';
config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Obtenemos el string de la variable de entorno
  const corsEnv = process.env.CORS_ORIGINS;

  // 2. 🟢 BLINDAJE: Si la variable no existe o está vacía, NUNCA dejes el array vacío [].
  // Le asignamos por defecto los entornos locales y de producción para que la app no muera.
  const allowedOrigins =
    corsEnv && corsEnv.trim() !== ''
      ? corsEnv.split(',')
      : ['https://recovenesp.com'];

  // 3. Pasamos el array directamente a la configuración de CORS
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());

  // 4. Hostinger inyecta de forma automática process.env.PORT, lo cual está perfecto aquí
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

import { config } from 'dotenv';
config();

import { NestFactory } from '@nestjs/core';
import { MailModule } from './mail.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(MailModule);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

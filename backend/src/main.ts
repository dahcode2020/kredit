import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Idempotency & requestId interceptor would be global here
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`KREDIT API listening on ${port} — country default BE, EUR`);
}
bootstrap();

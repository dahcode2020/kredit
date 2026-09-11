import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('KREDIT API')
    .setDescription('Plateforme Européenne de Crédit & Investissement — Belgique EUR — FR/EN/NL/DE — Simulation ≠ offre, décision humaine, audit immuable')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Idempotency-Key' }, 'idempotency')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Request-Id' }, 'requestId')
    .addTag('Auth')
    .addTag('Customer')
    .addTag('Credit')
    .addTag('Investments')
    .addTag('Payments')
    .addTag('Notifications')
    .addTag('Admin')
    .addTag('Super Admin')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, { swaggerOptions: { persistAuthorization: true } });
  // JSON at /api/docs-json (auto by SwaggerModule)
  // Also expose at /api/v1/docs-json for spec file
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/docs-json', (req: any, res: any) => res.json(document));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`KREDIT API listening on ${port} — country default BE, EUR — docs at /api/docs`);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as crypto from 'crypto';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", "https:"] } },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  }));
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  // Correlation ID middleware — must be before routes, propagates X-Request-Id
  app.use((req: any, res: any, next: any) => {
    const headerId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    const correlationId = headerId && /^[a-zA-Z0-9\-_]{8,128}$/.test(headerId) ? headerId : crypto.randomUUID();
    req.correlationId = correlationId;
    req.correlation_id = correlationId;
    req.id = correlationId;
    res.setHeader('X-Request-Id', correlationId);
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('KREDIT API')
    .setDescription('Plateforme Européenne de Crédit & Investissement — Belgique EUR — FR/EN/NL/DE — Simulation ≠ offre, décision humaine, audit immuable. Audit hash-chaîné, MFA admin, rate limiting, détection anomalie.')
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
    .addTag('Audit')
    .addTag('Security')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, { swaggerOptions: { persistAuthorization: true } });
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/docs-json', (req: any, res: any) => res.json(document));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`KREDIT API listening on ${port} — country default BE, EUR — docs at /api/docs — audit hash-chaîné, MFA, rate-limit, DR 5m RPO`);
}
bootstrap();

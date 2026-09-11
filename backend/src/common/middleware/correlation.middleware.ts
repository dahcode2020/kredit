import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // X-Request-Id / X-Correlation-Id — trace end-to-end (PWA offline sync idem)
    const headerId = (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string);
    const correlationId = headerId && /^[a-zA-Z0-9\-_]{8,128}$/.test(headerId) ? headerId : crypto.randomUUID();
    (req as any).correlationId = correlationId;
    (req as any).id = correlationId;
    res.setHeader('X-Request-Id', correlationId);
    res.setHeader('X-Correlation-Id', correlationId);
    // Security: IP & UA déjà disponibles via req.ip / req.headers['user-agent']
    next();
  }
}

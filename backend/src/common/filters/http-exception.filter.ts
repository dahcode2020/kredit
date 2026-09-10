import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(ex: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const status = ex.getStatus();
    res.status(status).json({ statusCode: status, message: ex.message, requestId: req.id, timestamp: new Date().toISOString() });
  }
}

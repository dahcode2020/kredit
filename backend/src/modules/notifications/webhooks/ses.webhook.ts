import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
@Controller('webhooks/ses')
export class SesWebhookController {
  logger = new Logger(SesWebhookController.name);
  @Post()
  async handle(@Req() req: Request, @Res() res: Response) {
    // SNS -> { Type, Message: JSON { eventType: 'Delivery'|'Bounce'|'Complaint', mail:{ messageId }, delivery|bounce } }
    this.logger.log(`SES webhook ${JSON.stringify(req.body).slice(0,400)}`);
    // TODO: update outbox status DELIVERED/BOUNCED, provider_ref=messageId
    return res.sendStatus(200);
  }
}

import { Controller, Get, Post, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private logger = new Logger(WhatsappWebhookController.name);
  // Vérification GET hub.verify_token (Meta)
  @Get()
  verify(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      this.logger.log('WhatsApp webhook verified');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  @Post()
  async handle(@Req() req: Request, @Res() res: Response) {
    // Vérifie signature X-Hub-Signature-256
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const raw = (req as any).rawBody ?? JSON.stringify(req.body);
    if (signature && process.env.WHATSAPP_APP_SECRET) {
      const expected = 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(raw).digest('hex');
      if (signature !== expected) {
        this.logger.warn('WhatsApp signature mismatch');
        return res.sendStatus(401);
      }
    }
    const payload = req.body;
    // payload.entry[0].changes[0].value.statuses: [{ id, status: 'sent'|'delivered'|'read'|'failed', timestamp }]
    // On met à jour notification_outbox.status + delivered_at/read_at + idempotence provider_ref
    this.logger.log(`WhatsApp webhook ${JSON.stringify(payload).slice(0,400)}`);
    // TODO: upsert notification_webhooks + update outbox
    // idempotence: provider_ref unique
    return res.sendStatus(200);
  }
}

import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationTemplatesController, NotificationsPublicController } from './notifications.controller';
import { WhatsappWebhookController } from './webhooks/whatsapp.webhook';
import { SesWebhookController } from './webhooks/ses.webhook';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';
import { PushChannel } from './channels/push.channel';
import { NotificationsQueue } from './queues/notifications.queue';
import { DispatcherWorker } from './workers/dispatcher.worker';
import { I18nModule } from '../../i18n/i18n.module';

@Module({
  imports: [I18nModule],
  controllers: [NotificationTemplatesController, NotificationsPublicController, WhatsappWebhookController, SesWebhookController],
  providers: [NotificationsService, EmailChannel, SmsChannel, WhatsappChannel, PushChannel, NotificationsQueue, DispatcherWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}

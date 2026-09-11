import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentsController, PaymentWebhooksController, AdminPaymentsController } from './payments.controller';
import { MollieProvider } from './providers/mollie.provider';
import { StripeProvider } from './providers/stripe.provider';
import { AdminConfirmProvider } from './providers/admin-confirm.provider';

@Module({
  controllers: [PaymentsController, PaymentWebhooksController, AdminPaymentsController],
  providers: [
    MollieProvider, StripeProvider, AdminConfirmProvider,
    {
      provide: 'PaymentProvider',
      useFactory: (cfg: ConfigService, mollie: MollieProvider, stripe: StripeProvider, admin: AdminConfirmProvider) => {
        const p = (cfg.get('PAYMENT_PROVIDER') ?? process.env.PAYMENT_PROVIDER ?? 'mollie').toLowerCase();
        if (p === 'stripe') return stripe;
        if (p === 'admin-confirm' || p === 'admin') return admin;
        return mollie;
      },
      inject: [ConfigService, MollieProvider, StripeProvider, AdminConfirmProvider],
    },
    PaymentService,
    PaymentWebhookService,
    PaymentReconciliationService,
  ],
  exports: [PaymentService, PaymentWebhookService, PaymentReconciliationService],
})
export class PaymentsModule {}

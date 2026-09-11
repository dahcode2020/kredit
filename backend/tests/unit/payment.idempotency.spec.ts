/**
 * Paiements — idempotence, retry, webhook double, jamais paid sans webhook
 * Sans DB: PaymentService en mémoire + PaymentProvider mock
 */
class MockProvider {
  name = 'MOCK';
  calls = 0;
  nextId = 0;
  failNext = 0; // nb fails before success (500)
  async createPayment(dto:any) {
    this.calls++;
    if (this.failNext > 0) { this.failNext--; const e:any = new Error('provider 500'); e.status=500; throw e; }
    return { providerPaymentId: `prov_${++this.nextId}`, checkoutUrl: `https://checkout.mock/${this.nextId}` };
  }
}

import { PaymentService } from '../../src/modules/payments/payment.service';

describe('PaymentService — idempotence & webhooks', () => {
  function make() {
    const provider = new MockProvider();
    const svc = new PaymentService(provider as any);
    return { svc, provider };
  }

  it('create idempotent: même Idempotency-Key → même Payment (single provider call)', async () => {
    const { svc, provider } = make();
    const key = 'idem-uuid-1';
    const dto = { loanId:'loan1', customerId:'cust1', amount:338.62, currency:'EUR', idempotencyKey:key };
    const r1 = await svc.create(dto);
    const r2 = await svc.create(dto);
    expect(r1.payment.id).toBe(r2.id ?? r2.payment?.id ?? r2.id); // second returns same object
    // le service log hit et ne rappelle pas provider
    expect(provider.calls).toBe(1);
  });

  it('deux clés différentes → deux payments distincts', async () => {
    const { svc } = make();
    const r1 = await svc.create({ loanId:'loan1', customerId:'cust1', amount:100, idempotencyKey:'k1' });
    const r2 = await svc.create({ loanId:'loan1', customerId:'cust1', amount:100, idempotencyKey:'k2' });
    expect(r1.payment.id).not.toBe(r2.payment.id);
  });

  it('retry 3× sur 500 puis success', async () => {
    const { svc, provider } = make();
    provider.failNext = 2;
    const res = await svc.create({ loanId:'loan1', customerId:'cust1', amount:100, idempotencyKey:'retry-1' });
    expect(res.payment.status).toBe('PROCESSING');
    expect(provider.calls).toBe(3); // 2 fails +1 success
  });

  it('retry échoue après 3× → FAILED', async () => {
    const { svc, provider } = make();
    provider.failNext = 5;
    await expect(svc.create({ loanId:'loan1', customerId:'cust1', amount:100, idempotencyKey:'retry-fail' })).rejects.toBeDefined();
    const p = await svc.getById((await svc['byIdemp'].get('retry-fail'))?.id ?? 'pay_x');
    // si not found due hash, at least first payment marked FAILED via catch?
    // Dans PaymentService, payment.status=FAILED avant throw — vérifier
    const stored = (svc as any).byIdemp.get('retry-fail');
    expect(stored.status).toBe('FAILED');
  });

  it('markSucceeded idempotent: webhook ×2 → même status SUCCEEDED', async () => {
    const { svc } = make();
    const { payment } = await svc.create({ loanId:'loan1', customerId:'cust1', amount:100, idempotencyKey:'webhook-x2' });
    const provId = payment.provider_payment_id;
    const after1 = await svc.markSucceeded(payment.id, provId, { raw:'first' });
    expect(after1.status).toBe('SUCCEEDED');
    const after2 = await svc.markSucceeded(payment.id, provId, { raw:'second' });
    expect(after2.status).toBe('SUCCEEDED');
    expect(after1).toBe(after2); // same ref
  });

  it('jamais SUCCEEDED sans webhook/confirm: création reste PROCESSING', async () => {
    const { svc } = make();
    const { payment } = await svc.create({ loanId:'loan2', customerId:'cust1', amount:200, idempotencyKey:'no-webhook' });
    expect(payment.status).toBe('PROCESSING');
    expect(payment.status).not.toBe('SUCCEEDED');
    // get doit encore être PROCESSING
    const fetched = await svc.getById(payment.id);
    expect(fetched.status).toBe('PROCESSING');
  });

  it('findByProviderId retrouve payment pour webhook routage', async () => {
    const { svc } = make();
    const { payment } = await svc.create({ loanId:'loan1', customerId:'cust1', amount:100, idempotencyKey:'byprov' });
    const found = await svc.findByProviderId(payment.provider_payment_id);
    expect(found.id).toBe(payment.id);
  });

  it('double webhook concurrent: second déjà SUCCEEDED -> idempotent', async () => {
    const { svc } = make();
    const { payment } = await svc.create({ loanId:'loan', customerId:'c', amount:50, idempotencyKey:'concurrent-webhook' });
    await Promise.all([
      svc.markSucceeded(payment.id, payment.provider_payment_id, {}),
      svc.markSucceeded(payment.id, payment.provider_payment_id, {}),
    ]);
    const p = await svc.getById(payment.id);
    expect(p.status).toBe('SUCCEEDED');
  });
});

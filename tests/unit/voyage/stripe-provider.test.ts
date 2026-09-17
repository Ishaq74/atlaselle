import { describe, expect, it, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  mockPaymentIdForSession,
  mockProvider,
  stripeProvider,
  verifyStripeSignature,
} from '@/modules/payments/domain/providers';

const SECRET = 'whsec_test_123';

function sign(raw: string, t: number, secret = SECRET): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${raw}`, 'utf8').digest('hex');
  return `t=${t},v1=${v1}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe('verifyStripeSignature', () => {
  it('accepts a fresh valid signature', () => {
    const raw = JSON.stringify({ id: 'evt_1', type: 'charge.refunded', data: { object: {} } });
    const t = Math.floor(Date.now() / 1000);
    expect(() => verifyStripeSignature(raw, sign(raw, t), SECRET)).not.toThrow();
  });

  it('rejects missing, expired and forged signatures', () => {
    const raw = JSON.stringify({ id: 'evt_1' });
    const t = Math.floor(Date.now() / 1000);
    expect(() => verifyStripeSignature(raw, null, SECRET)).toThrow(/manquante/);
    expect(() => verifyStripeSignature(raw, sign(raw, t - 400), SECRET)).toThrow(/expirée/);
    expect(() => verifyStripeSignature(raw, sign(raw, t, 'whsec_other'), SECRET)).toThrow(/invalide/);
  });
});

describe('mock provider', () => {
  it('is deterministic per idempotency key', async () => {
    const a = await mockProvider.createCheckoutSession({
      amount: 100, currency: 'EUR', idempotencyKey: 'k1', reservationId: 'r1',
      customerEmail: 't@t.com', successUrl: 'https://x/s', cancelUrl: 'https://x/c',
    });
    const b = await mockProvider.createCheckoutSession({
      amount: 100, currency: 'EUR', idempotencyKey: 'k1', reservationId: 'r1',
      customerEmail: 't@t.com', successUrl: 'https://x/s', cancelUrl: 'https://x/c',
    });
    expect(a.providerSessionId).toBe(b.providerSessionId);
    expect(a.checkoutUrl).toContain('/api/payments/mock-callback?session=');
    expect(mockPaymentIdForSession(a.providerSessionId)).toMatch(/^mock_pi_/);
  });

  it('parses success and failure payloads', async () => {
    const ok = await mockProvider.verifyWebhook(JSON.stringify({ providerPaymentId: 'mock_pi_x', amount: 100, currency: 'EUR', idempotencyKey: 'k' }), null);
    expect(ok.outcome).toBe('checkout.completed');
    const ko = await mockProvider.verifyWebhook(JSON.stringify({ providerPaymentId: 'mock_pi_x', amount: 100, currency: 'EUR', failed: true }), null);
    expect(ko.outcome).toBe('payment.failed');
    await expect(mockProvider.verifyWebhook(JSON.stringify({ nope: 1 }), null)).rejects.toThrow();
  });

  it('builds deterministic refund ids', async () => {
    const { providerRefundId } = await mockProvider.createRefund({ providerPaymentId: 'mock_pi_abc', idempotencyKey: 'k' });
    expect(providerRefundId).toBe('mock_re_abc');
  });
});

describe('stripe provider (fetch stubbed, no network)', () => {
  it('creates checkout sessions with idempotency metadata', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' }), { status: 200 });
    }));
    const session = await stripeProvider.createCheckoutSession({
      amount: 389000, currency: 'EUR', idempotencyKey: 'idem-1', reservationId: 'res-1',
      customerEmail: 't@t.com', successUrl: 'https://site/success', cancelUrl: 'https://site/cancel',
    });
    expect(session).toEqual({ providerSessionId: 'cs_test_1', checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_1' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.stripe.com/v1/checkout/sessions');
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('389000');
    expect(body.get('metadata[idempotency_key]')).toBe('idem-1');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
  });

  it('parses checkout.session.completed with amounts', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_intent: 'pi_1', amount_total: 75000, currency: 'eur', metadata: { idempotency_key: 'idem-9' } } },
    });
    const event = await stripeProvider.verifyWebhook(raw, sign(raw, Math.floor(Date.now() / 1000)));
    expect(event).toMatchObject({ outcome: 'checkout.completed', providerPaymentId: 'pi_1', amount: 75000, currency: 'EUR', idempotencyKey: 'idem-9' });
  });

  it('rejects unhandled event types with a typed error', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ type: 'customer.created', data: { object: {} } });
    await expect(stripeProvider.verifyWebhook(raw, sign(raw, Math.floor(Date.now() / 1000)))).rejects.toThrow(/Unhandled Stripe event/);
  });
});

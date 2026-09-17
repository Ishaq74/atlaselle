import { describe, expect, it } from 'vitest';
import { selectPaymentProvider, mockProvider, UnhandledWebhookError } from '@/modules/payments/domain/providers';
import { loadTripPage, loadTripsList } from '@/modules/trips/loaders/trip.loader';
import { loadAdminTrips, listTripRevisions } from '@/modules/trips/loaders/admin-trips.loader';
import { loadOpenDepartures } from '@/modules/departures/loaders/departure.loader';

describe('providers — select et mock', () => {
  it('default mock, stripe lower, inconnu -> mock', () => {
    const prev = process.env.PAYMENT_PROVIDER;
    delete process.env.PAYMENT_PROVIDER;
    expect(selectPaymentProvider().name).toBe('mock');
    process.env.PAYMENT_PROVIDER = 'STRIPE';
    expect(selectPaymentProvider().name).toBe('stripe');
    process.env.PAYMENT_PROVIDER = 'nope';
    expect(selectPaymentProvider().name).toBe('mock');
    if (prev === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = prev;
  });
  it('mock déterministe même clé', async () => {
    const input = { amount: 1000, currency: 'EUR', idempotencyKey: 'k1', reservationId: 'r1', customerEmail: 't@t.com', successUrl: 's', cancelUrl: 'c' };
    const a = await mockProvider.createCheckoutSession(input);
    const b = await mockProvider.createCheckoutSession(input);
    expect(a.providerSessionId).toBe(b.providerSessionId);
    expect(a.checkoutUrl).toContain(a.providerSessionId);
  });
  it('UnhandledWebhookError message', () => {
    expect(new UnhandledWebhookError('x').message).toContain('x');
    expect(new UnhandledWebhookError('').message).toContain('unknown');
  });
});

describe('trip.loader — cas nuls', () => {
  it('locale invalide, slug inconnu, liste locale invalide', async () => {
    expect(await loadTripPage('xx' as never, 'whatever')).toBeNull();
    expect(await loadTripPage('en', 'does-not-exist-xyz-123')).toBeNull();
    expect(await loadTripsList('xx' as never)).toEqual([]);
  });
});

describe('admin-trips — pagination, tri, recherche', () => {
  it('page/offset, sort, search slug, total', async () => {
    const p1 = await loadAdminTrips({ page: '1', pageSize: '1' });
    expect(p1.meta.total).toBeGreaterThanOrEqual(0);
    expect(p1.rows.length).toBeLessThanOrEqual(1);
    const sorted = await loadAdminTrips({ sortBy: 'createdAt', sortOrder: 'asc', pageSize: '5' });
    expect(sorted.rows.length).toBeLessThanOrEqual(5);
    const none = await loadAdminTrips({ search: 'zzz-no-match-zzz' });
    expect(none.rows).toEqual([]);
    expect(none.meta.total).toBe(0);
    expect(await listTripRevisions('no-trip')).toEqual([]);
  });
});

describe('departure.loader — exclusions', () => {
  it('trip inconnu -> []', async () => {
    expect(await loadOpenDepartures('no-such-trip')).toEqual([]);
  });
});

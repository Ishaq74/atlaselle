import { describe, expect, it } from 'vitest';
import { computeLine, priceQuote, pricingRulesSchema, subtractCalendarMonths, type PricingInput } from '@/modules/pricing/domain/pricing';
import { availableSeats, canHold, isHoldActive, isLastSeats, SCARCITY_THRESHOLD } from '@/modules/availability/domain/availability';
import { canClaimTraveler, normalizeEmail, resolveEmailConflict } from '@/modules/travelers/domain/traveler-email';

const base: PricingInput = {
  priceAmount: 389000,
  currency: 'EUR',
  depositType: 'fixed',
  depositAmount: 75000,
  depositPercent: 0,
  singleSupplementType: 'fixed',
  singleSupplementAmount: 45000,
  taxType: 'none',
  taxAmount: 0,
  feeType: 'none',
  feeAmount: 0,
  discountType: 'none',
  discountAmount: 0,
  roomType: 'shared',
};

describe('computeLine', () => {
  it('handles fixed, percent and none', () => {
    expect(computeLine('fixed', 5000, 0, 100000)).toBe(5000);
    expect(computeLine('percent', 0, 20, 100000)).toBe(20000);
    expect(computeLine('none', 5000, 20, 100000)).toBe(0);
  });

  it('never returns negative amounts', () => {
    expect(computeLine('fixed', -100, 0, 1000)).toBe(0);
  });
});

describe('priceQuote (TODO §12.2, centimes)', () => {
  it('quotes shared room with fixed deposit', () => {
    const q = priceQuote(base);
    expect(q.totalAmount).toBe(389000);
    expect(q.depositAmount).toBe(75000);
    expect(q.balanceAmount).toBe(314000);
    expect(q.currency).toBe('EUR');
  });

  it('adds single supplement only for single rooms', () => {
    expect(priceQuote({ ...base, roomType: 'single' }).totalAmount).toBe(434000);
  });

  it('applies percent deposit and caps it at total', () => {
    const q = priceQuote({ ...base, depositType: 'percent', depositAmount: 0, depositPercent: 30 });
    expect(q.depositAmount).toBe(Math.round(389000 * 0.3));
    const over = priceQuote({ ...base, depositType: 'percent', depositAmount: 0, depositPercent: 200 });
    expect(over.depositAmount).toBe(over.totalAmount);
  });

  it('applies early-bird pricing rules', () => {
    const q = priceQuote({ ...base, pricingRules: { earlyBirdPercent: 10 } });
    expect(q.discountAmount).toBe(38900);
    expect(q.totalAmount).toBe(350100);
  });
});

describe('subtractCalendarMonths (early bird, clamp calendrier)', () => {
  it('clamp au dernier jour du mois (31 janv − 1 mois → 28/29 févr)', () => {
    expect(subtractCalendarMonths(new Date('2027-03-31T00:00:00Z'), 1)?.toISOString()).toBe('2027-02-28T00:00:00.000Z');
    expect(subtractCalendarMonths(new Date('2028-03-31T00:00:00Z'), 1)?.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('soustrait les mois pleins', () => {
    expect(subtractCalendarMonths(new Date('2027-06-15T00:00:00Z'), 4)?.toISOString()).toBe('2027-02-15T00:00:00.000Z');
  });

  it('fail-closed : départ absent ou invalide → null', () => {
    expect(subtractCalendarMonths(null, 4)).toBeNull();
    expect(subtractCalendarMonths(undefined, 4)).toBeNull();
    expect(subtractCalendarMonths('pas-une-date', 4)).toBeNull();
  });
});

describe('early bird — fenêtre (mois/absolue), montant fixe, paiement intégral', () => {
  const depStartDate = new Date('2027-06-15T00:00:00Z');

  it('borne relative inclusive : actif à la date limite, expiré juste après', () => {
    const now = new Date('2027-02-15T00:00:00Z');
    const active = priceQuote({ ...base, startDate: depStartDate, pricingRules: { earlyBirdPercent: 10, earlyBirdMonths: 4 } }, { now });
    expect(active.earlyBird?.active).toBe(true);
    expect(active.earlyBird?.until).toBe('2027-02-15T00:00:00.000Z');
    expect(active.discountAmount).toBe(38900);
    expect(active.depositAmount).toBe(75000); // % seul : l'acompte reste paramétré
    const expired = priceQuote({ ...base, startDate: depStartDate, pricingRules: { earlyBirdPercent: 10, earlyBirdMonths: 4 } }, { now: new Date('2027-02-15T00:00:01Z') });
    expect(expired.earlyBird?.active).toBe(false);
    expect(expired.earlyBird?.discountAmount).toBe(0);
    expect(expired.discountAmount).toBe(0);
  });

  it('fail-closed : months défini sans startDate → jamais de remise', () => {
    const q = priceQuote({ ...base, pricingRules: { earlyBirdPercent: 10, earlyBirdMonths: 4 } }, { now: new Date('2027-01-01T00:00:00Z') });
    expect(q.earlyBird?.active).toBe(false);
    expect(q.discountAmount).toBe(0);
  });

  it('intersection des bornes : before et months se cumulent en la plus restrictive', () => {
    const rules = { earlyBirdPercent: 10, earlyBirdMonths: 4, earlyBirdBefore: '2027-01-01' };
    const jan = priceQuote({ ...base, startDate: depStartDate, pricingRules: rules }, { now: new Date('2027-01-01T00:00:00Z') });
    expect(jan.earlyBird?.active).toBe(true);
    expect(jan.earlyBird?.until).toBe('2027-01-01T00:00:00.000Z');
    // Après la borne absolue mais encore avant le cutoff relatif → inactif.
    const feb = priceQuote({ ...base, startDate: depStartDate, pricingRules: rules }, { now: new Date('2027-02-01T00:00:00Z') });
    expect(feb.earlyBird?.active).toBe(false);
    expect(feb.discountAmount).toBe(0);
  });

  it('remise fixe active la fenêtre, exclusive avec le % (Zod)', () => {
    const q = priceQuote({ ...base, startDate: depStartDate, pricingRules: { earlyBirdAmountFixed: 15000, earlyBirdMonths: 4 } }, { now: new Date('2027-02-01T00:00:00Z') });
    expect(q.earlyBird?.active).toBe(true);
    expect(q.earlyBird?.discountAmount).toBe(15000);
    expect(q.discountAmount).toBe(15000);
    expect(q.totalAmount).toBe(374000);
    expect(() => pricingRulesSchema.parse({ earlyBirdPercent: 10, earlyBirdAmountFixed: 15000 })).toThrow();
  });

  it('paiement intégral : acompte écrasé au total quand la fenêtre est active', () => {
    const rules = { earlyBirdPercent: 10, earlyBirdMonths: 4, earlyBirdFullPayment: true };
    const q = priceQuote({ ...base, startDate: depStartDate, pricingRules: rules }, { now: new Date('2027-01-01T00:00:00Z') });
    expect(q.earlyBird?.active).toBe(true);
    expect(q.earlyBird?.fullPayment).toBe(true);
    expect(q.totalAmount).toBe(350100);
    expect(q.depositAmount).toBe(350100); // acompte fixe 75000 écrasé
    expect(q.balanceAmount).toBe(0);
    // Fenêtre expirée → chemin acompte normal, même si fullPayment reste paramétré.
    const late = priceQuote({ ...base, startDate: depStartDate, pricingRules: rules }, { now: new Date('2027-05-01T00:00:00Z') });
    expect(late.earlyBird?.active).toBe(false);
    expect(late.earlyBird?.fullPayment).toBe(false);
    expect(late.depositAmount).toBe(75000);
  });

  it('fixed 0 sans % : paiement intégral sans remise (option admin)', () => {
    const q = priceQuote({ ...base, startDate: depStartDate, pricingRules: { earlyBirdAmountFixed: 0, earlyBirdMonths: 4, earlyBirdFullPayment: true } }, { now: new Date('2027-01-01T00:00:00Z') });
    expect(q.earlyBird?.active).toBe(true);
    expect(q.earlyBird?.discountAmount).toBe(0);
    expect(q.discountAmount).toBe(0);
    expect(q.depositAmount).toBe(q.totalAmount);
  });

  it('compat : earlyBirdBefore invalide → applique quand même (historique)', () => {
    const q = priceQuote({ ...base, pricingRules: { earlyBirdPercent: 10, earlyBirdBefore: 'pas-une-date' } }, { now: new Date('2027-06-01T00:00:00Z') });
    expect(q.discountAmount).toBe(38900);
  });
});

describe('availability math (TODO §10)', () => {
  it('computes available seats', () => {
    expect(availableSeats({ capacityMax: 14, confirmedSeats: 8, heldSeats: 2 })).toBe(4);
    expect(availableSeats({ capacityMax: 14, confirmedSeats: 14, heldSeats: 0 })).toBe(0);
  });

  it('refuses overbooking', () => {
    expect(canHold({ capacityMax: 14, confirmedSeats: 13, heldSeats: 0 }, 2)).toBe(false);
    expect(canHold({ capacityMax: 14, confirmedSeats: 13, heldSeats: 0 }, 1)).toBe(true);
    expect(canHold({ capacityMax: 14, confirmedSeats: 0, heldSeats: 0 }, 0)).toBe(false);
  });

  it('ignores expired holds', () => {
    const now = new Date('2027-01-01T12:00:00Z');
    expect(isHoldActive({ status: 'active', expiresAt: new Date('2027-01-01T12:30:00Z') }, now)).toBe(true);
    expect(isHoldActive({ status: 'active', expiresAt: new Date('2027-01-01T11:59:00Z') }, now)).toBe(false);
    expect(isHoldActive({ status: 'released', expiresAt: new Date('2027-01-01T12:30:00Z') }, now)).toBe(false);
  });
});

describe('isLastSeats (rareté marketing, bandeau urgence)', () => {
  it('urgence seulement à 1 ou 2 places restantes', () => {
    expect(isLastSeats(2)).toBe(true);
    expect(isLastSeats(1)).toBe(true);
  });

  it('pas de bandeau au-dessus du seuil ni au complet', () => {
    expect(isLastSeats(3)).toBe(false);
    expect(isLastSeats(14)).toBe(false);
    expect(isLastSeats(0)).toBe(false);
  });

  it('seuil = 2', () => {
    expect(SCARCITY_THRESHOLD).toBe(2);
  });

  it('entrées non valides -> false', () => {
    expect(isLastSeats(-1)).toBe(false);
    expect(isLastSeats(1.5)).toBe(false);
    expect(isLastSeats(Number.NaN)).toBe(false);
  });
});

describe('traveler email (TODO §11.1)', () => {
  it('normalizes emails', () => {
    expect(normalizeEmail('  Voyage@Example.COM ')).toBe('voyage@example.com');
  });

  it('reuses verified travelers, conflicts otherwise', () => {
    expect(resolveEmailConflict(null)).toBeNull();
    expect(resolveEmailConflict({ id: 't1', emailVerifiedAt: new Date() })).toEqual({ action: 'reuse', travelerId: 't1' });
    expect(resolveEmailConflict({ id: 't1', emailVerifiedAt: null })).toEqual({
      action: 'conflict',
      code: 'APPLICATION_EMAIL_CONFLICT',
    });
  });

  it('claims a pre-auth or own-account traveler when a verified account proves the email', () => {
    // Dossier fantôme pré-authentification : réclamable par un compte vérifié.
    expect(canClaimTraveler({ userId: null }, 'user-1')).toBe(true);
    // Dossier déjà rattaché au même compte : réclamable.
    expect(canClaimTraveler({ userId: 'user-1' }, 'user-1')).toBe(true);
    // Rattaché à un AUTRE compte : jamais (protection anti-spam).
    expect(canClaimTraveler({ userId: 'user-2' }, 'user-1')).toBe(false);
    // Sans preuve (anonyme) : jamais — null comme undefined.
    expect(canClaimTraveler({ userId: null }, null)).toBe(false);
    expect(canClaimTraveler({ userId: null }, undefined)).toBe(false);
  });
});

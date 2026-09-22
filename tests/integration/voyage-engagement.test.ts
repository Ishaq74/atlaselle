import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// `astro:actions` is a virtual module resolved only by the Astro build pipeline.
vi.mock('astro:actions', () => {
  class ActionError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  }
  return { ActionError, defineAction: (def: any) => def };
});

import { and, eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips, tripFavorites, tripReactions } from '@database/schemas/trips.schema';
import { user } from '@database/schemas';
import { resetRateLimiter } from '@/lib/rate-limit';
import { toggleTripFavorite, toggleTripReaction } from '@/actions/voyage/engagement';
import { hasVoyagePermission } from '@/actions/voyage/_helpers';
import { getTestHelpers } from '../helpers/auth';

const toggleFav = (toggleTripFavorite as any).handler as (i: any, c: any) => Promise<any>;
const toggleReact = (toggleTripReaction as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-eng-trip-${stamp}`;
const TRIP_DRAFT = `test-eng-draft-${stamp}`;
const UNKNOWN_TRIP = `test-eng-unknown-${stamp}`;

const anonCtx = () =>
  ({
    locals: { user: null },
    request: { headers: new Headers(), url: 'http://localhost:4321/en/trips/x' },
    clientAddress: '127.0.0.1',
  }) as any;

const userCtx = (userId: string, email: string, banned = false) =>
  ({
    locals: { user: { id: userId, role: 'user', email, emailVerified: true, banned } },
    request: { headers: new Headers({ 'user-agent': 'vitest' }), url: 'http://localhost:4321/en/trips/x' },
    clientAddress: '127.0.0.1',
  }) as any;

const favoritesOf = (userId: string) =>
  db.select().from(tripFavorites).where(and(eq(tripFavorites.tripId, TRIP), eq(tripFavorites.userId, userId)));
const reactionsOf = (userId: string) =>
  db.select().from(tripReactions).where(and(eq(tripReactions.tripId, TRIP), eq(tripReactions.userId, userId)));

describe('Voyage engagement actions (real DB)', () => {
  let userId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;
  const email = `eng-${stamp}@test.com`;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const saved = await helpers.saveUser(helpers.createUser({ email, name: 'Eng User', emailVerified: true }));
    userId = saved.id;
    // Rôle explicite : userRole porte trip:engage (et pas trip:read).
    await db.update(user).set({ role: 'user' }).where(eq(user.id, userId));
    await insertTestTrip(db, [
      { id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
        durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8, difficulty: 'easy', difficultyLevel: 2 },
      { id: TRIP_DRAFT, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
        durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8, difficulty: 'easy', difficultyLevel: 2 },
    ]);
  });

  afterAll(async () => {
    // trip_favorites / trip_reactions : ON DELETE CASCADE via trips + user.
    await db.delete(trips).where(eq(trips.id, TRIP));
    await db.delete(trips).where(eq(trips.id, TRIP_DRAFT));
    await helpers.deleteUser(userId).catch(() => {});
    invalidateCache();
  });

  beforeEach(() => resetRateLimiter());

  it('rejects anonymous visitors (UNAUTHORIZED)', async () => {
    await expect(toggleFav({ tripId: TRIP }, anonCtx())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(toggleReact({ tripId: TRIP, reactionType: 'LIKE' }, anonCtx())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects banned accounts (FORBIDDEN)', async () => {
    await expect(toggleFav({ tripId: TRIP }, userCtx(userId, email, true))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('grants trip:engage to a plain verified user, but not trip:read', async () => {
    // userRole : trip:['engage'] uniquement — un compte normal peut favori/réagir,
    // sans accéder aux surfaces de lecture admin (trip:read).
    await expect(hasVoyagePermission(userCtx(userId, email), { trip: ['engage'] })).resolves.toBe(true);
    await expect(hasVoyagePermission(userCtx(userId, email), { trip: ['read'] })).resolves.toBe(false);
  });

  it('toggleTripFavorite flips ON then OFF with persisted state', async () => {
    await expect(toggleFav({ tripId: TRIP }, userCtx(userId, email))).resolves.toEqual({ active: true });
    expect(await favoritesOf(userId)).toHaveLength(1);

    await expect(toggleFav({ tripId: TRIP }, userCtx(userId, email))).resolves.toEqual({ active: false });
    expect(await favoritesOf(userId)).toHaveLength(0);
  });

  it('toggleTripFavorite double-toggle is idempotent (net zero)', async () => {
    await toggleFav({ tripId: TRIP }, userCtx(userId, email));
    await toggleFav({ tripId: TRIP }, userCtx(userId, email));
    expect(await favoritesOf(userId)).toHaveLength(0);
  });

  it('toggleTripReaction switches type (upsert) and removes on repeat', async () => {
    await expect(toggleReact({ tripId: TRIP, reactionType: 'LIKE' }, userCtx(userId, email))).resolves.toEqual({ active: 'LIKE' });
    expect((await reactionsOf(userId)).map((r) => r.reactionType)).toEqual(['LIKE']);

    // Changement de réaction : une seule ligne, type mis à jour (onConflict upsert).
    await expect(toggleReact({ tripId: TRIP, reactionType: 'LOVE' }, userCtx(userId, email))).resolves.toEqual({ active: 'LOVE' });
    const rows = await reactionsOf(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].reactionType).toBe('LOVE');

    // Même réaction une seconde fois = retrait (idempotence du double-toggle).
    await expect(toggleReact({ tripId: TRIP, reactionType: 'LOVE' }, userCtx(userId, email))).resolves.toEqual({ active: null });
    expect(await reactionsOf(userId)).toHaveLength(0);
  });

  it('rejects unknown and unpublished trips (NOT_FOUND)', async () => {
    await expect(toggleFav({ tripId: UNKNOWN_TRIP }, userCtx(userId, email))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(toggleFav({ tripId: TRIP_DRAFT }, userCtx(userId, email))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(toggleReact({ tripId: TRIP_DRAFT, reactionType: 'FIRE' }, userCtx(userId, email))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

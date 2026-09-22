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

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips, tripReports } from '@database/schemas/trips.schema';
import { user } from '@database/schemas';
import { resetRateLimiter } from '@/lib/rate-limit';
import { createTripReport } from '@/actions/voyage/engagement';
import { resolveTripReport } from '@/actions/voyage/moderation';
import { getTestHelpers } from '../helpers/auth';

const report = (createTripReport as any).handler as (i: any, c: any) => Promise<any>;
const resolveReport = (resolveTripReport as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-mod-trip-${stamp}`;
const TRIP_DRAFT = `test-mod-draft-${stamp}`;
const UNKNOWN_TRIP = `test-mod-unknown-${stamp}`;

const anonCtx = () =>
  ({
    locals: { user: null },
    request: { headers: new Headers(), url: 'http://localhost:4321/en/trips/x' },
    clientAddress: '127.0.0.1',
  }) as any;

const userCtx = (userId: string, email: string, role = 'user') =>
  ({
    locals: { user: { id: userId, role, email, emailVerified: true, banned: false } },
    request: { headers: new Headers({ 'user-agent': 'vitest' }), url: 'http://localhost:4321/en/trips/x' },
    clientAddress: '127.0.0.1',
  }) as any;

describe('Voyage moderation actions (real DB)', () => {
  let reporterId: string;
  let editorId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;
  const reporterEmail = `mod-reporter-${stamp}@test.com`;
  const editorEmail = `mod-editor-${stamp}@test.com`;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const reporter = await helpers.saveUser(helpers.createUser({ email: reporterEmail, name: 'Reporter', emailVerified: true }));
    reporterId = reporter.id;
    await db.update(user).set({ role: 'user' }).where(eq(user.id, reporterId));
    const editor = await helpers.saveUser(helpers.createUser({ email: editorEmail, name: 'Editor', emailVerified: true }));
    editorId = editor.id;
    // editorRole porte trip:moderate (contrairement à userRole).
    await db.update(user).set({ role: 'editor' }).where(eq(user.id, editorId));
    await insertTestTrip(db, [
      { id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
        durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8, difficulty: 'easy', difficultyLevel: 2 },
      { id: TRIP_DRAFT, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
        durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8, difficulty: 'easy', difficultyLevel: 2 },
    ]);
  });

  afterAll(async () => {
    // trip_reports : ON DELETE CASCADE via trips, reporter_id SET NULL via user.
    await db.delete(trips).where(eq(trips.id, TRIP));
    await db.delete(trips).where(eq(trips.id, TRIP_DRAFT));
    await helpers.deleteUser(reporterId).catch(() => {});
    await helpers.deleteUser(editorId).catch(() => {});
    invalidateCache();
  });

  beforeEach(() => resetRateLimiter());

  it('rejects anonymous reporters (UNAUTHORIZED)', async () => {
    await expect(report({ tripId: TRIP, reason: 'SPAM' }, anonCtx())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('creates a trip report with persisted fields', async () => {
    const res = await report(
      { tripId: TRIP, reason: 'SPAM', description: '  <b>Pub</b> abusive  ' },
      userCtx(reporterId, reporterEmail),
    );
    expect(res.id).toBeTypeOf('string');
    const [row] = await db.select().from(tripReports).where(eq(tripReports.id, res.id));
    expect(row.tripId).toBe(TRIP);
    expect(row.commentId).toBeNull();
    expect(row.reviewId).toBeNull();
    expect(row.reporterId).toBe(reporterId);
    expect(row.reason).toBe('SPAM');
    expect(row.status).toBe('PENDING');
    // stripHtml + trim à l'écriture (jamais de HTML en base).
    expect(row.description).toBe('Pub abusive');
    expect(row.resolvedBy).toBeNull();
    expect(row.resolvedAt).toBeNull();
  });

  it('rejects reports on unknown or unpublished trips (NOT_FOUND)', async () => {
    await expect(report({ tripId: UNKNOWN_TRIP, reason: 'OTHER' }, userCtx(reporterId, reporterEmail))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(report({ tripId: TRIP_DRAFT, reason: 'OTHER' }, userCtx(reporterId, reporterEmail))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resolveTripReport requires trip:moderate (FORBIDDEN for a plain user)', async () => {
    const res = await report({ tripId: TRIP, reason: 'ABUSIVE' }, userCtx(reporterId, reporterEmail));
    // userRole n'a pas trip:moderate — le reporter lui-même ne peut pas résoudre.
    await expect(resolveReport({ id: res.id, status: 'RESOLVED' }, userCtx(reporterId, reporterEmail))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const [row] = await db.select().from(tripReports).where(eq(tripReports.id, res.id));
    expect(row.status).toBe('PENDING');
  });

  it.each(['REVIEWED', 'RESOLVED', 'REJECTED'] as const)('editor resolves a report as %s', async (status) => {
    const res = await report({ tripId: TRIP, reason: 'OTHER', description: `cas ${status}` }, userCtx(reporterId, reporterEmail));
    await expect(resolveReport({ id: res.id, status }, userCtx(editorId, editorEmail, 'editor'))).resolves.toEqual({ success: true });
    const [row] = await db.select().from(tripReports).where(eq(tripReports.id, res.id));
    expect(row.status).toBe(status);
    expect(row.resolvedBy).toBe(editorId);
    expect(row.resolvedAt).toBeInstanceOf(Date);
  });

  it('resolveTripReport rejects unknown report ids (NOT_FOUND)', async () => {
    await expect(
      resolveReport({ id: randomUUID(), status: 'RESOLVED' }, userCtx(editorId, editorEmail, 'editor')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

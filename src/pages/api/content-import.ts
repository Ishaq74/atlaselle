import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { auth } from '@/lib/auth';
import { importCmsContent } from '@database/loaders/page.loader';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAuditEvent, extractIp } from '@/lib/audit';

export const prerender = false;

const sectionSchema = z.object({
  type: z.string().min(1).max(50),
  content: z.unknown(),
  sortOrder: z.number().int().min(0).max(10000),
  isVisible: z.boolean(),
});

const pageSchema = z.object({
  locale: z.string().min(2).max(10),
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  ogImage: z.string().max(500).nullable().optional(),
  canonical: z.string().max(500).nullable().optional(),
  robots: z.string().max(200).nullable().optional(),
  template: z.string().max(50).optional().default('default'),
  isPublished: z.boolean().optional().default(false),
  publishedAt: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
  sections: z.array(sectionSchema).max(200).optional().default([]),
});

const importSchema = z.object({
  version: z.number().int().min(1).max(1),
  pages: z.array(pageSchema).min(1).max(1000),
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.role !== 'admin') {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const userId = session.user.id;
  const rl = checkRateLimit(`content-import:${userId}`, { window: 60, max: 3 });
  if (!rl.allowed) {
    return Response.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'VALIDATION_ERROR', details: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  const { created, updated, skipped } = await importCmsContent({ pages: parsed.data.pages }, userId);

  void logAuditEvent({
    userId,
    action: 'CONTENT_IMPORT',
    resource: 'pages',
    resourceId: null,
    metadata: { created, updated, skipped, total: parsed.data.pages.length },
    ipAddress: extractIp(request.headers, clientAddress),
    userAgent: request.headers.get('user-agent'),
  }).catch(() => {});

  return Response.json({ success: true, created, updated, skipped });
};

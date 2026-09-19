import type { APIRoute } from 'astro';
import { auth } from '@/lib/auth';
import { exportCmsContent } from '@database/loaders/page.loader';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAuditEvent, extractIp } from '@/lib/audit';

export const prerender = false;

export const GET: APIRoute = async ({ request, clientAddress }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.role !== 'admin') {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const userId = session.user.id;
  const rl = checkRateLimit(`content-export:${userId}`, { window: 60, max: 5 });
  if (!rl.allowed) {
    return Response.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const exportData = await exportCmsContent();

  void logAuditEvent({
    userId,
    action: 'CONTENT_EXPORT',
    resource: 'pages',
    resourceId: null,
    metadata: { pageCount: exportData.pages.length },
    ipAddress: extractIp(request.headers, clientAddress),
    userAgent: request.headers.get('user-agent'),
  }).catch(() => {});

  const filename = `cms-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};

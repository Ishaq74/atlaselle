import { describe, it, expect, vi, beforeEach } from 'vitest';

const userHasPermissionMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => null,
      userHasPermission: (...args: unknown[]) => userHasPermissionMock(...args),
    },
  },
}));

import { requireAuth, requireAdmin, requirePermission } from '@/lib/auth-guards';

function astro(user: unknown, lang = 'en') {
  const redirect = vi.fn((url: string) => ({ redirect: url }));
  return {
    astro: { params: { lang }, locals: { user }, redirect } as never,
    redirect,
  };
}

describe('auth-guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermissionMock.mockResolvedValue({ success: true });
  });

  it('requireAuth redirige les invités et bannis vers sign-in', async () => {
    for (const user of [null, undefined, { id: 'u', banned: true }]) {
      const { astro: a, redirect } = astro(user);
      const res = await requireAuth(a);
      expect('redirect' in res).toBe(true);
      expect(redirect).toHaveBeenCalledOnce();
      expect(redirect.mock.calls[0][0]).toContain('/en/auth/');
      redirect.mockClear();
    }
  });

  it('requireAuth laisse passer les connectés', async () => {
    const { astro: a } = astro({ id: 'u1', banned: false });
    const res = await requireAuth(a);
    expect('user' in res).toBe(true);
  });

  it('requireAdmin redirige invités vers sign-in, non-admins vers dashboard', async () => {
    const g = astro(null);
    expect('redirect' in (await requireAdmin(g.astro))).toBe(true);
    expect(g.redirect.mock.calls[0][0]).toContain('sign-in');
    const u = astro({ id: 'u1', role: 'user', banned: false });
    const res = await requireAdmin(u.astro);
    expect('redirect' in res).toBe(true);
    expect(u.redirect.mock.calls[0][0]).toContain('dashboard');
    const a = astro({ id: 'a1', role: 'admin', banned: false });
    expect('user' in (await requireAdmin(a.astro))).toBe(true);
  });

  it('requirePermission redirige sans permission, laisse passer avec', async () => {
    const { astro: a, redirect } = astro({ id: 'u1', role: 'admin', banned: false });
    userHasPermissionMock.mockResolvedValueOnce({ success: false });
    const denied = await requirePermission(a, { trip: ['update'] });
    expect('redirect' in denied).toBe(true);
    expect(redirect.mock.calls[0][0]).toContain('dashboard');
    expect(userHasPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ userId: 'u1' }) }),
    );
    const ok = await requirePermission(a, { trip: ['update'] });
    expect('user' in ok).toBe(true);
  });

  it('requirePermission redirige les invités vers sign-in sans appeler le service', async () => {
    const { astro: a } = astro(null);
    const res = await requirePermission(a, { trip: ['read'] });
    expect('redirect' in res).toBe(true);
    expect(userHasPermissionMock).not.toHaveBeenCalled();
  });
});

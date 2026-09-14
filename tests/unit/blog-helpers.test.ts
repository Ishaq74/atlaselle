import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:actions', () => {
  class ActionError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  }

  return { ActionError };
});

const mockSelect = vi.fn();
const mockUserHasPermission = vi.fn();

vi.mock('@database/drizzle', () => ({
  getDrizzle: vi.fn(() => ({
    select: mockSelect,
  })),
}));

vi.mock('@database/schemas', () => ({
  blogPosts: { id: 'id', organizationId: 'organizationId' },
  blogCategories: { id: 'id', organizationId: 'organizationId' },
  blogTags: { id: 'id', organizationId: 'organizationId' },
  mediaFiles: { id: 'id', organizationId: 'organizationId' },
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      userHasPermission: mockUserHasPermission,
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(() => Promise.resolve()),
  extractIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10 })),
}));
vi.mock('@database/cache', () => ({ invalidateCache: vi.fn() }));

import {
  assertBlogPermission,
  assertCategoryInTenant,
  assertMediaInTenant,
  assertPostInTenant,
  assertTagInTenant,
  hasBlogPermission,
  invalidateBlogCache,
  resolveBlogTenant,
} from '@/actions/blog/_helpers';
import { invalidateCache } from '@database/cache';

function fakeContext(user: any = null): any {
  return {
    locals: { user },
    request: { headers: new Headers() },
    clientAddress: '127.0.0.1',
  };
}

function selectChain(rows: any[]) {
  const terminal: any = Object.assign(Promise.resolve(rows), {
    limit: vi.fn().mockResolvedValue(rows),
  });

  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(terminal),
    }),
  };
}

beforeEach(() => {
  mockSelect.mockReset();
  mockUserHasPermission.mockReset();
  mockUserHasPermission.mockResolvedValue({ success: true });
});

describe('resolveBlogTenant (single-tenant)', () => {
  it('always returns the global context', () => {
    expect(resolveBlogTenant({})).toEqual({
      organizationId: null,
      isOrgContext: false,
    });
    expect(resolveBlogTenant({ organizationId: 'org-1' })).toEqual({
      organizationId: null,
      isOrgContext: false,
    });
  });
});

describe('assertBlogPermission', () => {
  it('throws UNAUTHORIZED when user is missing', async () => {
    await expect(
      assertBlogPermission(fakeContext(null), { blog: ['read'] }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('checks global permissions without an implicit admin bypass', async () => {
    const user = { id: 'admin-1', role: 'admin', banned: false };

    const result = await assertBlogPermission(
      fakeContext(user),
      { blog: ['delete'] },
    );

    expect(result).toBe(user);
    expect(mockUserHasPermission).toHaveBeenCalledWith({
      body: {
        userId: 'admin-1',
        permissions: { blog: ['delete'] },
      },
    });
  });

  it('rejects when RBAC denies the requested blog permission', async () => {
    mockUserHasPermission.mockResolvedValueOnce({ success: false });

    await expect(
      assertBlogPermission(
        fakeContext({ id: 'editor-1', role: 'editor', banned: false }),
        { blogReview: ['moderate'] },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns false instead of throwing when a capability lookup fails', async () => {
    mockUserHasPermission.mockRejectedValueOnce(new Error('auth unavailable'));

    await expect(
      hasBlogPermission(
        fakeContext({ id: 'user-1', role: 'user', banned: false }),
        { blog: ['read'] },
      ),
    ).resolves.toBe(false);
  });
});

describe('tenant resource guards (single-tenant: existence only)', () => {
  it('resolves an existing post', async () => {
    const row = { id: 'post-1', organizationId: null };
    mockSelect.mockReturnValueOnce(selectChain([row]));

    await expect(assertPostInTenant('post-1')).resolves.toEqual(row);
  });

  it('rejects a missing post', async () => {
    mockSelect.mockReturnValueOnce(selectChain([]));

    await expect(assertPostInTenant('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resolves an existing category', async () => {
    const row = { id: 'cat-1', organizationId: null };
    mockSelect.mockReturnValueOnce(selectChain([row]));

    await expect(assertCategoryInTenant('cat-1')).resolves.toEqual(row);
  });

  it('resolves an existing tag', async () => {
    const row = { id: 'tag-1', organizationId: null };
    mockSelect.mockReturnValueOnce(selectChain([row]));

    await expect(assertTagInTenant('tag-1')).resolves.toEqual(row);
  });

  it('resolves existing media', async () => {
    const row = { id: 'media-1', organizationId: null };
    mockSelect.mockReturnValueOnce(selectChain([row]));

    await expect(assertMediaInTenant('media-1')).resolves.toEqual(row);
  });
});

describe('invalidateBlogCache', () => {
  it('invalidates slug and internal-link target caches', () => {
    invalidateBlogCache();

    expect(invalidateCache).toHaveBeenCalledWith('blog:slugs:');
    expect(invalidateCache).toHaveBeenCalledWith('blog:link-targets:');
  });
});

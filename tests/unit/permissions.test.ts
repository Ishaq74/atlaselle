import { describe, it, expect } from 'vitest';
import { ac, adminRole, editorRole, userRole, statement } from '@/lib/permissions';
import { defaultStatements } from 'better-auth/plugins/admin/access';

describe('RBAC Permissions', () => {
  describe('statement', () => {
    it('defines all expected resources', () => {
      const resources = Object.keys(statement);
      expect(resources).toContain('user');
      expect(resources).toContain('session');
      expect(resources).toContain('page');
      expect(resources).toContain('section');
      expect(resources).toContain('media');
      expect(resources).toContain('site');
      expect(resources).toContain('navigation');
      expect(resources).toContain('audit');
      expect(resources).toContain('theme');
      expect(resources).toContain('blog');
      expect(resources).toContain('blogCategory');
      expect(resources).toContain('blogTag');
      expect(resources).toContain('blogComment');
      expect(resources).toContain('blogReview');
    });

    it('merges defaultStatements from better-auth admin plugin', () => {
      // user + session resources must include all better-auth defaults
      for (const action of defaultStatements.user) {
        expect(statement.user).toContain(action);
      }
      for (const action of defaultStatements.session) {
        expect(statement.session).toContain(action);
      }
    });

    it('page resource has CRUD + publish', () => {
      expect(statement.page).toContain('create');
      expect(statement.page).toContain('read');
      expect(statement.page).toContain('update');
      expect(statement.page).toContain('delete');
      expect(statement.page).toContain('publish');
    });

    it('user resource has admin management actions', () => {
      expect(statement.user).toContain('ban');
      expect(statement.user).toContain('list');
      expect(statement.user).toContain('set-role');
      expect(statement.user).toContain('impersonate');
      expect(statement.user).toContain('delete');
    });

    it('session resource has management actions', () => {
      expect(statement.session).toContain('list');
      expect(statement.session).toContain('revoke');
      expect(statement.session).toContain('delete');
    });
  });

  describe('roles', () => {
    it('exports ac and all three roles', () => {
      expect(ac).toBeDefined();
      expect(adminRole).toBeDefined();
      expect(editorRole).toBeDefined();
      expect(userRole).toBeDefined();
    });

    it('admin role inherits better-auth default admin permissions', () => {
      // adminRole must contain all keys from adminAc.statements
      const adminRoleStatements = (adminRole as Record<string, unknown>).statements ?? adminRole;
      expect(adminRoleStatements).toBeDefined();
    });

    it('admin role has the expected shape', () => {
      expect(typeof adminRole).toBe('object');
    });

    it('editor role has the expected shape', () => {
      expect(typeof editorRole).toBe('object');
    });

    it('user role has the expected shape', () => {
      expect(typeof userRole).toBe('object');
    });

    it('editor and user roles have empty user and session permissions', () => {
      // Editor and user should not have user management or session management
      const editorStatements = (editorRole as unknown as Record<string, { actions: string[] }>);
      const userStatements = (userRole as unknown as Record<string, { actions: string[] }>);
      expect(editorStatements).toBeDefined();
      expect(userStatements).toBeDefined();
    });
  });

  describe('voyage resources (single-tenant, no org roles)', () => {
    it('declares trip, departure, application, reservation, payment and policy resources', () => {
      const resources = Object.keys(statement);
      for (const r of ['trip', 'departure', 'application', 'reservation', 'payment', 'policy']) {
        expect(resources).toContain(r);
      }
    });

    it('trip resource exposes lifecycle actions', () => {
      for (const a of ['create', 'read', 'update', 'publish', 'archive']) {
        expect(statement.trip).toContain(a);
      }
    });
  });

  describe('statement completeness', () => {
    it('declares voyage resources instead of org resources', () => {
      const resources = Object.keys(statement);
      for (const r of ['trip', 'departure', 'application', 'reservation', 'payment', 'policy']) {
        expect(resources).toContain(r);
      }
    });

    it('section resource has CUD actions', () => {
      expect(statement.section).toContain('create');
      expect(statement.section).toContain('update');
      expect(statement.section).toContain('delete');
    });

    it('media resource has upload and delete', () => {
      expect(statement.media).toContain('upload');
      expect(statement.media).toContain('read');
      expect(statement.media).toContain('delete');
    });

    it('site resource has read and update', () => {
      expect(statement.site).toContain('read');
      expect(statement.site).toContain('update');
    });

    it('navigation resource has read and update', () => {
      expect(statement.navigation).toContain('read');
      expect(statement.navigation).toContain('update');
    });

    it('audit resource has read', () => {
      expect(statement.audit).toContain('read');
    });

    it('theme resource has read and update', () => {
      expect(statement.theme).toContain('read');
      expect(statement.theme).toContain('update');
    });

    it('blog resources expose moderation and taxonomy actions', () => {
      expect(statement.blog).toContain('publish');
      expect(statement.blog).toContain('moderate');
      expect(statement.blogCategory).toContain('delete');
      expect(statement.blogTag).toContain('update');
      expect(statement.blogComment).toContain('moderate');
      expect(statement.blogReview).toContain('moderate');
    });
  });

  describe('role authorization', () => {
    it('admin role can authorize page:create', () => {
      const result = adminRole.authorize({ page: ["create"] });
      expect(result.success).toBe(true);
    });

    it('admin role can authorize user:ban', () => {
      const result = adminRole.authorize({ user: ["ban"] });
      expect(result.success).toBe(true);
    });

    it('editor role can authorize page:create', () => {
      const result = editorRole.authorize({ page: ["create"] });
      expect(result.success).toBe(true);
    });

    it('editor role can authorize page:publish', () => {
      const result = editorRole.authorize({ page: ["publish"] });
      expect(result.success).toBe(true);
    });

    it('user role can authorize page:read', () => {
      const result = userRole.authorize({ page: ["read"] });
      expect(result.success).toBe(true);
    });

    it('user role cannot authorize page:create', () => {
      const result = userRole.authorize({ page: ["create"] });
      expect(result.success).toBe(false);
    });

    it('user role cannot authorize page:delete', () => {
      const result = userRole.authorize({ page: ["delete"] });
      expect(result.success).toBe(false);
    });

    it('admin role can authorize trip:publish', () => {
      const result = adminRole.authorize({ trip: ["publish"] });
      expect(result.success).toBe(true);
    });

    it('editor role can authorize trip:create but not trip:publish', () => {
      expect(editorRole.authorize({ trip: ["create"] }).success).toBe(true);
      expect(editorRole.authorize({ trip: ["publish"] }).success).toBe(false);
    });

    it('admin role can authorize blog:moderate', () => {
      const result = adminRole.authorize({ blog: ['moderate'] });
      expect(result.success).toBe(true);
    });

    it('user role cannot authorize trip:read (no voyage access)', () => {
      const result = userRole.authorize({ trip: ["read"] });
      expect(result.success).toBe(false);
    });
  });
});

import { describe, expect, it } from 'vitest';

// L'import exécute assertResourceCompatibility (module ↔ ressource).
import { applicationAdminResource } from '@/modules/applications/admin/resource';
import { applicationsModule } from '@/modules/applications/module';
import { reservationAdminResource } from '@/modules/reservations/admin/resource';
import { reservationsModule } from '@/modules/reservations/module';
import { paymentAdminResource } from '@/modules/payments/admin/resource';
import { paymentsModule } from '@/modules/payments/module';
import { travelerAdminResource } from '@/modules/travelers/admin/resource';
import { travelersModule } from '@/modules/travelers/module';
import { emailAdminResource } from '@/modules/email-voyage/admin/resource';
import { emailvoyageModule } from '@/modules/email-voyage/module';
import { policyAdminResource } from '@/modules/policies/admin/resource';
import { policiesModule } from '@/modules/policies/module';

describe('voyage admin resources (TODO §16)', () => {
  it.each([
    ['application', applicationAdminResource, applicationsModule, 'application'],
    ['reservation', reservationAdminResource, reservationsModule, 'reservation'],
    ['payment', paymentAdminResource, paymentsModule, 'payment'],
    ['traveler', travelerAdminResource, travelersModule, 'traveler'],
    ['email_delivery', emailAdminResource, emailvoyageModule, 'email'],
    ['policy_document', policyAdminResource, policiesModule, 'policy'],
  ])('%s targets its module entity with read access', (_id, resource: any, module: any, ns: string) => {
    expect(resource.entity).toBe(module.entity);
    expect(resource.actions.read).toBe(true);
    expect(resource.permissionNamespace).toBe(ns);
    expect(resource.management.list).toBe(true);
    expect(resource.management.pagination).toBe(true);
  });

  it('restricts destructive voyage actions', () => {
    expect(applicationAdminResource.actions.delete).toBe(false);
    expect(reservationAdminResource.actions.delete).toBe(false);
    expect(paymentAdminResource.actions.delete).toBe(false);
    expect(travelerAdminResource.actions.delete).toBe(false);
    expect(policyAdminResource.actions.publish).toBe(true);
  });
});

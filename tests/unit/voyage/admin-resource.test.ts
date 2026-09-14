import { describe, expect, it } from 'vitest';

// L'import exécute assertResourceCompatibility (module ↔ ressource).
import { tripAdminResource, departureAdminResource } from '@/modules/trips/admin/resource';
import { tripsModule } from '@/modules/trips/module';
import { departuresModule } from '@/modules/departures/module';

describe('trip admin resource (TODO §16)', () => {
  it('targets the trips module entity with publication', () => {
    expect(tripAdminResource.entity).toBe(tripsModule.entity);
    expect(tripAdminResource.actions.publish).toBe(true);
    expect(tripAdminResource.actions.restore).toBe(true);
    expect(tripAdminResource.actions.delete).toBe(false);
    expect(tripAdminResource.permissionNamespace).toBe('trip');
  });

  it('exposes url-driven list capabilities', () => {
    expect(tripAdminResource.management).toMatchObject({ list: true, filters: true, pagination: true });
  });
});

describe('departure admin resource', () => {
  it('targets the departures module entity without publish', () => {
    expect(departureAdminResource.entity).toBe(departuresModule.entity);
    expect(departureAdminResource.actions.update).toBe(true);
    expect(departureAdminResource.actions.publish).toBe(false);
    expect(departureAdminResource.permissionNamespace).toBe('departure');
  });
});

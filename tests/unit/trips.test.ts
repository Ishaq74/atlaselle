import { describe, expect, it } from "vitest";
import { TRIPS, calculateTripTotal, getTripBySlug, tripUrl } from "@/data/trips";

describe("ATLASELLE trip catalogue", () => {
  it("uses one shared fact source for every localized route", () => {
    const trip = TRIPS[0]!;
    expect(trip.price).toBe(3890);
    expect(tripUrl("en", trip)).toBe("/en/trips/south-africa");
    expect(tripUrl("fr", trip)).toBe("/fr/voyages/afrique-du-sud");
    expect(tripUrl("ar", trip)).toBe("/ar/trips/south-africa");
    expect(tripUrl("es", trip)).toBe("/es/viajes/sudafrica");
  });

  it("resolves locale-specific slugs and retains Spanish support", () => {
    expect(getTripBySlug("fr", "sicile-malte")?.id).toBe("sicily-malta");
    expect(getTripBySlug("ar", "sicily-malta")?.id).toBe("sicily-malta");
    expect(getTripBySlug("es", "sicilia-malta")?.id).toBe("sicily-malta");
    expect(getTripBySlug("es", "sudafrica")?.id).toBe("south-africa");
    // Compat transition : anciens liens ES utilisaient l'id comme slug.
    expect(getTripBySlug("es", "sicily-malta")?.id).toBe("sicily-malta");
  });

  it("calculates server totals from shared trip pricing", () => {
    expect(calculateTripTotal(TRIPS[1]!, 2)).toEqual({
      currency: "EUR", travelers: 2, total: 6580, depositDue: 1300, balanceDue: 5280,
    });
    expect(calculateTripTotal(TRIPS[1]!, 0).travelers).toBe(1);
  });
});

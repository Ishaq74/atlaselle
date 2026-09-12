import { describe, expect, it } from "vitest";
import { buildServiceCategoryUrl, buildServiceUrl } from "@/modules/services/utils/urls";

describe("Services URLs", () => {
  it("builds global localized URLs", () => {
    expect(buildServiceUrl("fr", null, "plomberie", "maison")).toBe("/fr/services/maison/plomberie");
    expect(buildServiceCategoryUrl("ar", null, "maison")).toBe("/ar/services/maison");
  });

  it("builds organization-scoped URLs with organization slug", () => {
    expect(buildServiceUrl("en", "acme", "plumbing", "home")).toBe("/en/organizations/acme/services/home/plumbing");
    expect(buildServiceCategoryUrl("es", "acme", "home")).toBe("/es/organizations/acme/services/home");
  });
});

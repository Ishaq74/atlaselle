import { describe, expect, it } from "vitest";
import { buildServiceCategoryUrl, buildServiceUrl } from "@/modules/services/utils/urls";

describe("Services URLs (single-tenant)", () => {
  it("builds global localized URLs", () => {
    expect(buildServiceUrl("fr", "plomberie", "maison")).toBe("/fr/services/maison/plomberie");
    expect(buildServiceCategoryUrl("ar", "maison")).toBe("/ar/services/maison");
  });

  it("builds URLs without category", () => {
    expect(buildServiceUrl("en", "plumbing")).toBe("/en/services/plumbing");
    expect(buildServiceCategoryUrl("es", "hogar")).toBe("/es/services/hogar");
  });
});

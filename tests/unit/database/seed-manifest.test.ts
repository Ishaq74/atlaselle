import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as schemas from "@database/schemas";
import { seedManifest } from "@database/data/manifest";

const SERVICES = [
  ["24-services.data.ts", "services"],
  ["24b-service-translations.data.ts", "serviceTranslations"],
  ["25-service-categories.data.ts", "serviceCategories"],
  ["25b-service-category-translations.data.ts", "serviceCategoryTranslations"],
  ["26-service-tags.data.ts", "serviceTags"],
  ["26b-service-tag-translations.data.ts", "serviceTagTranslations"],
  ["27-service-category-links.data.ts", "serviceCategoryLinks"],
  ["27b-service-tag-links.data.ts", "serviceTagLinks"],
  ["28-service-media.data.ts", "serviceMedia"],
  ["29-service-availability.data.ts", "serviceAvailability"],
  ["30-service-revisions.data.ts", "serviceRevisions"],
  ["31-service-locks.data.ts", "serviceLocks"],
  ["32-service-seo.data.ts", "serviceSeo"],
  ["33-service-favorites.data.ts", "serviceFavorites"],
  ["34-service-reviews.data.ts", "serviceReviews"],
  ["34b-service-review-helpful.data.ts", "serviceReviewHelpful"],
  ["35-service-comments.data.ts", "serviceComments"],
  ["36-service-reports.data.ts", "serviceReports"],
  ["37-service-view-stats.data.ts", "serviceViewStats"],
  ["38-service-reactions.data.ts", "serviceReactions"],
  ["39-service-notifications.data.ts", "serviceNotifications"],
  ["40-service-attribute-definitions.data.ts", "serviceAttributeDefinitions"],
  ["40b-service-attribute-values.data.ts", "serviceAttributeValues"],
] as const;

const dataDir = resolve(process.cwd(), "src/database/data");

describe("seed manifest", () => {
  it("contains every Services dataset exactly once and points to existing schema exports/files", () => {
    const entries = seedManifest.filter((entry) => entry.dataFile.startsWith("2") || entry.dataFile.startsWith("3") || entry.dataFile.startsWith("4"));
    for (const [dataFile, schemaExport] of SERVICES) {
      expect(entries.filter((entry) => entry.dataFile === dataFile)).toHaveLength(1);
      expect(entries.find((entry) => entry.dataFile === dataFile)?.schemaExport).toBe(schemaExport);
      expect(existsSync(resolve(dataDir, dataFile))).toBe(true);
      expect(schemas[schemaExport as keyof typeof schemas]).toBeDefined();
    }
  });

  it("does not contain duplicate data files", () => {
    expect(new Set(seedManifest.map((entry) => entry.dataFile)).size).toBe(seedManifest.length);
  });

  it("points every data file at a table it actually populates", () => {
    // Deux entrées PEUVENT viser la même table : le seeder itère sur chaque
    // entrée et insère son dataset, `schemaExport` ne sert qu'à retrouver la
    // table cible. Les sections légales des mentions, des conditions de
    // réservation et de l'assurance vivent toutes dans `pageSections`.
    // L'unicité requise porte sur les FICHIERS, pas sur les tables.
    for (const entry of seedManifest) {
      expect(entry.schemaExport, `${entry.dataFile} must declare a schemaExport`).toBeTruthy();
      expect(entry.dataFile).toMatch(/^\d+[a-z]?-[a-z][a-z0-9-]*\.data\.ts$/);
    }
  });

  it("keeps the Services dependency order deterministic", () => {
    // Index sur la PREMIÈRE occurrence : l'ordre du manifeste doit garantir
    // qu'une table est créée avant les entrées qui la référencent.
    const index = new Map<string, number>();
    seedManifest.forEach((entry, position) => {
      if (!index.has(entry.schemaExport)) index.set(entry.schemaExport, position);
    });
    expect(index.get("services")).toBeLessThan(index.get("serviceTranslations")!);
    expect(index.get("serviceCategories")).toBeLessThan(index.get("serviceCategoryLinks")!);
    expect(index.get("serviceReviews")).toBeLessThan(index.get("serviceReviewHelpful")!);
    expect(index.get("serviceComments")).toBeLessThan(index.get("serviceReports")!);
    expect(index.get("serviceAttributeDefinitions")).toBeLessThan(index.get("serviceAttributeValues")!);
    expect(index.get("serviceComments")).toBeLessThan(index.get("serviceNotifications")!);
    expect(index.get("serviceReviews")).toBeLessThan(index.get("serviceNotifications")!);
  });
});

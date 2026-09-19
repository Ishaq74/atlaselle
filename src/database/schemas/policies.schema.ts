import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { LOCALES } from "@i18n/config";

const localeEnum = text("locale", { enum: LOCALES }).notNull();

export const POLICY_TYPES = ["privacy", "terms", "booking_terms", "cancellation", "accessibility", "photo_consent"] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

// ─── Documents légaux versionnés (TODO §13.7 — révision juridique par langue) ─
export const policyDocuments = pgTable(
  "policy_documents",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    type: text("type", { enum: POLICY_TYPES }).notNull(),
    locale: localeEnum,
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("policy_docs_type_locale_uidx").on(table.type, table.locale),
    index("policy_docs_type_idx").on(table.type),
  ],
);

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    documentId: text("document_id").notNull().references(() => policyDocuments.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    published: boolean("published").default(false).notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("policy_versions_doc_version_uidx").on(table.documentId, table.version),
    index("policy_versions_doc_idx").on(table.documentId),
  ],
);

export const policyDocumentsRelations = relations(policyDocuments, ({ many }) => ({
  versions: many(policyVersions),
}));

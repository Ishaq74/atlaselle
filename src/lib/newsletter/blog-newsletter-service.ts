import { createHash, randomBytes } from "node:crypto";
import { and, eq, gte, isNull, or, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { blogSubscribers } from "@database/schemas";
import type { Locale } from "@i18n/config";
import { logAuditEvent } from "@/lib/audit";
import { sendEmail } from "@/smtp/send";
import { blogNewsletterConfirmTemplate } from "@/smtp/templates/blog-newsletter";

const CONFIRMATION_TOKEN_PREFIX = "newsletter.confirm.v2.";
const UNSUBSCRIBE_TOKEN_PREFIX = "newsletter.unsubscribe.v2.";
const TOKEN_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 512;

interface NewsletterAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface SubscribeBlogNewsletterInput {
  email: string;
  locale: Locale;
  configuredSite?: URL | null;
  audit?: NewsletterAuditContext;
}

interface ConsumeNewsletterTokenInput {
  token: string;
  audit?: NewsletterAuditContext;
}

export interface NewsletterTokenConsumption {
  consumed: boolean;
}

export class NewsletterConfigurationError extends Error {
  constructor() {
    super("Newsletter server origin is not configured");
    this.name = "NewsletterConfigurationError";
  }
}

export class NewsletterDeliveryError extends Error {
  constructor(cause: unknown) {
    super("Newsletter confirmation email delivery failed", { cause });
    this.name = "NewsletterDeliveryError";
  }
}

type ParsedToken =
  | { kind: "v2"; hash: string }
  | { kind: "legacy"; raw: string; hash: string }
  | { kind: "invalid" };

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

function createPurposeToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

function parsePurposeToken(token: string, expectedPrefix: string): ParsedToken {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > MAX_TOKEN_LENGTH) return { kind: "invalid" };

  if (trimmed.startsWith(expectedPrefix)) {
    const secret = trimmed.slice(expectedPrefix.length);
    return TOKEN_SECRET_PATTERN.test(secret)
      ? { kind: "v2", hash: hashToken(trimmed) }
      : { kind: "invalid" };
  }

  // Explicit compatibility for rows created before purpose-bound, hashed v2
  // tokens. A token carrying another v2 purpose is never treated as legacy.
  if (trimmed.startsWith("newsletter.")) return { kind: "invalid" };
  return { kind: "legacy", raw: trimmed, hash: hashToken(trimmed) };
}

function getConfiguredOrigin(configuredSite?: URL | null): string {
  const environmentOrigin = process.env.SITE_URL?.trim();
  const candidate = environmentOrigin || configuredSite?.origin;
  if (!candidate) throw new NewsletterConfigurationError();

  try {
    const parsed = new URL(candidate);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("Invalid origin");
    }
    return parsed.origin;
  } catch {
    throw new NewsletterConfigurationError();
  }
}

function safeOperationalError(error: unknown): { name: string; code: string | null } {
  if (!(error instanceof Error)) return { name: "UnknownError", code: null };
  const code = (error as NodeJS.ErrnoException).code;
  return { name: error.name, code: typeof code === "string" ? code : null };
}

async function subscribe(input: SubscribeBlogNewsletterInput): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const confirmationToken = createPurposeToken(CONFIRMATION_TOKEN_PREFIX);
  const unsubscribeToken = createPurposeToken(UNSUBSCRIBE_TOKEN_PREFIX);
  const confirmationExpiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);
  const confirmationTokenHash = hashToken(confirmationToken);
  const unsubscribeTokenHash = hashToken(unsubscribeToken);
  const origin = getConfiguredOrigin(input.configuredSite);
  const now = new Date();
  const db = getDrizzle();

  const subscriberId = await db.transaction(async (tx) => {
    // La newsletter est globale (single-admin). Le verrou consultatif empêche
    // deux instances de créer des lignes dupliquées en concurrence.
    const lockScope = `global:${hashToken(email)}`;
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))`,
    );

    const [existing] = await tx
      .select({ id: blogSubscribers.id })
      .from(blogSubscribers)
      .where(eq(blogSubscribers.email, email))
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(blogSubscribers)
        .set({
          locale: input.locale,
          token: null,
          tokenUsedAt: null,
          confirmationTokenHash,
          confirmationTokenExpiresAt: confirmationExpiresAt,
          confirmationTokenUsedAt: null,
          unsubscribeTokenHash,
          unsubscribeTokenUsedAt: null,
          status: "PENDING",
          confirmedAt: null,
          unsubscribedAt: null,
          updatedAt: now,
        })
        .where(eq(blogSubscribers.id, existing.id))
        .returning({ id: blogSubscribers.id });
      if (!updated) throw new Error("Newsletter subscriber disappeared during update");
      return updated.id;
    }

    const [created] = await tx
      .insert(blogSubscribers)
      .values({
        email,
        locale: input.locale,
        token: null,
        tokenUsedAt: null,
        confirmationTokenHash,
        confirmationTokenExpiresAt: confirmationExpiresAt,
        confirmationTokenUsedAt: null,
        unsubscribeTokenHash,
        unsubscribeTokenUsedAt: null,
        status: "PENDING",
        confirmedAt: null,
        unsubscribedAt: null,
      })
      .returning({ id: blogSubscribers.id });
    if (!created) throw new Error("Newsletter subscriber was not created");
    return created.id;
  });

  await logAuditEvent({
    userId: null,
    action: "BLOG_NEWSLETTER_SUBSCRIBE",
    resource: "blogSubscriber",
    resourceId: subscriberId,
    metadata: {
      tokenVersion: "v2",
      confirmationExpiresAt: confirmationExpiresAt.toISOString(),
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
  });

  const confirmUrl = new URL("/api/blog/newsletter/confirm", origin);
  confirmUrl.searchParams.set("token", confirmationToken);
  const unsubscribeUrl = new URL("/api/blog/newsletter/unsubscribe", origin);
  unsubscribeUrl.searchParams.set("token", unsubscribeToken);
  const template = blogNewsletterConfirmTemplate({
    locale: input.locale,
    confirmUrl: confirmUrl.toString(),
    unsubscribeUrl: unsubscribeUrl.toString(),
  });

  try {
    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.error("[newsletter] Confirmation delivery failed", {
      subscriberId,
      ...safeOperationalError(error),
    });
    await logAuditEvent({
      userId: null,
      action: "EMAIL_SEND_FAILED",
      resource: "blogSubscriber",
      resourceId: subscriberId,
    metadata: {
      purpose: "newsletter-confirmation",
    },
      ipAddress: input.audit?.ipAddress,
      userAgent: input.audit?.userAgent,
    });
    throw new NewsletterDeliveryError(error);
  }
}

async function confirm(
  input: ConsumeNewsletterTokenInput,
): Promise<NewsletterTokenConsumption> {
  const parsed = parsePurposeToken(input.token, CONFIRMATION_TOKEN_PREFIX);
  if (parsed.kind === "invalid") return { consumed: false };

  const now = new Date();
  const db = getDrizzle();
  const tokenCondition =
    parsed.kind === "legacy"
      ? eq(blogSubscribers.token, parsed.raw)
      : and(
          eq(blogSubscribers.confirmationTokenHash, parsed.hash),
          isNull(blogSubscribers.confirmationTokenUsedAt),
          gte(blogSubscribers.confirmationTokenExpiresAt, now),
        );

  const [updated] = await db
    .update(blogSubscribers)
    .set({
      status: "CONFIRMED",
      confirmedAt: now,
      unsubscribedAt: null,
      confirmationTokenHash: parsed.hash,
      confirmationTokenUsedAt: now,
      // Legacy links used one credential for both operations. Preserve only
      // its hash as the unsubscribe credential after confirmation; v2 rows
      // already carry an independently generated unsubscribe hash.
      ...(parsed.kind === "legacy"
        ? {
            token: null,
            tokenUsedAt: now,
            confirmationTokenExpiresAt: null,
            unsubscribeTokenHash: parsed.hash,
            unsubscribeTokenUsedAt: null,
          }
        : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(blogSubscribers.status, "PENDING"),
        parsed.kind === "legacy" ? isNull(blogSubscribers.tokenUsedAt) : undefined,
        tokenCondition,
      ),
    )
    .returning({
      id: blogSubscribers.id,
    });

  if (!updated) return { consumed: false };

  await logAuditEvent({
    userId: null,
    action: "BLOG_NEWSLETTER_CONFIRM",
    resource: "blogSubscriber",
    resourceId: updated.id,
    metadata: {
      tokenVersion: parsed.kind,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
  });
  return { consumed: true };
}

async function unsubscribe(
  input: ConsumeNewsletterTokenInput,
): Promise<NewsletterTokenConsumption> {
  const parsed = parsePurposeToken(input.token, UNSUBSCRIBE_TOKEN_PREFIX);
  if (parsed.kind === "invalid") return { consumed: false };

  const now = new Date();
  const db = getDrizzle();
  const tokenCondition =
    parsed.kind === "legacy"
      ? or(
          and(
            eq(blogSubscribers.token, parsed.raw),
            isNull(blogSubscribers.tokenUsedAt),
          ),
          and(
            eq(blogSubscribers.unsubscribeTokenHash, parsed.hash),
            isNull(blogSubscribers.unsubscribeTokenUsedAt),
          ),
        )
      : and(
          eq(blogSubscribers.unsubscribeTokenHash, parsed.hash),
          isNull(blogSubscribers.unsubscribeTokenUsedAt),
        );

  const [updated] = await db
    .update(blogSubscribers)
    .set({
      status: "UNSUBSCRIBED",
      token: null,
      ...(parsed.kind === "legacy" ? { tokenUsedAt: now } : {}),
      unsubscribeTokenHash: parsed.hash,
      unsubscribeTokenUsedAt: now,
      unsubscribedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        or(
          eq(blogSubscribers.status, "PENDING"),
          eq(blogSubscribers.status, "CONFIRMED"),
        ),
        tokenCondition,
      ),
    )
    .returning({
      id: blogSubscribers.id,
    });

  if (!updated) return { consumed: false };

  await logAuditEvent({
    userId: null,
    action: "BLOG_NEWSLETTER_UNSUBSCRIBE",
    resource: "blogSubscriber",
    resourceId: updated.id,
    metadata: {
      tokenVersion: parsed.kind,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
  });
  return { consumed: true };
}

export const blogNewsletterService = {
  subscribe,
  confirm,
  unsubscribe,
};

import type { EmailPayload, EmailFrom, SmtpProvider } from './types';
import { getSmtpProvider, getSmtpFrom } from './env';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RETRIES = 3;

/**
 * Garde-fou « aucun envoi réel pendant les tests ».
 *
 * Les tests d'intégration et E2E exercent le chemin complet du formulaire de
 * contact jusqu'à `sendEmail`. Sans ce filet, un `.env` de développement
 * contenant de vraies identifiants SMTP déclenche de vrais emails (facturation
 * de fournisseur, bouncefile, réputation du domaine) à chaque run.
 *
 * Règle : en test, on ne fait JAMAIS d'appel réseau sortant. On écrit
 * l'email dans un fichier local pour pouvoir l'inspecter, et on considère
 * l'envoi réussi — les assertions portent sur le contrat HTTP, pas sur la
 * délivrabilité.
 */
const TEST_EMAIL_CAPTURE_DIR = 'logs/test-emails';

async function captureEmailInTest(payload: EmailPayload, provider: SmtpProvider, from: EmailFrom): Promise<void> {
  const { appendFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), TEST_EMAIL_CAPTURE_DIR);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    to: payload.to,
    from,
    subject: payload.subject,
    provider,
    captured: true,
  });
  await appendFile(join(dir, 'captured.jsonl'), record + '\n', { mode: 0o600 });
}

/** Vrai si l'on est dans un environnement de test (jamais en production). */
function isTestRun(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

/** Opt-out explicite pour valider un vrai envoi depuis un test local. */
function allowsRealSendInTest(): boolean {
  return process.env.SMTP_ALLOW_REAL_SEND_IN_TEST === 'true';
}

async function callProvider(provider: SmtpProvider, payload: EmailPayload, from: EmailFrom): Promise<void> {
  switch (provider) {
    case 'BREVO': {
      const { send } = await import('./providers/brevo');
      return send(payload, from);
    }
    case 'RESEND': {
      const { send } = await import('./providers/resend');
      return send(payload, from);
    }
    case 'NODEMAILER': {
      const { send } = await import('./providers/nodemailer');
      return send(payload, from);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Fournisseur SMTP inconnu : ${_exhaustive}`);
    }
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code && ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'].includes(code)) return true;
    if (/\b(429|500|502|503|504)\b/.test(err.message)) return true;
  }
  return false;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!payload.to || !EMAIL_RE.test(payload.to) || payload.to.length > 254) {
    throw new Error(`Invalid recipient email address`);
  }
  if (/[\r\n]/.test(payload.subject)) {
    throw new Error(`Invalid subject — contains line terminators`);
  }
  const provider = getSmtpProvider();
  const from = getSmtpFrom();

  // Filet de sécurité : aucun appel réseau sortant en test (cf. commentaire).
  if (isTestRun() && !allowsRealSendInTest()) {
    await captureEmailInTest(payload, provider, from);
    return;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callProvider(provider, payload, from);
    } catch (err) {
      if (attempt === MAX_RETRIES || !isRetryable(err)) {
        // Dead-letter: log failed email for manual retry
        const logsDir = join(process.cwd(), 'logs');
        const dlPath = join(logsDir, `email-dead-letter-${new Date().toISOString().slice(0, 10)}.jsonl`);
        const record = JSON.stringify({
          timestamp: new Date().toISOString(),
          to: payload.to,
          subject: payload.subject,
          provider,
          error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
          code: (err as NodeJS.ErrnoException).code ?? null,
          attempts: attempt,
        });
        mkdir(logsDir, { recursive: true, mode: 0o700 })
          .then(() => appendFile(dlPath, record + '\n', { mode: 0o600 }))
          .catch((fileErr) => {
            console.error('[SMTP] Dead-letter write failed:', fileErr);
          });
        throw err;
      }
      const delay = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 1000);
      console.warn(`[SMTP] Attempt ${attempt} failed, retrying in ${delay}ms...`, (err as Error).message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

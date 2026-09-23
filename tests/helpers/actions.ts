/**
 * Shared helpers to call Astro server actions from E2E tests.
 *
 * Protocol (verified against astro/dist/actions/runtime/entrypoints/client.js):
 *   POST /_actions/<actionName>
 *   headers: Content-Type: application/json, Accept: application/json, Origin (CSRF)
 *   body: JSON.stringify(input)
 *   success -> 200/204 (devalue-encoded body, or empty)
 *   ActionError -> 4xx/5xx with { type:"AstroActionError", code, message } (plain JSON)
 */
import type { Browser, APIRequestContext } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from '../e2e/global-setup';

const BASE_URL = 'http://localhost:4322';

/** Sign in the seeded admin and return an authenticated request context. */
export async function adminRequest(browser: Browser): Promise<APIRequestContext> {
  const context = await browser.newContext();
  const response = await context.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
    headers: { 'content-type': 'application/json', Origin: BASE_URL },
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  if (response.status() !== 200) throw new Error(`admin login failed (${response.status()})`);
  return context.request;
}

let ipSeq = 0;
/** Unique IP per call - isolates per-IP action rate-limit buckets (TRUST_PROXY=true). */
export function uniqueIp(): Record<string, string> {
  ipSeq += 1;
  return { 'X-Forwarded-For': `10.10.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}` };
}

export interface ActionResult {
  status: number;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Call an Astro server action and normalize the outcome.
 * - ok: 2xx (200 devalue body, or 204 empty)
 * - error: 4xx/5xx with the ActionError code extracted from the JSON body
 */
export async function callAction(
  request: APIRequestContext,
  actionName: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const response = await request.post(`${BASE_URL}/_actions/${actionName}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: BASE_URL,
      ...uniqueIp(),
    },
    data: input,
  });
  const status = response.status();
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  if (status >= 400) {
    try {
      const body = (await response.json()) as { code?: string; message?: string };
      errorCode = body.code;
      errorMessage = body.message;
    } catch {
      // Non-JSON error body.
    }
  }
  return { status, ok: status >= 200 && status < 300, errorCode, errorMessage };
}
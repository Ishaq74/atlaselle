/**
 * Traitement serveur de repli des formulaires (soumission native, sans JavaScript).
 *
 * Un `<form method="POST" action="?_action=<nom>">` envoie un corps
 * `application/x-www-form-urlencoded` / `multipart/form-data`. On :
 *   1. retrouve l'action dans le registre `src/actions` (nom exact, pas d'accès arbitraire) ;
 *   2. appelle sa jumelle `accept: "form"` avec le même contexte (session, rate-limit,
 *      permissions : tout est dans le handler de l'action, rien n'est contourné) ;
 *   3. répond par une 303 (Post/Redirect/Get) vers la page d'origine et dépose un message
 *      flash (`atl_flash`) que `FormFlash.astro` affiche une fois.
 * Le CSRF est couvert par `security.checkOrigin` d'Astro, avant le middleware.
 */
import type { APIContext } from "astro";
import { captureError } from "@/lib/monitoring";
import { FORM_ACTION_PARAM } from "./action-url";
import { FORM_ADAPTERS } from "./adapters";
import { getFormCompanion } from "./companion";
import { flashSetCookie, type Flash } from "./flash";
import { flashMessages, localeFromPathname } from "./messages";
import { SUCCESS_POLICIES, isSafeRedirect } from "./policies";

const MAX_BODY_BYTES = 1024 * 1024;
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data"];
const REGISTRY_KEY_RE = /^[A-Za-z][A-Za-z0-9]*$/;

interface ActionErrorLike {
  code?: string;
  message?: string;
  type?: string;
  issues?: unknown[];
}

interface ActionResultLike {
  data?: unknown;
  error?: ActionErrorLike;
}

type Registry = Record<string, unknown>;
type CallableAction = (input: FormData) => Promise<ActionResultLike>;

export interface FormFallbackDeps {
  loadRegistry: () => Promise<Registry>;
}

const defaultDeps: FormFallbackDeps = {
  loadRegistry: async () => (await import("@/actions")).server as unknown as Registry,
};

function isFormRequest(request: Request): boolean {
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  return FORM_CONTENT_TYPES.some((accepted) => type.startsWith(accepted));
}

function originalTarget(request: Request): string {
  const url = new URL(request.url);
  url.searchParams.delete(FORM_ACTION_PARAM);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

function redirect(location: string, flash: Flash | null, secure: boolean): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (flash) headers.append("Set-Cookie", flashSetCookie(flash, secure));
  return new Response(null, { status: 303, headers });
}

function errorMessage(error: ActionErrorLike, pathname: string): string {
  const t = flashMessages(localeFromPathname(pathname));
  if (error.type === "AstroActionInputError" && Array.isArray(error.issues)) return t.invalid;
  switch (error.code) {
    case "UNAUTHORIZED":
      return t.unauthorized;
    case "FORBIDDEN":
      return t.forbidden;
    case "TOO_MANY_REQUESTS":
      return t.rateLimited;
    case "INTERNAL_SERVER_ERROR":
    case "UNSUPPORTED_MEDIA_TYPE":
      return t.generic;
    default:
      return typeof error.message === "string" && error.message.trim() ? error.message : t.generic;
  }
}

/**
 * Retourne une Response 303 si la requête est une soumission native de formulaire
 * ciblant une action (`?_action=`), sinon `null` (la requête suit son cours normal).
 */
export async function handleFormFallback(
  context: APIContext,
  url: URL,
  deps: FormFallbackDeps = defaultDeps,
): Promise<Response | null> {
  const { request } = context;
  const name = url.searchParams.get(FORM_ACTION_PARAM);
  if (request.method !== "POST" || !name || !isFormRequest(request)) return null;

  const secure = url.protocol === "https:";
  const target = originalTarget(request);
  const t = flashMessages(localeFromPathname(url.pathname));
  const fail = (message: string): Response => redirect(target, { kind: "error", message }, secure);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail(t.tooLarge);

  if (!REGISTRY_KEY_RE.test(name)) return fail(t.generic);
  const registry = await deps.loadRegistry();
  if (!Object.prototype.hasOwnProperty.call(registry, name)) return fail(t.generic);

  const action = registry[name];
  const adapter = Object.prototype.hasOwnProperty.call(FORM_ADAPTERS, name) ? FORM_ADAPTERS[name] : undefined;
  // Avec adaptateur : on construit l'objet JSON et on appelle l'action JSON d'origine.
  const callable = (adapter ? action : (getFormCompanion(action) ?? action)) as CallableAction | undefined;
  if (typeof callable !== "function") return fail(t.generic);

  let result: ActionResultLike;
  try {
    const formData = await request.formData();
    const input = adapter ? adapter(formData) : formData;
    result = (await context.callAction(callable as never, input as never)) as unknown as ActionResultLike;
  } catch (err) {
    console.error("[form-fallback] action failed:", name, err);
    captureError(err, { tags: { source: "form-fallback", action: name } });
    return fail(t.generic);
  }

  if (result.error) return fail(errorMessage(result.error, url.pathname));

  const outcome = SUCCESS_POLICIES[name]?.(result.data, { locale: localeFromPathname(url.pathname), url });
  const dataMessage =
    typeof (result.data as { message?: unknown } | null | undefined)?.message === "string"
      ? ((result.data as { message: string }).message)
      : undefined;
  const message = outcome?.message ?? dataMessage ?? t.success;
  const redirectTo = outcome?.redirectTo;

  if (redirectTo !== undefined && isSafeRedirect(redirectTo)) {
    const external = !redirectTo.startsWith("/");
    return redirect(redirectTo, external ? null : { kind: "success", message }, secure);
  }
  return redirect(target, { kind: "success", message }, secure);
}

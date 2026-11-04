import { describe, it, expect, vi } from "vitest";
import { handleFormFallback } from "@/lib/form-fallback/handler";
import { FORM_COMPANION } from "@/lib/form-fallback/companion";
import { formAction } from "@/lib/form-fallback/action-url";
import { decodeFlash, encodeFlash, FLASH_COOKIE } from "@/lib/form-fallback/flash";
import { isSafeRedirect, SUCCESS_POLICIES } from "@/lib/form-fallback/policies";
import { localeFromPathname } from "@/lib/form-fallback/messages";

function flashOf(res: Response): { kind: string; message: string } | null {
  const cookie = res.headers.get("set-cookie");
  if (!cookie) return null;
  const value = cookie.split(";")[0].slice(FLASH_COOKIE.length + 1);
  return decodeFlash(value);
}

function setup(opts: {
  url?: string;
  method?: string;
  contentType?: string | null;
  body?: string;
  registry?: Record<string, unknown>;
  result?: unknown;
  callError?: Error;
}) {
  const url = new URL(opts.url ?? "https://site.test/fr/trips/x?tab=a&_action=createTripComment");
  const headers: Record<string, string> = {};
  if (opts.contentType !== null) headers["content-type"] = opts.contentType ?? "application/x-www-form-urlencoded";
  const request = new Request(url, {
    method: opts.method ?? "POST",
    headers,
    body: (opts.method ?? "POST") === "POST" ? (opts.body ?? "tripId=t1&content=hello") : undefined,
  });
  const callAction = vi.fn(async () => {
    if (opts.callError) throw opts.callError;
    return opts.result ?? { data: { ok: true }, error: undefined };
  });
  const form = vi.fn();
  const registry = opts.registry ?? { createTripComment: Object.assign(vi.fn(), { [FORM_COMPANION]: form }) };
  const context = { request, callAction } as never;
  const run = () => handleFormFallback(context, url, { loadRegistry: async () => registry });
  return { run, callAction, form, registry };
}

describe("handleFormFallback", () => {
  it("laisse passer les requêtes qui ne sont pas des soumissions natives", async () => {
    expect(await setup({ method: "GET" }).run()).toBeNull();
    expect(await setup({ url: "https://site.test/fr/x" }).run()).toBeNull();
    expect(await setup({ contentType: "application/json" }).run()).toBeNull();
  });

  it("appelle la jumelle form avec le FormData et redirige en 303 sans _action", async () => {
    const { run, callAction, form } = setup({});
    const res = (await run())!;
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/fr/trips/x?tab=a");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(callAction).toHaveBeenCalledTimes(1);
    const [fn, input] = callAction.mock.calls[0] as unknown as [unknown, FormData];
    expect(fn).toBe(form);
    expect(input).toBeInstanceOf(FormData);
    expect(input.get("tripId")).toBe("t1");
    expect(flashOf(res)).toEqual({ kind: "success", message: "Enregistré." });
  });

  it("utilise l'action elle-même quand elle accepte déjà les formulaires", async () => {
    const formAction = vi.fn();
    const { run, callAction } = setup({ registry: { createTripComment: formAction } });
    await run();
    expect((callAction.mock.calls[0] as unknown[])[0]).toBe(formAction);
  });

  it("refuse un nom d'action inconnu ou invalide sans rien appeler", async () => {
    for (const name of ["nope", "__proto__", "constructor", "a.b", "toString"]) {
      const { run, callAction } = setup({ url: `https://site.test/en/x?_action=${name}` });
      const res = (await run())!;
      expect(res.status).toBe(303);
      expect(callAction).not.toHaveBeenCalled();
      expect(flashOf(res)?.kind).toBe("error");
    }
  });

  it("transforme une erreur de saisie en message localisé générique", async () => {
    const { run } = setup({
      url: "https://site.test/es/trips/x?_action=createTripComment",
      result: { data: undefined, error: { type: "AstroActionInputError", issues: [{}], code: "BAD_REQUEST", message: "zod" } },
    });
    const flash = flashOf((await run())!);
    expect(flash?.kind).toBe("error");
    expect(flash?.message).toMatch(/no son válidos/);
  });

  it("mappe les codes d'erreur courants et reprend le message métier", async () => {
    const cases: Array<[string, string | undefined, RegExp]> = [
      ["UNAUTHORIZED", undefined, /connecter/],
      ["FORBIDDEN", undefined, /autorisation/],
      ["TOO_MANY_REQUESTS", undefined, /Trop de tentatives/],
      ["INTERNAL_SERVER_ERROR", "secret stack", /a échoué/],
      ["CONFLICT", "Déjà inscrite.", /Déjà inscrite\./],
    ];
    for (const [code, message, expected] of cases) {
      const { run } = setup({ result: { error: { code, message } } });
      expect(flashOf((await run())!)?.message).toMatch(expected);
    }
  });

  it("n'expose pas le détail d'une exception interne", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { run } = setup({ callError: new Error("db password leaked") });
    const flash = flashOf((await run())!);
    expect(flash?.message).not.toMatch(/password/);
    expect(flash?.kind).toBe("error");
    spy.mockRestore();
  });

  it("rejette un corps trop volumineux avant de lire le body", async () => {
    const url = new URL("https://site.test/en/x?_action=createTripComment");
    const request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "content-length": String(5 * 1024 * 1024) },
      body: "a=b",
    });
    const callAction = vi.fn();
    const res = (await handleFormFallback({ request, callAction } as never, url, { loadRegistry: async () => ({}) }))!;
    expect(res.status).toBe(303);
    expect(callAction).not.toHaveBeenCalled();
    expect(flashOf(res)?.message).toMatch(/too large/);
  });

  it("applique la politique de succès : redirection interne avec flash, externe sans flash", async () => {
    SUCCESS_POLICIES.createTripComment = () => ({ redirectTo: "/fr/booking-confirmed?x=1", message: "OK perso" });
    const internal = (await setup({}).run())!;
    expect(internal.headers.get("location")).toBe("/fr/booking-confirmed?x=1");
    expect(flashOf(internal)).toEqual({ kind: "success", message: "OK perso" });

    SUCCESS_POLICIES.createTripComment = () => ({ redirectTo: "https://pay.example/session/1" });
    const external = (await setup({}).run())!;
    expect(external.headers.get("location")).toBe("https://pay.example/session/1");
    expect(external.headers.get("set-cookie")).toBeNull();

    SUCCESS_POLICIES.createTripComment = () => ({ redirectTo: "javascript:alert(1)" });
    const unsafe = (await setup({}).run())!;
    expect(unsafe.headers.get("location")).toBe("/fr/trips/x?tab=a");
    delete SUCCESS_POLICIES.createTripComment;
  });

  it("pose le cookie flash HttpOnly/SameSite et Secure en HTTPS", async () => {
    const cookie = (await setup({}).run())!.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Secure/);
    const http = (await setup({ url: "http://localhost/fr/x?_action=createTripComment" }).run())!.headers.get("set-cookie")!;
    expect(http).not.toMatch(/Secure/);
  });
});

describe("helpers", () => {
  it("formAction conserve le chemin et la requête et ajoute _action", () => {
    expect(formAction("payBalance", new URL("https://s.test/fr/booking-confirmed?session=abc"))).toBe(
      "/fr/booking-confirmed?session=abc&_action=payBalance",
    );
    expect(formAction("x", new URL("https://s.test/fr/a?_action=old"))).toBe("/fr/a?_action=x");
  });

  it("flash : aller-retour, troncature et rejet des valeurs invalides", () => {
    expect(decodeFlash(encodeFlash({ kind: "success", message: "ok" }))).toEqual({ kind: "success", message: "ok" });
    expect(decodeFlash(encodeFlash({ kind: "error", message: "x".repeat(1000) }))?.message).toHaveLength(300);
    expect(decodeFlash("not-base64-json")).toBeNull();
    expect(decodeFlash(Buffer.from('{"kind":"evil","message":"m"}').toString("base64url"))).toBeNull();
    expect(decodeFlash(undefined)).toBeNull();
  });

  it("isSafeRedirect n'accepte que chemins internes et http(s)", () => {
    expect(isSafeRedirect("/fr/x")).toBe(true);
    expect(isSafeRedirect("https://pay.example/x")).toBe(true);
    for (const bad of ["//evil.com", "/\\evil.com", "javascript:alert(1)", "data:text/html,x", "", "/a\r\nSet-Cookie: x=1", 42]) {
      expect(isSafeRedirect(bad)).toBe(false);
    }
  });

  it("localeFromPathname retombe sur en", () => {
    expect(localeFromPathname("/ar/x")).toBe("ar");
    expect(localeFromPathname("/api/x")).toBe("en");
    expect(localeFromPathname("/")).toBe("en");
  });
});

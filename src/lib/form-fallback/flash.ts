export const FLASH_COOKIE = "atl_flash";
export const FLASH_MAX_AGE_SECONDS = 120;
const MESSAGE_MAX_LENGTH = 300;

export interface Flash {
  kind: "success" | "error";
  message: string;
}

export function encodeFlash(flash: Flash): string {
  const safe: Flash = { kind: flash.kind, message: flash.message.slice(0, MESSAGE_MAX_LENGTH) };
  return Buffer.from(JSON.stringify(safe), "utf8").toString("base64url");
}

export function decodeFlash(raw: string | undefined | null): Flash | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Flash>;
    if ((parsed.kind !== "success" && parsed.kind !== "error") || typeof parsed.message !== "string") return null;
    const message = parsed.message.trim().slice(0, MESSAGE_MAX_LENGTH);
    return message ? { kind: parsed.kind, message } : null;
  } catch {
    return null;
  }
}

export function flashSetCookie(flash: Flash, secure: boolean): string {
  const parts = [
    `${FLASH_COOKIE}=${encodeFlash(flash)}`,
    "Path=/",
    `Max-Age=${FLASH_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

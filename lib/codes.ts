export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

/** Normalises user/URL input to XXXX-XXXX, or returns null if it can't be a valid code. */
export function normaliseCode(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 8) return null;
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return CODE_PATTERN.test(code) ? code : null;
}

export function inviteUrl(code: string): string {
  const base = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  return `${base}/invite/${code}`;
}

/** Pulls a code out of a scanned invite URL (…/invite/XXXX-XXXX) or a bare code. */
export function extractCode(scanned: string): string | null {
  const text = scanned.trim();
  const fromUrl = text.match(/\/invite\/([^/?#\s]+)/i);
  return normaliseCode(fromUrl ? fromUrl[1] : text);
}

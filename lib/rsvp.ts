export type RsvpAnswer = "yes" | "no";

export const RSVP_MESSAGE_MAX = 500;
export const RSVP_DEADLINE = "6th December 2026";

export const RSVP_LABEL: Record<RsvpAnswer | "none", string> = {
  yes: "Coming",
  no: "Not coming",
  none: "No reply",
};

/** "yes" or "no" from untrusted input; anything else returns null. */
export function parseRsvp(v: unknown): RsvpAnswer | null {
  return v === "yes" || v === "no" ? v : null;
}

/** Trims a guest's message and normalises line endings. Returns null when empty, or undefined when too long. */
export function cleanRsvpMessage(v: unknown): string | null | undefined {
  const m = String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (m === "") return null;
  return m.length > RSVP_MESSAGE_MAX ? undefined : m;
}

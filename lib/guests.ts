import "server-only";
import { randomInt } from "node:crypto";
import { CODE_ALPHABET } from "./codes";
import { getSupabase, type Guest, type GuestType } from "./supabase";

export function generateCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export type NewGuest = { name: string | null; phone: string | null; type: GuestType; admits: number };

/**
 * Inserts guests, giving every non-printed guest a fresh code.
 * If a code collides with one already in the table (unique violation), new codes are drawn and the insert is retried.
 */
export async function insertGuests(rows: NewGuest[]): Promise<Guest[]> {
  const db = getSupabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const used = new Set<string>();
    const payload = rows.map((r) => {
      if (r.type === "printed") return { ...r, code: null };
      let code = generateCode();
      while (used.has(code)) code = generateCode();
      used.add(code);
      return { ...r, code };
    });
    const { data, error } = await db.from("guests").insert(payload).select("*");
    if (!error) return data as Guest[];
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not generate unique codes. Try again.");
}

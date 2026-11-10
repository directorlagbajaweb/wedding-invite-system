"use server";

import { normaliseCode } from "@/lib/codes";
import { cleanRsvpMessage, parseRsvp, RSVP_MESSAGE_MAX, type RsvpAnswer } from "@/lib/rsvp";
import { getSupabase } from "@/lib/supabase";

export type SavedRsvp = { rsvp: RsvpAnswer; message: string | null; at: string };

export type RsvpResult = { ok: true; data: SavedRsvp } | { ok: false; error: string };

/**
 * Saves the RSVP for the invite with this code. The code is the guest's only credential,
 * so this only ever touches (and returns) that one guest's RSVP fields.
 */
export async function sendRsvp(code: unknown, rsvp: unknown, message: unknown): Promise<RsvpResult> {
  const c = normaliseCode(String(code ?? ""));
  const answer = parseRsvp(rsvp);
  const msg = cleanRsvpMessage(message);
  if (!c) return { ok: false, error: "We couldn’t find this invitation." };
  if (!answer) return { ok: false, error: "Please choose accept or decline." };
  if (msg === undefined) {
    return { ok: false, error: `Please keep your message under ${RSVP_MESSAGE_MAX} characters.` };
  }

  const { data, error } = await getSupabase()
    .from("guests")
    .update({ rsvp: answer, rsvp_message: msg, rsvp_at: new Date().toISOString() })
    .eq("code", c)
    .not("name", "is", null)
    .select("rsvp, rsvp_message, rsvp_at")
    .maybeSingle();

  if (error) return { ok: false, error: "Sorry, we couldn’t save your RSVP. Please try again." };
  if (!data) return { ok: false, error: "We couldn’t find this invitation." };
  return {
    ok: true,
    data: { rsvp: data.rsvp as RsvpAnswer, message: data.rsvp_message as string | null, at: data.rsvp_at as string },
  };
}

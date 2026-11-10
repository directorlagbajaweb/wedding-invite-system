"use server";

import { refresh } from "next/cache";
import { attemptLogin, hasSession } from "@/lib/auth";
import { inviteUrl } from "@/lib/codes";
import { defaultAdmits, MAX_ADMITS, MIN_ADMITS, normaliseGuestType, parseAdmits, toCsv } from "@/lib/csv";
import { insertGuests, type NewGuest } from "@/lib/guests";
import { parseRsvp } from "@/lib/rsvp";
import { getSupabase, type Guest } from "@/lib/supabase";

/* ---------- Password gate ---------- */

export type PasswordState = { error?: string };

export async function submitPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Enter the password." };

  const result = await attemptLogin("admin", password);
  if (result.ok) {
    refresh();
    return {};
  }
  if (result.error === "locked") {
    return { error: `Too many wrong tries. Try again in ${result.retryInSeconds} seconds.` };
  }
  return {
    error: `Wrong password. ${result.remaining} ${result.remaining === 1 ? "try" : "tries"} left.`,
  };
}

/* ---------- Helpers ---------- */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const NOT_SIGNED_IN = "Your session has expired. Reload the page and sign in again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanName(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function cleanPhone(v: unknown): string | null {
  const p = String(v ?? "").trim().slice(0, 30);
  return p === "" ? null : p;
}

const cleanType = normaliseGuestType;

const BAD_ADMITS = `Admits must be a whole number from ${MIN_ADMITS} to ${MAX_ADMITS}.`;

/** Blank means the default for the name (2 for couples, otherwise 1). Invalid returns null. */
function cleanAdmits(v: unknown, name: string): number | null {
  if (String(v ?? "").trim() === "") return defaultAdmits(name);
  return parseAdmits(v);
}

/* ---------- Data ---------- */

export async function loadGuests(): Promise<Guest[] | null> {
  if (!(await hasSession("admin"))) return null;
  const { data, error } = await getSupabase()
    .from("guests")
    .select("id, name, phone, type, code, admits, rsvp, rsvp_message, rsvp_at, arrived_at, created_at")
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error("Could not load guests");
  return data as Guest[];
}

/* ---------- Add guest ---------- */

export async function addGuest(input: {
  name: string;
  phone: string;
  type: string;
  admits: string | number;
}): Promise<ActionResult<{ name: string; code: string | null; url: string | null; phone: string | null }>> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  const name = cleanName(input.name);
  const type = cleanType(input.type);
  if (!name) return { ok: false, error: "Name is required." };
  if (!type) return { ok: false, error: "Type must be e-invite or printed." };
  const admits = cleanAdmits(input.admits, name);
  if (admits === null) return { ok: false, error: BAD_ADMITS };

  try {
    const [g] = await insertGuests([{ name, phone: cleanPhone(input.phone), type, admits }]);
    refresh();
    return {
      ok: true,
      data: { name: g.name ?? name, code: g.code, url: g.code ? inviteUrl(g.code) : null, phone: g.phone },
    };
  } catch {
    return { ok: false, error: "Could not save the guest. Try again." };
  }
}

/* ---------- CSV import ---------- */

export async function importGuests(
  rows: { name: string; phone: string; type: string; admits?: string | number }[],
): Promise<ActionResult<{ inserted: number; eInvites: number; printed: number }>> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Nothing to import." };
  if (rows.length > 1000) return { ok: false, error: "Import at most 1000 rows at a time." };

  const clean: NewGuest[] = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    const type = cleanType(r.type);
    if (!name) continue;
    if (!type) return { ok: false, error: `"${name}" has an unknown type. Use e-invite or printed.` };
    const admits = cleanAdmits(r.admits, name);
    if (admits === null) return { ok: false, error: `"${name}": ${BAD_ADMITS}` };
    clean.push({ name, phone: cleanPhone(r.phone), type, admits });
  }
  if (clean.length === 0) return { ok: false, error: "Nothing to import." };

  try {
    const saved = await insertGuests(clean);
    refresh();
    return {
      ok: true,
      data: {
        inserted: saved.length,
        eInvites: saved.filter((g) => g.type === "e-invite").length,
        printed: saved.filter((g) => g.type === "printed").length,
      },
    };
  } catch {
    return { ok: false, error: "Import failed. Nothing was saved. Try again." };
  }
}

/* ---------- Spares ---------- */

export async function createSpares(count: number): Promise<ActionResult<{ created: number }>> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1 || n > 50) return { ok: false, error: "Choose a number from 1 to 50." };

  try {
    const rows: NewGuest[] = Array.from({ length: n }, () => ({ name: null, phone: null, type: "spare", admits: 1 }));
    const saved = await insertGuests(rows);
    refresh();
    return { ok: true, data: { created: saved.length } };
  } catch {
    return { ok: false, error: "Could not create spare codes. Try again." };
  }
}

export async function assignSpare(
  id: string,
  name: string,
  phone: string,
  admits: string | number,
): Promise<ActionResult<{ code: string; url: string; phone: string | null; name: string }>> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  const n = cleanName(name);
  if (!UUID.test(id)) return { ok: false, error: "Unknown spare." };
  if (!n) return { ok: false, error: "Name is required." };
  const a = cleanAdmits(admits, n);
  if (a === null) return { ok: false, error: BAD_ADMITS };

  const p = cleanPhone(phone);
  const { data, error } = await getSupabase()
    .from("guests")
    .update({ name: n, phone: p, type: "e-invite", admits: a })
    .eq("id", id)
    .eq("type", "spare")
    .is("name", null)
    .select("code")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not assign the spare. Try again." };
  if (!data?.code) return { ok: false, error: "That spare has already been assigned." };
  refresh();
  return { ok: true, data: { code: data.code, url: inviteUrl(data.code), phone: p, name: n } };
}

/* ---------- Row actions ---------- */

export async function updatePhone(id: string, phone: string): Promise<ActionResult> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  if (!UUID.test(id)) return { ok: false, error: "Unknown guest." };
  const { error } = await getSupabase().from("guests").update({ phone: cleanPhone(phone) }).eq("id", id);
  if (error) return { ok: false, error: "Could not save the phone number." };
  refresh();
  return { ok: true, data: undefined };
}

export async function updateAdmits(id: string, admits: string | number): Promise<ActionResult> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  if (!UUID.test(id)) return { ok: false, error: "Unknown guest." };
  const a = parseAdmits(admits);
  if (a === null) return { ok: false, error: BAD_ADMITS };
  const { error } = await getSupabase().from("guests").update({ admits: a }).eq("id", id);
  if (error) return { ok: false, error: "Could not save admits." };
  refresh();
  return { ok: true, data: undefined };
}

/** Sets a guest's RSVP by hand (e.g. they replied by phone). "" clears it, along with any message. */
export async function setRsvp(id: string, rsvp: string): Promise<ActionResult> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  if (!UUID.test(id)) return { ok: false, error: "Unknown guest." };
  const answer = parseRsvp(rsvp);
  if (answer === null && rsvp !== "") return { ok: false, error: "Choose Coming, Not coming or No reply." };

  const { data, error } = await getSupabase()
    .from("guests")
    .update(
      answer
        ? { rsvp: answer, rsvp_at: new Date().toISOString() }
        : { rsvp: null, rsvp_message: null, rsvp_at: null },
    )
    .eq("id", id)
    .not("name", "is", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not save the RSVP." };
  if (!data) return { ok: false, error: "Only guests with a name can RSVP." };
  refresh();
  return { ok: true, data: undefined };
}

export async function undoCheckIn(id: string): Promise<ActionResult> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  if (!UUID.test(id)) return { ok: false, error: "Unknown guest." };
  const { error } = await getSupabase().from("guests").update({ arrived_at: null }).eq("id", id);
  if (error) return { ok: false, error: "Could not undo the check-in." };
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteGuest(id: string): Promise<ActionResult> {
  if (!(await hasSession("admin"))) return { ok: false, error: NOT_SIGNED_IN };
  if (!UUID.test(id)) return { ok: false, error: "Unknown guest." };
  const db = getSupabase();

  let { error } = await db.from("guests").delete().eq("id", id);
  if (error?.code === "23503") {
    // The guest has scan history. Keep the log rows (they still hold the code) but detach them.
    const detach = await db.from("scans").update({ guest_id: null }).eq("guest_id", id);
    if (detach.error) {
      return { ok: false, error: "This guest has check-in history and can't be deleted." };
    }
    ({ error } = await db.from("guests").delete().eq("id", id));
  }
  if (error) return { ok: false, error: "Could not delete the guest." };
  refresh();
  return { ok: true, data: undefined };
}

/* ---------- Export ---------- */

const lagosDateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export async function exportGuestsCsv(): Promise<ActionResult<string>> {
  const guests = await loadGuests().catch(() => undefined);
  if (guests === null) return { ok: false, error: NOT_SIGNED_IN };
  if (!guests) return { ok: false, error: "Could not load guests." };

  // Same "expected" rule as the stats: named guests plus anyone who arrived on an unnamed spare.
  const expected = guests.filter((g) => g.name || g.arrived_at);
  const people = expected.reduce((sum, g) => sum + (g.admits ?? 1), 0);
  const peopleArrived = guests.filter((g) => g.arrived_at).reduce((sum, g) => sum + (g.admits ?? 1), 0);

  const rows = guests.map((g) => [
    g.name ?? "",
    g.phone ?? "",
    g.type,
    g.code ?? "",
    g.code ? inviteUrl(g.code) : "",
    String(g.admits ?? 1),
    g.arrived_at ? lagosDateTime.format(new Date(g.arrived_at)).replace(",", "") : "",
    g.rsvp ?? "",
    g.rsvp_message ?? "",
    g.rsvp_at ? lagosDateTime.format(new Date(g.rsvp_at)).replace(",", "") : "",
  ]);
  return {
    ok: true,
    data: toCsv([
      [
        "name",
        "phone",
        "type",
        "code",
        "invite_link",
        "admits",
        "arrived_at (Lagos time)",
        "rsvp",
        "rsvp_message",
        "rsvp_at (Lagos time)",
      ],
      ...rows,
      // Totals row. The name column is blank so re-importing this file skips it.
      [],
      ["", "", "", "", "Total people", String(people), `${peopleArrived} arrived`],
    ]),
  };
}


"use server";

import { refresh } from "next/cache";
import { attemptLogin, hasSession } from "@/lib/auth";
import { extractCode } from "@/lib/codes";
import { getSupabase, type GuestType } from "@/lib/supabase";

/* ---------- PIN gate ---------- */

export type PinState = { error?: string };

export async function submitPin(_prev: PinState, formData: FormData): Promise<PinState> {
  const pin = String(formData.get("pin") ?? "").trim();
  if (!pin) return { error: "Enter the PIN." };

  const result = await attemptLogin("usher", pin);
  if (result.ok) {
    refresh();
    return {};
  }
  if (result.error === "locked") {
    return { error: `Too many wrong tries. Try again in ${result.retryInSeconds} seconds.` };
  }
  return {
    error: `Wrong PIN. ${result.remaining} ${result.remaining === 1 ? "try" : "tries"} left.`,
  };
}

/* ---------- Check-in ---------- */

export type CheckInResult =
  | { status: "valid"; name: string; admits: number }
  | { status: "already_used"; name: string; time: string; admits: number }
  | { status: "invalid" }
  | { status: "error"; message: string };

type RpcResponse = {
  result: "valid" | "already_used" | "invalid";
  name: string | null;
  arrived_at: string | null;
  admits: number | null;
};

const lagosTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return lagosTime.format(new Date(iso)).replace(/\s/g, "").toLowerCase();
}

async function runCheckIn(
  code: string | null,
  guestId: string | null,
  method: "qr" | "name",
): Promise<CheckInResult> {
  if (!(await hasSession("usher"))) {
    return { status: "error", message: "Session expired. Reload and enter the PIN." };
  }

  const { data, error } = await getSupabase().rpc("check_in", {
    p_code: code,
    p_guest_id: guestId,
    p_method: method,
  });
  if (error || !data) {
    return { status: "error", message: "Could not reach the guest list. Try again." };
  }

  const res = data as RpcResponse;
  const name = res.name?.trim() || "Guest";
  const admits = res.admits ?? 1;
  if (res.result === "valid") return { status: "valid", name, admits };
  if (res.result === "already_used") {
    return { status: "already_used", name, time: formatTime(res.arrived_at), admits };
  }
  return { status: "invalid" };
}

export async function checkInScanned(scanned: string): Promise<CheckInResult> {
  // Unrecognisable scans still go through check_in so they are logged as invalid.
  const code = extractCode(scanned) ?? scanned.trim().slice(0, 64);
  return runCheckIn(code, null, "qr");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkInGuest(guestId: string): Promise<CheckInResult> {
  if (!UUID.test(guestId)) return { status: "invalid" };
  return runCheckIn(null, guestId, "name");
}

/* ---------- Name search ---------- */

export type SearchRow = {
  id: string;
  name: string;
  type: GuestType;
  admits: number;
  arrivedTime: string | null;
};

export async function searchGuests(query: string): Promise<SearchRow[] | null> {
  if (!(await hasSession("usher"))) return null;
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return [];

  // Escape LIKE wildcards so the search is a plain "contains".
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await getSupabase()
    .from("guests")
    .select("id, name, type, admits, arrived_at")
    .not("name", "is", null)
    .ilike("name", pattern)
    .order("name")
    .limit(30);
  if (error || !data) return null;

  return data.map((g) => ({
    id: g.id as string,
    name: g.name as string,
    type: g.type as GuestType,
    admits: (g.admits as number | null) ?? 1,
    arrivedTime: g.arrived_at ? formatTime(g.arrived_at as string) : null,
  }));
}

/* ---------- Live count ---------- */

export type Stats = { arrived: number; total: number };

export async function getStats(): Promise<Stats | null> {
  if (!(await hasSession("usher"))) return null;
  return loadStats();
}

const PAGE = 1000;

/**
 * Counts people, not invites: each invite contributes its admits.
 * Expected = everyone with a name, plus anyone who arrived on an unnamed spare.
 */
async function loadStats(): Promise<Stats | null> {
  const db = getSupabase();
  let total = 0;
  let arrived = 0;
  // Page through, since the API caps rows per request.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("guests")
      .select("admits, arrived_at")
      .or("name.not.is.null,arrived_at.not.is.null")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error || !data) return null;
    for (const g of data) {
      const a = (g.admits as number | null) ?? 1;
      total += a;
      if (g.arrived_at) arrived += a;
    }
    if (data.length < PAGE) break;
  }
  return { total, arrived };
}

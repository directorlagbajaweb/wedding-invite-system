"use client";

import { useMemo, useState } from "react";
import { MAX_ADMITS, MIN_ADMITS } from "@/lib/csv";
import { RSVP_LABEL } from "@/lib/rsvp";
import type { Guest, GuestType } from "@/lib/supabase";
import { deleteGuest, setRsvp, undoCheckIn, updateAdmits, updatePhone } from "./actions";
import { btnSmall, card, formatArrival, input, inviteLink, useCopy, WhatsAppButton } from "./ui";

const TYPE_LABEL: Record<GuestType, string> = {
  "e-invite": "E-invite",
  printed: "Printed",
  spare: "Spare",
};

type TypeFilter = "all" | GuestType;
type ArrivedFilter = "all" | "arrived" | "not";
type RsvpFilter = "all" | "yes" | "no" | "none";

export function GuestTable({ guests, siteUrl }: { guests: Guest[]; siteUrl: string }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [arrived, setArrived] = useState<ArrivedFilter>("all");
  const [rsvp, setRsvpFilter] = useState<RsvpFilter>("all");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests
      .filter((g) => (type === "all" ? true : g.type === type))
      .filter((g) => (arrived === "all" ? true : arrived === "arrived" ? !!g.arrived_at : !g.arrived_at))
      .filter((g) =>
        rsvp === "all"
          ? true
          : rsvp === "none"
            ? !g.rsvp && !!(g.name || g.arrived_at) // same "No reply" as the stats
            : g.rsvp === rsvp,
      )
      .filter((g) => (q ? (g.name ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (!a.name !== !b.name) return a.name ? -1 : 1; // unassigned spares last
        return (a.name ?? a.code ?? "").localeCompare(b.name ?? b.code ?? "");
      });
  }, [guests, query, type, arrived, rsvp]);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    setError("");
    const res = await fn().catch(() => ({ ok: false, error: "Something went wrong. Try again." }));
    setBusyId(null);
    if (!res.ok) setError(res.error ?? "Something went wrong.");
  }

  return (
    <section className={card} aria-labelledby="guests-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="guests-title" className="text-lg font-semibold">
          Guests{" "}
          <span className="font-normal text-muted">
            ({rows.length}
            {rows.length !== guests.length ? ` of ${guests.length}` : ""})
          </span>
        </h2>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="gt-search" className="sr-only">
              Search by name
            </label>
            <input
              id="gt-search"
              type="search"
              placeholder="Search by name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${input} w-56`}
            />
          </div>
          <div>
            <label htmlFor="gt-type" className="sr-only">
              Filter by type
            </label>
            <select
              id="gt-type"
              value={type}
              onChange={(e) => setType(e.target.value as TypeFilter)}
              className={`${input} w-40`}
            >
              <option value="all">All types</option>
              <option value="e-invite">E-invites</option>
              <option value="printed">Printed</option>
              <option value="spare">Spares</option>
            </select>
          </div>
          <div>
            <label htmlFor="gt-arrived" className="sr-only">
              Filter by arrival
            </label>
            <select
              id="gt-arrived"
              value={arrived}
              onChange={(e) => setArrived(e.target.value as ArrivedFilter)}
              className={`${input} w-44`}
            >
              <option value="all">Arrived or not</option>
              <option value="arrived">Arrived</option>
              <option value="not">Not arrived</option>
            </select>
          </div>
          <div>
            <label htmlFor="gt-rsvp" className="sr-only">
              Filter by RSVP
            </label>
            <select
              id="gt-rsvp"
              value={rsvp}
              onChange={(e) => setRsvpFilter(e.target.value as RsvpFilter)}
              className={`${input} w-40`}
            >
              <option value="all">All RSVPs</option>
              <option value="yes">Coming</option>
              <option value="no">Not coming</option>
              <option value="none">No reply</option>
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-warning">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-hairline bg-white">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Phone</th>
              <th scope="col" className="px-4 py-3 font-medium">Admits</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Code</th>
              <th scope="col" className="px-4 py-3 font-medium">RSVP</th>
              <th scope="col" className="px-4 py-3 font-medium">Arrived</th>
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No guests match.
                </td>
              </tr>
            ) : (
              rows.map((g) => {
                const url = g.code ? inviteLink(siteUrl, g.code) : null;
                const label = g.name ?? `spare ${g.code}`;
                const busy = busyId === g.id;
                return (
                  <tr key={g.id} className={busy ? "opacity-60" : ""}>
                    <td className="px-4 py-3 font-medium">
                      {g.name ?? <span className="font-normal text-muted italic">Unassigned spare</span>}
                    </td>
                    <td className="px-4 py-3">
                      <PhoneCell
                        key={`${g.id}:${g.phone ?? ""}`}
                        guestId={g.id}
                        label={label}
                        phone={g.phone}
                        onSave={(p) => run(g.id, () => updatePhone(g.id, p))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <AdmitsCell
                        key={`${g.id}:${g.admits}`}
                        guestId={g.id}
                        label={label}
                        admits={g.admits ?? 1}
                        onSave={(a) => run(g.id, () => updateAdmits(g.id, a))}
                      />
                    </td>
                    <td className="px-4 py-3">{TYPE_LABEL[g.type]}</td>
                    <td className="px-4 py-3 font-mono tracking-wider whitespace-nowrap">
                      {g.code ?? <span className="text-muted">&ndash;</span>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <RsvpCell
                        guest={g}
                        label={label}
                        busy={busy}
                        onChange={(value) => {
                          if (
                            value === "" &&
                            g.rsvp_message &&
                            !window.confirm(`Clear the RSVP for ${label}? Their message will be deleted too.`)
                          ) {
                            return;
                          }
                          void run(g.id, () => setRsvp(g.id, value));
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {g.arrived_at ? (
                        <span className="font-medium text-success">{formatArrival(g.arrived_at)}</span>
                      ) : (
                        <span className="text-muted">&ndash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <WhatsAppButton phone={g.phone} name={g.name ?? ""} url={g.name ? url : null} />
                        <button
                          type="button"
                          className={btnSmall}
                          disabled={!url}
                          onClick={() => url && copy(url, g.id)}
                        >
                          {copied === g.id ? "Copied" : "Copy link"}
                        </button>
                        {g.arrived_at ? (
                          <button
                            type="button"
                            className={btnSmall}
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Undo check-in for ${label}? They will be able to enter again.`)) {
                                void run(g.id, () => undoCheckIn(g.id));
                              }
                            }}
                          >
                            Undo check-in
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={`${btnSmall} border-warning/60 text-warning`}
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Delete ${label}? Their invite link will stop working. This can't be undone.`)) {
                              void run(g.id, () => deleteGuest(g.id));
                            }
                          }}
                          aria-label={`Delete ${label}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PhoneCell({
  guestId,
  label,
  phone,
  onSave,
}: {
  guestId: string;
  label: string;
  phone: string | null;
  onSave: (phone: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value.trim() === (phone ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(value.trim());
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="-mx-2 rounded-lg px-2 py-1 text-left whitespace-nowrap hover:bg-paper"
        aria-label={`Edit phone for ${label}${phone ? `, currently ${phone}` : ""}`}
      >
        {phone || <span className="text-muted">Add phone</span>}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor={`phone-${guestId}`} className="sr-only">
        Phone for {label}
      </label>
      <input
        id={`phone-${guestId}`}
        type="tel"
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue(phone ?? "");
            setEditing(false);
          }
        }}
        className={`${input} h-9 w-40`}
      />
      <button type="submit" disabled={saving} className={btnSmall}>
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function AdmitsCell({
  guestId,
  label,
  admits,
  onSave,
}: {
  guestId: string;
  label: string;
  admits: number;
  onSave: (admits: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(admits));
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(value);
    if (n === admits) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(n);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="-mx-2 rounded-lg px-2 py-1 text-left tabular-nums hover:bg-paper"
        aria-label={`Edit admits for ${label}, currently ${admits}`}
      >
        {admits}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor={`admits-${guestId}`} className="sr-only">
        Admits for {label}
      </label>
      <input
        id={`admits-${guestId}`}
        type="number"
        inputMode="numeric"
        min={MIN_ADMITS}
        max={MAX_ADMITS}
        step={1}
        required
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue(String(admits));
            setEditing(false);
          }
        }}
        className={`${input} h-9 w-20`}
      />
      <button type="submit" disabled={saving} className={btnSmall}>
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

const RSVP_COLOUR = { yes: "text-success", no: "text-warning", none: "text-muted" } as const;

function RsvpCell({
  guest,
  label,
  busy,
  onChange,
}: {
  guest: Guest;
  label: string;
  busy: boolean;
  onChange: (value: "" | "yes" | "no") => void;
}) {
  const [showMessage, setShowMessage] = useState(false);
  if (!guest.name) return <span className="text-muted">&ndash;</span>;

  const status = guest.rsvp ?? "none";
  const messageId = `rsvp-msg-${guest.id}`;
  return (
    <div className="w-44">
      <label htmlFor={`rsvp-${guest.id}`} className="sr-only">
        RSVP for {label}
      </label>
      <select
        id={`rsvp-${guest.id}`}
        value={guest.rsvp ?? ""}
        disabled={busy}
        onChange={(e) => onChange(e.target.value as "" | "yes" | "no")}
        className={`h-9 rounded-lg border border-hairline bg-white px-2 text-sm font-medium focus:border-gold focus:outline-none ${RSVP_COLOUR[status]}`}
      >
        <option value="yes">{RSVP_LABEL.yes}</option>
        <option value="no">{RSVP_LABEL.no}</option>
        <option value="">{RSVP_LABEL.none}</option>
      </select>
      {guest.rsvp_at ? <p className="mt-1 text-xs text-muted">{formatArrival(guest.rsvp_at)}</p> : null}
      {guest.rsvp_message ? (
        <>
          <button
            type="button"
            onClick={() => setShowMessage((v) => !v)}
            aria-expanded={showMessage}
            aria-controls={messageId}
            className="mt-1 text-xs font-medium text-gold underline underline-offset-2"
          >
            {showMessage ? "Hide message" : "Message"}
          </button>
          {showMessage ? (
            <p id={messageId} className="mt-1 text-sm whitespace-pre-line break-words">
              {guest.rsvp_message}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

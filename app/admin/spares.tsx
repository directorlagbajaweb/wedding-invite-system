"use client";

import { useState } from "react";
import type { Guest } from "@/lib/supabase";
import { assignSpare, createSpares } from "./actions";
import { btnPrimary, btnSmall, card, formatArrival, input, inviteLink, NewInviteLink, useCopy } from "./ui";

type Assigned = { name: string; phone: string | null; url: string };

export function Spares({ guests, siteUrl }: { guests: Guest[]; siteUrl: string }) {
  const [count, setCount] = useState("10");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Assigned | null>(null);
  const { copied, copy } = useCopy();

  const spares = guests.filter((g) => g.type === "spare" && !g.name && g.code);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      setMessage({ ok: false, text: "Choose a number from 1 to 50." });
      return;
    }
    setPending(true);
    setMessage(null);
    const res = await createSpares(n).catch(() => null);
    setPending(false);
    setMessage(
      res && res.ok
        ? { ok: true, text: `Created ${res.data.created} spare code${res.data.created === 1 ? "" : "s"}.` }
        : { ok: false, text: res?.error ?? "Could not create spare codes." },
    );
  }

  return (
    <section className={card} aria-labelledby="spares-title">
      <h2 id="spares-title" className="text-lg font-semibold">
        Spare codes
      </h2>
      <p className="mt-1 text-sm text-muted">
        For last-minute guests. Assign a name later and it becomes a normal e-invite.
      </p>

      <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="spare-count" className="text-sm font-medium">
            How many
          </label>
          <input
            id="spare-count"
            type="number"
            min={1}
            max={50}
            required
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={`${input} mt-1 w-28`}
          />
        </div>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Creating…" : "Create spare codes"}
        </button>
      </form>
      {message ? (
        <p role="status" className={`mt-2 text-sm ${message.ok ? "text-success" : "text-warning"}`}>
          {message.text}
        </p>
      ) : null}

      {assigned ? <NewInviteLink name={assigned.name} phone={assigned.phone} url={assigned.url} /> : null}

      <h3 className="mt-6 text-sm font-semibold">
        Unassigned <span className="font-normal text-muted">({spares.length})</span>
      </h3>
      {spares.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No unassigned spare codes.</p>
      ) : (
        <ul className="mt-2 max-h-80 divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline bg-white">
          {spares.map((s) => {
            const url = inviteLink(siteUrl, s.code!);
            return (
              <li key={s.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-sm tracking-wider">{s.code}</span>
                    {s.arrived_at ? (
                      <span className="ml-2 text-xs text-success">Used at gate {formatArrival(s.arrived_at)}</span>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={btnSmall} onClick={() => copy(url, s.id)}>
                      {copied === s.id ? "Copied" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      className={btnSmall}
                      aria-expanded={assigningId === s.id}
                      onClick={() => setAssigningId((id) => (id === s.id ? null : s.id))}
                    >
                      Assign name
                    </button>
                  </div>
                </div>
                {assigningId === s.id ? (
                  <AssignForm
                    id={s.id}
                    onDone={(a) => {
                      setAssigningId(null);
                      setAssigned(a);
                    }}
                    onCancel={() => setAssigningId(null)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AssignForm({
  id,
  onDone,
  onCancel,
}: {
  id: string;
  onDone: (a: Assigned) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await assignSpare(id, name, phone).catch(() => null);
    setPending(false);
    if (!res || !res.ok) {
      setError(res?.error ?? "Could not assign the spare.");
      return;
    }
    onDone({ name: res.data.name, phone: res.data.phone, url: res.data.url });
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
      <label className="sr-only" htmlFor={`as-name-${id}`}>
        Name
      </label>
      <input
        id={`as-name-${id}`}
        required
        autoFocus
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={input}
      />
      <label className="sr-only" htmlFor={`as-phone-${id}`}>
        Phone (optional)
      </label>
      <input
        id={`as-phone-${id}`}
        type="tel"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className={input}
      />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={onCancel} className={btnSmall + " h-11"}>
        Cancel
      </button>
      {error ? (
        <p role="alert" className="text-sm text-warning sm:col-span-4">
          {error}
        </p>
      ) : null}
    </form>
  );
}

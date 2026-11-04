"use client";

import { useState } from "react";
import { addGuest } from "./actions";
import { btnPrimary, card, input, NewInviteLink } from "./ui";

type Created = { name: string; code: string | null; url: string | null; phone: string | null };

export function AddGuest() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"e-invite" | "printed">("e-invite");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await addGuest({ name, phone, type }).catch(() => null);
    setPending(false);
    if (!res || !res.ok) {
      setError(res?.error ?? "Could not save the guest.");
      return;
    }
    setCreated(res.data);
    setName("");
    setPhone("");
  }

  return (
    <section className={card} aria-labelledby="add-guest-title">
      <h2 id="add-guest-title" className="text-lg font-semibold">
        Add a guest
      </h2>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="ag-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="ag-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${input} mt-1`}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="ag-phone" className="text-sm font-medium">
            Phone <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="ag-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0803 123 4567"
            className={`${input} mt-1`}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="ag-type" className="text-sm font-medium">
            Type
          </label>
          <select
            id="ag-type"
            value={type}
            onChange={(e) => setType(e.target.value as "e-invite" | "printed")}
            className={`${input} mt-1`}
          >
            <option value="e-invite">E-invite (gets a QR code)</option>
            <option value="printed">Printed card (no code)</option>
          </select>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Add guest"}
          </button>
          {error ? (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          ) : null}
        </div>
      </form>

      {created ? (
        created.url ? (
          <NewInviteLink name={created.name} phone={created.phone} url={created.url} />
        ) : (
          <p role="status" className="mt-4 text-sm text-success">
            Saved {created.name} as a printed-card guest (no code).
          </p>
        )
      ) : null}
    </section>
  );
}

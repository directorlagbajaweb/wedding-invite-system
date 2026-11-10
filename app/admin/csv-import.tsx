"use client";

import { useRef, useState } from "react";
import { defaultAdmits, MAX_ADMITS, MIN_ADMITS, normaliseGuestType, parseAdmits, parseCsv } from "@/lib/csv";
import type { Guest } from "@/lib/supabase";
import { importGuests } from "./actions";
import { btnPrimary, btnSecondary, card } from "./ui";

type PreviewRow = {
  line: number;
  name: string;
  phone: string;
  rawType: string;
  type: "e-invite" | "printed" | null;
  rawAdmits: string;
  /** null when the admits cell is filled in but isn't a whole number from 1 to 10. */
  admits: number | null;
  duplicate: "file" | "existing" | null;
  include: boolean;
};

type Preview = { fileName: string; rows: PreviewRow[]; blankSkipped: number };

const key = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

function buildPreview(fileName: string, text: string, existing: Guest[]): Preview | string {
  const table = parseCsv(text);
  if (table.length === 0) return "The file is empty.";

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = {
    name: header.indexOf("name"),
    phone: header.indexOf("phone"),
    type: header.indexOf("type"),
    admits: header.indexOf("admits"),
  };
  if (col.name === -1) {
    return "The first row must be a header with a “name” column (and optionally phone, type, admits).";
  }

  const known = new Set(existing.filter((g) => g.name).map((g) => key(g.name!)));
  const seen = new Set<string>();
  const rows: PreviewRow[] = [];
  let blankSkipped = 0;

  table.slice(1).forEach((cells, i) => {
    const get = (c: number) => (c >= 0 ? (cells[c] ?? "").trim() : "");
    const name = get(col.name).replace(/\s+/g, " ");
    if (!name) {
      blankSkipped++;
      return;
    }
    const rawType = get(col.type);
    const type = normaliseGuestType(rawType);
    const rawAdmits = get(col.admits);
    const admits = rawAdmits === "" ? defaultAdmits(name) : parseAdmits(rawAdmits);
    const k = key(name);
    const duplicate = known.has(k) ? "existing" : seen.has(k) ? "file" : null;
    seen.add(k);
    rows.push({
      line: i + 2,
      name,
      phone: get(col.phone),
      rawType,
      type,
      rawAdmits,
      admits,
      duplicate,
      include: type !== null && admits !== null && duplicate === null,
    });
  });

  if (rows.length === 0) return "No guests found in the file.";
  return { fileName, rows, blankSkipped };
}

const importable = (r: PreviewRow) => r.include && r.type !== null && r.admits !== null;

export function CsvImport({ existing }: { existing: Guest[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [saving, setSaving] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setDone("");
    setError("");
    setPreview(null);
    if (!file) return;
    const result = buildPreview(file.name, await file.text(), existing);
    if (typeof result === "string") setError(result);
    else setPreview(result);
  }

  function toggle(line: number) {
    setPreview((p) =>
      p ? { ...p, rows: p.rows.map((r) => (r.line === line ? { ...r, include: !r.include } : r)) } : p,
    );
  }

  function reset() {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!preview) return;
    const chosen = preview.rows.filter(importable);
    if (chosen.length === 0) return;
    setSaving(true);
    setError("");
    const res = await importGuests(
      chosen.map((r) => ({ name: r.name, phone: r.phone, type: r.type!, admits: r.admits! })),
    ).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setError(res?.error ?? "Import failed. Nothing was saved.");
      return;
    }
    setDone(
      `Imported ${res.data.inserted} guests: ${res.data.eInvites} e-invites with codes, ${res.data.printed} printed.`,
    );
    reset();
  }

  const rows = preview?.rows ?? [];
  const chosen = rows.filter(importable);
  const dupes = rows.filter((r) => r.duplicate).length;
  const badType = rows.filter((r) => !r.type).length;
  const badAdmits = rows.filter((r) => r.admits === null).length;
  const chosenPeople = chosen.reduce((sum, r) => sum + (r.admits ?? 0), 0);

  return (
    <section className={card} aria-labelledby="csv-title">
      <h2 id="csv-title" className="text-lg font-semibold">
        Upload guest list (CSV)
      </h2>
      <p className="mt-1 text-sm text-muted">
        Columns: <code>name</code>, <code>phone</code>, <code>type</code> (e-invite or printed; blank means
        e-invite), <code>admits</code> ({MIN_ADMITS}&ndash;{MAX_ADMITS}; blank means 2 if the name has
        &ldquo;&amp;&rdquo;, otherwise 1). You&rsquo;ll see a preview before anything is saved.
      </p>

      <label htmlFor="csv-file" className="mt-4 block text-sm font-medium">
        CSV file
      </label>
      <input
        id="csv-file"
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        className="mt-1 block text-sm file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border file:border-gold file:bg-transparent file:px-4 file:font-medium file:text-ink"
      />

      {error ? (
        <p role="alert" className="mt-3 text-sm text-warning">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-3 text-sm font-medium text-success">
          {done}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-5">
          <p className="text-sm" role="status">
            <strong>{preview.fileName}</strong>: {rows.length} guests found
            {preview.blankSkipped
              ? `, ${preview.blankSkipped} blank row${preview.blankSkipped === 1 ? "" : "s"} skipped`
              : ""}
            {dupes ? `, ${dupes} possible duplicate${dupes === 1 ? "" : "s"} (unticked)` : ""}
            {badType ? `, ${badType} with an unknown type (can’t import)` : ""}
            {badAdmits ? `, ${badAdmits} with invalid admits (can’t import)` : ""}.
          </p>

          <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-hairline bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-paper text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Import</th>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Admits</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((r) => (
                  <tr key={r.line} className={r.include ? "" : "text-muted"}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={r.include}
                        disabled={!r.type || r.admits === null}
                        onChange={() => toggle(r.line)}
                        aria-label={`Import ${r.name}`}
                        className="h-4 w-4 accent-[#B8894F]"
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.line}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2">{r.phone || <span className="text-muted">&ndash;</span>}</td>
                    <td className="px-3 py-2">{r.type ?? <span className="text-warning">{r.rawType}</span>}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.admits ?? <span className="text-warning">{r.rawAdmits}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {!r.type ? (
                        <span className="text-warning">Unknown type: use e-invite or printed</span>
                      ) : r.admits === null ? (
                        <span className="text-warning">
                          Invalid admits: use a whole number from {MIN_ADMITS} to {MAX_ADMITS}
                        </span>
                      ) : r.duplicate === "existing" ? (
                        <span className="text-warning">Duplicate: already in guest list</span>
                      ) : r.duplicate === "file" ? (
                        <span className="text-warning">Duplicate: appears earlier in this file</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={saving || chosen.length === 0} className={btnPrimary}>
              {saving
                ? "Saving…"
                : `Save ${chosen.length} guest${chosen.length === 1 ? "" : "s"} (${chosenPeople} ${chosenPeople === 1 ? "person" : "people"})`}
            </button>
            <button type="button" onClick={reset} disabled={saving} className={btnSecondary}>
              Cancel
            </button>
            <span className="text-sm text-muted">
              {chosen.filter((r) => r.type === "e-invite").length} e-invites will get codes,{" "}
              {chosen.filter((r) => r.type === "printed").length} printed will not.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Small RFC 4180 CSV parser: handles quoted fields, escaped quotes, commas and newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cell(value: string | null | undefined): string {
  let v = value ?? "";
  // Stop spreadsheet apps treating text as a formula.
  if (/^[=@\t\r]/.test(v) || /^[+-][^\d\s]/.test(v)) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: (string | null | undefined)[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** Guest type from a CSV/form value. Blank means e-invite; anything unrecognised returns null. */
export function normaliseGuestType(v: unknown): "e-invite" | "printed" | null {
  const t = String(v ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (t === "" || t === "e-invite" || t === "einvite") return "e-invite";
  if (t === "printed") return "printed";
  return null;
}

export const MIN_ADMITS = 1;
export const MAX_ADMITS = 10;

/** Default people per invite: 2 for couples ("A & B"), otherwise 1. */
export function defaultAdmits(name: string | null | undefined): number {
  return (name ?? "").includes("&") ? 2 : 1;
}

/** Admits from a CSV/form value: a whole number from 1 to 10. Anything else returns null. */
export function parseAdmits(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= MIN_ADMITS && n <= MAX_ADMITS ? n : null;
}

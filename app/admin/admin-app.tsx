"use client";

import { useMemo, useState } from "react";
import type { Guest } from "@/lib/supabase";
import { exportGuestsCsv } from "./actions";
import { AddGuest } from "./add-guest";
import { CsvImport } from "./csv-import";
import { GuestTable } from "./guest-table";
import { Spares } from "./spares";
import { btnSecondary } from "./ui";

export function AdminApp({ guests, siteUrl }: { guests: Guest[]; siteUrl: string }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const stats = useMemo(() => {
    const unassigned = guests.filter((g) => g.type === "spare" && !g.name).length;
    return {
      total: guests.filter((g) => g.name || g.arrived_at).length,
      eInvites: guests.filter((g) => g.type === "e-invite").length,
      printed: guests.filter((g) => g.type === "printed").length,
      unassigned,
      arrived: guests.filter((g) => g.arrived_at).length,
    };
  }, [guests]);

  async function download() {
    setExporting(true);
    setExportError("");
    const res = await exportGuestsCsv().catch(() => null);
    setExporting(false);
    if (!res || !res.ok) {
      setExportError(res?.error ?? "Export failed.");
      return;
    }
    const blob = new Blob(["﻿" + res.data], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `guests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Guest admin</h1>
          <p className="mt-1 text-muted">Racheal &amp; Christian &middot; Saturday, 2nd January 2027</p>
        </div>
        <div className="text-right">
          <button type="button" onClick={download} disabled={exporting} className={btnSecondary}>
            {exporting ? "Preparing…" : "Export CSV"}
          </button>
          {exportError ? (
            <p role="alert" className="mt-1 text-sm text-warning">
              {exportError}
            </p>
          ) : null}
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total guests" value={stats.total} />
        <Stat label="E-invites" value={stats.eInvites} />
        <Stat label="Printed" value={stats.printed} />
        <Stat label="Unassigned spares" value={stats.unassigned} />
        <Stat label="Arrived" value={stats.arrived} accent />
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AddGuest />
        <Spares guests={guests} siteUrl={siteUrl} />
      </div>

      <div className="mt-6">
        <CsvImport existing={guests} />
      </div>

      <div className="mt-6">
        <GuestTable guests={guests} siteUrl={siteUrl} />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-hairline bg-card px-5 py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`mt-1 text-3xl font-semibold tabular-nums ${accent ? "text-success" : ""}`}>{value}</dd>
    </div>
  );
}

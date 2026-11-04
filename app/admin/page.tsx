import type { Metadata } from "next";
import { Suspense } from "react";
import { hasSession } from "@/lib/auth";
import { loadGuests } from "./actions";
import { AdminApp } from "./admin-app";
import { PasswordGate } from "./password-gate";

export const metadata: Metadata = {
  title: "Guest admin",
};

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-paper font-sans text-ink">
      <Suspense fallback={<p className="p-8 text-muted">Loading&hellip;</p>}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  if (!(await hasSession("admin"))) return <PasswordGate />;
  const guests = await loadGuests();
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  return <AdminApp guests={guests ?? []} siteUrl={siteUrl} />;
}

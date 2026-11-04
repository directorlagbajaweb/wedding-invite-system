import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { hasSession } from "@/lib/auth";
import { getStats } from "./actions";
import { PinGate } from "./pin-gate";
import { UsherApp } from "./usher-app";

export const metadata: Metadata = {
  title: "Gate check-in",
};

export const viewport: Viewport = {
  themeColor: "#FFFDF9",
};

export default function ScanPage() {
  return (
    <div className="min-h-dvh bg-card font-sans text-ink">
      <Suspense fallback={<p className="p-6 text-lg text-muted">Loading&hellip;</p>}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  if (!(await hasSession("usher"))) return <PinGate />;
  const stats = await getStats();
  return <UsherApp initialStats={stats} />;
}

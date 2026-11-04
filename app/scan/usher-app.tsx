"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkInGuest,
  checkInScanned,
  getStats,
  searchGuests,
  type CheckInResult,
  type SearchRow,
  type Stats,
} from "./actions";
import { Scanner } from "./scanner";

type Tab = "scan" | "search";

const TYPE_LABEL: Record<SearchRow["type"], string> = {
  "e-invite": "E-invite",
  printed: "Printed card",
  spare: "Spare code",
};

/** Ignore the same QR for this long after its result closes, so it isn't instantly re-scanned as "already checked in". */
const SAME_CODE_COOLDOWN_MS = 4000;

export function UsherApp({ initialStats }: { initialStats: Stats | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("scan");
  const [stats, setStats] = useState(initialStats);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const lastScan = useRef<{ text: string; closedAt: number } | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const [resumeNonce, setResumeNonce] = useState(0);

  const refreshStats = useCallback(async () => {
    const next = await getStats().catch(() => undefined);
    if (next === null) router.refresh(); // session expired → back to PIN screen
    else if (next) setStats(next);
  }, [router]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshStats();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [refreshStats]);

  const show = useCallback(
    (r: CheckInResult) => {
      setResult(r);
      setAnnouncement(describe(r));
      vibrate(r);
      if (r.status === "valid") void refreshStats();
    },
    [refreshStats],
  );

  const close = useCallback(() => {
    setResult(null);
    if (lastScan.current) lastScan.current.closedAt = Date.now();
    setSearchVersion((v) => v + 1);
  }, []);

  const handleScan = useCallback(
    async (text: string) => {
      const last = lastScan.current;
      if (last && last.text === text && Date.now() - last.closedAt < SAME_CODE_COOLDOWN_MS) {
        // Same QR still in front of the camera: quietly resume.
        setResumeNonce((n) => n + 1);
        return;
      }
      lastScan.current = { text, closedAt: Infinity };
      setBusy(true);
      try {
        show(await checkInScanned(text));
      } catch {
        show({ status: "error", message: "Could not check in. Try again." });
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  const handleGuest = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        show(await checkInGuest(id));
      } catch {
        show({ status: "error", message: "Could not check in. Try again." });
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header
        className="sticky top-0 z-10 border-b border-hairline bg-card px-5 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">Gate check-in</h1>
          <p className="text-lg font-semibold tabular-nums">
            {stats ? (
              <>
                {stats.arrived} <span className="font-normal text-muted">of</span> {stats.total}{" "}
                <span className="font-normal text-muted">arrived</span>
              </>
            ) : (
              <span className="font-normal text-muted">Count unavailable</span>
            )}
          </p>
        </div>

        <div role="tablist" aria-label="Check-in method" className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-paper p-1">
          {(["scan", "search"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => setTab(t)}
              className={`h-12 rounded-full text-lg font-semibold transition-colors ${
                tab === t ? "bg-ink text-white" : "text-ink"
              }`}
            >
              {t === "scan" ? "Scan" : "Name search"}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-5 py-5">
        {tab === "scan" ? (
          <section id="panel-scan" role="tabpanel" aria-labelledby="tab-scan">
            <Scanner onScan={handleScan} paused={busy || result !== null} resumeNonce={resumeNonce} />
          </section>
        ) : (
          <section id="panel-search" role="tabpanel" aria-labelledby="tab-search">
            <NameSearch onCheckIn={handleGuest} disabled={busy} version={searchVersion} />
          </section>
        )}
      </main>

      <div className="sr-only" role="status" aria-live="assertive">
        {announcement}
      </div>

      {result ? <ResultOverlay result={result} onClose={close} /> : null}
    </div>
  );
}

/* ---------- Name search ---------- */

function NameSearch({
  onCheckIn,
  disabled,
  version,
}: {
  onCheckIn: (id: string) => void;
  disabled: boolean;
  version: number;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const seq = useRef(0);
  const router = useRouter();
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const mine = ++seq.current;
    const t = window.setTimeout(async () => {
      setState("loading");
      const res = await searchGuests(trimmed).catch(() => null);
      if (mine !== seq.current) return;
      if (res === null) {
        setState("error");
        return;
      }
      setRows(res);
      setState("done");
    }, 250);
    return () => window.clearTimeout(t);
  }, [trimmed, version]);

  const tooShort = trimmed.length < 2;

  return (
    <div>
      <label htmlFor="guest-search" className="block text-base font-medium">
        Guest name
      </label>
      <input
        id="guest-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        placeholder="Type at least 2 letters"
        className="mt-2 h-14 w-full rounded-2xl border-2 border-hairline bg-white px-4 text-lg text-ink placeholder:text-muted focus:border-gold focus:outline-none"
      />

      <div className="mt-4" aria-live="polite">
        {tooShort ? null : state === "error" ? (
          <p className="text-lg text-warning">
            Search failed.{" "}
            <button type="button" className="underline" onClick={() => router.refresh()}>
              Reload
            </button>
          </p>
        ) : state === "done" && rows.length === 0 ? (
          <p className="text-lg text-muted">No guests match &ldquo;{trimmed}&rdquo;.</p>
        ) : null}
      </div>

      {!tooShort && rows.length > 0 ? (
        <ul className="divide-y divide-hairline">
          {rows.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{g.name}</p>
                <p className="text-base text-muted">
                  {TYPE_LABEL[g.type]} &middot;{" "}
                  {g.arrivedTime ? (
                    <span className="font-medium text-success">Arrived {g.arrivedTime}</span>
                  ) : (
                    <span className="text-ink">Not arrived</span>
                  )}
                </p>
              </div>
              {g.arrivedTime ? null : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onCheckIn(g.id)}
                  className="h-12 shrink-0 rounded-full bg-gold px-5 text-base font-semibold text-white disabled:opacity-60"
                  aria-label={`Check in ${g.name}`}
                >
                  Check in
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------- Result overlay ---------- */

/** Green closes itself after this long; red and grey wait for "Next guest". */
const VALID_DISMISS_MS = 5000;

function ResultOverlay({ result, onClose }: { result: CheckInResult; onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const autoClose = result.status === "valid";

  useEffect(() => {
    buttonRef.current?.focus();
    if (!autoClose) return;
    const t = window.setTimeout(onClose, VALID_DISMISS_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, autoClose]);

  const bg =
    result.status === "valid" ? "bg-success" : result.status === "already_used" ? "bg-warning" : "bg-neutral";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={describe(result)}
      onClick={autoClose ? onClose : undefined}
      className={`overlay-in fixed inset-0 z-50 flex flex-col text-center text-white ${bg}`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        {result.status === "valid" ? (
          <>
            <span className="text-2xl font-medium tracking-wide uppercase">Welcome</span>
            <span className="mt-4 text-5xl leading-tight font-bold break-words">{result.name}</span>
            <span className="mt-8 rounded-full border-2 border-white px-6 py-2 text-2xl font-semibold">
              Admits 1
            </span>
          </>
        ) : result.status === "already_used" ? (
          <>
            <span className="text-5xl leading-tight font-bold break-words">{result.name}</span>
            <span className="mt-5 text-4xl leading-tight font-bold">
              Already checked in{result.time ? ` at ${result.time}` : ""}
            </span>
            <span className="mt-8 max-w-[22ch] text-xl leading-snug">
              Please refer this guest to the family representative.
            </span>
          </>
        ) : result.status === "invalid" ? (
          <span className="text-4xl leading-tight font-bold">Invitation not found</span>
        ) : (
          <span className="text-3xl leading-tight font-bold">{result.message}</span>
        )}
      </div>

      <div className="px-5 pb-6">
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="min-h-14 w-full rounded-full bg-white text-xl font-semibold text-ink focus-visible:outline-white"
        >
          Next guest
        </button>
      </div>

      {autoClose ? (
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25" aria-hidden="true">
          <div
            className="countdown-bar h-full bg-white"
            style={{ animationDuration: `${VALID_DISMISS_MS}ms` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function describe(r: CheckInResult): string {
  switch (r.status) {
    case "valid":
      return `Welcome, ${r.name}. Admits 1.`;
    case "already_used":
      return `${r.name}. Already checked in${r.time ? ` at ${r.time}` : ""}. Please refer this guest to the family representative.`;
    case "invalid":
      return "Invitation not found.";
    default:
      return r.message;
  }
}

function vibrate(r: CheckInResult) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (r.status === "valid") navigator.vibrate(150);
  else if (r.status === "already_used") navigator.vibrate(700);
  else navigator.vibrate([120, 80, 120]);
}

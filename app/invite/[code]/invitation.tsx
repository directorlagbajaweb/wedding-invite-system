"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT } from "@/lib/event";
import { Amp, CardShell, GoldRule } from "../card-shell";

type Phase = "closed" | "pressing" | "closing" | "open";

type Props = {
  name: string;
  code: string;
  admits: number;
  qrDataUrl: string;
  joyUrl: string;
};

type Sparkle = { id: number; dx: number; dy: number; size: number; delay: number };
type Burst = { x: number; y: number; sparkles: Sparkle[] };

const PRESS_MS = 140;
const CLOSE_MS = 400;

function makeSparkles(): Sparkle[] {
  const count = 7;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const dist = 55 + Math.random() * 45;
    return {
      id: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 18, // drift slightly upward
      size: 3 + Math.random() * 3,
      delay: Math.random() * 120,
    };
  });
}

export function Invitation({ name, code, admits, qrDataUrl, joyUrl }: Props) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [burst, setBurst] = useState<Burst | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function open(seal: HTMLElement) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("open");
      return;
    }
    const r = seal.getBoundingClientRect();
    setBurst({ x: r.left + r.width / 2, y: r.top + r.height / 2, sparkles: makeSparkles() });
    setPhase("pressing");
    later(() => setPhase("closing"), PRESS_MS);
    later(() => setPhase("open"), PRESS_MS + CLOSE_MS);
    later(() => setBurst(null), 1500);
  }

  useEffect(() => {
    if (phase === "open") headingRef.current?.focus();
  }, [phase]);

  return (
    <CardShell>
      {phase === "open" ? (
        <Revealed name={name} code={code} admits={admits} qrDataUrl={qrDataUrl} joyUrl={joyUrl} headingRef={headingRef} />
      ) : (
        <Closed phase={phase} onOpen={open} />
      )}
      {burst ? (
        <div aria-hidden="true">
          {burst.sparkles.map((p) => (
            <span
              key={p.id}
              className="sparkle"
              style={
                {
                  left: burst.x,
                  top: burst.y,
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  "--s": `${p.size}px`,
                  "--d": `${p.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ) : null}
    </CardShell>
  );
}

function Closed({ phase, onOpen }: { phase: Phase; onOpen: (seal: HTMLElement) => void }) {
  return (
    <section aria-label="Invitation">
      <h1 className="font-script text-[3.5rem] leading-[1.1] sm:text-[4rem]">
        Racheal <Amp /> Christian
      </h1>
      <GoldRule className="my-8" />
      <p className="mx-auto max-w-[32ch] text-lg leading-relaxed text-muted italic">
        {EVENT.greeting}
      </p>
      <div className="mt-12 flex justify-center">
        <button
          type="button"
          onClick={(e) => onOpen(e.currentTarget)}
          disabled={phase !== "closed"}
          data-phase={phase}
          className="seal relative flex h-36 w-36 flex-col items-center justify-center rounded-full text-white"
        >
          <span
            aria-hidden="true"
            className="seal-ring pointer-events-none absolute inset-[6px] rounded-full border border-white/50"
          />
          <span aria-hidden="true" className="font-script text-3xl leading-none">
            R<Amp className="text-white" />C
          </span>
          <span className="mt-2 flex flex-col text-[0.62rem] leading-[1.35] tracking-[0.05em] uppercase">
            <span>Open</span>
            <span>your</span>
            <span>invitation</span>
          </span>
        </button>
      </div>
    </section>
  );
}

function Revealed({
  name,
  code,
  admits,
  qrDataUrl,
  joyUrl,
  headingRef,
}: Props & { headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  let i = 0;
  const step = () => ({ "--i": i++ }) as React.CSSProperties;

  return (
    <section aria-label="Your invitation">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="reveal-item text-2xl font-medium focus:outline-none focus-visible:outline-none"
        style={step()}
      >
        Dear {name},
      </h1>

      <p className="reveal-item mt-5 text-lg text-balance text-muted" style={step()}>
        You are invited to celebrate the wedding of
      </p>
      <p
        className="reveal-item mt-2 font-script text-[3.25rem] leading-[1.1] sm:text-[3.75rem]"
        style={step()}
      >
        Racheal <Amp /> Christian
      </p>

      <p className="reveal-item mt-5 text-xl font-medium" style={step()}>
        {EVENT.dateDisplay}
      </p>

      <dl className="reveal-item mt-8 border-y border-hairline" style={step()}>
        <EventRow {...EVENT.church} />
        <div className="h-px bg-hairline" aria-hidden="true" />
        <EventRow {...EVENT.reception} />
      </dl>

      <p className="reveal-item mt-6 text-muted" style={step()}>
        Colours of the day: <span className="text-ink">{EVENT.colours}</span>
      </p>

      <div className="reveal-item" style={step()}>
        <GoldRule className="my-8" />
      </div>

      <div className="reveal-item flex flex-col items-center" style={step()}>
        <div className="qr-panel">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise */}
          <img
            src={qrDataUrl}
            width={220}
            height={220}
            alt={`QR code for invitation ${code}`}
            className="block h-[220px] w-[220px]"
          />
        </div>
        <p
          className="mt-4 font-medium tracking-[0.35em] text-ink"
          aria-label={`Code ${code.split("").join(" ")}`}
        >
          {code}
        </p>
        <span className="mt-3 rounded-full border border-gold px-3 py-0.5 text-sm tracking-[0.12em] text-gold uppercase">
          Admits {admits}
        </span>
      </div>

      <p className="reveal-item mx-auto mt-6 max-w-[30ch] text-muted italic" style={step()}>
        Please show this QR code at the gate. Screenshot it to keep it handy.
      </p>

      {joyUrl ? (
        <div className="reveal-item mt-8" style={step()}>
          <a
            href={joyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold w-full sm:w-auto"
          >
            View wedding website &amp; RSVP
          </a>
        </div>
      ) : null}
    </section>
  );
}

function EventRow({ label, time, venue }: { label: string; time: string; venue: string }) {
  return (
    <div className="py-5">
      <dt className="text-sm tracking-[0.18em] text-gold uppercase">
        {label} &middot; {time}
      </dt>
      <dd className="mx-auto mt-2 max-w-[30ch] leading-snug">{venue}</dd>
    </div>
  );
}

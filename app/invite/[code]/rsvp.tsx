"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RSVP_DEADLINE, RSVP_MESSAGE_MAX, type RsvpAnswer } from "@/lib/rsvp";
import { sendRsvp, type SavedRsvp } from "./actions";

const CHOICES: { value: RsvpAnswer; label: string }[] = [
  { value: "yes", label: "Joyfully accept" },
  { value: "no", label: "Regretfully decline" },
];

export function Rsvp({ code, admits, initial }: { code: string; admits: number; initial: SavedRsvp | null }) {
  const [saved, setSaved] = useState<SavedRsvp | null>(initial);
  const [editing, setEditing] = useState(initial === null);
  // Moves focus after a switch between form and thank-you, but not on first render.
  const focusNext = useRef<"thanks" | "form" | null>(null);
  const thanksRef = useRef<HTMLHeadingElement>(null);
  const formHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusNext.current === "thanks") thanksRef.current?.focus();
    if (focusNext.current === "form") formHeadingRef.current?.focus();
    focusNext.current = null;
  }, [editing]);

  return (
    <section aria-labelledby="rsvp-heading" className="mt-8 border-t border-hairline pt-8">
      {editing || !saved ? (
        <RsvpForm
          code={code}
          admits={admits}
          initial={saved}
          headingRef={formHeadingRef}
          onSaved={(s) => {
            setSaved(s);
            focusNext.current = "thanks";
            setEditing(false);
          }}
          onCancel={
            saved
              ? () => {
                  focusNext.current = "thanks";
                  setEditing(false);
                }
              : undefined
          }
        />
      ) : (
        <div className="rsvp-in">
          <h2
            id="rsvp-heading"
            ref={thanksRef}
            tabIndex={-1}
            className="text-2xl font-medium focus:outline-none focus-visible:outline-none"
          >
            Thank you, we&rsquo;ve received your RSVP
          </h2>
          <p className="mt-3 text-lg">
            {saved.rsvp === "yes" ? (
              <>
                You&rsquo;re <span className="font-medium text-success">joyfully accepting</span>
                {admits > 1 ? ` for ${admits} people` : ""}.
              </>
            ) : (
              <>
                You&rsquo;ve <span className="font-medium">regretfully declined</span>. You&rsquo;ll be missed.
              </>
            )}
          </p>
          {saved.message ? (
            <blockquote className="mx-auto mt-4 max-w-[32ch] border-l-2 border-gold/60 pl-4 text-left whitespace-pre-line text-muted italic break-words">
              {saved.message}
            </blockquote>
          ) : null}
          <button
            type="button"
            onClick={() => {
              focusNext.current = "form";
              setEditing(true);
            }}
            className="mt-5 min-h-11 px-2 text-gold underline underline-offset-4 hover:text-[#9c7440]"
          >
            Change my answer
          </button>
        </div>
      )}
    </section>
  );
}

function RsvpForm({
  code,
  admits,
  initial,
  headingRef,
  onSaved,
  onCancel,
}: {
  code: string;
  admits: number;
  initial: SavedRsvp | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onSaved: (s: SavedRsvp) => void;
  onCancel?: () => void;
}) {
  const [choice, setChoice] = useState<RsvpAnswer | null>(initial?.rsvp ?? null);
  const [message, setMessage] = useState(initial?.message ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const counterId = `${id}-count`;
  const left = RSVP_MESSAGE_MAX - message.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice) {
      setError("Please choose accept or decline.");
      return;
    }
    setPending(true);
    setError("");
    const res = await sendRsvp(code, choice, message).catch(() => null);
    setPending(false);
    if (!res || !res.ok) {
      setError(res?.error ?? "Sorry, we couldn’t save your RSVP. Please try again.");
      return;
    }
    onSaved(res.data);
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2
        id="rsvp-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-medium focus:outline-none focus-visible:outline-none"
      >
        Kindly RSVP by {RSVP_DEADLINE}
      </h2>
      {admits > 1 ? <p className="mt-2 text-muted">This RSVP is for {admits} people.</p> : null}

      <fieldset className="mt-6">
        <legend className="sr-only">Will you attend?</legend>
        <div className="grid gap-3">
          {CHOICES.map((c) => {
            const selected = choice === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setChoice(c.value);
                  setError("");
                }}
                className={`rsvp-choice min-h-14 w-full rounded-full border px-5 text-lg font-medium ${
                  selected ? "border-gold bg-gold text-white" : "border-gold/70 bg-white text-ink hover:bg-paper"
                }`}
              >
                {selected ? <span aria-hidden="true">&#10003;&nbsp;</span> : null}
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 text-left">
        <label htmlFor={`${id}-msg`} className="block font-medium">
          Message to the couple <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={`${id}-msg`}
          value={message}
          maxLength={RSVP_MESSAGE_MAX}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          aria-describedby={counterId}
          className="mt-2 block w-full resize-y rounded-2xl border border-hairline bg-white px-4 py-3 text-base text-ink placeholder:text-muted focus:border-gold focus:outline-none"
          placeholder="Share your wishes…"
        />
        <p
          id={counterId}
          className={`mt-1 text-right text-sm tabular-nums ${left <= 20 ? "text-warning" : "text-muted"}`}
          aria-live={left <= 20 ? "polite" : "off"}
        >
          {message.length}/{RSVP_MESSAGE_MAX}
          <span className="sr-only"> characters used</span>
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-warning">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col items-center gap-2">
        <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-60">
          {pending ? "Sending…" : "Send RSVP"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="min-h-11 px-2 text-muted underline underline-offset-4"
          >
            Keep my current answer
          </button>
        ) : null}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { submitPin, type PinState } from "./actions";

export function PinGate() {
  const [state, action, pending] = useActionState<PinState, FormData>(submitPin, {});

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <h1 className="text-3xl font-semibold">Gate check-in</h1>
      <p className="mt-2 text-lg text-muted">Racheal &amp; Christian&rsquo;s wedding</p>

      <form action={action} className="mt-10">
        <label htmlFor="pin" className="block text-base font-medium">
          Usher PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "pin-error" : undefined}
          className="mt-2 h-16 w-full rounded-2xl border-2 border-hairline bg-white px-4 text-center text-3xl tracking-[0.5em] text-ink focus:border-gold focus:outline-none"
        />
        <p id="pin-error" role="alert" className="mt-3 min-h-[1.5rem] text-base font-medium text-warning">
          {state.error}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="mt-4 h-14 w-full rounded-full bg-gold text-lg font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}

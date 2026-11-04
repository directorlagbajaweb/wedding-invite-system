"use client";

import { useActionState } from "react";
import { submitPassword, type PasswordState } from "./actions";

export function PasswordGate() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(submitPassword, {});

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Guest admin</h1>
      <p className="mt-1 text-muted">Racheal &amp; Christian&rsquo;s wedding</p>

      <form action={action} className="mt-8 rounded-2xl border border-hairline bg-card p-6">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "password-error" : undefined}
          className="mt-2 h-12 w-full rounded-xl border border-hairline bg-white px-4 text-ink focus:border-gold focus:outline-none"
        />
        <p id="password-error" role="alert" className="mt-2 min-h-[1.25rem] text-sm font-medium text-warning">
          {state.error}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="mt-3 h-12 w-full rounded-full bg-gold font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

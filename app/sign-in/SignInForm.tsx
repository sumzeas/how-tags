"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, {} as SignInState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        Email
        <input
          name="email"
          type="email"
          defaultValue={state.email}
          required
          autoComplete="email"
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border px-3 py-2"
        />
      </label>
      {state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm">
        New here? <Link href="/sign-up" className="underline">Create an account</Link>
      </p>
    </form>
  );
}

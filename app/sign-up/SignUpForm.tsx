"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { checkCredentials, createAccount } from "./actions";

interface SignUpFormProps {
  passwordMin: number;
  passwordMax: number;
}

export function SignUpForm({ passwordMin, passwordMax }: SignUpFormProps) {
  const [step, setStep] = useState<"credentials" | "username">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string>();

  const [, checkAction, checking] = useActionState(async (_: null, formData: FormData) => {
    const result = await checkCredentials(formData);
    setError(result.error);
    if (!result.error) setStep("username");
    return null;
  }, null);

  const [, createAction, creating] = useActionState(async (_: null, formData: FormData) => {
    // Email and password were checked in step 1; send them along with the username.
    formData.set("email", email);
    formData.set("password", password);
    const result = await createAccount(formData);
    setError(result.error);
    if (result.restart) setStep("credentials");
    return null;
  }, null);

  if (step === "username") {
    return (
      <form action={createAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Username
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="rounded border px-3 py-2"
          />
          <span className="text-sm opacity-70">This name will be seen by others.</span>
        </label>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <button type="submit" disabled={creating} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {creating ? "Creating account…" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(undefined);
            setStep("credentials");
          }}
          className="text-sm underline"
        >
          Back
        </button>
      </form>
    );
  }

  return (
    <form action={checkAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        Email
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="rounded border px-3 py-2"
        />
        <span className="text-sm opacity-70">
          {passwordMin}–{passwordMax} characters.
        </span>
      </label>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button type="submit" disabled={checking} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
        {checking ? "Checking…" : "Continue"}
      </button>
      <p className="text-sm">
        Already have an account? <Link href="/sign-in" className="underline">Sign in</Link>
      </p>
    </form>
  );
}

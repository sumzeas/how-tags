"use client";

import { useActionState } from "react";
import { deleteAccount, type DeleteAccountState } from "./actions";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccount, {} as DeleteAccountState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded border border-red-600 p-4">
      <h2 className="text-lg font-semibold text-red-600">Delete account</h2>
      <p className="text-sm">
        This permanently deletes your account and signs you out. It can&apos;t be undone.
      </p>
      <label className="flex flex-col gap-1">
        Confirm your password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border px-3 py-2"
        />
      </label>
      {state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Deleting…" : "Delete account"}
      </button>
    </form>
  );
}

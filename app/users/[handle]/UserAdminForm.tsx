"use client";

import { useActionState } from "react";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/users/roles";
import { saveUserAdminSettings, type UserAdminState } from "./actions";

export function UserAdminForm({ handle, role, canPost }: { handle: string; role: Role; canPost: boolean }) {
  const [state, formAction, pending] = useActionState(
    saveUserAdminSettings.bind(null, handle),
    {} as UserAdminState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Admin controls</h2>
      <label className="flex flex-col gap-1">
        Role
        <select name="role" defaultValue={role} className="rounded border px-3 py-2">
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input name="canPost" type="checkbox" defaultChecked={canPost} />
        Allow Posting
      </label>
      {state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      {state.saved && !pending && <p role="status">Saved.</p>}
      <button type="submit" disabled={pending} className="self-start rounded border px-4 py-2 disabled:opacity-50">
        {pending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}

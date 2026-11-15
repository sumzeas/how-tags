"use client";

import { useActionState } from "react";
import { setPostLock, type PostLockState } from "./actions";

export function PostLockForm({ pid, locked }: { pid: string; locked: boolean }) {
  const [state, formAction, pending] = useActionState(setPostLock.bind(null, pid), {} as PostLockState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Moderator controls</h2>
      <input type="hidden" name="intent" value={locked ? "unlock" : "lock"} />
      <label className="flex flex-col gap-1">
        Reason
        <input name="reason" required maxLength={500} className="rounded border px-3 py-2" />
      </label>
      {state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      {state.saved && !pending && <p role="status">Saved.</p>}
      <button type="submit" disabled={pending} className="self-start rounded border px-4 py-2 disabled:opacity-50">
        {pending ? "Saving…" : locked ? "Unlock post" : "Lock post"}
      </button>
    </form>
  );
}

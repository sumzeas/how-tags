"use client";

import { useActionState } from "react";
import { saveSiteSettings, type SiteSettingsState } from "./actions";

export function SiteSettingsForm({ postingEnabled }: { postingEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(saveSiteSettings, {} as SiteSettingsState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Global settings</h2>
      <label className="flex items-center gap-2">
        <input name="postingEnabled" type="checkbox" defaultChecked={postingEnabled} />
        Allow posting site-wide
      </label>
      <p className="text-sm opacity-70">
        Turning this off stops everyone from creating new posts, whatever their own setting.
      </p>
      {state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      {state.saved && !pending && <p role="status">Saved.</p>}
      <button type="submit" disabled={pending} className="self-start rounded border px-4 py-2 disabled:opacity-50">
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

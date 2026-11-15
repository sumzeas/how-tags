"use client";

import { stepDownAsModerator } from "./actions";

export function StepDownForm() {
  return (
    <form
      action={stepDownAsModerator}
      onSubmit={(event) => {
        if (!confirm("Step down as moderator? Only an admin can give the role back.")) event.preventDefault();
      }}
      className="flex flex-col gap-4 rounded border p-4"
    >
      <h2 className="text-lg font-semibold">Moderator role</h2>
      <p className="text-sm">You can give up your moderator role at any time. Only an admin can give it back.</p>
      <button type="submit" className="self-start rounded border px-4 py-2">
        Step down as moderator
      </button>
    </form>
  );
}

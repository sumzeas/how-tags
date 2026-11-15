"use server";

import { refresh } from "next/cache";
import { requireModerator } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";
import { InvalidReasonError, NotModeratorError } from "@/lib/users/ModeratorProfile";

export interface PostLockState {
  error?: string;
  saved?: boolean;
}

/**
 * Locks or unlocks post `pid` from the moderator controls on /pages/[pid].
 * `pid` is bound by the page; the moderator always comes from the session.
 */
export async function setPostLock(pid: string, _: PostLockState, formData: FormData): Promise<PostLockState> {
  const moderator = await requireModerator();
  const intent = formData.get("intent");
  if (intent !== "lock" && intent !== "unlock") return { error: "Choose lock or unlock." };
  const reason = String(formData.get("reason") ?? "");

  try {
    const store = getUserStore();
    if (intent === "lock") moderator.lockPost(store, pid, reason);
    else moderator.unlockPost(store, pid, reason);
  } catch (err) {
    if (err instanceof InvalidReasonError || err instanceof NotModeratorError) return { error: err.message };
    throw err;
  }
  // Re-render so the locked notice and the button match the new state.
  refresh();
  return { saved: true };
}

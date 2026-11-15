"use server";

import { refresh } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { endSession, getSignedInUser } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";
import { ModeratorProfile, NotModeratorError, NotModeratorRoleError } from "@/lib/users/ModeratorProfile";
import { IncorrectPasswordError } from "@/lib/users/UserProfile";

export interface DeleteAccountState {
  error?: string;
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/sign-in");
}

/**
 * Removes the signed-in moderator's own moderator role, the only role change
 * moderators can make. Forbidden for everyone else, admins included.
 */
export async function stepDownAsModerator(): Promise<void> {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in/clear-session");
  if (user.role !== "moderator") forbidden();
  const moderator = ModeratorProfile.from(user) ?? forbidden();

  try {
    moderator.stepDown(getUserStore());
  } catch (err) {
    // Demoted or deleted since the page loaded.
    if (err instanceof NotModeratorError || err instanceof NotModeratorRoleError) forbidden();
    throw err;
  }
  // Re-render so the role and the step-down form update.
  refresh();
}

export async function deleteAccount(_: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  // The account comes from the session cookie, never from the form, so a
  // request can only delete the account it's signed in as.
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in/clear-session");

  try {
    await user.delete(getUserStore(), String(formData.get("password") ?? ""));
  } catch (err) {
    if (err instanceof IncorrectPasswordError) return { error: "Incorrect password." };
    throw err;
  }
  // Deleting the account already removed its sessions; this clears the cookie.
  await endSession();
  redirect("/sign-in");
}

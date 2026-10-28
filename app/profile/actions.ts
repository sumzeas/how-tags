"use server";

import { redirect } from "next/navigation";
import { endSession, getSignedInUser } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";
import { IncorrectPasswordError } from "@/lib/users/UserProfile";

export interface DeleteAccountState {
  error?: string;
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/sign-in");
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

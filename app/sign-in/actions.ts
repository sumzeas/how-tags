"use server";

import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";
import { UserProfile } from "@/lib/users/UserProfile";

export interface SignInState {
  error?: string;
  /** Echoed back so the email field isn't cleared after a failed attempt. */
  email?: string;
}

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await UserProfile.authenticate(getUserStore(), email, password);
  if (!user) return { error: "Email or password is incorrect.", email };
  await startSession(user.id);
  redirect("/profile");
}

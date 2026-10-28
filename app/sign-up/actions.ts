"use server";

import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";
import { EmailTakenError, InvalidEmailError } from "@/lib/users/email";
import { InvalidPasswordError } from "@/lib/users/password";
import { InvalidUsernameError, UserProfile } from "@/lib/users/UserProfile";

export interface SignUpResult {
  error?: string;
  /** True when the email or password needs fixing, so the form returns to step 1. */
  restart?: boolean;
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Step 1: is the email free and the password acceptable? */
export async function checkCredentials(formData: FormData): Promise<SignUpResult> {
  try {
    UserProfile.checkSignUp(getUserStore(), field(formData, "email"), field(formData, "password"));
    return {};
  } catch (err) {
    if (
      err instanceof InvalidEmailError ||
      err instanceof InvalidPasswordError ||
      err instanceof EmailTakenError
    ) {
      return { error: err.message };
    }
    throw err;
  }
}

/** Step 2: create the account, sign in, and go to the profile. */
export async function createAccount(formData: FormData): Promise<SignUpResult> {
  let user: UserProfile;
  try {
    user = await UserProfile.create(getUserStore(), {
      email: field(formData, "email"),
      username: field(formData, "username"),
      password: field(formData, "password"),
    });
  } catch (err) {
    if (err instanceof InvalidUsernameError) return { error: err.message };
    if (
      err instanceof InvalidEmailError ||
      err instanceof InvalidPasswordError ||
      err instanceof EmailTakenError
    ) {
      return { error: err.message, restart: true };
    }
    throw err;
  }
  await startSession(user.id);
  redirect("/profile");
}

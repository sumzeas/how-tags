"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { LastAdminError, NotAdminError, UserNotFoundError } from "@/lib/users/AdminProfile";
import { getUserStore } from "@/lib/users/db";
import { isRole } from "@/lib/users/roles";

export interface UserAdminState {
  error?: string;
  saved?: boolean;
}

/**
 * Saves the admin controls on /users/[handle]. `handle` is bound by the page
 * (the target); the actor always comes from the session.
 */
export async function saveUserAdminSettings(
  handle: string,
  _: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const admin = await requireAdmin();
  const role = formData.get("role");
  if (!isRole(role)) return { error: "Choose a valid role." };

  try {
    admin.updateUser(getUserStore(), handle, {
      role,
      canPost: formData.get("canPost") === "on",
    });
  } catch (err) {
    if (err instanceof LastAdminError || err instanceof UserNotFoundError || err instanceof NotAdminError) {
      return { error: err.message };
    }
    throw err;
  }
  // Re-render so the badge and header reflect the new role.
  refresh();
  return { saved: true };
}

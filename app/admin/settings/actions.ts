"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";

export interface SiteSettingsState {
  error?: string;
  saved?: boolean;
}

export async function saveSiteSettings(_: SiteSettingsState, formData: FormData): Promise<SiteSettingsState> {
  // The actor comes from the session; requireAdmin() 403s everyone else.
  const admin = await requireAdmin();
  admin.updateSiteSettings(getUserStore(), {
    postingEnabled: formData.get("postingEnabled") === "on",
  });
  // Re-render the page so the audit log below the form shows the change.
  refresh();
  return { saved: true };
}

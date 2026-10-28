import { redirect } from "next/navigation";
import { clearStaleSession } from "@/lib/auth/session";

// Pages can't change cookies, so signed-out pages redirect here first. This
// drops an expired cookie so later requests don't keep looking it up.
export async function GET(): Promise<never> {
  await clearStaleSession();
  redirect("/sign-in");
}

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getUserStore } from "@/lib/users/db";
import { UserProfile, type PublicProfile } from "@/lib/users/UserProfile";

const COOKIE_NAME = "howtags_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

// The database keeps only this hash, so a leaked database file can't be used
// to sign in as anyone.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Signs the user in. Call only from a Server Action or Route Handler. */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  getUserStore().createSession(hashToken(token), userId, expiresAt);

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

/**
 * The signed-in user's public profile, or null. Reads cookies, so render it
 * inside <Suspense>. Cached per request, so calling it from several
 * components queries the database only once.
 */
export const getCurrentUser = cache(async (): Promise<PublicProfile | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  // No connection() or io() needed: cookies() above already keeps this out of
  // prerendering, and the store checks expiry against SQLite's clock.
  const store = getUserStore();
  const userId = store.findSessionUserId(hashToken(token));
  if (!userId) return null;
  return UserProfile.findById(store, userId)?.toPublic() ?? null;
});

/**
 * Deletes the session cookie if it no longer matches a live session (expired,
 * or the account was deleted). A valid cookie is left alone, so linking here
 * can't sign anyone out. Call only from a Server Action or Route Handler.
 */
export async function clearStaleSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token && !(await getCurrentUser())) cookieStore.delete(COOKIE_NAME);
}

/** Signs the user out. Call only from a Server Action or Route Handler. */
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) getUserStore().deleteSession(hashToken(token));
  cookieStore.delete(COOKIE_NAME);
}

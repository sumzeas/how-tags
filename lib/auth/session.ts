import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
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

/** The signed-in user's public profile, or null. Reads cookies, so render it inside <Suspense>. */
export async function getCurrentUser(): Promise<PublicProfile | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const store = getUserStore();
  const userId = store.findSessionUserId(hashToken(token), new Date().toISOString());
  if (!userId) return null;
  return UserProfile.findById(store, userId)?.toPublic() ?? null;
}

/** Signs the user out. Call only from a Server Action or Route Handler. */
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) getUserStore().deleteSession(hashToken(token));
  cookieStore.delete(COOKIE_NAME);
}

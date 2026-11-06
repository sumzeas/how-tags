import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { UserName } from "./UserName";

/** Shown while the session loads, and to signed-out visitors. */
export function SignedOutLinks() {
  return (
    <>
      <Link href="/sign-in" className="underline">Sign in</Link>
      <Link href="/sign-up" className="underline">Sign up</Link>
    </>
  );
}

/** Reads the session cookie, so render it inside <Suspense>. */
export async function AuthNav() {
  const user = await getCurrentUser();
  if (!user) return <SignedOutLinks />;

  return (
    <Link href="/profile" className="underline">
      <UserName user={user} />
    </Link>
  );
}

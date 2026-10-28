import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "./actions";

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Your profile</h1>
      {/* Reads the session cookie, so it has to stream in behind a boundary. */}
      <Suspense fallback={<p>Loading…</p>}>
        <ProfileDetails />
      </Suspense>
    </main>
  );
}

async function ProfileDetails() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-medium">Username</dt>
        <dd>{user.username}</dd>
        <dt className="font-medium">Handle</dt>
        <dd>@{user.handle}</dd>
      </dl>
      <form action={signOut}>
        <button type="submit" className="rounded border px-4 py-2">
          Sign out
        </button>
      </form>
    </>
  );
}

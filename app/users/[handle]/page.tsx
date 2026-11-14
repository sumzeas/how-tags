import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserName } from "@/app/_components/UserName";
import { getSignedInAdmin } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";
import { UserProfile } from "@/lib/users/UserProfile";
import { UserAdminForm } from "./UserAdminForm";

export default function UserPage({ params }: PageProps<"/users/[handle]">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
      {/* The handle and the database are only known per request. */}
      <Suspense fallback={<p>Loading…</p>}>
        <UserDetails params={params} />
      </Suspense>
    </main>
  );
}

async function UserDetails({ params }: Pick<PageProps<"/users/[handle]">, "params">) {
  const { handle } = await params;
  const user = UserProfile.findByHandle(getUserStore(), handle);
  if (!user) notFound();

  return (
    <>
      <h1 className="text-2xl font-semibold">
        <UserName user={user.toPublic()} />
      </h1>
      {/* Reads the session cookie; renders nothing for non-admins. */}
      <Suspense fallback={null}>
        <AdminControls target={user} />
      </Suspense>
    </>
  );
}

async function AdminControls({ target }: { target: UserProfile }) {
  // Only decides whether to show the form; the action re-checks with requireAdmin().
  if (!(await getSignedInAdmin())) return null;
  return <UserAdminForm handle={target.handle} role={target.role} canPost={target.canPostFlag} />;
}

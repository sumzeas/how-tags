import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";
import type { AuditEntry } from "@/lib/users/store";
import { SiteSettingsForm } from "./SiteSettingsForm";

const AUDIT_LIMIT = 50;

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Site settings</h1>
      {/* Reads the session cookie, so it has to stream in behind a boundary. */}
      <Suspense fallback={<p>Loading…</p>}>
        <AdminSettings />
      </Suspense>
    </main>
  );
}

async function AdminSettings() {
  // proxy.ts already returned 403 to non-admins; this is the second check.
  const admin = await requireAdmin();
  const store = getUserStore();
  const settings = admin.getSiteSettings(store);
  const audit = store.listAudit(AUDIT_LIMIT);

  return (
    <>
      <SiteSettingsForm postingEnabled={settings.postingEnabled} />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Audit log</h2>
        {audit.length === 0 ? (
          <p className="opacity-70">No changes yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {audit.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.createdAt} className="opacity-60">
                  {entry.createdAt.slice(0, 16).replace("T", " ")} UTC
                </time>{" "}
                <AuditDescription entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Who({ handle, id }: { handle: string | null; id: string | null }) {
  if (handle) return <Link href={`/users/${handle}`} className="underline">@{handle}</Link>;
  // A null id with no handle means the server made the change (make-admin).
  return <span className="italic">{id === null ? "system" : "[deleted user]"}</span>;
}

function AuditDescription({ entry }: { entry: AuditEntry }) {
  const actor = <Who handle={entry.actorHandle} id={entry.actorId} />;
  const target = <Who handle={entry.targetHandle} id={entry.targetId} />;
  const d = entry.details;

  switch (entry.action) {
    case "role.change":
      return <>{actor} changed {target}&apos;s role from {String(d.from)} to {String(d.to)}</>;
    case "permissions.change": {
      const to = (d.canPost as { to?: unknown } | undefined)?.to;
      return <>{actor} turned posting {to ? "on" : "off"} for {target}</>;
    }
    case "settings.change": {
      const to = (d.postingEnabled as { to?: unknown } | undefined)?.to;
      return <>{actor} turned site-wide posting {to ? "on" : "off"}</>;
    }
    default:
      return <>{actor} {entry.action}</>;
  }
}

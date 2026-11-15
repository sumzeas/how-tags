import Link from "next/link";
import { Suspense } from "react";
import { Who } from "@/app/_components/Who";
import { requireModerator } from "@/lib/auth/session";
import { getUserStore } from "@/lib/users/db";

const LOG_LIMIT = 100;

export default function ModerationLogPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Moderation log</h1>
      {/* Reads the session cookie, so it has to stream in behind a boundary. */}
      <Suspense fallback={<p>Loading…</p>}>
        <ModerationLog />
      </Suspense>
    </main>
  );
}

async function ModerationLog() {
  // proxy.ts already returned 403 to everyone else; this is the second check.
  const moderator = await requireModerator();
  const entries = moderator.listModerationLog(getUserStore(), LOG_LIMIT);

  if (entries.length === 0) return <p className="opacity-70">No moderation actions yet.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {entries.map((entry) => (
        <li key={entry.id}>
          <time dateTime={entry.createdAt} className="opacity-60">
            {entry.createdAt.slice(0, 16).replace("T", " ")} UTC
          </time>{" "}
          <Who handle={entry.actorHandle} id={entry.actorId} />{" "}
          {entry.action === "post.lock" ? "locked" : "unlocked"}{" "}
          <Link href={`/pages/${encodeURIComponent(entry.postId)}`} className="underline">
            {entry.postId}
          </Link>
          <p className="opacity-80">Reason: {entry.reason}</p>
        </li>
      ))}
    </ul>
  );
}

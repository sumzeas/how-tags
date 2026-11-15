import Link from "next/link";

/** A log row's actor or target: a link to their page, "system", or "[deleted user]". */
export function Who({ handle, id }: { handle: string | null; id: string | null }) {
  if (handle) return <Link href={`/users/${handle}`} className="underline">@{handle}</Link>;
  // A null id with no handle means the server made the change (make-admin).
  return <span className="italic">{id === null ? "system" : "[deleted user]"}</span>;
}

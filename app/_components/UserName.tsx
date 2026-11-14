import { ROLE_LABELS } from "@/lib/users/roles";
import type { PublicProfile } from "@/lib/users/UserProfile";

/**
 * Display name followed by the muted unique handle, e.g.
 * "Sam @brave-crimson-otter", plus a badge for admins and moderators.
 */
export function UserName({ user }: { user: PublicProfile }) {
  return (
    <span>
      {user.username} <span className="opacity-60">@{user.handle}</span>
      {user.role !== "user" && (
        <>
          {" "}
          <span className="rounded border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide">
            {ROLE_LABELS[user.role]}
          </span>
        </>
      )}
    </span>
  );
}

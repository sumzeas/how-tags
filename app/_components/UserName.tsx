import type { PublicProfile } from "@/lib/users/UserProfile";

/** Display name followed by the muted unique handle, e.g. "Sam @brave-crimson-otter". */
export function UserName({ user }: { user: PublicProfile }) {
  return (
    <span>
      {user.username} <span className="opacity-60">@{user.handle}</span>
    </span>
  );
}

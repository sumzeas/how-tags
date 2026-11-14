// No "server-only" here: client components may read a PublicProfile's role.

export const ROLES = ["user", "moderator", "admin"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  user: "User",
  moderator: "Moderator",
  admin: "Admin",
};

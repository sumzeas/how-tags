import "server-only";
import type { UserStore } from "./store";
import type { UserProfile } from "./UserProfile";

/**
 * Whether `user` may create posts: posting must be on site-wide
 * (/admin/settings) and for this user (the "Allow Posting" switch on their
 * page). Reads the store each time, so a change applies at once.
 * The posts feature should call this before saving anything.
 */
export function canPost(store: UserStore, user: UserProfile): boolean {
  if (!store.getSiteSettings().postingEnabled) return false;
  return store.findById(user.id)?.canPost ?? false;
}

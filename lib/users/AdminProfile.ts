import "server-only";
import { isRole, type Role } from "./roles";
import type { SiteSettings, UserRecord, UserStore } from "./store";
import type { PublicProfile, UserProfile } from "./UserProfile";

export class LastAdminError extends Error {
  constructor() {
    super("Cannot remove the last administrator");
    this.name = "LastAdminError";
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("No user with that handle.");
    this.name = "UserNotFoundError";
  }
}

/** The acting account is no longer an admin (demoted or deleted since it was loaded). */
export class NotAdminError extends Error {
  constructor() {
    super("You are no longer an administrator.");
    this.name = "NotAdminError";
  }
}

/**
 * Admin powers for a signed-in UserProfile. The only way to get one is
 * AdminProfile.from(), which returns null unless the user is an admin, so
 * code can't reach these methods without passing that check. Every method
 * also re-reads the actor's role from the store first, so an AdminProfile
 * stops working as soon as its account is demoted.
 */
export class AdminProfile {
  readonly #user: UserProfile;

  private constructor(user: UserProfile) {
    this.#user = user;
  }

  static from(user: UserProfile | null): AdminProfile | null {
    return user?.role === "admin" ? new AdminProfile(user) : null;
  }

  get id(): string {
    return this.#user.id;
  }

  get handle(): string {
    return this.#user.handle;
  }

  toPublic(): PublicProfile {
    return this.#user.toPublic();
  }

  toJSON(): PublicProfile {
    return this.toPublic();
  }

  /**
   * Changes a user's role and logs it. Throws LastAdminError if this would
   * leave the site with no admin (including an admin demoting themselves).
   */
  setRole(store: UserStore, targetHandle: string, role: Role): void {
    this.updateUser(store, targetHandle, { role });
  }

  /** Sets a user's "Allow Posting" switch and logs it. */
  setUserPermissions(store: UserStore, targetHandle: string, permissions: { canPost: boolean }): void {
    this.updateUser(store, targetHandle, permissions);
  }

  /**
   * Applies the "Save Changes" form on a user's page: role and permissions
   * together, all or nothing. Each field left out is unchanged, and only
   * fields that actually change are logged. Throws LastAdminError as setRole.
   */
  updateUser(store: UserStore, targetHandle: string, changes: { role?: Role; canPost?: boolean }): void {
    if (changes.role !== undefined && !isRole(changes.role)) throw new Error("Unknown role.");
    store.transaction(() => {
      this.#assertStillAdmin(store);
      const target = findTarget(store, targetHandle);
      if (changes.canPost !== undefined && changes.canPost !== target.canPost) {
        store.updateCanPost(target.id, changes.canPost);
        store.appendAudit({
          actorId: this.id,
          action: "permissions.change",
          targetId: target.id,
          details: { canPost: { from: target.canPost, to: changes.canPost } },
        });
      }
      // Throwing here also rolls back the permission change above.
      if (changes.role !== undefined) applyRole(store, this.id, target, changes.role);
    });
  }

  getSiteSettings(store: UserStore): SiteSettings {
    this.#assertStillAdmin(store);
    return store.getSiteSettings();
  }

  /** Changes site-wide settings, such as turning off all posting, and logs it. */
  updateSiteSettings(store: UserStore, settings: SiteSettings): void {
    store.transaction(() => {
      this.#assertStillAdmin(store);
      const current = store.getSiteSettings();
      if (current.postingEnabled === settings.postingEnabled) return;
      store.updateSiteSettings(settings);
      store.appendAudit({
        actorId: this.id,
        action: "settings.change",
        targetId: null,
        details: { postingEnabled: { from: current.postingEnabled, to: settings.postingEnabled } },
      });
    });
  }

  #assertStillAdmin(store: UserStore): void {
    if (store.findById(this.id)?.role !== "admin") throw new NotAdminError();
  }
}

/**
 * Makes a user an admin with no acting account, for the make-admin script
 * run on the server. Logged with a null actor ("system"). Never call this
 * from a page, action or route.
 */
export function grantAdminFromServer(store: UserStore, targetHandle: string): void {
  store.transaction(() => applyRole(store, null, findTarget(store, targetHandle), "admin"));
}

function findTarget(store: UserStore, handle: string): UserRecord {
  const target = store.findByHandle(handle);
  if (!target) throw new UserNotFoundError();
  return target;
}

/** Call inside a transaction, so the admin count can't change before the update. */
function applyRole(store: UserStore, actorId: string | null, target: UserRecord, role: Role): void {
  if (target.role === role) return;
  if (target.role === "admin" && store.countAdmins() <= 1) throw new LastAdminError();
  store.updateRole(target.id, role);
  store.appendAudit({
    actorId,
    action: "role.change",
    targetId: target.id,
    details: { from: target.role, to: role },
  });
}

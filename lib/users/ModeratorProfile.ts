import "server-only";
import type { ModerationEntry, ModerationStore, UserStore } from "./store";
import type { PublicProfile, UserProfile } from "./UserProfile";

const REASON_MAX_LENGTH = 500;
const POST_ID_MAX_LENGTH = 200;

/** The acting account can no longer moderate (demoted or deleted since it was loaded). */
export class NotModeratorError extends Error {
  constructor() {
    super("You are no longer a moderator.");
    this.name = "NotModeratorError";
  }
}

export class InvalidReasonError extends Error {
  constructor() {
    super(`Give a reason of 1-${REASON_MAX_LENGTH} characters.`);
    this.name = "InvalidReasonError";
  }
}

/** stepDown() called by an account whose role isn't "moderator" (admins included). */
export class NotModeratorRoleError extends Error {
  constructor() {
    super("Only moderators can step down from the moderator role.");
    this.name = "NotModeratorRoleError";
  }
}

/** The stores a moderator needs: users (to re-check the role) and moderation. */
export type ModeratorStore = UserStore & ModerationStore;

/**
 * Moderator powers for a signed-in UserProfile. Admins have them too. The
 * only way to get one is ModeratorProfile.from(), which returns null for
 * anyone else, and every method re-reads the actor's role from the store
 * first, so a ModeratorProfile stops working as soon as its account is
 * demoted.
 *
 * Moderators can't change anyone's role. The one exception is stepDown(),
 * which only removes their own moderator role.
 */
export class ModeratorProfile {
  readonly #user: UserProfile;

  private constructor(user: UserProfile) {
    this.#user = user;
  }

  static from(user: UserProfile | null): ModeratorProfile | null {
    return user && canModerate(user.role) ? new ModeratorProfile(user) : null;
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

  /** Locks a post against new replies and logs it with `reason`. Does nothing if it's already locked. */
  lockPost(store: ModeratorStore, postId: string, reason: string): void {
    this.#setLock(store, postId, reason, true);
  }

  /** Unlocks a post and logs it with `reason`. Does nothing if it isn't locked. */
  unlockPost(store: ModeratorStore, postId: string, reason: string): void {
    this.#setLock(store, postId, reason, false);
  }

  listModerationLog(store: ModeratorStore, limit: number): ModerationEntry[] {
    this.#assertStillModerator(store);
    return store.listModeration(limit);
  }

  /**
   * Gives up the moderator role, making this account a plain user, and logs
   * it in the audit log. Throws NotModeratorRoleError for admins, who change
   * roles through AdminProfile instead.
   */
  stepDown(store: ModeratorStore): void {
    store.transaction(() => {
      const current = store.findById(this.id);
      if (!current) throw new NotModeratorError();
      if (current.role !== "moderator") throw new NotModeratorRoleError();
      store.updateRole(this.id, "user");
      store.appendAudit({
        actorId: this.id,
        action: "role.change",
        targetId: this.id,
        details: { from: "moderator", to: "user" },
      });
    });
  }

  #setLock(store: ModeratorStore, postId: string, reason: string, locked: boolean): void {
    const id = checkPostId(postId);
    const why = checkReason(reason);
    store.transaction(() => {
      this.#assertStillModerator(store);
      if (Boolean(store.getPostLock(id)) === locked) return;
      store.setPostLock(id, locked ? this.id : null);
      store.appendModeration({
        actorId: this.id,
        action: locked ? "post.lock" : "post.unlock",
        postId: id,
        reason: why,
      });
    });
  }

  #assertStillModerator(store: ModeratorStore): void {
    const role = store.findById(this.id)?.role;
    if (!role || !canModerate(role)) throw new NotModeratorError();
  }
}

function canModerate(role: string): boolean {
  return role === "moderator" || role === "admin";
}

function checkReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 1 || [...trimmed].length > REASON_MAX_LENGTH) throw new InvalidReasonError();
  return trimmed;
}

function checkPostId(postId: string): string {
  if (postId.length < 1 || postId.length > POST_ID_MAX_LENGTH) throw new Error("Invalid post ID.");
  return postId;
}

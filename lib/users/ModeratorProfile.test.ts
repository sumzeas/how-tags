import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdminProfile } from "./AdminProfile";
import { InvalidReasonError, ModeratorProfile, NotModeratorError, NotModeratorRoleError } from "./ModeratorProfile";
import { canReply } from "./permissions";
import type { Role } from "./roles";
import { SqliteUserStore } from "./store";
import { UserProfile } from "./UserProfile";

let store: SqliteUserStore;
beforeEach(() => {
  store = new SqliteUserStore(":memory:");
});
afterEach(() => {
  store.close();
});

// Inserts rows directly to skip scrypt hashing; see AdminProfile.test.ts.
function addUser(handle: string, role: Role = "user"): UserProfile {
  const id = randomUUID();
  store.insert({
    id,
    emailHmac: `hmac-${handle}`,
    handle,
    username: handle,
    passwordHash: "unused",
    createdAt: new Date().toISOString(),
  });
  if (role !== "user") store.updateRole(id, role);
  return UserProfile.findById(store, id)!;
}

function moderatorFor(handle: string): ModeratorProfile {
  const moderator = ModeratorProfile.from(UserProfile.findByHandle(store, handle));
  if (!moderator) throw new Error(`${handle} can't moderate`);
  return moderator;
}

const roleOf = (handle: string) => store.findByHandle(handle)?.role;

describe("ModeratorProfile.from", () => {
  it("returns a ModeratorProfile for moderators and admins only", () => {
    expect(ModeratorProfile.from(addUser("user-charlie"))).toBeNull();
    expect(ModeratorProfile.from(null)).toBeNull();
    expect(ModeratorProfile.from(addUser("mod-bob", "moderator"))).toBeInstanceOf(ModeratorProfile);
    expect(ModeratorProfile.from(addUser("admin-alice", "admin"))).toBeInstanceOf(ModeratorProfile);
  });

  it("serializes to the public profile only", () => {
    addUser("mod-bob", "moderator");
    expect(JSON.parse(JSON.stringify(moderatorFor("mod-bob")))).toEqual({
      handle: "mod-bob",
      username: "mod-bob",
      role: "moderator",
    });
  });

  it("has no way to change another user's role", () => {
    addUser("mod-bob", "moderator");
    const moderator = moderatorFor("mod-bob") as unknown as Record<string, unknown>;
    expect(moderator.setRole).toBeUndefined();
    expect(moderator.updateUser).toBeUndefined();
    // Moderators can't get admin powers either.
    expect(AdminProfile.from(UserProfile.findByHandle(store, "mod-bob"))).toBeNull();
  });
});

describe("locking posts", () => {
  it("locks a post so no one can reply, and logs who, when and why", () => {
    addUser("mod-bob", "moderator");
    const charlie = addUser("user-charlie");
    expect(canReply(store, charlie, "post-789")).toBe(true);

    moderatorFor("mod-bob").lockPost(store, "post-789", "  Off-topic debate  ");

    expect(store.getPostLock("post-789")).toMatchObject({ postId: "post-789" });
    expect(canReply(store, charlie, "post-789")).toBe(false);
    expect(canReply(store, charlie, "post-other")).toBe(true);
    const [entry] = store.listModeration(10);
    expect(entry).toMatchObject({
      action: "post.lock",
      actorHandle: "mod-bob",
      postId: "post-789",
      reason: "Off-topic debate",
    });
    expect(new Date(entry.createdAt).toISOString()).toBe(entry.createdAt);
  });

  it("blocks replies from moderators too while locked", () => {
    const bob = addUser("mod-bob", "moderator");
    moderatorFor("mod-bob").lockPost(store, "post-789", "Spam");
    expect(canReply(store, bob, "post-789")).toBe(false);
  });

  it("unlocks a post and logs it", () => {
    addUser("mod-bob", "moderator");
    const charlie = addUser("user-charlie");
    const bob = moderatorFor("mod-bob");
    bob.lockPost(store, "post-789", "Heated");
    bob.unlockPost(store, "post-789", "Cooled down");

    expect(store.getPostLock("post-789")).toBeUndefined();
    expect(canReply(store, charlie, "post-789")).toBe(true);
    expect(store.listModeration(10).map((e) => [e.action, e.reason])).toEqual([
      ["post.unlock", "Cooled down"],
      ["post.lock", "Heated"],
    ]);
  });

  it("logs nothing when the post is already in that state", () => {
    addUser("mod-bob", "moderator");
    const bob = moderatorFor("mod-bob");
    bob.unlockPost(store, "post-789", "Not locked");
    bob.lockPost(store, "post-789", "First");
    bob.lockPost(store, "post-789", "Second");
    expect(store.listModeration(10).map((e) => e.reason)).toEqual(["First"]);
  });

  it("lets admins moderate", () => {
    addUser("admin-alice", "admin");
    moderatorFor("admin-alice").lockPost(store, "post-789", "Admin lock");
    expect(store.listModeration(1)[0].actorHandle).toBe("admin-alice");
  });

  it("requires a reason of 1-500 characters", () => {
    addUser("mod-bob", "moderator");
    const bob = moderatorFor("mod-bob");
    expect(() => bob.lockPost(store, "post-789", "   ")).toThrow(InvalidReasonError);
    expect(() => bob.lockPost(store, "post-789", "x".repeat(501))).toThrow(InvalidReasonError);
    expect(store.getPostLock("post-789")).toBeUndefined();
    bob.lockPost(store, "post-789", "x".repeat(500));
    expect(store.getPostLock("post-789")).toBeDefined();
  });

  it("stops working once the moderator is demoted or deleted", () => {
    addUser("mod-bob", "moderator");
    const bob = moderatorFor("mod-bob");
    store.updateRole(bob.id, "user");
    expect(() => bob.lockPost(store, "post-789", "Too late")).toThrow(NotModeratorError);
    expect(() => bob.listModerationLog(store, 10)).toThrow(NotModeratorError);
    store.delete(bob.id);
    expect(() => bob.lockPost(store, "post-789", "Too late")).toThrow(NotModeratorError);
    expect(store.getPostLock("post-789")).toBeUndefined();
    expect(store.listModeration(10)).toEqual([]);
  });

  it("keeps log rows and locks after the moderator's account is deleted", () => {
    const bob = addUser("mod-bob", "moderator");
    moderatorFor("mod-bob").lockPost(store, "post-789", "Spam");
    store.delete(bob.id);
    expect(store.listModeration(10)[0]).toMatchObject({ actorId: null, actorHandle: null, reason: "Spam" });
    expect(store.getPostLock("post-789")).toMatchObject({ lockedById: null });
  });
});

describe("stepDown", () => {
  it("lets a moderator remove their own moderator role, and logs it", () => {
    addUser("mod-bob", "moderator");
    const bob = moderatorFor("mod-bob");
    bob.stepDown(store);
    expect(roleOf("mod-bob")).toBe("user");
    expect(store.listAudit(1)[0]).toMatchObject({
      action: "role.change",
      actorHandle: "mod-bob",
      targetHandle: "mod-bob",
      details: { from: "moderator", to: "user" },
    });
    // Now a plain user, so the old profile can't moderate.
    expect(() => bob.lockPost(store, "post-789", "Gone")).toThrow(NotModeratorError);
  });

  it("isn't available to admins", () => {
    addUser("admin-alice", "admin");
    expect(() => moderatorFor("admin-alice").stepDown(store)).toThrow(NotModeratorRoleError);
    expect(roleOf("admin-alice")).toBe("admin");
    expect(store.listAudit(10)).toEqual([]);
  });

  it("fails once the moderator has already been demoted", () => {
    addUser("mod-bob", "moderator");
    const bob = moderatorFor("mod-bob");
    store.updateRole(bob.id, "user");
    expect(() => bob.stepDown(store)).toThrow(NotModeratorRoleError);
    expect(store.listAudit(10)).toEqual([]);
  });
});

describe("migration", () => {
  it("adds post locks and the moderation log to a database from before moderators", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "howtags-"));
    const file = path.join(dir, "v1.db");
    // Build a current database, then roll it back to user_version 1.
    new SqliteUserStore(file).close();
    const old = new DatabaseSync(file);
    old.exec("DROP TABLE post_locks; DROP TABLE moderation_log; PRAGMA user_version = 1;");
    old.close();

    const upgraded = new SqliteUserStore(file);
    try {
      expect(upgraded.getPostLock("post-789")).toBeUndefined();
      expect(upgraded.listModeration(10)).toEqual([]);
    } finally {
      upgraded.close();
    }
    const check = new DatabaseSync(file);
    expect(check.prepare("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    check.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

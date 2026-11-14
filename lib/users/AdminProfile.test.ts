import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AdminProfile,
  grantAdminFromServer,
  LastAdminError,
  NotAdminError,
  UserNotFoundError,
} from "./AdminProfile";
import { canPost } from "./permissions";
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

// Inserts rows directly: UserProfile.create's scrypt hashing would make every
// test take seconds, and none of these need to sign in.
function addUser(handle: string, role: Role = "user"): UserProfile {
  store.insert({
    id: randomUUID(),
    emailHmac: `hmac-${handle}`,
    handle,
    username: handle,
    passwordHash: "unused",
    createdAt: new Date().toISOString(),
  });
  const id = store.findByHandle(handle)!.id;
  if (role !== "user") store.updateRole(id, role);
  return UserProfile.findById(store, id)!;
}

function adminFor(handle: string): AdminProfile {
  const admin = AdminProfile.from(UserProfile.findByHandle(store, handle));
  if (!admin) throw new Error(`${handle} is not an admin`);
  return admin;
}

const roleOf = (handle: string) => store.findByHandle(handle)?.role;

describe("AdminProfile.from", () => {
  it("returns an AdminProfile only for admins", () => {
    expect(AdminProfile.from(addUser("reg-user"))).toBeNull();
    expect(AdminProfile.from(addUser("mod-user", "moderator"))).toBeNull();
    expect(AdminProfile.from(null)).toBeNull();
    expect(AdminProfile.from(addUser("super-admin", "admin"))).toBeInstanceOf(AdminProfile);
  });

  it("serializes to the public profile only", () => {
    addUser("super-admin", "admin");
    expect(JSON.parse(JSON.stringify(adminFor("super-admin")))).toEqual({
      handle: "super-admin",
      username: "super-admin",
      role: "admin",
    });
  });
});

describe("roles", () => {
  beforeEach(() => {
    addUser("super-admin", "admin");
    addUser("reg-user");
  });

  it("promotes a user to Admin and logs who did it", () => {
    adminFor("super-admin").setRole(store, "reg-user", "admin");
    expect(roleOf("reg-user")).toBe("admin");

    const [entry] = store.listAudit(10);
    expect(entry).toMatchObject({
      action: "role.change",
      actorHandle: "super-admin",
      targetHandle: "reg-user",
      details: { from: "user", to: "admin" },
    });
  });

  it("promotes a user to Moderator and logs it", () => {
    adminFor("super-admin").setRole(store, "reg-user", "moderator");
    expect(roleOf("reg-user")).toBe("moderator");
    expect(store.listAudit(10)[0].details).toEqual({ from: "user", to: "moderator" });
  });

  it("doesn't log a change that changes nothing", () => {
    adminFor("super-admin").setRole(store, "reg-user", "user");
    expect(store.listAudit(10)).toEqual([]);
  });

  it("stops the last admin from removing their own role", () => {
    const admin = adminFor("super-admin");
    expect(() => admin.setRole(store, "super-admin", "user")).toThrow(LastAdminError);
    expect(() => admin.setRole(store, "super-admin", "user")).toThrow("Cannot remove the last administrator");
    expect(roleOf("super-admin")).toBe("admin");
    expect(store.listAudit(10)).toEqual([]);
  });

  it("lets an admin step down while another admin remains", () => {
    const admin = adminFor("super-admin");
    admin.setRole(store, "reg-user", "admin");
    admin.setRole(store, "super-admin", "user");
    expect(roleOf("super-admin")).toBe("user");
    // Now reg-user is the only admin, so the guard applies to them.
    expect(() => adminFor("reg-user").setRole(store, "reg-user", "moderator")).toThrow(LastAdminError);
  });

  it("stops working once its account is demoted", () => {
    const original = adminFor("super-admin");
    original.setRole(store, "reg-user", "admin");
    adminFor("reg-user").setRole(store, "super-admin", "user");
    expect(() => original.setRole(store, "reg-user", "user")).toThrow(NotAdminError);
    expect(() => original.updateSiteSettings(store, { postingEnabled: false })).toThrow(NotAdminError);
    expect(roleOf("reg-user")).toBe("admin");
  });

  it("rejects unknown handles and roles", () => {
    const admin = adminFor("super-admin");
    expect(() => admin.setRole(store, "nobody-here", "admin")).toThrow(UserNotFoundError);
    expect(() => admin.setRole(store, "reg-user", "owner" as Role)).toThrow("Unknown role.");
    expect(roleOf("reg-user")).toBe("user");
  });
});

describe("posting permissions", () => {
  beforeEach(() => {
    addUser("super-admin", "admin");
    addUser("reg-user");
  });

  it("lets everyone post by default", () => {
    expect(canPost(store, UserProfile.findByHandle(store, "reg-user")!)).toBe(true);
  });

  it("turns off posting for one user", () => {
    adminFor("super-admin").setUserPermissions(store, "reg-user", { canPost: false });
    expect(canPost(store, UserProfile.findByHandle(store, "reg-user")!)).toBe(false);
    expect(canPost(store, UserProfile.findByHandle(store, "super-admin")!)).toBe(true);
    expect(store.listAudit(10)[0]).toMatchObject({
      action: "permissions.change",
      targetHandle: "reg-user",
      details: { canPost: { from: true, to: false } },
    });
  });

  it("reads the current setting, not the one the profile was loaded with", () => {
    const loadedEarlier = UserProfile.findByHandle(store, "reg-user")!;
    adminFor("super-admin").setUserPermissions(store, "reg-user", { canPost: false });
    expect(canPost(store, loadedEarlier)).toBe(false);
  });

  it("turns off posting site-wide", () => {
    const admin = adminFor("super-admin");
    admin.updateSiteSettings(store, { postingEnabled: false });
    expect(admin.getSiteSettings(store)).toEqual({ postingEnabled: false });
    expect(canPost(store, UserProfile.findByHandle(store, "reg-user")!)).toBe(false);
    expect(canPost(store, UserProfile.findByHandle(store, "super-admin")!)).toBe(false);
    expect(store.listAudit(10)[0]).toMatchObject({ action: "settings.change", targetId: null });
  });

  it("saves role and permissions together, or neither", () => {
    const admin = adminFor("super-admin");
    expect(() => admin.updateUser(store, "super-admin", { role: "user", canPost: false })).toThrow(LastAdminError);
    expect(store.findByHandle("super-admin")).toMatchObject({ role: "admin", canPost: true });
    expect(store.listAudit(10)).toEqual([]);

    admin.updateUser(store, "reg-user", { role: "moderator", canPost: false });
    expect(store.findByHandle("reg-user")).toMatchObject({ role: "moderator", canPost: false });
    expect(store.listAudit(10).map((e) => e.action).sort()).toEqual(["permissions.change", "role.change"]);
  });
});

describe("audit log", () => {
  it("keeps entries after the people in them delete their accounts", () => {
    addUser("super-admin", "admin");
    addUser("other-admin", "admin");
    addUser("reg-user");
    adminFor("super-admin").setRole(store, "reg-user", "moderator");
    store.delete(store.findByHandle("super-admin")!.id);
    store.delete(store.findByHandle("reg-user")!.id);

    const [entry] = store.listAudit(10);
    expect(entry).toMatchObject({ actorId: null, actorHandle: null, targetId: null, targetHandle: null });
    expect(entry.details).toEqual({ from: "user", to: "moderator" });
  });

  it("records the make-admin script as having no actor", () => {
    addUser("first-user");
    grantAdminFromServer(store, "first-user");
    expect(roleOf("first-user")).toBe("admin");
    expect(store.listAudit(10)[0]).toMatchObject({ actorId: null, targetHandle: "first-user" });
  });
});

describe("migration", () => {
  it("upgrades a database created before roles existed", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "howtags-"));
    const file = path.join(dir, "old.db");
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, email_hmac TEXT NOT NULL UNIQUE, handle TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO users VALUES ('id-1', 'hmac', 'old-timer', 'Old', 'hash', '2026-01-01T00:00:00.000Z');
    `);
    old.close();

    const upgraded = new SqliteUserStore(file);
    try {
      expect(upgraded.findByHandle("old-timer")).toMatchObject({ role: "user", canPost: true });
      expect(upgraded.getSiteSettings()).toEqual({ postingEnabled: true });
      expect(upgraded.listAudit(10)).toEqual([]);
    } finally {
      upgraded.close();
    }
    // Opening it again doesn't re-run the migration.
    new SqliteUserStore(file).close();
    rmSync(dir, { recursive: true, force: true });
  });
});

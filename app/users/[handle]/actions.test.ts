import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSession } from "@/lib/auth/session";
import type { Role } from "@/lib/users/roles";
import { SqliteUserStore } from "@/lib/users/store";

// Stand-ins for the request's cookie jar, the server's database, and the
// Next.js functions that work by throwing.
const jar = new Map<string, string>();
let store: SqliteUserStore;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("@/lib/users/db", () => ({ getUserStore: () => store }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  forbidden: () => {
    throw new Error("forbidden");
  },
}));
vi.mock("next/cache", () => ({ refresh: () => {} }));

const { saveUserAdminSettings } = await import("./actions");
const { saveSiteSettings } = await import("@/app/admin/settings/actions");

beforeEach(() => {
  store = new SqliteUserStore(":memory:");
  jar.clear();
});
afterEach(() => {
  store.close();
});

function addUser(handle: string, role: Role = "user"): string {
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
  return id;
}

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

describe("saveUserAdminSettings", () => {
  it("lets an admin change another user's role and posting permission", async () => {
    await startSession(addUser("super-admin", "admin"));
    addUser("reg-user");
    const result = await saveUserAdminSettings("reg-user", {}, form({ role: "moderator" }));
    expect(result).toEqual({ saved: true });
    // An unchecked checkbox isn't sent, so posting is now off.
    expect(store.findByHandle("reg-user")).toMatchObject({ role: "moderator", canPost: false });
  });

  it("shows the last-admin message instead of demoting the only admin", async () => {
    await startSession(addUser("super-admin", "admin"));
    const result = await saveUserAdminSettings("super-admin", {}, form({ role: "user", canPost: "on" }));
    expect(result).toEqual({ error: "Cannot remove the last administrator" });
    expect(store.findByHandle("super-admin")?.role).toBe("admin");
  });

  it("forbids moderators and users", async () => {
    addUser("reg-user");
    for (const role of ["moderator", "user"] as const) {
      jar.clear();
      await startSession(addUser(`acting-${role}`, role));
      await expect(saveUserAdminSettings("reg-user", {}, form({ role: "admin", canPost: "on" }))).rejects.toThrow(
        "forbidden",
      );
    }
    expect(store.findByHandle("reg-user")?.role).toBe("user");
    expect(store.listAudit(10)).toEqual([]);
  });

  it("sends signed-out visitors to sign in", async () => {
    addUser("reg-user");
    await expect(saveUserAdminSettings("reg-user", {}, form({ role: "admin" }))).rejects.toThrow("redirect:/sign-in");
  });

  it("acts as the signed-in admin, whatever the form says", async () => {
    addUser("other-admin", "admin");
    await startSession(addUser("super-admin", "admin"));
    addUser("reg-user");
    await saveUserAdminSettings("reg-user", {}, form({ role: "moderator", actorId: "other-admin" }));
    expect(store.listAudit(1)[0].actorHandle).toBe("super-admin");
  });
});

describe("saveSiteSettings", () => {
  it("lets an admin turn off posting site-wide", async () => {
    await startSession(addUser("super-admin", "admin"));
    expect(await saveSiteSettings({}, form({}))).toEqual({ saved: true });
    expect(store.getSiteSettings()).toEqual({ postingEnabled: false });
  });

  it("forbids moderators", async () => {
    await startSession(addUser("mod-bob", "moderator"));
    await expect(saveSiteSettings({}, form({}))).rejects.toThrow("forbidden");
    expect(store.getSiteSettings()).toEqual({ postingEnabled: true });
  });
});

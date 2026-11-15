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

const { setPostLock } = await import("./actions");

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

describe("setPostLock", () => {
  it("lets a moderator lock and unlock a post with a reason", async () => {
    await startSession(addUser("mod-bob", "moderator"));
    expect(await setPostLock("post-789", {}, form({ intent: "lock", reason: "Off-topic debate" }))).toEqual({
      saved: true,
    });
    expect(store.getPostLock("post-789")).toBeDefined();
    expect(store.listModeration(1)[0]).toMatchObject({ actorHandle: "mod-bob", reason: "Off-topic debate" });

    await setPostLock("post-789", {}, form({ intent: "unlock", reason: "Resolved" }));
    expect(store.getPostLock("post-789")).toBeUndefined();
  });

  it("lets an admin lock a post", async () => {
    await startSession(addUser("admin-alice", "admin"));
    await setPostLock("post-789", {}, form({ intent: "lock", reason: "Spam" }));
    expect(store.getPostLock("post-789")).toBeDefined();
  });

  it("shows an error for a missing reason or intent", async () => {
    await startSession(addUser("mod-bob", "moderator"));
    expect(await setPostLock("post-789", {}, form({ intent: "lock" }))).toHaveProperty("error");
    expect(await setPostLock("post-789", {}, form({ reason: "Spam" }))).toHaveProperty("error");
    expect(store.getPostLock("post-789")).toBeUndefined();
  });

  it("forbids regular users", async () => {
    await startSession(addUser("user-charlie"));
    await expect(setPostLock("post-789", {}, form({ intent: "lock", reason: "Mine" }))).rejects.toThrow("forbidden");
    expect(store.getPostLock("post-789")).toBeUndefined();
    expect(store.listModeration(10)).toEqual([]);
  });

  it("sends signed-out visitors to sign in", async () => {
    await expect(setPostLock("post-789", {}, form({ intent: "lock", reason: "Spam" }))).rejects.toThrow(
      "redirect:/sign-in",
    );
  });
});

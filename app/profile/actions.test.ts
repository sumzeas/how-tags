import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startSession } from "@/lib/auth/session";
import type { Role } from "@/lib/users/roles";
import { SqliteUserStore } from "@/lib/users/store";
import { UserProfile } from "@/lib/users/UserProfile";

// A stand-in for the request's cookie jar and the server's database.
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
// The real redirect() throws an error Next.js catches; this one records where it pointed.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  forbidden: () => {
    throw new Error("forbidden");
  },
}));
vi.mock("next/cache", () => ({ refresh: () => {} }));

const { deleteAccount, stepDownAsModerator } = await import("./actions");

const EMAIL = "sam@mail.com";
const PASSWORD = "correct horse battery";

beforeAll(() => {
  process.env.EMAIL_HMAC_KEY = randomBytes(32).toString("base64");
});
beforeEach(() => {
  store = new SqliteUserStore(":memory:");
  jar.clear();
});
afterEach(() => {
  store.close();
});

async function signedInUser() {
  const user = await UserProfile.create(store, { email: EMAIL, username: "Sam", password: PASSWORD });
  await startSession(user.id);
  return user;
}

function submit(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return deleteAccount({}, formData);
}

describe("deleteAccount", () => {
  it("deletes the account and its session with the right password", async () => {
    const user = await signedInUser();
    const [token] = jar.values();
    await expect(submit({ password: PASSWORD })).rejects.toThrow("redirect:/sign-in");

    expect(store.findById(user.id)).toBeUndefined();
    expect(jar.size).toBe(0);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    expect(store.findSessionUserId(tokenHash)).toBeUndefined();
    // The email is free to sign up again.
    await expect(
      UserProfile.create(store, { email: EMAIL, username: "Sam", password: PASSWORD }),
    ).resolves.toBeInstanceOf(UserProfile);
  });

  it("keeps the account and session with a wrong password", async () => {
    const user = await signedInUser();
    expect(await submit({ password: "wrong password!!" })).toEqual({ error: "Incorrect password." });
    expect(store.findById(user.id)).toBeDefined();
    expect(jar.size).toBe(1);
    expect(await UserProfile.authenticate(store, EMAIL, PASSWORD)).not.toBeNull();
  });

  it("ignores a user id sent in the form and deletes only the signed-in account", async () => {
    const other = await UserProfile.create(store, { email: "other@mail.com", username: "Other", password: PASSWORD });
    const user = await signedInUser();
    await expect(submit({ password: PASSWORD, userId: other.id })).rejects.toThrow("redirect:/sign-in");
    expect(store.findById(user.id)).toBeUndefined();
    expect(store.findById(other.id)).toBeDefined();
  });

  it("deletes nothing without a session", async () => {
    const user = await UserProfile.create(store, { email: EMAIL, username: "Sam", password: PASSWORD });
    await expect(submit({ password: PASSWORD })).rejects.toThrow("redirect:/sign-in/clear-session");
    expect(store.findById(user.id)).toBeDefined();
  });
});

describe("stepDownAsModerator", () => {
  // Inserts rows directly: these tests don't need a password.
  function addUser(handle: string, role: Role): string {
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

  it("makes the signed-in moderator a plain user", async () => {
    await startSession(addUser("mod-bob", "moderator"));
    await stepDownAsModerator();
    expect(store.findByHandle("mod-bob")?.role).toBe("user");
    expect(store.listAudit(1)[0]).toMatchObject({ actorHandle: "mod-bob", targetHandle: "mod-bob" });
  });

  it("forbids users and admins", async () => {
    for (const role of ["user", "admin"] as const) {
      jar.clear();
      await startSession(addUser(`acting-${role}`, role));
      await expect(stepDownAsModerator()).rejects.toThrow("forbidden");
      expect(store.findByHandle(`acting-${role}`)?.role).toBe(role);
    }
    expect(store.listAudit(10)).toEqual([]);
  });

  it("sends signed-out visitors to sign in", async () => {
    await expect(stepDownAsModerator()).rejects.toThrow("redirect:/sign-in/clear-session");
  });
});

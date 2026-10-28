import { randomBytes } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

const { clearStaleSession, endSession, getCurrentUser, startSession } = await import("./session");

const PASSWORD = "correct horse battery";

beforeAll(() => {
  process.env.EMAIL_HMAC_KEY = randomBytes(32).toString("base64");
});
beforeEach(() => {
  store = new SqliteUserStore(":memory:");
  jar.clear();
});
afterEach(() => {
  vi.useRealTimers();
  store.close();
});

async function signedInUser() {
  const user = await UserProfile.create(store, { email: "sam@mail.com", username: "Sam", password: PASSWORD });
  await startSession(user.id);
  return user;
}

describe("getCurrentUser", () => {
  it("returns null without a session cookie", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns only the public profile for a live session", async () => {
    const user = await signedInUser();
    expect(await getCurrentUser()).toEqual({ handle: user.handle, username: "Sam" });
  });

  it("returns null after sign-out or account deletion", async () => {
    const user = await signedInUser();
    await endSession();
    expect(await getCurrentUser()).toBeNull();

    await startSession(user.id);
    await user.delete(store, PASSWORD);
    expect(await getCurrentUser()).toBeNull();
  });

  it("checks expiry with SQLite's clock, not the JavaScript one", async () => {
    // Reading JS time here would make Next.js require connection() or io().
    await signedInUser();
    vi.useFakeTimers({ now: new Date("3000-01-01T00:00:00.000Z") });
    expect(await getCurrentUser()).not.toBeNull();
  });
});

describe("clearStaleSession", () => {
  it("deletes a cookie whose account no longer exists", async () => {
    const user = await signedInUser();
    await user.delete(store, PASSWORD);
    await clearStaleSession();
    expect(jar.size).toBe(0);
  });

  it("keeps a valid cookie, so a link to it can't sign anyone out", async () => {
    await signedInUser();
    await clearStaleSession();
    expect(jar.size).toBe(1);
    expect(await getCurrentUser()).not.toBeNull();
  });
});

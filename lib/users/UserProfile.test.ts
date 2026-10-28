import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InvalidEmailError } from "./email";
import { generateHandle } from "./handle";
import { InvalidPasswordError } from "./password";
import { EmailTakenError, SqliteUserStore, type UserRecord, type UserStore } from "./store";
import { IncorrectPasswordError, InvalidUsernameError, UserProfile } from "./UserProfile";
import { ADJECTIVES, ANIMALS, COLORS } from "./wordlists";

const EMAIL = "Sam.Example@Mail.com";
const PASSWORD = "correct horse battery";

beforeAll(() => {
  process.env.EMAIL_HMAC_KEY = randomBytes(32).toString("base64");
});

let store: SqliteUserStore;
beforeEach(() => {
  store = new SqliteUserStore(":memory:");
});
afterEach(() => {
  store.close();
});

function signUp(overrides: Partial<{ email: string; username: string; password: string }> = {}) {
  return UserProfile.create(store, { email: EMAIL, username: "Sam", password: PASSWORD, ...overrides });
}

describe("sign-up and sign-in", () => {
  it("authenticates with the right email and password", async () => {
    const user = await signUp();
    const signedIn = await UserProfile.authenticate(store, EMAIL, PASSWORD);
    expect(signedIn?.id).toBe(user.id);
    expect(signedIn?.username).toBe("Sam");
    expect(user.handle).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
  });

  it("matches email case-insensitively and ignores surrounding spaces", async () => {
    await signUp();
    expect(await UserProfile.authenticate(store, "  sam.example@MAIL.COM ", PASSWORD)).not.toBeNull();
  });

  it("returns null for a wrong password, unknown email, or malformed email", async () => {
    await signUp();
    expect(await UserProfile.authenticate(store, EMAIL, "wrong password!!")).toBeNull();
    expect(await UserProfile.authenticate(store, "nobody@mail.com", PASSWORD)).toBeNull();
    expect(await UserProfile.authenticate(store, "not-an-email", PASSWORD)).toBeNull();
  });

  it("rejects a second account with the same email", async () => {
    await signUp();
    await expect(signUp({ email: "SAM.EXAMPLE@mail.com", username: "Other" })).rejects.toThrow(
      EmailTakenError,
    );
  });

  it("allows duplicate display names with different handles", async () => {
    const a = await signUp();
    const b = await signUp({ email: "other@mail.com" });
    expect(a.username).toBe(b.username);
    expect(a.handle).not.toBe(b.handle);
  });

  it("rejects invalid input", async () => {
    await expect(signUp({ email: "bad" })).rejects.toThrow(InvalidEmailError);
    await expect(signUp({ password: "short" })).rejects.toThrow(InvalidPasswordError);
    await expect(signUp({ password: "x".repeat(129) })).rejects.toThrow(InvalidPasswordError);
    await expect(signUp({ username: "   " })).rejects.toThrow(InvalidUsernameError);
    await expect(signUp({ username: "x".repeat(33) })).rejects.toThrow(InvalidUsernameError);
    await expect(signUp({ username: "Sam\u0000" })).rejects.toThrow(InvalidUsernameError);
  });

  it("blocks reserved names, including disguised ones", async () => {
    for (const username of ["admin", "Ad-Min", "HowTags Official", "MODERATOR"]) {
      await expect(signUp({ username })).rejects.toThrow(InvalidUsernameError);
    }
  });
});

describe("what gets stored", () => {
  it("never writes the raw email or password to the database file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "howtags-"));
    const fileStore = new SqliteUserStore(path.join(dir, "test.db"));
    await UserProfile.create(fileStore, { email: EMAIL, username: "Sam", password: PASSWORD });
    fileStore.close();

    for (const name of readdirSync(dir)) {
      const bytes = readFileSync(path.join(dir, name)).toString("latin1").toLowerCase();
      expect(bytes).not.toContain("sam.example");
      expect(bytes).not.toContain("correct horse");
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("salts every password hash differently", async () => {
    const a = await signUp();
    const b = await signUp({ email: "other@mail.com" });
    const hashA = store.findById(a.id)!.passwordHash;
    const hashB = store.findById(b.id)!.passwordHash;
    expect(hashA).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(hashA).not.toBe(hashB);
  });

  it("exposes only the handle and display name when serialized", async () => {
    const user = await signUp();
    expect(JSON.parse(JSON.stringify(user))).toEqual({ handle: user.handle, username: "Sam" });
    expect(Object.keys(user)).not.toContain("passwordHash");
  });
});

describe("account changes", () => {
  it("changes the password only with the current one", async () => {
    const user = await signUp();
    await expect(user.changePassword(store, "wrong password!!", "brand new password")).rejects.toThrow(
      IncorrectPasswordError,
    );
    await user.changePassword(store, PASSWORD, "brand new password");
    expect(await UserProfile.authenticate(store, EMAIL, PASSWORD)).toBeNull();
    expect(await UserProfile.authenticate(store, EMAIL, "brand new password")).not.toBeNull();
  });

  it("renames with the same validation as sign-up", async () => {
    const user = await signUp();
    user.rename(store, "  Samantha  ");
    expect(UserProfile.findById(store, user.id)?.username).toBe("Samantha");
    expect(() => user.rename(store, "admin")).toThrow(InvalidUsernameError);
  });

  it("does not delete with the wrong password", async () => {
    const user = await signUp();
    await expect(user.delete(store, "wrong password!!")).rejects.toThrow(IncorrectPasswordError);
    expect(store.findById(user.id)).toBeDefined();
  });

  it("deletes permanently with the right password", async () => {
    const user = await signUp();
    await user.delete(store, PASSWORD);
    expect(store.findById(user.id)).toBeUndefined();
    expect(await UserProfile.authenticate(store, EMAIL, PASSWORD)).toBeNull();
    expect(() => user.rename(store, "Ghost")).toThrow(/deleted/);
    // The email is free to sign up again.
    await expect(signUp()).resolves.toBeInstanceOf(UserProfile);
  });
});

describe("handles", () => {
  it("uses non-repeating wordlists", () => {
    for (const list of [ADJECTIVES, COLORS, ANIMALS]) {
      expect(new Set(list).size).toBe(list.length);
    }
    expect(ADJECTIVES.length * COLORS.length * ANIMALS.length).toBe(300_000);
  });

  it("generates varied handles", () => {
    const handles = new Set(Array.from({ length: 1000 }, () => generateHandle()));
    expect(handles.size).toBeGreaterThan(990);
  });

  it("retries on collision and falls back to a numeric suffix", async () => {
    let attempts = 0;
    const alwaysTaken: UserStore = {
      insert: (record: UserRecord) => ++attempts > 10 && /-\d{2}$/.test(record.handle),
      findByEmailHmac: () => undefined,
      findById: () => undefined,
      updateUsername: () => {},
      updatePasswordHash: () => {},
      delete: () => {},
    };
    const user = await UserProfile.create(alwaysTaken, { email: EMAIL, username: "Sam", password: PASSWORD });
    expect(attempts).toBe(11);
    expect(user.handle).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
  });
});

describe("sign-up step 1 check", () => {
  it("passes for a new email and valid password", () => {
    expect(() => UserProfile.checkSignUp(store, EMAIL, PASSWORD)).not.toThrow();
  });

  it("rejects an email that's already registered, in any letter case", async () => {
    await signUp();
    expect(() => UserProfile.checkSignUp(store, "SAM.EXAMPLE@mail.com", PASSWORD)).toThrow(
      EmailTakenError,
    );
  });

  it("rejects invalid input", () => {
    expect(() => UserProfile.checkSignUp(store, "bad", PASSWORD)).toThrow(InvalidEmailError);
    expect(() => UserProfile.checkSignUp(store, EMAIL, "short")).toThrow(InvalidPasswordError);
  });
});

describe("sessions", () => {
  const LATER = "2999-01-01T00:00:00.000Z";

  it("finds the user for a live session and not for an expired one", async () => {
    const user = await signUp();
    store.createSession("live", user.id, LATER);
    store.createSession("expired", user.id, "2000-01-01T00:00:00.000Z");
    expect(store.findSessionUserId("live")).toBe(user.id);
    expect(store.findSessionUserId("expired")).toBeUndefined();
    expect(store.findSessionUserId("unknown")).toBeUndefined();
  });

  it("compares expiry to the current time down to the second", async () => {
    const user = await signUp();
    store.createSession("soon", user.id, new Date(Date.now() + 60_000).toISOString());
    store.createSession("just-gone", user.id, new Date(Date.now() - 1_000).toISOString());
    expect(store.findSessionUserId("soon")).toBe(user.id);
    expect(store.findSessionUserId("just-gone")).toBeUndefined();
  });

  it("deletes expired sessions when a new one starts", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "howtags-"));
    const file = path.join(dir, "test.db");
    const fileStore = new SqliteUserStore(file);
    const user = await UserProfile.create(fileStore, { email: EMAIL, username: "Sam", password: PASSWORD });
    fileStore.createSession("expired", user.id, "2000-01-01T00:00:00.000Z");
    fileStore.createSession("live", user.id, LATER);

    const db = new DatabaseSync(file);
    const rows = db.prepare("SELECT token_hash FROM sessions").all();
    db.close();
    fileStore.close();
    rmSync(dir, { recursive: true, force: true });
    expect(rows).toEqual([{ token_hash: "live" }]);
  });

  it("ends a session when it's deleted", async () => {
    const user = await signUp();
    store.createSession("token", user.id, LATER);
    store.deleteSession("token");
    expect(store.findSessionUserId("token")).toBeUndefined();
  });

  it("ends every session when the account is deleted", async () => {
    const user = await signUp();
    store.createSession("token", user.id, LATER);
    await user.delete(store, PASSWORD);
    expect(store.findSessionUserId("token")).toBeUndefined();
  });
});

import "server-only";
import { randomUUID } from "node:crypto";
import { emailLookupKey, InvalidEmailError } from "./email";
import { generateHandle } from "./handle";
import { getDummyHash, hashPassword, verifyPassword } from "./password";
import type { UserRecord, UserStore } from "./store";

// Privacy model: each account stores only what's needed to tell users apart
// and let them sign in.
//   id          random UUID, internal only (other tables should reference this)
//   emailHmac   keyed hash of the sign-in email; the email itself is never stored
//   handle      generated public name, e.g. @brave-crimson-otter
//   username    display name chosen by the user (not unique)
//   password    scrypt hash, see password.ts
//
// NOTE: The sign-up feature must tell users their email is never shared with
// advertisers.
//
// TODO(password recovery): sending reset emails needs a readable copy of the
// address. When adding it, store an AES-256-GCM encrypted copy (key in
// EMAIL_ENCRYPTION_KEY) and fill it in at each user's next sign-in, since they
// type the email then. Keep emailHmac for lookups.

const USERNAME_MAX_LENGTH = 32;
const HANDLE_ATTEMPTS = 10;

// Compared after lowercasing and removing everything but letters and digits,
// so "Ad-Min" and "HowTags Official" are caught too.
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "moderator", "mod", "staff", "support",
  "system", "root", "howtags", "howtagsofficial", "official", "deleteduser",
]);

export class InvalidUsernameError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidUsernameError";
  }
}

export class IncorrectPasswordError extends Error {
  constructor() {
    super("Incorrect password.");
    this.name = "IncorrectPasswordError";
  }
}

export function normalizeUsername(username: string): string {
  const normalized = username.normalize("NFKC").trim().replace(/\s+/g, " ");
  const length = [...normalized].length;
  if (length < 1 || length > USERNAME_MAX_LENGTH) {
    throw new InvalidUsernameError(`Username must be 1-${USERNAME_MAX_LENGTH} characters.`);
  }
  if (/\p{C}/u.test(normalized)) {
    throw new InvalidUsernameError("Username contains invalid characters.");
  }
  if (RESERVED_USERNAMES.has(normalized.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))) {
    throw new InvalidUsernameError("That username is reserved.");
  }
  return normalized;
}

export interface PublicProfile {
  handle: string;
  username: string;
}

export class UserProfile {
  readonly id: string;
  readonly handle: string;
  readonly createdAt: string;
  #username: string;
  // Private fields are invisible to JSON.stringify, spread, and console.log.
  #passwordHash: string;
  #deleted = false;

  private constructor(record: UserRecord) {
    this.id = record.id;
    this.handle = record.handle;
    this.createdAt = record.createdAt;
    this.#username = record.username;
    this.#passwordHash = record.passwordHash;
  }

  get username(): string {
    return this.#username;
  }

  /** Throws InvalidEmailError, InvalidUsernameError, InvalidPasswordError, or EmailTakenError. */
  static async create(
    store: UserStore,
    input: { email: string; username: string; password: string },
  ): Promise<UserProfile> {
    const username = normalizeUsername(input.username);
    const emailHmac = emailLookupKey(input.email);
    const passwordHash = await hashPassword(input.password);

    for (let attempt = 0; attempt <= HANDLE_ATTEMPTS; attempt++) {
      const record: UserRecord = {
        id: randomUUID(),
        emailHmac,
        handle: generateHandle(attempt === HANDLE_ATTEMPTS),
        username,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      if (store.insert(record)) return new UserProfile(record);
    }
    throw new Error("Could not generate a unique handle.");
  }

  /**
   * Returns the user, or null for any failure. Callers should show one
   * generic "email or password is incorrect" message.
   */
  static async authenticate(
    store: UserStore,
    email: string,
    password: string,
  ): Promise<UserProfile | null> {
    let record: UserRecord | undefined;
    try {
      record = store.findByEmailHmac(emailLookupKey(email));
    } catch (err) {
      if (!(err instanceof InvalidEmailError)) throw err;
    }
    // Hash even when there's no account, so response time doesn't reveal
    // which emails are registered.
    const valid = await verifyPassword(password, record?.passwordHash ?? (await getDummyHash()));
    return record && valid ? new UserProfile(record) : null;
  }

  static findById(store: UserStore, id: string): UserProfile | null {
    const record = store.findById(id);
    return record ? new UserProfile(record) : null;
  }

  async changePassword(store: UserStore, current: string, next: string): Promise<void> {
    await this.#requirePassword(current);
    const passwordHash = await hashPassword(next);
    store.updatePasswordHash(this.id, passwordHash);
    this.#passwordHash = passwordHash;
  }

  rename(store: UserStore, username: string): void {
    this.#assertNotDeleted();
    const normalized = normalizeUsername(username);
    store.updateUsername(this.id, normalized);
    this.#username = normalized;
  }

  /**
   * Permanently deletes the account after re-checking the password. Nothing
   * is kept. Future content tables (edits, tutorials) should show
   * "[deleted user]" for rows whose author no longer exists.
   */
  async delete(store: UserStore, password: string): Promise<void> {
    await this.#requirePassword(password);
    store.delete(this.id);
    this.#deleted = true;
    this.#passwordHash = "";
  }

  /** The only shape that should leave the server. */
  toPublic(): PublicProfile {
    return { handle: this.handle, username: this.#username };
  }

  toJSON(): PublicProfile {
    return this.toPublic();
  }

  async #requirePassword(password: string): Promise<void> {
    this.#assertNotDeleted();
    if (!(await verifyPassword(password, this.#passwordHash))) {
      throw new IncorrectPasswordError();
    }
  }

  #assertNotDeleted(): void {
    if (this.#deleted) throw new Error("This account has been deleted.");
  }
}

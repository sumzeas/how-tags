import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EmailTakenError } from "./email";

/** A user row exactly as stored. Never send this to the client. */
export interface UserRecord {
  id: string;
  emailHmac: string;
  handle: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

/**
 * Persistence for user accounts. UserProfile only talks to this interface,
 * so the backing database can change without touching the class.
 */
export interface UserStore {
  /** Inserts a user. Returns false if `handle` is taken; throws EmailTakenError if `emailHmac` is. */
  insert(user: UserRecord): boolean;
  findByEmailHmac(emailHmac: string): UserRecord | undefined;
  findById(id: string): UserRecord | undefined;
  updateUsername(id: string, username: string): void;
  updatePasswordHash(id: string, passwordHash: string): void;
  delete(id: string): void;
}

/**
 * Persistence for sign-in sessions. Only a hash of each session token is
 * stored; the token itself lives in the user's cookie.
 */
export interface SessionStore {
  createSession(tokenHash: string, userId: string, expiresAt: string): void;
  /** Returns the session's user id, or undefined if missing or expired at `now`. */
  findSessionUserId(tokenHash: string, now: string): string | undefined;
  deleteSession(tokenHash: string): void;
}

// Defined in email.ts so UserProfile can throw it without loading SQLite.
export { EmailTakenError };

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email_hmac    TEXT NOT NULL UNIQUE,
    handle        TEXT NOT NULL UNIQUE,
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  ) STRICT;
`;

interface UserRow {
  id: string;
  email_hmac: string;
  handle: string;
  username: string;
  password_hash: string;
  created_at: string;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    emailHmac: row.email_hmac,
    handle: row.handle,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export class SqliteUserStore implements UserStore, SessionStore {
  readonly #db: DatabaseSync;

  /** `file` defaults to data/howtags.db; pass ":memory:" for tests. */
  constructor(file = path.join(process.cwd(), "data", "howtags.db")) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.#db = new DatabaseSync(file);
    // Zero out deleted rows in the main database file. Old copies can still sit
    // in the -wal file until a checkpoint overwrites them, and in any backups.
    this.#db.exec("PRAGMA secure_delete = ON;");
    this.#db.exec("PRAGMA journal_mode = WAL;");
    // Needed for ON DELETE CASCADE, so deleting a user ends their sessions.
    this.#db.exec("PRAGMA foreign_keys = ON;");
    this.#db.exec(SCHEMA);
  }

  insert(user: UserRecord): boolean {
    try {
      this.#db
        .prepare(
          `INSERT INTO users (id, email_hmac, handle, username, password_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(user.id, user.emailHmac, user.handle, user.username, user.passwordHash, user.createdAt);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("UNIQUE constraint failed: users.email_hmac")) throw new EmailTakenError();
      if (message.includes("UNIQUE constraint failed: users.handle")) return false;
      throw err;
    }
  }

  findByEmailHmac(emailHmac: string): UserRecord | undefined {
    const row = this.#db.prepare("SELECT * FROM users WHERE email_hmac = ?").get(emailHmac);
    return row ? toRecord(row as unknown as UserRow) : undefined;
  }

  findById(id: string): UserRecord | undefined {
    const row = this.#db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row ? toRecord(row as unknown as UserRow) : undefined;
  }

  updateUsername(id: string, username: string): void {
    this.#db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, id);
  }

  updatePasswordHash(id: string, passwordHash: string): void {
    this.#db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  }

  delete(id: string): void {
    this.#db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }

  createSession(tokenHash: string, userId: string, expiresAt: string): void {
    this.#db
      .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash, userId, expiresAt);
  }

  findSessionUserId(tokenHash: string, now: string): string | undefined {
    const row = this.#db
      .prepare("SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
      .get(tokenHash, now) as { user_id: string } | undefined;
    return row?.user_id;
  }

  deleteSession(tokenHash: string): void {
    this.#db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  close(): void {
    this.#db.close();
  }
}

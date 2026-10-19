import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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

export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailTakenError";
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email_hmac    TEXT NOT NULL UNIQUE,
    handle        TEXT NOT NULL UNIQUE,
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
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

export class SqliteUserStore implements UserStore {
  readonly #db: DatabaseSync;

  /** `file` defaults to data/howtags.db; pass ":memory:" for tests. */
  constructor(file = path.join(process.cwd(), "data", "howtags.db")) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.#db = new DatabaseSync(file);
    // Overwrite deleted rows with zeros so removed accounts don't linger on disk.
    this.#db.exec("PRAGMA secure_delete = ON;");
    this.#db.exec("PRAGMA journal_mode = WAL;");
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

  close(): void {
    this.#db.close();
  }
}

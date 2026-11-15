import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EmailTakenError } from "./email";
import type { Role } from "./roles";

/** A user row exactly as stored. Never send this to the client. */
export interface UserRecord {
  id: string;
  emailHmac: string;
  handle: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  role: Role;
  /** Per-user "Allow Posting" switch, set by admins. */
  canPost: boolean;
}

/** The fields a new account starts with; role and canPost take their defaults. */
export type NewUserRecord = Omit<UserRecord, "role" | "canPost">;

/** Site-wide switches, edited on /admin/settings. */
export interface SiteSettings {
  postingEnabled: boolean;
}

export type AuditAction = "role.change" | "permissions.change" | "settings.change";

export interface NewAuditEntry {
  /** null when the change came from the server itself (the make-admin script). */
  actorId: string | null;
  action: AuditAction;
  targetId: string | null;
  /** What changed, e.g. { from: "user", to: "admin" }. Stored as JSON. */
  details: Record<string, unknown>;
}

export interface AuditEntry {
  id: number;
  action: AuditAction;
  /** null for "system", or once the account has been deleted. */
  actorId: string | null;
  actorHandle: string | null;
  targetId: string | null;
  targetHandle: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

/**
 * Persistence for user accounts, roles, site settings and the audit log.
 * UserProfile and AdminProfile only talk to this interface, so the backing
 * database can change without touching them.
 */
export interface UserStore {
  /** Inserts a user. Returns false if `handle` is taken; throws EmailTakenError if `emailHmac` is. */
  insert(user: NewUserRecord): boolean;
  findByEmailHmac(emailHmac: string): UserRecord | undefined;
  findById(id: string): UserRecord | undefined;
  findByHandle(handle: string): UserRecord | undefined;
  updateUsername(id: string, username: string): void;
  updatePasswordHash(id: string, passwordHash: string): void;
  delete(id: string): void;

  countAdmins(): number;
  updateRole(id: string, role: Role): void;
  updateCanPost(id: string, canPost: boolean): void;

  getSiteSettings(): SiteSettings;
  updateSiteSettings(settings: SiteSettings): void;

  appendAudit(entry: NewAuditEntry): void;
  /** Newest first. */
  listAudit(limit: number): AuditEntry[];

  /**
   * Runs `fn` atomically: it either fully applies or (if it throws) not at
   * all, and no other writer can change what it read in the meantime.
   */
  transaction<T>(fn: () => T): T;
}

/** A post that moderators have locked against new replies. */
export interface PostLock {
  postId: string;
  /** null once the moderator's account has been deleted. */
  lockedById: string | null;
  lockedAt: string;
}

export type ModerationAction = "post.lock" | "post.unlock";

export interface NewModerationEntry {
  actorId: string;
  action: ModerationAction;
  postId: string;
  reason: string;
}

export interface ModerationEntry {
  id: number;
  action: ModerationAction;
  /** null once the account has been deleted. */
  actorId: string | null;
  actorHandle: string | null;
  postId: string;
  reason: string;
  createdAt: string;
}

/**
 * Persistence for post locks and the moderation log. Kept apart from
 * UserStore so content moderation can move to the posts database later.
 */
export interface ModerationStore {
  getPostLock(postId: string): PostLock | undefined;
  /** Locks the post as `lockedById`, or unlocks it when null. */
  setPostLock(postId: string, lockedById: string | null): void;

  appendModeration(entry: NewModerationEntry): void;
  /** Newest first. */
  listModeration(limit: number): ModerationEntry[];

  /** See UserStore.transaction. */
  transaction<T>(fn: () => T): T;
}

/**
 * Persistence for sign-in sessions. Only a hash of each session token is
 * stored; the token itself lives in the user's cookie.
 */
export interface SessionStore {
  /** Also deletes any sessions that have already expired. */
  createSession(tokenHash: string, userId: string, expiresAt: string): void;
  /** Returns the session's user id, or undefined if missing or expired. */
  findSessionUserId(tokenHash: string): string | undefined;
  deleteSession(tokenHash: string): void;
}

// Defined in email.ts so UserProfile can throw it without loading SQLite.
export { EmailTakenError };

// The original schema (user_version 0). Later changes go in MIGRATIONS so
// existing databases get them too: CREATE TABLE IF NOT EXISTS never adds
// columns to a table that already exists.
const BASE_SCHEMA = `
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

  CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions (expires_at);
`;

/** MIGRATIONS[i] upgrades a database from user_version i to i + 1. */
const MIGRATIONS = [
  // 1: roles, per-user posting permission, site settings, audit log.
  `
  ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'moderator', 'admin'));
  ALTER TABLE users ADD COLUMN can_post INTEGER NOT NULL DEFAULT 1
    CHECK (can_post IN (0, 1));
  CREATE INDEX users_role ON users (role);

  CREATE TABLE site_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;
  INSERT INTO site_settings (key, value) VALUES ('posting_enabled', '1');

  -- Rows outlive the accounts they mention; a deleted account becomes NULL.
  CREATE TABLE audit_log (
    id         INTEGER PRIMARY KEY,
    actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    target_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
    details    TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX audit_log_actor_id ON audit_log (actor_id);
  CREATE INDEX audit_log_target_id ON audit_log (target_id);
  `,
  // 2: post locks and the moderation log.
  `
  CREATE TABLE post_locks (
    post_id      TEXT PRIMARY KEY,
    locked_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    locked_at    TEXT NOT NULL
  ) STRICT;

  -- Like audit_log, rows outlive the moderator's account.
  CREATE TABLE moderation_log (
    id         INTEGER PRIMARY KEY,
    actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    post_id    TEXT NOT NULL,
    reason     TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX moderation_log_actor_id ON moderation_log (actor_id);
  CREATE INDEX moderation_log_post_id ON moderation_log (post_id);
  `,
];

// The current UTC time in the same format as Date.toISOString(), which is how
// expires_at is stored, so the two compare correctly as strings.
const SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

interface UserRow {
  id: string;
  email_hmac: string;
  handle: string;
  username: string;
  password_hash: string;
  created_at: string;
  role: Role;
  can_post: number;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    emailHmac: row.email_hmac,
    handle: row.handle,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    role: row.role,
    canPost: row.can_post === 1,
  };
}

interface AuditRow {
  id: number;
  action: AuditAction;
  actor_id: string | null;
  actor_handle: string | null;
  target_id: string | null;
  target_handle: string | null;
  details: string;
  created_at: string;
}

interface ModerationRow {
  id: number;
  action: ModerationAction;
  actor_id: string | null;
  actor_handle: string | null;
  post_id: string;
  reason: string;
  created_at: string;
}

export class SqliteUserStore implements UserStore, SessionStore, ModerationStore {
  readonly #db: DatabaseSync;

  /** `file` defaults to data/howtags.db; pass ":memory:" for tests. */
  constructor(file = path.join(process.cwd(), "data", "howtags.db")) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.#db = new DatabaseSync(file);
    // Zero out deleted rows in the main database file. Old copies can still sit
    // in the -wal file until a checkpoint overwrites them, and in any backups.
    this.#db.exec("PRAGMA secure_delete = ON;");
    this.#db.exec("PRAGMA journal_mode = WAL;");
    // Needed for ON DELETE CASCADE / SET NULL, so deleting a user ends their
    // sessions and detaches their audit log rows.
    this.#db.exec("PRAGMA foreign_keys = ON;");
    // Wait for another connection's write (the make-admin script, a second
    // dev server) instead of failing at once with SQLITE_BUSY.
    this.#db.exec("PRAGMA busy_timeout = 5000;");
    this.#db.exec(BASE_SCHEMA);
    this.#migrate();
  }

  #migrate(): void {
    const { user_version: version } = this.#db.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    for (let v = version; v < MIGRATIONS.length; v++) {
      this.transaction(() => {
        this.#db.exec(MIGRATIONS[v]);
        // PRAGMA can't take a bound parameter; v is a loop index, not input.
        this.#db.exec(`PRAGMA user_version = ${v + 1};`);
      });
    }
  }

  insert(user: NewUserRecord): boolean {
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

  findByHandle(handle: string): UserRecord | undefined {
    const row = this.#db.prepare("SELECT * FROM users WHERE handle = ?").get(handle);
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

  countAdmins(): number {
    const row = this.#db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as {
      n: number;
    };
    return row.n;
  }

  updateRole(id: string, role: Role): void {
    this.#db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  }

  updateCanPost(id: string, canPost: boolean): void {
    this.#db.prepare("UPDATE users SET can_post = ? WHERE id = ?").run(canPost ? 1 : 0, id);
  }

  getSiteSettings(): SiteSettings {
    const rows = this.#db.prepare("SELECT key, value FROM site_settings").all() as unknown as {
      key: string;
      value: string;
    }[];
    const values = new Map(rows.map((r) => [r.key, r.value]));
    // A missing row means the default (on), so a damaged table can't quietly
    // switch posting off for everyone.
    return { postingEnabled: values.get("posting_enabled") !== "0" };
  }

  updateSiteSettings(settings: SiteSettings): void {
    this.#db
      .prepare(
        `INSERT INTO site_settings (key, value) VALUES ('posting_enabled', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      )
      .run(settings.postingEnabled ? "1" : "0");
  }

  appendAudit(entry: NewAuditEntry): void {
    this.#db
      .prepare(
        `INSERT INTO audit_log (actor_id, action, target_id, details, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(entry.actorId, entry.action, entry.targetId, JSON.stringify(entry.details), new Date().toISOString());
  }

  listAudit(limit: number): AuditEntry[] {
    const rows = this.#db
      .prepare(
        `SELECT a.id, a.action, a.actor_id, actor.handle AS actor_handle,
                a.target_id, target.handle AS target_handle, a.details, a.created_at
         FROM audit_log a
         LEFT JOIN users actor ON actor.id = a.actor_id
         LEFT JOIN users target ON target.id = a.target_id
         ORDER BY a.id DESC
         LIMIT ?`,
      )
      .all(limit) as unknown as AuditRow[];
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actor_id,
      actorHandle: row.actor_handle,
      targetId: row.target_id,
      targetHandle: row.target_handle,
      details: JSON.parse(row.details) as Record<string, unknown>,
      createdAt: row.created_at,
    }));
  }

  getPostLock(postId: string): PostLock | undefined {
    const row = this.#db
      .prepare("SELECT post_id, locked_by_id, locked_at FROM post_locks WHERE post_id = ?")
      .get(postId) as { post_id: string; locked_by_id: string | null; locked_at: string } | undefined;
    return row ? { postId: row.post_id, lockedById: row.locked_by_id, lockedAt: row.locked_at } : undefined;
  }

  setPostLock(postId: string, lockedById: string | null): void {
    if (lockedById === null) {
      this.#db.prepare("DELETE FROM post_locks WHERE post_id = ?").run(postId);
      return;
    }
    this.#db
      .prepare(
        `INSERT INTO post_locks (post_id, locked_by_id, locked_at) VALUES (?, ?, ?)
         ON CONFLICT (post_id) DO UPDATE SET locked_by_id = excluded.locked_by_id, locked_at = excluded.locked_at`,
      )
      .run(postId, lockedById, new Date().toISOString());
  }

  appendModeration(entry: NewModerationEntry): void {
    this.#db
      .prepare(
        `INSERT INTO moderation_log (actor_id, action, post_id, reason, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(entry.actorId, entry.action, entry.postId, entry.reason, new Date().toISOString());
  }

  listModeration(limit: number): ModerationEntry[] {
    const rows = this.#db
      .prepare(
        `SELECT m.id, m.action, m.actor_id, actor.handle AS actor_handle,
                m.post_id, m.reason, m.created_at
         FROM moderation_log m
         LEFT JOIN users actor ON actor.id = m.actor_id
         ORDER BY m.id DESC
         LIMIT ?`,
      )
      .all(limit) as unknown as ModerationRow[];
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actor_id,
      actorHandle: row.actor_handle,
      postId: row.post_id,
      reason: row.reason,
      createdAt: row.created_at,
    }));
  }

  transaction<T>(fn: () => T): T {
    // IMMEDIATE takes the write lock up front, so two admins demoting each
    // other at once run one after the other and the admin count stays right.
    this.#db.exec("BEGIN IMMEDIATE;");
    try {
      const result = fn();
      this.#db.exec("COMMIT;");
      return result;
    } catch (err) {
      this.#db.exec("ROLLBACK;");
      throw err;
    }
  }

  createSession(tokenHash: string, userId: string, expiresAt: string): void {
    // Sign-in is a good moment to clear out sessions nobody signed out of.
    this.#db.prepare(`DELETE FROM sessions WHERE expires_at <= ${SQL_NOW}`).run();
    this.#db
      .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash, userId, expiresAt);
  }

  findSessionUserId(tokenHash: string): string | undefined {
    // Compare against SQLite's clock so callers don't read the current time,
    // which Next.js would otherwise need excluding from prerendering.
    const row = this.#db
      .prepare(`SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ${SQL_NOW}`)
      .get(tokenHash) as { user_id: string } | undefined;
    return row?.user_id;
  }

  deleteSession(tokenHash: string): void {
    this.#db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  close(): void {
    this.#db.close();
  }
}

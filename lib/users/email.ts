import "server-only";
import { createHmac } from "node:crypto";

// Emails are never stored. Only a keyed HMAC is kept, which is enough to
// find an account at sign-in and to stop duplicate sign-ups. Without
// EMAIL_HMAC_KEY the stored values can't be reversed or brute-forced from a
// list of known emails.
//
// Back up EMAIL_HMAC_KEY. Losing or changing it makes every existing
// account impossible to sign in to.

const EMAIL_MAX_LENGTH = 254;
// Deliberately loose: one "@", no whitespace, a dot in the domain.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvalidEmailError extends Error {
  constructor() {
    super("Enter a valid email address.");
    this.name = "InvalidEmailError";
  }
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
    throw new InvalidEmailError();
  }
  return normalized;
}

let cachedKey: Buffer | undefined;
function hmacKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.EMAIL_HMAC_KEY;
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length < 32) {
    throw new Error(
      "EMAIL_HMAC_KEY must be set to at least 32 random bytes, base64-encoded. See .env.example.",
    );
  }
  cachedKey = key;
  return key;
}

/** Hex HMAC-SHA256 of the normalized email, used as the account lookup key. */
export function emailLookupKey(email: string): string {
  return createHmac("sha256", hmacKey()).update(normalizeEmail(email)).digest("hex");
}

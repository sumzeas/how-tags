import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt parameters follow the OWASP Password Storage Cheat Sheet.
// They are stored inside each hash so they can be raised later without
// breaking existing accounts (re-hash on next successful sign-in).
const N = 2 ** 17;
const R = 8;
const P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
// scrypt needs ~128 * N * r bytes (128 MiB here); Node's default cap is 32 MiB.
const MAX_MEM = 256 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 12;
// Upper bound keeps hashing cost predictable and blocks huge-input DoS.
export const PASSWORD_MAX_LENGTH = 128;

export class InvalidPasswordError extends Error {
  constructor() {
    super(
      `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`,
    );
    this.name = "InvalidPasswordError";
  }
}

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export function assertValidPassword(password: string): void {
  const length = [...password.normalize("NFKC")].length;
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    throw new InvalidPasswordError();
  }
}

/** Returns `scrypt$N$r$p$salt$hash` (salt and hash base64). */
export async function hashPassword(password: string): Promise<string> {
  assertValidPassword(password);
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  if (password.length > PASSWORD_MAX_LENGTH * 4) return false;

  const expected = Buffer.from(keyB64, "base64");
  const actual = await derive(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEM,
  });
  return timingSafeEqual(actual, expected);
}

// A real hash of a random password. authenticate() verifies against it when
// an email isn't registered, so both paths take the same time.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString("base64"));
  return dummyHash;
}

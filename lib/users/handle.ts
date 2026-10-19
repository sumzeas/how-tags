import "server-only";
import { randomInt } from "node:crypto";
import { ADJECTIVES, ANIMALS, COLORS } from "./wordlists";

function pick<T>(words: readonly T[]): T {
  return words[randomInt(words.length)];
}

/**
 * Returns a random handle like "brave-crimson-otter". Pass `withSuffix` to
 * append a 2-digit number, used only after repeated collisions.
 */
export function generateHandle(withSuffix = false): string {
  const handle = `${pick(ADJECTIVES)}-${pick(COLORS)}-${pick(ANIMALS)}`;
  return withSuffix ? `${handle}-${randomInt(10, 100)}` : handle;
}

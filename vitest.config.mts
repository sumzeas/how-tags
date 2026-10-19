import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      // The real package throws outside a React Server Components build.
      "server-only": path.resolve(root, "test/server-only-stub.ts"),
      "@": root,
    },
  },
  test: {
    environment: "node",
    // scrypt is intentionally slow (~0.3s per hash).
    testTimeout: 30_000,
  },
});

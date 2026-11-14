// Lets plain Node (with its built-in TypeScript type stripping) run scripts
// that import lib/ code, without a bundler or extra dependency:
//   - "server-only" resolves to an empty stub (the real package throws
//     outside a React Server Components build), as in vitest.config.mts
//   - extensionless relative imports ("./email") resolve to ".ts" files
// Use with: node --import ./scripts/ts-hooks.mjs scripts/<name>.ts
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const SERVER_ONLY_STUB = new URL("../test/server-only-stub.ts", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: SERVER_ONLY_STUB, shortCircuit: true };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (!/\.[cm]?[jt]s$/.test(specifier) && existsSync(candidate)) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

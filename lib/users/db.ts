import "server-only";
import { SqliteUserStore } from "./store";

// One connection for the whole server. Kept on globalThis so dev hot reloads
// reuse it instead of opening a new one each time.
const globalForStore = globalThis as unknown as { howtagsUserStore?: SqliteUserStore };

export function getUserStore(): SqliteUserStore {
  globalForStore.howtagsUserStore ??= new SqliteUserStore();
  return globalForStore.howtagsUserStore;
}

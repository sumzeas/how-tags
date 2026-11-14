// Makes an existing account an admin. Run on the server, from the repo root:
//   npm run make-admin -- <handle>
// This is how the first admin is created; after that, admins promote others
// from /users/<handle>. The change is written to the audit log as "system".
import { grantAdminFromServer, UserNotFoundError } from "../lib/users/AdminProfile";
import { SqliteUserStore } from "../lib/users/store";

const handle = process.argv[2]?.replace(/^@/, "").trim();
if (!handle) {
  console.error("Usage: npm run make-admin -- <handle>");
  process.exit(1);
}

const store = new SqliteUserStore();
try {
  const before = store.findByHandle(handle);
  if (before?.role === "admin") {
    console.log(`@${handle} is already an admin.`);
  } else {
    grantAdminFromServer(store, handle);
    console.log(`@${handle} is now an admin (was ${before?.role}).`);
  }
} catch (err) {
  if (err instanceof UserNotFoundError) {
    console.error(`No user with the handle @${handle}.`);
    process.exitCode = 1;
  } else {
    throw err;
  }
} finally {
  store.close();
}

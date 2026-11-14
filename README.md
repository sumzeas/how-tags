HowTags is a wiki/tutorial engine that uses tag-based searching.

## Creating the first admin

Sign up an account, find its handle on `/profile` (for example `@brave-crimson-otter`), then run on the server:

    npm run make-admin -- brave-crimson-otter

That account can then open `/admin/settings` and promote others from their page at `/users/<handle>`. The change is recorded in the audit log as "system".

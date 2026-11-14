HowTags is a wiki/tutorial engine that uses tag-based searching.

## Getting started

### Prerequisites

- Node.js 22.13 or newer. User accounts and sessions use Node's built-in `node:sqlite`.
- A PostgreSQL database. Pages are stored there.

### Install

    npm install

### Configure the environment

Copy the example file:

    cp .env.example .env.local

Then set these values in `.env.local`:

- `EMAIL_HMAC_KEY`: a secret used to hash sign-in emails. Generate one with:

      node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

  Back it up. Losing or changing it locks every existing account out.
- `DATABASE_URL`: the Postgres connection string, for example `postgres://user:password@localhost:5432/howtags`.

### Set up the databases

- **SQLite (users and sessions):** nothing to do. `data/howtags.db` is created on first use. It is for development only and is gitignored.
- **Postgres (pages):** pages are read from a `pages` table with `pid` and `markdown` columns. The repo has no migration yet, so here is an example table:

      CREATE TABLE pages (
        pid      text PRIMARY KEY,
        markdown text NOT NULL
      );

### Run the app

    npm run dev

Open http://localhost:3000 and create an account at `/sign-up`.

### Other commands

| Command         | What it does                            |
| --------------- | --------------------------------------- |
| `npm run build` | Production build (also type-checks)     |
| `npm run start` | Serve the production build              |
| `npm run lint`  | Run ESLint                              |
| `npm test`      | Run all Vitest tests once               |

Then create the first admin (below).

## Creating the first admin

Sign up an account, find its handle on `/profile` (for example `@brave-crimson-otter`), then run on the server:

    npm run make-admin -- brave-crimson-otter

That account can then open `/admin/settings` and promote others from their page at `/users/<handle>`. The change is recorded in the audit log as "system".

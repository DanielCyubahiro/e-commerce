# e-commerce

A NestJS learning project exploring DDD, CQRS, and hexagonal architecture.
Bounded contexts sit on a shared kernel, one directory under `src/` each, one
page under [docs/contexts/](docs/contexts/) each:

- [identity](docs/contexts/identity.md)
- [catalogue](docs/contexts/catalogue.md)
- [ordering](docs/contexts/ordering.md)

It is deliberately architected to be forked onto new infrastructure when that
is worth learning, not to serve real users.

## Prerequisites

- Node 22+, pnpm, and Docker (Postgres and Mongo, plus integration tests)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:migrate
```

Every variable in `.env.example` is required at boot. A missing or malformed one
aborts startup with a message naming it, rather than failing later on first
query. There is no signing secret to generate: authentication is a server-side
session in an `HttpOnly` cookie, and the only value that has to match your
frontend is `WEB_BASE_URL`, which doubles as the CORS origin and the cookie's
`Secure` switch.

There is no frontend, so a verification or password-reset email has nowhere
to land except the mailbox `docker-compose.yml` starts for local development:
open Mailpit's web UI at [http://localhost:8025](http://localhost:8025) and
read the link out of whichever message registration, resend, or
forgot-password just sent.

Every registration creates a `customer`. A seller is made by hand, once, in
the database; no endpoint can do it, which is what keeps role-gated endpoints
meaningful:

```sql
UPDATE users SET role = 'seller' WHERE email = 'you@example.com';
```

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm start:dev` | Start databases, then watch mode |
| `pnpm start` | Run once against a running database |
| `pnpm build` | Compile to `dist` |
| `pnpm test` | Unit and docs tests, no database |
| `pnpm test:docs` | Docs structure tests only, no database |
| `pnpm test:integration` | Repository tests against a throwaway Postgres container |
| `pnpm test:http` | HTTP tests through the real pipe and filter stack |
| `pnpm test:all` | Every project |
| `pnpm test:cov` | Coverage |
| `pnpm lint` | ESLint with type-aware rules |
| `pnpm db:up` / `db:down` / `db:logs` | Local Postgres and Mongo |
| `pnpm db:migrate` | Apply pending Drizzle migrations to that Postgres |
| `pnpm postman:push` | Publish `postman/` to the Postman cloud (needs `POSTMAN_API_KEY`) |

`start:dev` migrates before it starts watching. `start` and `start:prod` do
not, so a database left behind a new migration answers with a 500 from the
first query against the missing table. The integration suite migrates a fresh
container of its own and so stays green either way.

`pnpm build` is the only command that type-checks `src/` against
`tsconfig.build.json`. `pnpm test` passing proves nothing about types: Jest
runs through `ts-jest`, which is effectively transpile-only here, and nothing
in the test tree is type-checked at all. Every exhaustiveness guarantee this
codebase relies on, `STATUS_BY_KIND`'s totality, a `never` guard on a closed
union, is only real because `pnpm build` was run.

## Where to go next

| Question | File |
| --- | --- |
| What does this term mean here? | [docs/concepts.md](docs/concepts.md) |
| What does a given context contain? | [docs/contexts/](docs/contexts/) |
| How is it structured, and how do I fork it? | [docs/architecture.md](docs/architecture.md) |
| How is it tested? | [docs/testing.md](docs/testing.md) |
| How do I try the API by hand? | [postman/README.md](postman/README.md) |
| Rules for agents working here | [AGENTS.md](AGENTS.md) |

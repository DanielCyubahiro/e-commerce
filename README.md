# e-commerce

A NestJS learning project exploring DDD, CQRS, and hexagonal architecture.
Bounded contexts sit on a shared kernel, one directory under `src/` each, one
page under [docs/contexts/](docs/contexts/) each:

- [identity](docs/contexts/identity.md)
- [catalogue](docs/contexts/catalogue.md)

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
query. `JWT_SECRET` is the one exception to having a usable default: generate
it yourself and never commit the real value.

```bash
openssl rand -base64 48
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

`start:dev` migrates before it starts watching. `start` and `start:prod` do
not, so a database left behind a new migration answers with a 500 from the
first query against the missing table. The integration suite migrates a fresh
container of its own and so stays green either way.

## Where to go next

| Question | File |
| --- | --- |
| What does this term mean here? | [docs/concepts.md](docs/concepts.md) |
| What does a given context contain? | [docs/contexts/](docs/contexts/) |
| How is it structured, and how do I fork it? | [docs/architecture.md](docs/architecture.md) |
| How is it tested? | [docs/testing.md](docs/testing.md) |
| Why was it built this way? | [docs/adr/](docs/adr/) |
| Rules for agents working here | [AGENTS.md](AGENTS.md) |

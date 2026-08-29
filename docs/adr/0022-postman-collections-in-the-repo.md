# 0022. Postman collections live in the repo and are checked against the controllers

## Status

Accepted.

## Context

The API has been documented for people to try by hand in three Postman
collections, one per controller, written with the rationale for each status
and each ordering of checks. They lived only in the Postman cloud. When
[0020](0020-server-side-sessions-replace-jwts.md) replaced the bearer token
and refresh chain with a session cookie, the collections kept describing
the old flow for a day after the merge: `pnpm test` could not see them, so
nothing went red. The same repo enforces every other document it can read
(`test/docs/`), and an unread document is the one that drifts.

## Decision

The collections and their environment are files under `postman/`, one
collection per controller named after its `@Controller()` root, in Postman
Collection v2.1 export format with the cloud's timestamps and `uid`s
stripped. The repo is the source of truth; `pnpm postman:push`
(`scripts/postman-push.mjs`) publishes to the cloud through the Postman
API, one way. An edit made in the app is overwritten by the next push.

`test/docs/postman.docs-spec.ts` reads the routes off the controllers'
decorator metadata and the requests off the files, and fails when a
controller has no collection, a route has no happy-path request, a request
names a route that no longer exists, or a referenced variable is not
declared in the environment or the collection. Expected statuses,
descriptions and scripts are not checked; AGENTS.md lists them as
discipline, as it does the `## Endpoints` tables.

The auth collection relies on Postman's cookie jar for the session, the way
a browser would, and fetches the two emailed tokens from Mailpit in a
collection-level pre-request script, so the happy path runs unattended.

## Alternatives considered

- **Cloud-owned, with a rule in AGENTS.md.** Cheapest, and exactly the
  arrangement that drifted. A rule nobody's test reads is a hope.
- **Cloud-owned, with a test that fetches over the network.** Needs an API
  key to run `pnpm test`, and the docs project is documented as reading
  disk only.
- **Generate the collections from an OpenAPI document produced by
  `@nestjs/swagger`.** Adds a dependency and decorators to every DTO, and a
  generated request has no room for the hand-written narrative that is the
  collections' value.
- **Two-way sync with a pull script.** Two editing surfaces for one
  hand-written JSON document is where silent overwrites come from. A pull is
  one `curl` away if it is ever needed.

## Consequences

- A new controller fails `pnpm test` until it has a collection file, and a
  new endpoint until it has a request, the same way a new bounded context
  fails until it has a page.
- Descriptions can still go stale silently. The check proves shape, not
  prose.
- Edits in the Postman app are lost. The app is for running and reading.
- The docs project now imports application code (the controllers) to read
  their metadata; a broken import in `presentation/` shows up there as well
  as in the http project.
- The `## Endpoints` tables in `docs/contexts/*.md` remain unchecked.
  `readRoutes()` makes that a short spec later.

# Postman collections

One collection per controller, named after its `@Controller()` root, plus the
environment they share:

| File | Covers |
| --- | --- |
| [auth.postman_collection.json](auth.postman_collection.json) | `AuthController`, `/auth` |
| [users.postman_collection.json](users.postman_collection.json) | `UserController`, `/users` |
| [products.postman_collection.json](products.postman_collection.json) | `ProductController`, `/products` |
| [e-commerce.local.postman_environment.json](e-commerce.local.postman_environment.json) | `baseUrl`, `mailpitUrl`, the account, the emailed tokens |

**These files are the source of truth.** The copies in the Postman cloud are
published from here with `pnpm postman:push`; an edit made in the app is
overwritten by the next push. Change the file, push, then use the app.
Why, and what was rejected: [ADR 0022](../docs/adr/0022-postman-collections-in-the-repo.md).

## Running

1. `pnpm start:dev`: Postgres, Mongo and Mailpit through Docker Compose, then
   Nest on the port in `.env` (3000 by default).
2. In the Postman app, import the four files (File > Import, drop the
   directory) or open the published copies in the workspace.
3. Select the **e-commerce (local)** environment. A collection-level guard
   aborts every request with a clear error when none is active, because
   variable writes would otherwise vanish silently.
4. Run `Create user` in the users collection, then the auth collection top
   to bottom, then whatever else you want to try.

The credential is an `HttpOnly` cookie named `session`. Postman's cookie
jar stores it from Login's `Set-Cookie` and attaches it to every later
request against `localhost:3000`, which is what a browser does; no request
here configures auth and no variable holds a token. Logout, Logout all and
a revoke of the current session clear it.

The auth run assumes a freshly registered, unverified account: Verify email
consumes the newest verification email, so a second run on the same account
answers 401 there. Re-register (Delete user, Create user) or start from
Login. Change password and Reset password rotate the environment's current
`userPassword`; the file holds the password at registration.

## Conventions

- **Happy path top to bottom.** The top-level requests of a collection run
  in order, every endpoint once, all green. Tests live in each request's
  test script.
- **Failure paths folder.** Each request is named for the status it should
  produce (`401 · Login with a wrong password`). One folder-level script
  asserts the status from the name and, outside 202 and 400, that the body
  carries a stable `code`. A request's description states any precondition.
- **Variables.** Anything two collections share lives in the environment.
  An id only one collection reads (`userId`, `productId`, `otherSessionId`)
  is a collection variable. Every variable a collection references must be
  declared in one of the two;
  [postman.docs-spec.ts](../test/docs/postman.docs-spec.ts) checks that,
  along with one collection per controller, a happy-path request per route,
  and a live route per request.
- **Emailed tokens.** Verification and reset tokens never travel over HTTP.
  The auth collection's pre-request script fetches the newest matching email
  from Mailpit at `{{mailpitUrl}}` just before Verify email and Reset
  password run. No email means a loud error naming the request to run
  first.
- **No cookie on purpose.** Two failure paths go to `{{cookielessBaseUrl}}`,
  `http://127.0.0.1:3000`: the same server under a different host name, so
  the jar has nothing to attach whatever is logged in.

## Publishing

```bash
export POSTMAN_API_KEY=...        # https://postman.co/settings/me/api-keys, shell only, never .env
pnpm postman:push
```

One line per file with the HTTP status. A new controller needs a new
`<root>.postman_collection.json` with no `info._postman_id`; with
`POSTMAN_WORKSPACE_ID` exported, the push creates it and rewrites the file
with the ids Postman assigned.

The rules an agent follows when an endpoint changes are in
[AGENTS.md](../AGENTS.md), under "Docs that must change with the code".

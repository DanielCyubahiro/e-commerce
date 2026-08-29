# AGENTS.md

A NestJS learning backend: DDD, CQRS, and hexagonal architecture. Bounded
contexts sit on a shared kernel, one directory under `src/` each, documented
under `docs/contexts/`. It exists to teach architecture, not to serve users,
and it gets forked when a new infrastructure technology is worth learning.

Read `docs/concepts.md` for what a term means here, `docs/architecture.md` for
structure and the fork seam, `docs/testing.md` for the test layers, and
`docs/adr/` for why a decision was made.

## Before you write code

Write the failing test first, and **show it failing, with output, before writing
implementation.** That step is where a test that asserts nothing gets caught.

Where the test goes:

| Change | Failing test goes | Project |
| --- | --- | --- |
| Domain invariant | `src/**/domain/**/*.spec.ts` | unit |
| Handler behaviour | `src/**/application/**/*.spec.ts`, against a fake | unit |
| New method on a port | the shared `test/contracts/*.contract.ts`, run via a binding file per implementation | unit + integration |
| New adapter for a port | one binding file per implementation | unit + integration |
| Endpoint, status, validation | `test/**/*.http-spec.ts` | http |
| Index or schema change | `test/setup/schema.integration-spec.ts` | integration |
| Doc structure rule | `test/docs/*.docs-spec.ts` | docs |

Filenames decide which Jest project claims a file. `*.spec.ts` is unit,
`*-spec.ts` is not. `foo.integration-spec.ts` and `foo.http-spec.ts` are
invisible to the unit project by design. `*.docs-spec.ts` ends in `-spec.ts`
too, so like the integration and http suffixes it is invisible to the unit
project.

The contract row is a mechanism, not a suggestion. No Jest project matches
`*.contract.ts` directly: a `*.spec.ts` and an `*.integration-spec.ts`
binding file per implementation import and invoke the shared function, for
example `product-write-repository.spec.ts` binding the in-memory fake.
Adding a method there breaks both bindings simultaneously until each
implements it, which is what stops the fake from silently diverging.

Assert thrown domain exceptions with `catchError` from
`@test/support/catch-error`, never `expect(fn).toThrow(SomeException)`. Most
domain exceptions are built only through a named factory behind a private
constructor, and TypeScript rejects passing one to `toThrow`: its
`Constructable` parameter type requires a public constructor, so the call
fails to compile with `TS2345` rather than failing at runtime.
`InvalidIdentifierException` is the one exception with a public constructor
and no factory, so `toThrow` would actually compile against it, but
`catchError` stays the uniform pattern to reach for.

## Where things live

- **Invariants live on the aggregate.** `Product` validates name, description,
  and stock in the private `build` both `create` and `replace` call. A handler
  never re-checks them.
- **Representation conversion lives in the application layer.** It is the only
  layer entitled to know both a decimal and its minor-unit form. See
  `ListProductsHandler.toMinorUnits`.
- **DTOs check type, presence, and absurd-size ceilings only.** Anything with a
  domain counterpart is left to the domain; the exception filter decides the
  resulting HTTP status.
- **No rule is written twice.** If a check exists in the domain, the DTO does
  not repeat it.
- **Auth state transitions are guarded targeted writes, not replacements.** A
  credential's verification flag, a session's touch and revocation, and a
  one-time token's consumption are each one `UPDATE ... WHERE <precondition>`,
  never a read followed by a check followed by a write. See
  [ADR 0013](docs/adr/0013-guarded-writes-never-rehydration.md).

## Docs that must change with the code

This is the complete checklist, not just the part `pnpm test` would catch you
missing. The third column says which: some rows the docs project genuinely
enforces, once the file or entry in question exists; the rest depends on
discipline alone, because no check here reads a sentence for staleness.

| When you | Update | Checked by `pnpm test`? |
| --- | --- | --- |
| Add a bounded context | New `docs/contexts/<name>.md` with all five headings, a row in every `docs/concepts.md` instance table, and README's context list. Name it for the capability, not the entity; see docs/concepts.md's Bounded context entry. | Yes: the page, its headings, the glossary row, and README's link to the page (`context-pages.docs-spec.ts`, `glossary.docs-spec.ts`). |
| Add or change a port | That context's `## Ports and adapters`, both tables | No |
| Add an endpoint, or change its status | That context's `## Endpoints` | No |
| Add an endpoint, or change its method, path, status, body or auth | Its controller's collection under `postman/`: the happy-path request, the failure paths the change warrants, the descriptions; then `pnpm postman:push`. See [postman/README.md](postman/README.md). | Partly: one collection per controller, every route with a happy-path request, every request on a live route, every referenced variable declared (`postman.docs-spec.ts`). Not statuses, descriptions, scripts or auth settings. |
| Add an exception | That context's `## Error codes`, plus the `## Error path` table in `docs/architecture.md` (columns Failure, Base, Filter, Status) if the *kind* is new | No |
| Introduce a term the glossary lacks | A new `docs/concepts.md` entry, with a table or the repo-wide-rule marker | Partly: once the entry exists, its shape and context coverage (`glossary.docs-spec.ts`). Not that you added one. |
| Make a non-obvious call | A new ADR, plus its row in `docs/adr/README.md` | Partly: once the ADR file exists, its row (`adr-index.docs-spec.ts`). Not that you wrote one. |
| Change the ESLint layer rules | `docs/architecture.md`'s enforcement table and the table above | No |
| Change Jest projects or thresholds | `docs/testing.md` | No |

A context with no instance of a glossary term still gets a row, reading
`| <context> | none | Not modelled yet |`. Absence is written, not omitted: an
empty cell and a forgotten edit look identical, and omitting the row is
exactly what `glossary.docs-spec.ts` catches.

The five required headings a context page must carry are named nowhere but
`CONTEXT_PAGE_HEADINGS` in `test/docs/docs-model.ts`; that constant is the
authority, not this file, so the two cannot drift apart. Copy
`docs/contexts/catalogue.md` as the template rather than retyping the headings
by hand. A required section with nothing to write yet, `## Endpoints` on a
context with no controller, say, still gets written, holding the word `none`,
the same convention as an empty glossary cell.

## APoSD in this codebase

Worked instances, copy these shapes:

- **Define errors out of existence.** `STATUS_BY_KIND` in
  `domain-exception.filter.ts` is a total `Record<DomainErrorKind, HttpStatus>`,
  so adding an error kind is a compile error, never a runtime fallthrough.
- **Reject inherited shallowness.** `AggregateRoot` stays empty rather than
  extending Nest's. See `docs/adr/0004-no-nest-aggregate-root-base-class.md`
  for why.

## Already enforced, do not re-check

| Rule | Mechanism |
| --- | --- |
| Domain imports no framework, no outer layer | `no-restricted-imports` |
| Presentation imports no domain entity, value object, or the domain barrel | `no-restricted-imports` |
| Application imports no adapter or controller | `no-restricted-imports` |
| Infrastructure imports no presentation | `no-restricted-imports` |
| No import cycles, including a layer's own barrel | `import/no-cycle` |
| Domain 100%, application 95%, rest 85% (branches 80) | `jest.config.ts` |
| Every context has a docs page with all five headings | `test/docs/context-pages.docs-spec.ts` |
| Every glossary entry covers every context | `test/docs/glossary.docs-spec.ts` |
| Doc links resolve, name real symbols, and carry no line anchors | `test/docs/links.docs-spec.ts` |
| Every ADR on disk is indexed, and no index row points at a missing ADR | `test/docs/adr-index.docs-spec.ts` |
| Every controller has a Postman collection, every route a happy-path request, every request a live route, every referenced variable a declaration | `test/docs/postman.docs-spec.ts` |

`pnpm lint` enforces the import rules above; `pnpm test:cov` enforces the
coverage row; `pnpm test` runs the docs rules alongside the unit project. None
of these run automatically, there is no CI in this repo yet. Do not
hand-verify a rule a tool already checks; run `pnpm lint`, `pnpm test`, or
`pnpm test:cov` instead, and do not "fix" a boundary ESLint accepted.

## Comments

Four kinds. A comment must say something the code cannot.

1. **Interface comments** on every exported class and every public method whose
   signature does not carry its contract: preconditions, normalisation, what it
   throws, what it returns at the edges. Never how it works. Test: can a caller
   who never opens the body use it correctly?
2. **Member comments** for units and invariants on data fields.
3. **Implementation comments** only where the *why* is non-obvious, like
   counting decimal places before rounding in `money.vo.ts`.
4. **Cross-module comments** for couplings spanning files, placed at the
   constrained end and pointing at the authority.

Never: restate a signature, teach a concept (that is `docs/concepts.md`), stand
in for a fix, or write an `@param` that retypes the parameter list.

## Red flags

| Thought | Reality |
| --- | --- |
| "I will add the method to the adapter" | It goes in the contract first, or the fake silently diverges. |
| "The test is obvious, I will write it after" | The red step is where you find out it asserts nothing. |
| "I will validate this in the DTO too, to be safe" | That is the same rule written twice. Pick the layer that owns it. |
| "I will import the barrel from inside its own layer" | That is a cycle. The Nest token resolves to `undefined` and fails at boot as an unrelated error. |
| "This exception needs `expect().toThrow()`" | Most have a private constructor behind a factory, which fails `toThrow`'s type check. Use `catchError`. |
| "I will document the context after the feature lands" | `pnpm test` is red until the page exists. The page is part of the feature. |
| "This context has no read model, so I will leave the row out" | A missing row and a forgotten edit are indistinguishable. Write `none`. |
| "I will load the credential, check it, then save it" | That is load-modify-save: two concurrent callers both pass the check. Guarded single statements, see [ADR 0013](docs/adr/0013-guarded-writes-never-rehydration.md). |
| "I will update the Postman collection after the PR merges" | The collection is part of the endpoint's change. `pnpm test` is red until the route has a request, and the descriptions are reviewed in the same diff as the code. A plan puts the collection update inside the task that changes the endpoint, never in a task of its own. |

# AGENTS.md

A NestJS learning backend: DDD, CQRS, and hexagonal architecture over one
bounded context (`product`) on a shared kernel. It exists to teach architecture,
not to serve users, and it gets forked when a new infrastructure technology is
worth learning.

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

Filenames decide which Jest project claims a file. `*.spec.ts` is unit,
`*-spec.ts` is not. `foo.integration-spec.ts` and `foo.http-spec.ts` are
invisible to the unit project by design.

The contract row is a mechanism, not a suggestion. No Jest project matches
`*.contract.ts` directly: a `*.spec.ts` and an `*.integration-spec.ts`
binding file per implementation import and invoke the shared function, for
example `product-write-repository.spec.ts` binding the in-memory fake.
Adding a method there breaks both bindings simultaneously until each
implements it, which is what stops the fake from silently diverging.

Assert thrown domain exceptions with `catchError` from
`@test/support/catch-error`, never `expect(fn).toThrow(SomeException)`. Those
exceptions have private constructors and named factories, which Jest's `toThrow`
cannot accept.

## Where things live

- **Invariants live on the aggregate.** `Product.create` validates name,
  description, and stock. A handler never re-checks them.
- **Representation conversion lives in the application layer.** It is the only
  layer entitled to know both a decimal and its minor-unit form. See
  `ListProductsHandler.toMinorUnits`.
- **DTOs check type, presence, and absurd-size ceilings only.** Anything with a
  domain counterpart is left to the domain; the exception filter decides the
  resulting HTTP status.
- **No rule is written twice.** If a check exists in the domain, the DTO does
  not repeat it.

## APoSD in this codebase

Worked instances, copy these shapes:

- **Define errors out of existence.** `STATUS_BY_KIND` in
  `domain-exception.filter.ts` is a total `Record<DomainErrorKind, HttpStatus>`,
  so adding an error kind is a compile error, never a runtime fallthrough.
- **Reject inherited shallowness.** `AggregateRoot` is deliberately empty rather
  than extending Nest's, which would inherit ten unused members and let a domain
  method named `publish` silently override framework behaviour.

## Already enforced, do not re-check

| Rule | Mechanism |
| --- | --- |
| Domain imports no framework, no outer layer | `no-restricted-imports` |
| Presentation imports no domain entity, value object, or the domain barrel | `no-restricted-imports` |
| Application imports no adapter or controller | `no-restricted-imports` |
| Infrastructure imports no presentation | `no-restricted-imports` |
| No import cycles, including a layer's own barrel | `import/no-cycle` |
| Domain 100%, application 95%, rest 85% (branches 80) | `jest.config.ts` |

The build proves these. Do not hand-verify them, and do not "fix" a boundary
ESLint accepted.

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
| "This exception needs `expect().toThrow()`" | Private constructors. Use `catchError`. |

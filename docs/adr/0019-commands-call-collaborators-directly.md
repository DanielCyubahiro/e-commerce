# 0019. Commands call collaborators directly, no domain events

## Status

Accepted. The first trigger it named, a second bounded context needing to
react, fired with ordering and is answered by
[0023](0023-stock-allocated-in-the-placement-transaction.md) with a
synchronous call inside a unit of work rather than an event.

## Context

Several handlers in this feature chain one write to a side effect on other
state: registration writes a user and then sends a verification email;
resetting a password changes the credential and then revokes every other
session; a replayed refresh token revokes its whole session. Every one of
these is written as the handler calling each collaborator, a port, directly
and in sequence, rather than an aggregate raising a domain event that a
separate listener reacts to later.
[ADR 0004](0004-no-nest-aggregate-root-base-class.md) already decided
`AggregateRoot` carries no event machinery, and documented why: Nest CQRS's
own `publish` and `commit` are inert until an instance passes through
`EventPublisher.mergeObjectContext`, and forgetting that call discards queued
events with no error and no log.

## Decision

Command handlers call every collaborator they need directly.
[`RegisterUserHandler`](../../src/identity/application/use-cases/commands/register-user/register-user.handler.ts)
calls `UserWriteRepository.register` and then `EmailSender.sendEmailVerification`
itself;
[`ResetPasswordHandler`](../../src/identity/application/use-cases/commands/reset-password/reset-password.handler.ts)
calls `CredentialRepository.changePassword` and then
`RefreshTokenRepository.revokeAllForUser` itself. Nothing here is modelled as
one aggregate raising an event for a separate listener to react to. This
continues ADR 0004 directly: an in-process event bus would buy decoupling,
the aggregate would not need to know about mail or sessions, but not
reliability, since the same `mergeObjectContext` hazard means a handler that
forgets to register a listener, or a listener nobody wired up, discards the
effect silently, with nothing failing as loudly as a missed direct call to a
port at least does, via a stack trace or a failing test.

## Alternatives considered

- **An in-process domain event bus**, an aggregate raising events that
  registered handlers subscribe to. Rejected: its entire value is decoupling
  an emitter from reactors it does not know about, which this feature does
  not need, since every reactor today is a single, known, synchronous call
  the handler can already make directly, while it inherits the exact
  silent-discard failure mode ADR 0004 already rejected Nest CQRS's own
  `AggregateRoot` for.

## Consequences

- Every cross-cutting effect in this feature is one handler method, readable
  top to bottom, with no subscriber elsewhere in the codebase reacting to
  something the handler did.
- A missed side effect is a diff to one file, not a search for which
  listener stopped firing.
- Three concrete triggers would justify revisiting this record: a second
  bounded context needing to react to registration, which direct calls
  cannot reach without `identity` importing that context and inverting the
  dependency the context boundaries exist to enforce; the mail outbox from
  [ADR 0018](0018-mail-sent-inline-after-commit.md) arriving, since a relay
  is itself a natural event consumer; or a security audit trail, recording
  that something happened as its own concern, outliving any single
  handler's direct calls.

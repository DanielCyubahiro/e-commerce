# 0018. Mail sent inline after commit

## Status

Accepted.

## Context

[`RegisterUserHandler`](../../src/identity/application/use-cases/commands/register-user/register-user.handler.ts),
[`ResendVerificationHandler`](../../src/identity/application/use-cases/commands/resend-verification/resend-verification.handler.ts),
and
[`RequestPasswordResetHandler`](../../src/identity/application/use-cases/commands/request-password-reset/request-password-reset.handler.ts)
each commit their database write first, then call
[`EmailSender`](../../src/identity/application/ports/email.sender.ts)
directly, in-process, inside the same request. A rejected send is logged and
treated as non-fatal; the request still answers success.

## Decision

Mail is sent synchronously and inline, after the triggering write commits,
directly from the command handler that triggered it, with no queue or relay
between them. A send failure never fails the request. This is safe only
because every mail-sending flow in this feature has an endpoint the user can
trigger again to get the same email resent:
`POST /auth/verify-email/resend` for a verification link, and
`POST /auth/forgot-password` for a reset link. Registration's own first
verification email is covered by the same fact, since resend exists
specifically to recover it. A dropped send is therefore recoverable by the
same caller who wanted it, through this API, with no support intervention.

The trigger for revisiting this decision is naming a mail-sending flow that
has no such retrigger endpoint: the first capability this codebase adds where
the user cannot simply ask for the email again is the one an outbox needs to
exist for, not a general reliability target reached for in advance of a
concrete need.

## Alternatives considered

- **A Postgres outbox table with a polling relay**, written in the same
  transaction as the triggering write and drained by a separate worker.
  Rejected for now: it is real infrastructure, a table, a poller,
  at-least-once delivery semantics, a dead-letter path, bought against a
  problem this feature does not have yet, since every current flow already
  tolerates a dropped send via its own retrigger endpoint.
- **BullMQ on Redis.** Rejected for the same reason, plus a new
  infrastructure dependency this repo does not otherwise need, for a
  guarantee, retrying a failed send, the retrigger endpoints already provide
  at the API level.

## Consequences

- A user whose verification or reset email is dropped by the transport sees
  no error and no signal that anything went wrong; recovery depends on them
  using resend or forgot-password again, which this API has no frontend to
  prompt them toward.
- Every mail-sending handler pays the SMTP round trip inline, inside the HTTP
  request, so a slow or unresponsive mail transport slows the response the
  caller is waiting on, rather than being decoupled from it.
- The first flow added without a retrigger endpoint is the concrete signal
  to build the outbox this record defers, not a target date or a general
  sense that reliability has become important.

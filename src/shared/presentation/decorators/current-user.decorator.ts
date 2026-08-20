import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../authenticated-request';

/**
 * Factored out of `createParamDecorator`'s callback so it can be unit-tested
 * directly: Nest never exposes that callback for a caller to invoke by hand.
 *
 * @throws Error when used on a `@Public()` endpoint, where the guard attaches
 * nothing. That is a wiring mistake rather than anything a client can cause,
 * which is why it is a plain error and a 500 rather than a domain exception.
 */
export function extractCurrentUser(
  context: ExecutionContext,
): AuthenticatedUser {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

  if (!request.user) {
    throw new Error(
      '@CurrentUser() requires a guarded endpoint; this one is @Public().',
    );
  }

  return request.user;
}

/** Reads what the guard attached, typed, so no controller touches `request.user` as an untyped bag. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    extractCurrentUser(context),
);

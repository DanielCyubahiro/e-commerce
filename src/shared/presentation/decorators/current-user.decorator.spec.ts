import type { ExecutionContext } from '@nestjs/common';
import { catchError } from '@test/support/catch-error';
import { extractCurrentUser } from './current-user.decorator';

const contextWith = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('extractCurrentUser', () => {
  it('returns the claims the guard attached', () => {
    const claims = {
      userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      role: 'seller',
      sessionId: '9c858901-8a57-4791-81fe-4c455b099bc9',
    };

    expect(extractCurrentUser(contextWith(claims))).toEqual(claims);
  });

  it('throws a plain Error on a @Public() route, where the guard attaches nothing', () => {
    const error = catchError(
      () => extractCurrentUser(contextWith(undefined)),
      Error,
    );

    expect(error.message).toMatch(/@Public\(\)/);
  });
});

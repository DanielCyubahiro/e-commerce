import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { FakeAccessTokenIssuer } from '@test/fakes/fake-access-token.issuer';
import { catchRejection } from '@test/support/catch-error';
import { UnauthenticatedException } from '@/identity/application';
import { IS_PUBLIC } from '@/shared/presentation/decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const issuer = new FakeAccessTokenIssuer('secret-one');
  const claims = {
    userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    role: 'seller',
    sessionId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  };

  const contextFor = (
    headers: Record<string, string>,
    metadata: Record<string, unknown> = {},
  ): {
    context: ExecutionContext;
    request: { headers: unknown; user?: unknown };
  } => {
    const request = { headers };
    const handler = () => undefined;
    Reflect.defineMetadata(IS_PUBLIC, metadata[IS_PUBLIC], handler);

    return {
      request,
      context: {
        getHandler: () => handler,
        getClass: () => class Controller {},
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  };

  const guard = new JwtAuthGuard(new Reflector(), issuer);

  it('admits a request carrying a valid bearer token', async () => {
    const { token } = await issuer.issue(claims);
    const { context, request } = contextFor({
      authorization: `Bearer ${token}`,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(claims);
  });

  it('admits a @Public() endpoint with no token at all', async () => {
    const { context, request } = contextFor({}, { [IS_PUBLIC]: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    // Nothing is attached, which is why @CurrentUser() throws on a public route.
    expect(request.user).toBeUndefined();
  });

  it('refuses a request with no Authorization header', async () => {
    const { context } = contextFor({});

    const error = await catchRejection(
      () => guard.canActivate(context),
      UnauthenticatedException,
    );
    expect(error.code).toBe('AUTH_UNAUTHENTICATED');
  });

  it('refuses a scheme other than Bearer', async () => {
    const { token } = await issuer.issue(claims);
    const { context } = contextFor({ authorization: `Basic ${token}` });

    const error = await catchRejection(
      () => guard.canActivate(context),
      UnauthenticatedException,
    );
    expect(error.code).toBe('AUTH_UNAUTHENTICATED');
  });

  it('refuses a token another issuer signed', async () => {
    const { token } = await new FakeAccessTokenIssuer('secret-two').issue(
      claims,
    );
    const { context } = contextFor({ authorization: `Bearer ${token}` });

    const error = await catchRejection(
      () => guard.canActivate(context),
      UnauthenticatedException,
    );
    expect(error.code).toBe('AUTH_UNAUTHENTICATED');
  });

  it('refuses a bearer header with nothing after the scheme', async () => {
    // 'Bearer' alone (no trailing space) would already fail the prefix check
    // above, exercising the same branch as the wrong-scheme case. The scheme
    // has to match exactly for this to reach the empty-token check instead.
    const { context } = contextFor({ authorization: 'Bearer ' });

    const error = await catchRejection(
      () => guard.canActivate(context),
      UnauthenticatedException,
    );
    expect(error.code).toBe('AUTH_UNAUTHENTICATED');
  });
});

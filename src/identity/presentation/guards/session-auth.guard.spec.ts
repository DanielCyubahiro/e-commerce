import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CommandBus } from '@nestjs/cqrs';
import { catchRejection } from '@test/support/catch-error';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import {
  revokeSeededSession,
  type SeededSession,
  seedSessionCookie,
} from '@test/support/session-cookie';
import {
  type AuthenticateSessionCommand,
  AuthenticateSessionHandler,
  ForbiddenOriginException,
  UnauthenticatedException,
} from '@/identity/application';
import { IS_PUBLIC } from '@/shared/presentation/decorators/public.decorator';
import { authWebSettingsFrom } from '../auth-web-settings';
import { SessionCookie } from '../session-cookie';
import { SessionAuthGuard } from './session-auth.guard';

/**
 * Records what SessionCookie asks Express to do. The attributes themselves are
 * Express's business and are asserted in session-cookie.http-spec.ts.
 */
class FakeResponse {
  readonly written: { value: string; maxAge: number | undefined }[] = [];
  private readonly headers = new Map<string, string | string[]>();

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  setHeader(name: string, value: string | string[]): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  removeHeader(name: string): void {
    this.headers.delete(name.toLowerCase());
  }

  cookie(_name: string, value: string, options: { maxAge?: number }): this {
    this.written.push({ value, maxAge: options.maxAge });
    return this;
  }
}

describe('SessionAuthGuard', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };
  const settings = authWebSettingsFrom('http://localhost:5173', lifetimes);

  let sessions: InMemorySessionRepository;
  let guard: SessionAuthGuard;

  const contextFor = (options: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    isPublic?: boolean;
  }): {
    context: ExecutionContext;
    request: { user?: unknown };
    response: FakeResponse;
  } => {
    const request = {
      headers: options.headers ?? {},
      cookies: options.cookies ?? {},
    } as {
      headers: Record<string, string>;
      cookies: Record<string, string>;
      user?: unknown;
    };
    const response = new FakeResponse();
    const handler = () => undefined;
    Reflect.defineMetadata(
      IS_PUBLIC,
      options.isPublic ? true : undefined,
      handler,
    );

    return {
      request,
      response,
      context: {
        getHandler: () => handler,
        getClass: () => class Controller {},
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as unknown as ExecutionContext,
    };
  };

  // Through the test-support helper rather than the repository directly: a
  // spec under `src/*/presentation/` may not import a domain value object,
  // and starting a session needs three of them.
  const startSession = (): Promise<SeededSession> =>
    seedSessionCookie(sessions, { userId, role: 'seller' }, now);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    sessions = new InMemorySessionRepository(lifetimes);

    // A bus of one handler: the real AuthenticateSessionHandler over the fake
    // repository, so the guard is tested through the same command it
    // dispatches in production.
    const authenticate = new AuthenticateSessionHandler(sessions);
    const bus = {
      execute: (command: AuthenticateSessionCommand) =>
        authenticate.execute(command),
    } as unknown as CommandBus;

    guard = new SessionAuthGuard(
      new Reflector(),
      bus,
      new SessionCookie(settings),
      settings,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('admits a request whose cookie names a live session, attaches its owner, and slides the cookie', async () => {
    const { plaintext, sessionId } = await startSession();
    const { context, request, response } = contextFor({
      cookies: { session: plaintext },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId, role: 'seller', sessionId });
    expect(response.written).toEqual([
      { value: plaintext, maxAge: 2_592_000_000 },
    ]);
  });

  it('admits a @Public() endpoint with no cookie at all, attaching nothing', async () => {
    const { context, request } = contextFor({ isPublic: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('refuses a request with no cookie', async () => {
    const { context } = contextFor({});

    const error = await catchRejection(
      () => guard.canActivate(context),
      UnauthenticatedException,
    );
    expect(error.code).toBe('AUTH_UNAUTHENTICATED');
  });

  it('refuses a cookie nobody issued', async () => {
    const { context } = contextFor({ cookies: { session: 'forged' } });

    const error = await catchRejection(
      () => guard.canActivate(context),
      UnauthenticatedException,
    );
    expect(error.code).toBe('AUTH_UNAUTHENTICATED');
  });

  it('refuses a cookie whose session has been revoked', async () => {
    // The whole point of the change: revocation reaches the next request.
    const session = await startSession();
    await revokeSeededSession(sessions, session, userId, now);
    const { context, response } = contextFor({
      cookies: { session: session.plaintext },
    });

    const error = await catchRejection(
      () => guard.canActivate(context),
      UnauthenticatedException,
    );
    expect(error.code).toBe('AUTH_UNAUTHENTICATED');
    expect(response.written).toEqual([]);
  });

  it('refuses a cross-site Origin with 403, even on a @Public() endpoint', async () => {
    // Login CSRF: a cross-site form post to /auth/login would otherwise plant
    // the attacker's session cookie in the victim's browser.
    const { context } = contextFor({
      headers: { origin: 'https://evil.example' },
      isPublic: true,
    });

    const error = await catchRejection(
      () => guard.canActivate(context),
      ForbiddenOriginException,
    );
    expect(error.code).toBe('AUTH_ORIGIN_FORBIDDEN');
    expect(error.origin).toBe('https://evil.example');
  });

  it('refuses the literal Origin "null"', async () => {
    const { context } = contextFor({
      headers: { origin: 'null' },
      isPublic: true,
    });

    const error = await catchRejection(
      () => guard.canActivate(context),
      ForbiddenOriginException,
    );
    expect(error.origin).toBe('null');
  });

  it('admits the frontend Origin', async () => {
    const { plaintext } = await startSession();
    const { context } = contextFor({
      headers: { origin: 'http://localhost:5173' },
      cookies: { session: plaintext },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

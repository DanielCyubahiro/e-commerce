import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CommandBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import {
  AuthenticateSessionCommand,
  type AuthenticatedSession,
  ForbiddenOriginException,
  UnauthenticatedException,
} from '@/identity/application';
import type { AuthenticatedRequest } from '@/shared/presentation/authenticated-request';
import { IS_PUBLIC } from '@/shared/presentation/decorators/public.decorator';
import { AUTH_WEB_SETTINGS, type AuthWebSettings } from '../auth-web-settings';
import { SessionCookie } from '../session-cookie';

/**
 * Registered as `APP_GUARD` in `identity.module.ts`, not through
 * `configureApp`: a guard handed to `useGlobalGuards` is constructed outside
 * the DI container and could not inject the bus or the cookie.
 *
 * Order matters. The Origin check runs before the `@Public()` short-circuit,
 * because a cross-site form post to a public endpoint (`/auth/login`) would
 * otherwise plant the attacker's session cookie in the victim's browser. The
 * session is resolved through `AuthenticateSessionCommand` rather than by
 * calling the port here, because hashing the presented token is a domain
 * operation presentation may not perform.
 *
 * Guards run before pipes, so on a protected endpoint a dead cookie answers
 * 401 before a malformed body could answer 400.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly commandBus: CommandBus,
    private readonly cookie: SessionCookie,
    @Inject(AUTH_WEB_SETTINGS) private readonly settings: AuthWebSettings,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();

    // Present and different is the only rejection. Absent passes: only a
    // browser can be CSRF'd, and browsers send Origin on every cross-origin
    // POST, PUT and DELETE. The literal "null", which browsers send from
    // sandboxed frames and some redirect chains, is present and differs.
    const origin = request.headers.origin;

    if (origin !== undefined && origin !== this.settings.allowedOrigin) {
      throw new ForbiddenOriginException(origin);
    }

    // Handler first, then class, so `@Public()` works at either level and a
    // method can open one endpoint on an otherwise guarded controller.
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic === true) {
      return true;
    }

    const token = this.cookie.read(request);

    if (token === null) {
      throw new UnauthenticatedException();
    }

    const session = await this.commandBus.execute<
      AuthenticateSessionCommand,
      AuthenticatedSession | null
    >(new AuthenticateSessionCommand(token));

    if (!session) {
      throw new UnauthenticatedException();
    }

    request.user = session;

    // Re-sent so the browser's Max-Age slides with the row's last_seen_at.
    this.cookie.write(http.getResponse<Response>(), token);

    return true;
  }
}

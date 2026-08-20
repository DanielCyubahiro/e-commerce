import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
  UnauthenticatedException,
} from '@/identity/application';
import type { AuthenticatedRequest } from '@/shared/presentation/authenticated-request';
import { IS_PUBLIC } from '@/shared/presentation/decorators/public.decorator';

const SCHEME = 'Bearer ';

/**
 * Registered as `APP_GUARD` in `identity.module.ts`, not through
 * `configureApp`: a guard handed to `useGlobalGuards` is constructed outside
 * the DI container and could not inject `AccessTokenIssuer`. The consequence is
 * that the request pipeline is described in two files rather than one.
 *
 * Guards run before pipes, so on a protected endpoint a bad token answers 401
 * before a malformed body could answer 400.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly issuer: AccessTokenIssuer,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Handler first, then class, so `@Public()` works at either level and a
    // method can open one endpoint on an otherwise guarded controller.
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = JwtAuthGuard.bearerToken(request.headers.authorization);

    if (token === null) {
      throw new UnauthenticatedException();
    }

    const claims = await this.issuer.verify(token);

    if (!claims) {
      throw new UnauthenticatedException();
    }

    request.user = claims;

    return true;
  }

  /** @returns null for a missing header, another scheme, or an empty token */
  private static bearerToken(header: string | undefined): string | null {
    if (header === undefined || !header.startsWith(SCHEME)) {
      return null;
    }

    const token = header.slice(SCHEME.length).trim();

    return token === '' ? null : token;
  }
}

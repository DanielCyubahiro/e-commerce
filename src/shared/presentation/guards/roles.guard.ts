import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InsufficientRoleException } from '@/shared/application';
import type { AuthenticatedRequest } from '../authenticated-request';
import { ROLES } from '../decorators/roles.decorator';

/**
 * Coarse authorization at the edge: compares the role the authentication
 * guard attached against the list `@Roles()` declared. Never applied globally,
 * so it cannot run before that guard.
 *
 * @throws InsufficientRoleException (403) when the caller's role is not listed
 * @throws Error when no user is attached, which means the endpoint is
 * `@Public()` and the decorator is a wiring mistake rather than a client fault
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES,
      [context.getHandler(), context.getClass()],
    );

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new Error(
        '@Roles() requires a guarded endpoint; this one is @Public().',
      );
    }

    if (!required.includes(request.user.role)) {
      throw new InsufficientRoleException(required);
    }

    return true;
  }
}

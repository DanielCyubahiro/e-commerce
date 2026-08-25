import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InsufficientRoleException } from '@/shared/application';
import { catchError } from '@test/support/catch-error';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

class Probe {
  // `this: void`: below, `Probe.prototype.x` is handed to `contextFor` as a
  // bare value, never called through a receiver, so `unbound-method` would
  // flag it otherwise. It cannot be wrapped in an arrow function instead,
  // because `SetMetadata` attaches the roles to this exact function object.
  @Roles('seller')
  staffOnly(this: void): string {
    return 'staff';
  }

  @Roles('seller', 'auditor')
  eitherRole(this: void): string {
    return 'either';
  }

  open(this: void): string {
    return 'open';
  }
}

const contextFor = (
  handler: (...args: never[]) => unknown,
  user: unknown,
): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => Probe,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const seller = { userId: 'u-1', role: 'seller', sessionId: 's-1' };
const customer = { userId: 'u-2', role: 'customer', sessionId: 's-2' };

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('lets any caller through an endpoint that lists no roles', () => {
    expect(guard.canActivate(contextFor(Probe.prototype.open, customer))).toBe(
      true,
    );
  });

  it('lets a caller holding a listed role through', () => {
    expect(
      guard.canActivate(contextFor(Probe.prototype.staffOnly, seller)),
    ).toBe(true);
    expect(
      guard.canActivate(contextFor(Probe.prototype.eitherRole, seller)),
    ).toBe(true);
  });

  it('refuses a caller holding none of the listed roles, naming them', () => {
    const error = catchError(
      () => guard.canActivate(contextFor(Probe.prototype.eitherRole, customer)),
      InsufficientRoleException,
    );

    expect(error.code).toBe('AUTH_ROLE_FORBIDDEN');
    expect(error.kind).toBe('forbidden');
    expect(error.message).toMatch(/seller, auditor/);
  });

  it('throws a plain Error when no user was attached, a wiring mistake', () => {
    const error = catchError(
      () => guard.canActivate(contextFor(Probe.prototype.staffOnly, undefined)),
      Error,
    );

    expect(error).not.toBeInstanceOf(InsufficientRoleException);
    expect(error.message).toMatch(/@Public\(\)/);
  });
});

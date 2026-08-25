import { SetMetadata } from '@nestjs/common';

export const ROLES = 'shared:roles';

/**
 * Lists the roles allowed to call an endpoint; `RolesGuard` reads it. Applied
 * together with `@UseGuards(RolesGuard)` at method level, so the guard always
 * runs after the global authentication guard has attached `request.user`.
 *
 * Absent means any authenticated caller. Ownership is not a role and is not
 * checked here: it belongs to the command or query, where the caller's id is
 * part of the write.
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES, roles);

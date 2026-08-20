import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'identity:isPublic';

/**
 * Marks an endpoint reachable without an access token.
 *
 * Lives in the shared kernel rather than in `identity/presentation` because
 * every context needs it: `ProductController` marks its two GETs with it. The
 * guard that reads it belongs to `identity`, which owns the token port.
 *
 * The default is protected, so forgetting this annotation closes an endpoint
 * rather than opening one.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC, true);

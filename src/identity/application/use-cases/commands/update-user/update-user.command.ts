import type { UserProfileInput } from '@/identity/domain';

/**
 * No email: it is immutable after registration, so a full replacement of the
 * mutable fields does not include it. See ADR 0014.
 */
export class UpdateUserCommand {
  constructor(
    public readonly id: string,
    public readonly fields: UserProfileInput,
  ) {}
}

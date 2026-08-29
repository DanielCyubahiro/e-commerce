import type { UserProfileInput } from '@/identity/domain';

/**
 * No email, and no role: both are immutable through the API, so a full
 * replacement of the mutable fields includes neither. See ADR 0014 and
 * ADR 0020.
 */
export class UpdateUserCommand {
  constructor(
    public readonly id: string,
    public readonly fields: UserProfileInput,
  ) {}
}

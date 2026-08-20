import { IsUUID } from 'class-validator';

/**
 * Version-agnostic to match `UniqueId`'s own pattern; tightening one without
 * the other would create exactly the drift this project keeps removing.
 *
 * A malformed id surfaces as 400, not 422: `UniqueId.parse` throws
 * `InvalidIdentifierException`, kind `malformed-identifier`.
 */
export class UserIdParamDto {
  @IsUUID()
  id!: string;
}

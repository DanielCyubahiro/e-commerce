import { IsUUID } from 'class-validator';

/**
 * Version-agnostic to match `UniqueId`'s own pattern; tightening one without the
 * other would create exactly the drift this project keeps removing.
 *
 * Unlike the create and list DTOs, whose domain-owned rules surface as 422, a
 * malformed id here surfaces as 400: `UniqueId.parse` throws
 * `InvalidIdentifierException` (invalid-identifier.exception.ts), kind
 * `malformed-identifier`.
 */
export class ProductIdParamDto {
  @IsUUID()
  id!: string;
}

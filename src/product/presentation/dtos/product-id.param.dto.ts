import { IsUUID } from 'class-validator';

/**
 * Version-agnostic to match `UniqueId`'s own pattern; tightening one without the
 * other would create exactly the drift this project keeps removing.
 */
export class ProductIdParamDto {
  @IsUUID()
  id!: string;
}

import { IsUUID } from 'class-validator';

/** Version-agnostic to match `UniqueId`; a malformed id answers 400, not 422. */
export class OrderIdParamDto {
  @IsUUID()
  id!: string;
}

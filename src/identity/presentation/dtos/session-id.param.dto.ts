import { IsUUID } from 'class-validator';

/**
 * Version-agnostic to match `UniqueId`'s own pattern, the same reasoning as
 * `UserIdParamDto`. A malformed id answers 400 from the pipe before any
 * lookup runs.
 */
export class SessionIdParamDto {
  @IsUUID()
  id!: string;
}

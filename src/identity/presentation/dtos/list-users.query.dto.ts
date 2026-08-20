import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/shared/application';

/**
 * `@Type` coerces the string query values: the pipe in `app.config.ts` enables
 * no implicit conversion.
 *
 * Pagination bounds have no domain counterpart, so they are enforced here and
 * answer 400. The role's closed set does have one, so it is left to
 * `UserRole.create` and answers 422, exactly as currency is on the product
 * list.
 */
export class ListUsersQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  role?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  @IsOptional()
  limit: number = DEFAULT_PAGE_LIMIT;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset: number = 0;
}

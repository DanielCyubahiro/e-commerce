import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/shared/application';

/**
 * Nest already coerces a `Number`-typed query parameter through
 * `transformPrimitive`, so the value arriving as a number is not what this DTO
 * adds. What it adds is validation: without it `?minPrice=abc` coerces to `NaN`
 * and only fails later as a 422 from the domain, and `?limit=abc` reaches
 * pagination unchecked.
 *
 * Pagination bounds have no domain counterpart, so they are enforced here.
 * Currency format does have one, so it is left to `Money` and reported as 422,
 * exactly as it is on the create path.
 */
export class ListProductsQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ValidateIf(
    (dto: ListProductsQueryDto) =>
      dto.minPrice !== undefined || dto.maxPrice !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  currency?: string;

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

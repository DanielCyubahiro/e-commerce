import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/shared/application';

/**
 * `status` is any non-empty string here; `OrderStatus` owns the closed set and
 * answers 422. `customerId` only means something under staff scope; a customer
 * who sends one is overridden, not rejected.
 */
export class ListOrdersQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

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

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Shape and absurd ceilings only. Quantity's 1 to 999 and the product id's
 * format are domain rules and answer 422 with a typed code; `@IsInt()` here is
 * what keeps a fractional quantity out at the edge, as `stock` does on products.
 */
export class OrderLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  productId!: string;

  @IsInt()
  quantity!: number;
}

/**
 * Every ceiling is far above the domain's (200/100/20), so `ShippingAddress`
 * is still the rule that can reject a value. `line2` and `region` accept an
 * explicit `null` as well as an absent key; the domain folds both.
 */
export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  recipientName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  line1!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  line2?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  city!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  region?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  country!: string;
}

/** The 1000-line ceiling is abuse protection; the domain's 100 is the rule. */
export class PlaceOrderDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;
}

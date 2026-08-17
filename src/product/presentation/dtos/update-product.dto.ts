import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * The replace payload: the same shape rules as `CreateProductDto`, with one
 * deliberate difference. `currency` is required here, because under replace
 * semantics an omitted optional field overwrites what is stored, so create's
 * EUR default would silently convert a USD product. A default that fills a
 * blank and a default that overwrites a value are not the same feature.
 *
 * Not a subclass of `CreateProductDto`, and it must not become one:
 * class-validator dedups inherited metadata by (propertyName, type), and
 * `@IsOptional` registers type `conditionalValidation`. Redeclaring `currency`
 * here without that decorator would leave the parent's `@IsOptional` in force,
 * so the field would silently be optional again with nothing failing to say so.
 */
export class UpdateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description!: string;

  @IsNumber()
  price!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sku!: string;

  @IsInt()
  stock!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

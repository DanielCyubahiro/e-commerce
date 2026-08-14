import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Checks type, presence, and ceilings loose enough to reject an abusive payload
 * without restating a business rule. Precise bounds (name length, sku format,
 * price precision, currency shape) belong to the domain and surface as 422 with a
 * typed code, so they are never written in two places that can drift.
 *
 * The property initialiser is the API's only currency default.
 */
export class CreateProductDto {
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
  @IsOptional()
  currency: string = 'EUR';
}

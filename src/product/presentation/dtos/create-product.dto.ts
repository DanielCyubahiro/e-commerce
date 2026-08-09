import {
  IsString,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Matches,
  IsOptional,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'SKU can only contain alphanumeric characters and dashes.',
  })
  sku!: string;

  @IsNumber()
  @Min(0)
  stock!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @IsOptional()
  currency?: string;
}

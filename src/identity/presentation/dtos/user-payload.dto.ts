import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Serves POST and PUT alike, unlike product's split pair, because no field's
 * optionality differs between the two paths. If one ever does, this splits into
 * two classes; it never gains a conditional decorator to serve both. Do not
 * subclass it either: class-validator dedups inherited metadata by property and
 * type, so a redeclared field silently keeps the parent's `@IsOptional`.
 *
 * Every ceiling here is loose enough that the domain rule is still the one that
 * can reject a value: names against 100, email against 254, phone against its
 * leading-`+`-and-digit-count bound. Precise rules belong to the domain and
 * surface as 422 with a typed code.
 */
export class UserPayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  email!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;

  /**
   * Typed `string | null` because `@IsOptional` skips validation for an
   * explicit JSON `null` as well as an absent key, so both reach the command.
   * `User.build` collapses them identically. See ADR 0011.
   */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string | null;
}

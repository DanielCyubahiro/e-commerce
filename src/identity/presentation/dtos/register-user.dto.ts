import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Every ceiling here is loose enough that the domain rule is still the one that
 * can reject a value: names against 100, email against 254, phone against its
 * leading-`+`-and-digit-count bound. Precise rules belong to the domain and
 * surface as 422 with a typed code.
 *
 * No `role`: every registration creates a customer, and `forbidNonWhitelisted`
 * answers 400 to a client that sends one.
 */
export class RegisterUserDto {
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

  /**
   * Typed `string | null` because `@IsOptional` skips validation for an
   * explicit JSON `null` as well as an absent key, so both reach the command.
   * `User.build` collapses them identically.
   */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string | null;

  /**
   * Bounded at 128 to match the domain's ceiling, which exists because argon2
   * spends 19 MiB per call on this value. The 12-character minimum is a domain
   * rule and is deliberately not repeated here; `Password.create` owns it and
   * answers 422.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

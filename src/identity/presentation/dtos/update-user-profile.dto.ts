import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Carries the three mutable fields `PUT /users/:id` may replace. `email` is
 * deliberately absent, not merely unvalidated: it is immutable after
 * registration, and `forbidNonWhitelisted` turns a client that sends one into
 * a 400 rather than a silently ignored field. `role` is absent
 * for the same reason: an endpoint that branches on `seller` cannot let a
 * caller set it.
 *
 * Every ceiling here is loose enough that the domain rule is still the one
 * that can reject a value: names against 100, phone against its
 * leading-`+`-and-digit-count bound. Precise rules belong to the domain and
 * surface as 422 with a typed code.
 */
export class UpdateUserProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  lastName!: string;

  /**
   * Typed `string | null` because `@IsOptional` skips validation for an
   * explicit JSON `null` as well as an absent key, so both reach the command.
   * `UserProfile.create` collapses them identically.
   */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string | null;
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * `token`'s ceiling is a generous bound on an opaque value, not a shape
 * check. `newPassword` carries no minimum: this is a password being set, and
 * `Password.create` owns that floor, matching `RegisterUserDto`.
 */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string;
}

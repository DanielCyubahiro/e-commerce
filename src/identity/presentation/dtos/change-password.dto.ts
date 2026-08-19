import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Neither field repeats a minimum. `currentPassword` is an attempt, matching
 * `LoginDto`, and `PasswordAttempt` has no floor by design. `newPassword` is
 * a password being set, and `Password.create` owns that floor. Both share
 * the same length ceiling, since both reach argon2 either way.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string;
}

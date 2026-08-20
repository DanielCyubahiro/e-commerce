import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * The email format is `Email.create`'s rule and is not repeated here.
 * `password` carries no minimum on purpose: this is an attempt, not a
 * password being set, and `PasswordAttempt` deliberately has no floor so a
 * tightened policy cannot lock out a hash written under an older one. The
 * length ceiling is still enforced, matching `PasswordAttempt`'s own, since
 * the value reaches argon2 either way.
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

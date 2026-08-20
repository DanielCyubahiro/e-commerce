import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** The email format is `Email.create`'s rule and is not repeated here. */
export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;
}

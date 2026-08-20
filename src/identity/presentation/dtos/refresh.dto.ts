import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Bounded to a generous ceiling only; the token's own shape is opaque here. */
export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  refreshToken!: string;
}

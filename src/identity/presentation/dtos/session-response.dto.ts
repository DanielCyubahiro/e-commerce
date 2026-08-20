import type { LoginResult } from '@/identity/application';

/**
 * `tokenType` is fixed at `Bearer` so a client has no reason to guess. The
 * refresh token is in the body rather than a cookie because this API has no
 * browser client; switching to an httpOnly cookie later changes this DTO and
 * the controller, and nothing below them.
 */
export class SessionResponseDto {
  accessToken!: string;
  tokenType!: 'Bearer';
  expiresIn!: number;
  refreshToken!: string;

  static fromResult(result: LoginResult): SessionResponseDto {
    const dto = new SessionResponseDto();
    dto.accessToken = result.accessToken;
    dto.tokenType = 'Bearer';
    dto.expiresIn = result.expiresInSeconds;
    dto.refreshToken = result.refreshToken;
    return dto;
  }
}

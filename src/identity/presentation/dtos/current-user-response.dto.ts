/**
 * The wire contract for "who am I", shared by login and `GET /auth/me`. No
 * `sessionId`: the device list marks the current session itself, and the id
 * is not something a client needs to hold.
 */
export class CurrentUserResponseDto {
  userId!: string;
  role!: string;

  static from(user: { userId: string; role: string }): CurrentUserResponseDto {
    const dto = new CurrentUserResponseDto();
    dto.userId = user.userId;
    dto.role = user.role;
    return dto;
  }
}

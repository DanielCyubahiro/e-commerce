import type { UserReadModel } from '@/identity/application';

/**
 * The wire contract, kept separate from `UserReadModel` on purpose: this class
 * is the only compile-time checkpoint marking what is public, so renaming a
 * read-model field cannot change the API silently.
 */
export class UserResponseDto {
  id!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  role!: string;
  phone!: string | null;
  createdAt!: string;
  updatedAt!: string;

  /**
   * `phone` stays `null` rather than being omitted, so every user on the wire
   * carries the same key set and "no phone" never looks like "this endpoint
   * does not return phone". See ADR 0011.
   */
  static fromReadModel(model: UserReadModel): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = model.id;
    dto.firstName = model.firstName;
    dto.lastName = model.lastName;
    dto.email = model.email;
    dto.role = model.role;
    dto.phone = model.phone;
    dto.createdAt = model.createdAt.toISOString();
    dto.updatedAt = model.updatedAt.toISOString();
    return dto;
  }
}

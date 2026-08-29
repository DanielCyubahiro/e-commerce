import { UniqueId } from '@/shared/domain';

/**
 * Ordering's own name for the person placing an order. Deliberately not
 * identity's `UserId`: a context models a shared concept in its own language,
 * and the brand keeps the two from being passed for each other.
 */
export class CustomerId extends UniqueId<'CustomerId'> {
  static create(value?: string): CustomerId {
    return new CustomerId(this.parse(value));
  }
}

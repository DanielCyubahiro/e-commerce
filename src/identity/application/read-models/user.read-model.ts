/**
 * Deliberately not the aggregate. Nothing here enforces an invariant, so the
 * query path never rehydrates a `User`, which is what lets the aggregate keep
 * its construction private.
 *
 * `phone` is `null`, never `undefined`, when the user has no phone.
 */
export interface UserReadModel {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One row of the device list. Deliberately never carries the token digest:
 * the list is shown to the user, and a digest is the one column that must
 * never leave the store.
 */
export interface SessionReadModel {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastSeenAt: Date;
}

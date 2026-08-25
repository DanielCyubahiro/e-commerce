/**
 * What a fake must offer to take part in `FakeUnitOfWork`: a copy of its whole
 * state, and a way to put that copy back. `capture` rather than `snapshot`
 * because the product fake already has a `snapshot()` seam with a different
 * meaning.
 */
export interface Snapshottable {
  capture(): unknown;
  restore(captured: unknown): void;
}

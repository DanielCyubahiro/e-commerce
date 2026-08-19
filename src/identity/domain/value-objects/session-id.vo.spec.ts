import { SessionId } from './session-id.vo';

// UniqueId's own parsing and equality branches are exhaustively covered by
// unique-id.vo.spec.ts against a probe subclass. This file exists only so
// SessionId.create, still uncalled by any consumer this early in the
// authentication build-out, is not left at 0% coverage.
describe('SessionId', () => {
  it('mints a new identity when given no value', () => {
    expect(SessionId.create().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('parses a supplied value', () => {
    const id = SessionId.create();

    expect(SessionId.create(id.value).equals(id)).toBe(true);
  });
});

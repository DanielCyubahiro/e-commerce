import { matchesRoute } from './route-match';

const revoke = { method: 'DELETE', segments: ['auth', 'sessions', ':id'] };

describe('matchesRoute', () => {
  it('accepts a literal path', () => {
    const login = { method: 'POST', segments: ['auth', 'login'] };

    expect(matchesRoute(login, { ...login })).toBe(true);
  });

  it('lets a :param accept a variable, a UUID, and a malformed id', () => {
    const ids = [
      '{{otherSessionId}}',
      '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      'not-a-uuid',
    ];

    const accepted = ids.filter((id) =>
      matchesRoute(revoke, {
        method: 'DELETE',
        segments: ['auth', 'sessions', id],
      }),
    );

    expect(accepted).toEqual(ids);
  });

  it('rejects a different method', () => {
    expect(
      matchesRoute(revoke, {
        method: 'GET',
        segments: ['auth', 'sessions', 'x'],
      }),
    ).toBe(false);
  });

  it('rejects a different segment count', () => {
    expect(
      matchesRoute(revoke, {
        method: 'DELETE',
        segments: ['auth', 'sessions'],
      }),
    ).toBe(false);
  });

  it('rejects a literal that differs', () => {
    expect(
      matchesRoute(revoke, {
        method: 'DELETE',
        segments: ['auth', 'session', 'x'],
      }),
    ).toBe(false);
  });

  it('rejects an empty segment where a param is expected', () => {
    expect(
      matchesRoute(revoke, {
        method: 'DELETE',
        segments: ['auth', 'sessions', ''],
      }),
    ).toBe(false);
  });
});

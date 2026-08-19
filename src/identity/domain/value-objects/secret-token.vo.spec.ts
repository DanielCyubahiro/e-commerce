import { SecretToken } from './secret-token.vo';

describe('SecretToken', () => {
  it('mints a different secret every time', () => {
    const first = SecretToken.issue();
    const second = SecretToken.issue();

    expect(first.plaintext).not.toBe(second.plaintext);
  });

  it('mints a url-safe secret, so it survives an email link unescaped', () => {
    expect(SecretToken.issue().plaintext).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('carries the digest of its own plaintext', () => {
    const token = SecretToken.issue();

    expect(token.hash.equals(SecretToken.hashOf(token.plaintext))).toBe(true);
  });

  it('recomputes the same digest for the same presented secret', () => {
    const token = SecretToken.issue();

    expect(SecretToken.hashOf(token.plaintext).value).toBe(
      SecretToken.hashOf(token.plaintext).value,
    );
  });

  it('recomputes a different digest for a different secret', () => {
    expect(SecretToken.hashOf('one').value).not.toBe(
      SecretToken.hashOf('two').value,
    );
  });

  it('redacts itself when serialised, so a logged command leaks nothing', () => {
    const token = SecretToken.issue();

    // JSON.stringify calls toJSON; String() calls toString. Template
    // interpolation also calls toString, so it is not a third path and gets
    // no separate assertion here.
    expect(JSON.stringify({ token })).toBe('{"token":"[REDACTED]"}');
    expect(String(token)).toBe('[REDACTED]');
  });
});

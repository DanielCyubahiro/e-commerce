import { validateEnv } from './env.schema';

const valid = {
  POSTGRES_DB_URI: 'postgresql://postgres:postgres@localhost:5432/ecommerce',
  MONGO_DB_URI: 'mongodb://localhost:27017/ecommerce',
  JWT_SECRET: 'a'.repeat(32),
  SMTP_HOST: 'localhost',
  SMTP_FROM: 'no-reply@example.com',
  WEB_BASE_URL: 'https://example.com',
};

describe('validateEnv', () => {
  it('applies defaults for variables that have them', () => {
    const config = validateEnv({ ...valid });

    expect(config.PORT).toBe(3000);
    expect(config.MONGO_DB_NAME).toBe('ecommerce');
  });

  it('converts a numeric variable from the string every env var is', () => {
    expect(validateEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('keeps variables the schema does not describe', () => {
    // The return value replaces the whole config, so stripping unknown keys
    // would delete PATH and everything else the process needs.
    expect(validateEnv({ ...valid, PATH: '/usr/bin' })).toMatchObject({
      PATH: '/usr/bin',
    });
  });

  it('names the missing variable when one is absent', () => {
    expect(() => validateEnv({ MONGO_DB_URI: valid.MONGO_DB_URI })).toThrow(
      /POSTGRES_DB_URI/,
    );
  });

  it('rejects an empty required variable', () => {
    expect(() => validateEnv({ ...valid, POSTGRES_DB_URI: '' })).toThrow(
      /POSTGRES_DB_URI/,
    );
  });

  it('rejects a port outside the valid range', () => {
    expect(() => validateEnv({ ...valid, PORT: '70000' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects a port that is not a number', () => {
    expect(() => validateEnv({ ...valid, PORT: 'abc' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('reports every failure at once, not just the first', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      /POSTGRES_DB_URI[\s\S]*MONGO_DB_URI/,
    );
  });

  it('rejects a JWT secret short enough to brute-force', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'a'.repeat(31) })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('accepts a 32 character JWT secret', () => {
    expect(
      validateEnv({ ...valid, JWT_SECRET: 'a'.repeat(32) }).JWT_SECRET,
    ).toHaveLength(32);
  });

  it('gives the JWT secret no default, unlike every other new variable', () => {
    const withoutSecret: Record<string, unknown> = { ...valid };
    delete withoutSecret.JWT_SECRET;

    expect(() => validateEnv(withoutSecret)).toThrow(/JWT_SECRET/);
  });

  it('defaults the token lifetimes', () => {
    const config = validateEnv({ ...valid });

    expect(config.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(config.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(config.PASSWORD_RESET_TTL_MINUTES).toBe(60);
    expect(config.EMAIL_VERIFICATION_TTL_HOURS).toBe(24);
  });

  it('accepts a base URL without a public suffix, so localhost works', () => {
    expect(
      validateEnv({ ...valid, WEB_BASE_URL: 'http://localhost:5173' })
        .WEB_BASE_URL,
    ).toBe('http://localhost:5173');
  });

  it('defaults the session lifetimes', () => {
    const config = validateEnv({ ...valid });

    expect(config.SESSION_IDLE_TTL_DAYS).toBe(30);
    expect(config.SESSION_ABSOLUTE_TTL_DAYS).toBe(365);
  });

  it('rejects an absolute session lifetime shorter than the idle one', () => {
    // class-validator has no cross-field decorator; an inverted pair would
    // make the idle TTL meaningless, so validateEnv checks it by hand.
    expect(() =>
      validateEnv({
        ...valid,
        SESSION_IDLE_TTL_DAYS: '30',
        SESSION_ABSOLUTE_TTL_DAYS: '7',
      }),
    ).toThrow(/SESSION_ABSOLUTE_TTL_DAYS/);
  });

  it('accepts an absolute session lifetime equal to the idle one', () => {
    expect(
      validateEnv({
        ...valid,
        SESSION_IDLE_TTL_DAYS: '30',
        SESSION_ABSOLUTE_TTL_DAYS: '30',
      }).SESSION_ABSOLUTE_TTL_DAYS,
    ).toBe(30);
  });
});

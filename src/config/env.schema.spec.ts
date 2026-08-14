import { validateEnv } from './env.schema';

const valid = {
  POSTGRES_DB_URI: 'postgresql://postgres:postgres@localhost:5432/ecommerce',
  MONGO_DB_URI: 'mongodb://localhost:27017/ecommerce',
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
});

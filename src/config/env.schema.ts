import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvSchema {
  @IsString()
  @IsNotEmpty()
  POSTGRES_DB_URI!: string;

  @IsString()
  @IsNotEmpty()
  MONGO_DB_URI!: string;

  @IsString()
  @IsNotEmpty()
  MONGO_DB_NAME: string = 'ecommerce';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;
}

/**
 * Wired into `ConfigModule.forRoot({ validate })`, so a missing or malformed
 * variable aborts startup instead of surfacing later as a connection error.
 *
 * Unrecognised variables pass through untouched: the return value replaces the
 * whole config, and the process environment legitimately holds hundreds of keys
 * this schema will never describe.
 *
 * @throws Error listing every constraint that failed
 */
export function validateEnv(config: Record<string, unknown>): EnvSchema {
  const validated = plainToInstance(EnvSchema, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map(
        (error) => `  - ${Object.values(error.constraints ?? {}).join(', ')}`,
      )
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return validated;
}

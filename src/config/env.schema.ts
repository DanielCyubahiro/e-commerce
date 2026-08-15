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

  // Reserved for an upcoming bounded context: MongoClientProvider connects at
  // boot (mongo.provider.ts), so this must be reachable even though nothing
  // queries it yet.
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
 * Every variable is required at boot, so a missing or malformed one aborts
 * startup with a message naming it rather than failing later on first query.
 *
 * All three options are load-bearing. `enableImplicitConversion` is the only
 * reason a numeric variable survives `@IsInt`, since `process.env` values are
 * always strings. `exposeDefaultValues` is the only reason the defaults above
 * apply. `skipMissingProperties: false` is the only reason an absent variable
 * fails instead of validating as undefined.
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

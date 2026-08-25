import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
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

  @IsInt()
  @Min(1)
  PASSWORD_RESET_TTL_MINUTES: number = 60;

  @IsInt()
  @Min(1)
  EMAIL_VERIFICATION_TTL_HOURS: number = 24;

  // How long a session survives without a request. Also the cookie's Max-Age.
  @IsInt()
  @Min(1)
  SESSION_IDLE_TTL_DAYS: number = 30;

  // The cap no amount of activity extends past.
  @IsInt()
  @Min(1)
  SESSION_ABSOLUTE_TTL_DAYS: number = 365;

  @IsString()
  @IsNotEmpty()
  SMTP_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 1025;

  @IsString()
  @IsNotEmpty()
  SMTP_FROM!: string;

  // require_tld off so http://localhost:5173 validates; the default rule wants a
  // public suffix, which no development host has.
  @IsUrl({ require_tld: false })
  WEB_BASE_URL!: string;
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

  // The one rule class-validator cannot express: a decorator sees one field.
  if (validated.SESSION_ABSOLUTE_TTL_DAYS < validated.SESSION_IDLE_TTL_DAYS) {
    throw new Error(
      'Invalid environment configuration:\n  - SESSION_ABSOLUTE_TTL_DAYS must be at least SESSION_IDLE_TTL_DAYS',
    );
  }

  return validated;
}

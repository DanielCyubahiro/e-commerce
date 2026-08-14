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

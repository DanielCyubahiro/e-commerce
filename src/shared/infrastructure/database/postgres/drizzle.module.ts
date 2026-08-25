import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { UNIT_OF_WORK } from '@/shared/application';
import {
  DRIZZLE,
  DrizzleProvider,
  POSTGRES_CLIENT,
  type PostgresClient,
  PostgresClientProvider,
} from './drizzle.provider';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work';

/** The close hook lives here because factory providers cannot carry lifecycle hooks. */
@Global()
@Module({
  providers: [
    PostgresClientProvider,
    DrizzleProvider,
    { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
  ],
  exports: [DRIZZLE, UNIT_OF_WORK],
})
export class DrizzleModule implements OnModuleDestroy {
  constructor(
    @Inject(POSTGRES_CLIENT) private readonly client: PostgresClient,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.end();
  }
}

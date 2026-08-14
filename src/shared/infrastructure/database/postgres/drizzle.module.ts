import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import {
  DRIZZLE,
  DrizzleProvider,
  POSTGRES_CLIENT,
  type PostgresClient,
  PostgresClientProvider,
} from './drizzle.provider';

/** The close hook lives here because factory providers cannot carry lifecycle hooks. */
@Global()
@Module({
  providers: [PostgresClientProvider, DrizzleProvider],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnModuleDestroy {
  constructor(
    @Inject(POSTGRES_CLIENT) private readonly client: PostgresClient,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.end();
  }
}

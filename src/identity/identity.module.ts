import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  commandHandlers,
  queryHandlers,
  USER_READ_REPOSITORY,
  USER_WRITE_REPOSITORY,
} from './application';
import {
  DrizzleUserReadRepository,
  DrizzleUserWriteRepository,
} from './infrastructure';
import { UserController } from './presentation/user.controller';

/**
 * Binds both ports to their adapters. The adapters inject `DRIZZLE`, which this
 * module does not provide: the client comes from the `@Global()` DrizzleModule
 * registered in src/app.module.ts. See the fork seam in docs/architecture.md.
 */
@Module({
  imports: [CqrsModule],
  controllers: [UserController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: USER_WRITE_REPOSITORY, useClass: DrizzleUserWriteRepository },
    { provide: USER_READ_REPOSITORY, useClass: DrizzleUserReadRepository },
  ],
})
export class IdentityModule {}

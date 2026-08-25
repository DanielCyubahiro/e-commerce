import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  commandHandlers,
  CREDENTIAL_REPOSITORY,
  EMAIL_SENDER,
  ONE_TIME_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  queryHandlers,
  SESSION_REPOSITORY,
  TOKEN_LIFETIMES,
  type TokenLifetimes,
  USER_READ_REPOSITORY,
  USER_WRITE_REPOSITORY,
} from './application';
import {
  Argon2PasswordHasher,
  DrizzleCredentialRepository,
  DrizzleOneTimeTokenRepository,
  DrizzleSessionRepository,
  DrizzleUserReadRepository,
  DrizzleUserWriteRepository,
  SmtpEmailSender,
} from './infrastructure';
import {
  AUTH_WEB_SETTINGS,
  type AuthWebSettings,
  authWebSettingsFrom,
} from './presentation/auth-web-settings';
import { AuthController } from './presentation/auth.controller';
import { SessionAuthGuard } from './presentation/guards/session-auth.guard';
import { SessionCookie } from './presentation/session-cookie';
import { UserController } from './presentation/user.controller';

/**
 * Binds every port to its adapter. The Drizzle adapters inject `DRIZZLE`, which
 * this module does not provide: the client comes from the `@Global()`
 * DrizzleModule registered in src/app.module.ts. `ConfigService` is likewise
 * not imported here: `ConfigModule.forRoot({ isGlobal: true })` in
 * `app.module.ts` is what makes it available, so nothing is added to
 * `imports` for it either. See the fork seam in docs/architecture.md.
 *
 * `ThrottlerModule` is the one exception to that pattern: it is imported
 * here, not in `app.module.ts`, because `AuthController` and `UserController`
 * are the only consumers of `ThrottlerGuard`, and every http-spec test
 * bootstraps this module directly rather than through `AppModule`. Being
 * `@Global()`, registering it here still makes it available app-wide once
 * `AppModule` imports this module, exactly as `ConfigModule` does the other
 * way round.
 */
@Module({
  imports: [CqrsModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [UserController, AuthController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: USER_WRITE_REPOSITORY, useClass: DrizzleUserWriteRepository },
    { provide: USER_READ_REPOSITORY, useClass: DrizzleUserReadRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: CREDENTIAL_REPOSITORY, useClass: DrizzleCredentialRepository },
    {
      provide: ONE_TIME_TOKEN_REPOSITORY,
      useClass: DrizzleOneTimeTokenRepository,
    },
    { provide: SESSION_REPOSITORY, useClass: DrizzleSessionRepository },
    {
      provide: EMAIL_SENDER,
      useFactory: (config: ConfigService) =>
        new SmtpEmailSender({
          host: config.getOrThrow<string>('SMTP_HOST'),
          port: config.getOrThrow<number>('SMTP_PORT'),
          from: config.getOrThrow<string>('SMTP_FROM'),
          webBaseUrl: config.getOrThrow<string>('WEB_BASE_URL'),
        }),
      inject: [ConfigService],
    },
    {
      // The only place the five lifetime keys are read.
      provide: TOKEN_LIFETIMES,
      useFactory: (config: ConfigService): TokenLifetimes => ({
        refreshTokenDays: config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS'),
        passwordResetMinutes: config.getOrThrow<number>(
          'PASSWORD_RESET_TTL_MINUTES',
        ),
        emailVerificationHours: config.getOrThrow<number>(
          'EMAIL_VERIFICATION_TTL_HOURS',
        ),
        sessionIdleDays: config.getOrThrow<number>('SESSION_IDLE_TTL_DAYS'),
        sessionAbsoluteDays: config.getOrThrow<number>(
          'SESSION_ABSOLUTE_TTL_DAYS',
        ),
      }),
      inject: [ConfigService],
    },
    {
      provide: AUTH_WEB_SETTINGS,
      useFactory: (
        config: ConfigService,
        lifetimes: TokenLifetimes,
      ): AuthWebSettings =>
        authWebSettingsFrom(
          config.getOrThrow<string>('WEB_BASE_URL'),
          lifetimes,
        ),
      inject: [ConfigService, TOKEN_LIFETIMES],
    },
    SessionCookie,
  ],
})
export class IdentityModule {}

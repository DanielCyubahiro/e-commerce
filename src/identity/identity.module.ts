import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  ACCESS_TOKEN_ISSUER,
  commandHandlers,
  CREDENTIAL_REPOSITORY,
  EMAIL_SENDER,
  ONE_TIME_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  queryHandlers,
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_LIFETIMES,
  type TokenLifetimes,
  USER_READ_REPOSITORY,
  USER_WRITE_REPOSITORY,
} from './application';
import {
  Argon2PasswordHasher,
  DrizzleCredentialRepository,
  DrizzleOneTimeTokenRepository,
  DrizzleRefreshTokenRepository,
  DrizzleUserReadRepository,
  DrizzleUserWriteRepository,
  JoseAccessTokenIssuer,
  SmtpEmailSender,
} from './infrastructure';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
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
  imports: [
    CqrsModule,
    // A default the per-endpoint `@Throttle` decorators tighten. Not
    // registered as a global guard: only six endpoints need a limit, so
    // ThrottlerGuard is applied per controller method instead, which also
    // keeps guard ordering out of play.
    //
    // Storage is the in-process default: with more than one instance each
    // gets its own counter, so the effective limit multiplies across the
    // fleet. Redis-backed storage fixes that and belongs with a later spec.
    // In production, IP throttling like this usually lives at the edge, in a
    // gateway or CDN, with the application keeping only the limits that need
    // to know about accounts; these six are a stand-in until that split
    // happens.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [UserController, AuthController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    // Global, so an endpoint added later is protected by default. Registered
    // here rather than in configureApp because APP_GUARD is the only form that
    // gets dependency injection.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: USER_WRITE_REPOSITORY, useClass: DrizzleUserWriteRepository },
    { provide: USER_READ_REPOSITORY, useClass: DrizzleUserReadRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: CREDENTIAL_REPOSITORY, useClass: DrizzleCredentialRepository },
    {
      provide: ONE_TIME_TOKEN_REPOSITORY,
      useClass: DrizzleOneTimeTokenRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: DrizzleRefreshTokenRepository,
    },
    {
      provide: ACCESS_TOKEN_ISSUER,
      useFactory: (config: ConfigService) =>
        new JoseAccessTokenIssuer(
          config.getOrThrow<string>('JWT_SECRET'),
          config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS'),
        ),
      inject: [ConfigService],
    },
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
      // The only place the three lifetime keys are read.
      provide: TOKEN_LIFETIMES,
      useFactory: (config: ConfigService): TokenLifetimes => ({
        refreshTokenDays: config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS'),
        passwordResetMinutes: config.getOrThrow<number>(
          'PASSWORD_RESET_TTL_MINUTES',
        ),
        emailVerificationHours: config.getOrThrow<number>(
          'EMAIL_VERIFICATION_TTL_HOURS',
        ),
      }),
      inject: [ConfigService],
    },
  ],
})
export class IdentityModule {}

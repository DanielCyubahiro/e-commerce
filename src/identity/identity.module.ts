import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
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
import { UserController } from './presentation/user.controller';

/**
 * Binds every port to its adapter. The Drizzle adapters inject `DRIZZLE`, which
 * this module does not provide: the client comes from the `@Global()`
 * DrizzleModule registered in src/app.module.ts. `ConfigService` is likewise
 * not imported here: `ConfigModule.forRoot({ isGlobal: true })` in
 * `app.module.ts` is what makes it available, so nothing is added to
 * `imports` for it either. See the fork seam in docs/architecture.md.
 */
@Module({
  imports: [CqrsModule],
  controllers: [UserController, AuthController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
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

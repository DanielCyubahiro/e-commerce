import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ChangePasswordCommand,
  LoginCommand,
  type LoginResult,
  LogoutAllSessionsCommand,
  LogoutCommand,
  RefreshSessionCommand,
  RequestPasswordResetCommand,
  ResendVerificationCommand,
  ResetPasswordCommand,
  VerifyEmailCommand,
} from '../application';
import { CurrentUser } from '@/shared/presentation/decorators/current-user.decorator';
import { Public } from '@/shared/presentation/decorators/public.decorator';
import type { AuthenticatedUser } from '@/shared/presentation/authenticated-request';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { RefreshDto } from './dtos/refresh.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { SessionResponseDto } from './dtos/session-response.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';

/**
 * Translates HTTP to a command and back; holds no logic of its own, which is
 * why it has no unit tests beyond the http-spec suite.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * Every attempt costs the server 19 MiB in argon2, correct password or not,
   * so this needs a limit even though argon2id already makes guessing
   * expensive for the attacker: it is paying for that cost decision, not
   * just guarding against brute force.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto): Promise<SessionResponseDto> {
    const result = await this.commandBus.execute<LoginCommand, LoginResult>(
      new LoginCommand(body.email, body.password),
    );

    return SessionResponseDto.fromResult(result);
  }

  /**
   * A POST carrying the token in the body, not a clickable GET. Link
   * prefetchers, spam filters and corporate mail scanners follow links, and a
   * GET that consumes a token gets consumed by a robot before the user clicks.
   * The emailed link points at a frontend, which posts here.
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<void> {
    await this.commandBus.execute<VerifyEmailCommand, void>(
      new VerifyEmailCommand(body.token),
    );
  }

  /**
   * 202 whether or not the address exists, so it cannot be used to probe.
   * Throttled because a hit spends someone else's inbox, not the caller's
   * own resource.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() body: ResendVerificationDto): Promise<void> {
    await this.commandBus.execute<ResendVerificationCommand, void>(
      new ResendVerificationCommand(body.email),
    );
  }

  /** Public: presenting the refresh token is the authentication. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto): Promise<SessionResponseDto> {
    const result = await this.commandBus.execute<
      RefreshSessionCommand,
      LoginResult
    >(new RefreshSessionCommand(body.refreshToken));

    return SessionResponseDto.fromResult(result);
  }

  /**
   * Takes no body: the session comes from the access token's `sid` claim, so
   * a client that has lost its refresh token can still end the session.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.commandBus.execute<LogoutCommand, void>(
      new LogoutCommand(user.sessionId),
    );
  }

  /**
   * Revokes every refresh chain of the caller's user, including the one it was
   * called from. That ends renewal, not access: the guard does no per-request
   * revocation lookup, so the caller's current access token keeps working
   * until it expires.
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.commandBus.execute<LogoutAllSessionsCommand, void>(
      new LogoutAllSessionsCommand(user.userId),
    );
  }

  /**
   * 202 whether or not the address exists, so it cannot be used to probe.
   * Throttled because a hit spends someone else's inbox, not the caller's
   * own resource.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.commandBus.execute<RequestPasswordResetCommand, void>(
      new RequestPasswordResetCommand(body.email),
    );
  }

  /**
   * Public: presenting the reset token is the authentication. Throttled
   * because `ResetPasswordHandler` hashes the new password before the token
   * is even checked (deliberately, so a policy rejection does not burn the
   * user's link), so without a limit a garbage token costs nothing to send
   * and buys a full argon2 hash every time regardless.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.commandBus.execute<ResetPasswordCommand, void>(
      new ResetPasswordCommand(body.token, body.newPassword),
    );
  }

  /**
   * Protected: a bearer token alone is not proof of the account owner, which
   * is why the command still carries the current password for the handler to
   * check. Throttled because that check is an argon2 verify against a
   * caller-supplied guess: a stolen access token would otherwise buy an
   * attacker one guess per request for the token's whole life.
   */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.commandBus.execute<ChangePasswordCommand, void>(
      new ChangePasswordCommand(
        user.userId,
        user.sessionId,
        body.currentPassword,
        body.newPassword,
      ),
    );
  }
}

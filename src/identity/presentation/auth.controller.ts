import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  LoginCommand,
  type LoginResult,
  LogoutAllSessionsCommand,
  LogoutCommand,
  RefreshSessionCommand,
  ResendVerificationCommand,
  VerifyEmailCommand,
} from '../application';
import { CurrentUser } from '@/shared/presentation/decorators/current-user.decorator';
import { Public } from '@/shared/presentation/decorators/public.decorator';
import type { AuthenticatedUser } from '@/shared/presentation/authenticated-request';
import { LoginDto } from './dtos/login.dto';
import { RefreshDto } from './dtos/refresh.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { SessionResponseDto } from './dtos/session-response.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';

/**
 * Translates HTTP to a command and back; holds no logic of its own, which is
 * why it has no unit tests beyond the http-spec suite.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
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

  /** 202 whether or not the address exists, so it cannot be used to probe. */
  @Public()
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

  /** Revokes every chain of the caller's user, including the one it was called from. */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.commandBus.execute<LogoutAllSessionsCommand, void>(
      new LogoutAllSessionsCommand(user.userId),
    );
  }
}

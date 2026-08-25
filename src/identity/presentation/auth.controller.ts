import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ChangePasswordCommand,
  type ListedSession,
  ListSessionsQuery,
  LoginCommand,
  type LoginResult,
  LogoutAllSessionsCommand,
  LogoutCommand,
  RequestPasswordResetCommand,
  ResendVerificationCommand,
  ResetPasswordCommand,
  RevokeSessionCommand,
  VerifyEmailCommand,
} from '../application';
import { CurrentUser } from '@/shared/presentation/decorators/current-user.decorator';
import { Public } from '@/shared/presentation/decorators/public.decorator';
import type { AuthenticatedUser } from '@/shared/presentation/authenticated-request';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { CurrentUserResponseDto } from './dtos/current-user-response.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { SessionIdParamDto } from './dtos/session-id.param.dto';
import { SessionResponseDto } from './dtos/session-response.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { originOf } from './request-origin';
import { SessionCookie } from './session-cookie';

/**
 * Translates HTTP to a command and back, and moves the session cookie; holds
 * no logic of its own, which is why it has no unit tests beyond the http-spec
 * suite.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly cookie: SessionCookie,
  ) {}

  /**
   * Every attempt costs the server 19 MiB in argon2, correct password or not,
   * so this needs a limit even though argon2id already makes guessing
   * expensive for the attacker: it is paying for that cost decision, not
   * just guarding against brute force.
   *
   * Answers the caller identity rather than an empty body so a fresh login
   * needs no second round trip to `GET /auth/me`.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponseDto> {
    const result = await this.commandBus.execute<LoginCommand, LoginResult>(
      new LoginCommand(body.email, body.password, originOf(request)),
    );

    this.cookie.write(response, result.token);

    return CurrentUserResponseDto.from(result);
  }

  /**
   * Who the cookie belongs to, from what the guard already loaded. The SPA
   * cannot read an HttpOnly cookie, so on a cold start this is its only way
   * to learn whether it is signed in, and as whom. No bus: the touch every
   * protected request pays is the only read.
   */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): CurrentUserResponseDto {
    return CurrentUserResponseDto.from(user);
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

  /**
   * Takes no body: the session comes from the cookie the guard resolved. The
   * cookie is cleared as well as the row revoked, so the browser stops
   * sending a dead credential that would cost a lookup and a 401 per request.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.commandBus.execute<LogoutCommand, void>(
      new LogoutCommand(user.userId, user.sessionId),
    );

    this.cookie.clear(response);
  }

  /**
   * Revokes every session of the caller's user, including the one it was
   * called from. Every one of them answers 401 on its next request.
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.commandBus.execute<LogoutAllSessionsCommand, void>(
      new LogoutAllSessionsCommand(user.userId),
    );

    this.cookie.clear(response);
  }

  /** The caller's own live sessions only; the query is scoped to the user the cookie resolved to. */
  @Get('sessions')
  async sessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionResponseDto[]> {
    const listed = await this.queryBus.execute<
      ListSessionsQuery,
      ListedSession[]
    >(new ListSessionsQuery(user.userId, user.sessionId));

    return listed.map((item) => SessionResponseDto.fromListed(item));
  }

  /**
   * Owner-scoped by the repository predicate, so another user's id and an
   * unknown id answer the same 404. When the caller revokes the session it is
   * calling from, the cookie is cleared too, exactly as logout would.
   */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SessionIdParamDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.commandBus.execute<RevokeSessionCommand, void>(
      new RevokeSessionCommand(user.userId, params.id),
    );

    // UUIDs are case-insensitive and @IsUUID() accepts either case, while
    // stored ids are lowercase, so a case-sensitive comparison here would
    // silently skip clearing the cookie on the caller's own uppercase id.
    if (params.id.toLowerCase() === user.sessionId) {
      this.cookie.clear(response);
    }
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
   * Protected: a live session alone is not proof of the account owner, which
   * is why the command still carries the current password for the handler to
   * check. Throttled because that check is an argon2 verify against a
   * caller-supplied guess: a stolen cookie would otherwise buy an attacker one
   * guess per request for as long as the session lives.
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

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ResendVerificationCommand, VerifyEmailCommand } from '../application';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';

/**
 * Translates HTTP to a command and back; holds no logic of its own, which is
 * why it has no unit tests beyond the http-spec suite.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * A POST carrying the token in the body, not a clickable GET. Link
   * prefetchers, spam filters and corporate mail scanners follow links, and a
   * GET that consumes a token gets consumed by a robot before the user clicks.
   * The emailed link points at a frontend, which posts here.
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<void> {
    await this.commandBus.execute<VerifyEmailCommand, void>(
      new VerifyEmailCommand(body.token),
    );
  }

  /** 202 whether or not the address exists, so it cannot be used to probe. */
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() body: ResendVerificationDto): Promise<void> {
    await this.commandBus.execute<ResendVerificationCommand, void>(
      new ResendVerificationCommand(body.email),
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_WEB_SETTINGS, type AuthWebSettings } from './auth-web-settings';

/**
 * The only place the session cookie's name and attributes exist. Reads the
 * plaintext the browser sent, writes it with the attributes ADR 0021 fixes,
 * and clears it with the same attributes, since a browser drops only a cookie
 * whose name, path and domain match the one it holds.
 *
 * Guarantees at most one `Set-Cookie` for the session per response: `write`
 * and `clear` replace any earlier entry for this name rather than appending,
 * so the guard's slide followed by a controller's `clear` leaves the clear.
 */
@Injectable()
export class SessionCookie {
  constructor(
    @Inject(AUTH_WEB_SETTINGS) private readonly settings: AuthWebSettings,
  ) {}

  /**
   * @returns null when the cookie is absent or empty. Relies on the
   * cookie-parser middleware `configureApp` installs.
   */
  read(request: Request): string | null {
    const jar: unknown = request.cookies;

    if (typeof jar !== 'object' || jar === null) {
      return null;
    }

    const value: unknown = (jar as Record<string, unknown>)[
      this.settings.cookie.name
    ];

    return typeof value === 'string' && value !== '' ? value : null;
  }

  write(response: Response, token: string): void {
    this.replace(response, token, this.settings.cookie.maxAgeSeconds);
  }

  clear(response: Response): void {
    this.replace(response, '', 0);
  }

  private replace(
    response: Response,
    value: string,
    maxAgeSeconds: number,
  ): void {
    const prefix = `${this.settings.cookie.name}=`;
    const existing = response.getHeader('Set-Cookie');
    const others = (
      Array.isArray(existing)
        ? existing
        : typeof existing === 'string'
          ? [existing]
          : []
    ).filter((header) => !header.startsWith(prefix));

    // Express's res.cookie appends to whatever Set-Cookie already holds, so the
    // earlier entry for this name is removed first.
    if (others.length > 0) {
      response.setHeader('Set-Cookie', others);
    } else {
      response.removeHeader('Set-Cookie');
    }

    response.cookie(this.settings.cookie.name, value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: this.settings.cookie.secure,
      // Express takes milliseconds and derives Expires from it; the emitted
      // Max-Age is still in seconds.
      maxAge: maxAgeSeconds * 1000,
    });
  }
}

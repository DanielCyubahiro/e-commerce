import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  type INestApplication,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import {
  AUTH_WEB_SETTINGS,
  authWebSettingsFrom,
} from '@/identity/presentation/auth-web-settings';
import { SessionCookie } from '@/identity/presentation/session-cookie';

const lifetimes = {
  passwordResetMinutes: 60,
  emailVerificationHours: 24,
  sessionIdleDays: 30,
  sessionAbsoluteDays: 365,
};

// A controller that does nothing but drive SessionCookie, so every assertion
// below is about what Express actually put on the wire.
@Controller('probe')
class CookieProbeController {
  constructor(private readonly cookie: SessionCookie) {}

  @Get('read')
  read(@Req() req: Request): { token: string | null } {
    return { token: this.cookie.read(req) };
  }

  @Post('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  write(@Res({ passthrough: true }) res: Response): void {
    this.cookie.write(res, 'plain-token');
  }

  @Post('clear')
  @HttpCode(HttpStatus.NO_CONTENT)
  clear(@Res({ passthrough: true }) res: Response): void {
    this.cookie.clear(res);
  }

  @Post('write-then-clear')
  @HttpCode(HttpStatus.NO_CONTENT)
  writeThenClear(@Res({ passthrough: true }) res: Response): void {
    this.cookie.write(res, 'plain-token');
    this.cookie.clear(res);
  }
}

const setCookiesOf = (response: request.Response): string[] =>
  response.get('Set-Cookie') ?? [];

describe.each([
  ['http://localhost:5173', false],
  ['https://shop.example.com', true],
])('SessionCookie over real Express, frontend at %s', (webBaseUrl, secure) => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CookieProbeController],
      providers: [
        {
          provide: AUTH_WEB_SETTINGS,
          useValue: authWebSettingsFrom(webBaseUrl, lifetimes),
        },
        SessionCookie,
      ],
    }).compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
      { allowedOrigin: new URL(webBaseUrl).origin },
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reads the session cookie the browser sent, and null without one', async () => {
    const withCookie = await request(app.getHttpServer())
      .get('/probe/read')
      .set('Cookie', 'session=abc; other=1');
    const without = await request(app.getHttpServer()).get('/probe/read');
    const empty = await request(app.getHttpServer())
      .get('/probe/read')
      .set('Cookie', 'session=');

    expect(withCookie.body).toEqual({ token: 'abc' });
    expect(without.body).toEqual({ token: null });
    expect(empty.body).toEqual({ token: null });
  });

  it('writes one cookie with every fixed attribute', async () => {
    const [cookie, ...rest] = setCookiesOf(
      await request(app.getHttpServer()).post('/probe/write').expect(204),
    );

    expect(rest).toEqual([]);
    expect(cookie).toContain('session=plain-token');
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain=');
    expect(cookie?.includes('Secure')).toBe(secure);
  });

  it('clears with the same name and path and a zero Max-Age', async () => {
    const [cookie, ...rest] = setCookiesOf(
      await request(app.getHttpServer()).post('/probe/clear').expect(204),
    );

    expect(rest).toEqual([]);
    expect(cookie).toContain('session=;');
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Path=/');
  });

  it('leaves exactly one Set-Cookie when a write is followed by a clear', async () => {
    // The guard slides the cookie before the controller runs; logout then
    // clears it. Two headers for one name would leave the browser to pick.
    const cookies = setCookiesOf(
      await request(app.getHttpServer())
        .post('/probe/write-then-clear')
        .expect(204),
    );

    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain('Max-Age=0');
  });
});

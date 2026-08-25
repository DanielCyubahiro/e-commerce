import {
  Controller,
  Get,
  type INestApplication,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';
import { type DomainErrorKind, DomainException } from '@/shared/domain';

const ALLOWED_ORIGIN = 'http://localhost:5173';

// `configureApp` is not the whole request pipeline: `JwtAuthGuard` is global
// too, but registered as `APP_GUARD` in `src/identity/identity.module.ts`
// rather than here, because only that provider form gets dependency
// injection. A reader wanting the full pipeline needs both files.

class ProbeInvariantException extends DomainException {
  readonly code = 'PROBE_INVARIANT';
  readonly kind: DomainErrorKind = 'invariant';

  constructor() {
    super('probe invariant violated');
  }
}

class ProbeConflictException extends ApplicationException {
  readonly code = 'PROBE_CONFLICT';
  readonly kind: ApplicationErrorKind = 'conflict';

  constructor() {
    super('probe conflict');
  }
}

@Controller('probe')
class ProbeController {
  @Get('domain')
  domain(): never {
    throw new ProbeInvariantException();
  }

  @Get('application')
  application(): never {
    throw new ProbeConflictException();
  }

  @Get('http')
  http(): never {
    throw new NotFoundException('probe missing');
  }

  @Get('unknown')
  unknown(): never {
    throw new Error('boom: password=hunter2 at products_sku_unique');
  }

  @Get('non-error')
  nonError(): never {
    // Throwing a non-Error is the point: the filter must not assume `.stack`.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 'a bare string, not an Error';
  }

  @Get('cookies')
  cookies(@Req() request: Request): { jar: unknown } {
    const jar: unknown = request.cookies;
    return { jar };
  }
}

describe('configureApp global filters', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();

    // Logging off: the unknown-error probe throws on purpose, and its stack
    // would otherwise bury the rest of the suite's output.
    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
      { allowedOrigin: ALLOWED_ORIGIN },
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps a domain invariant to 422 with its code', async () => {
    const response = await request(app.getHttpServer()).get('/probe/domain');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      statusCode: 422,
      code: 'PROBE_INVARIANT',
      message: 'probe invariant violated',
    });
  });

  it('maps an application conflict to 409 with its code', async () => {
    const response = await request(app.getHttpServer()).get(
      '/probe/application',
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      statusCode: 409,
      code: 'PROBE_CONFLICT',
      message: 'probe conflict',
    });
  });

  it('preserves a framework exception body', async () => {
    const response = await request(app.getHttpServer()).get('/probe/http');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ message: 'probe missing' });
  });

  it('reduces an unknown error to a 500 that leaks nothing', async () => {
    const response = await request(app.getHttpServer()).get('/probe/unknown');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
    expect(JSON.stringify(response.body)).not.toContain('products_sku_unique');
  });

  it('survives something thrown that is not an Error', async () => {
    const response = await request(app.getHttpServer()).get('/probe/non-error');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('parses cookies into request.cookies', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/cookies')
      .set('Cookie', 'a=1; b=two');

    expect(response.body).toEqual({ jar: { a: '1', b: 'two' } });
  });

  it('allows the configured origin with credentials, and no other', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/probe/http')
      .set('Origin', ALLOWED_ORIGIN);
    const other = await request(app.getHttpServer())
      .get('/probe/http')
      .set('Origin', 'https://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a preflight for the configured origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/probe/http')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'DELETE');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      ALLOWED_ORIGIN,
    );
  });
});

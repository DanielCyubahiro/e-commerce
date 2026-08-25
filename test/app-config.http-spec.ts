import {
  Controller,
  Get,
  type INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';
import { type DomainErrorKind, DomainException } from '@/shared/domain';

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

class ProbeTransitionException extends DomainException {
  readonly code = 'PROBE_TRANSITION';
  readonly kind: DomainErrorKind = 'illegal-transition';

  constructor() {
    super('probe cannot move there');
  }
}

class ProbeDetailedException extends ApplicationException {
  readonly code = 'PROBE_DETAILED';
  readonly kind: ApplicationErrorKind = 'conflict';
  readonly details = [{ productId: 'p-1', reason: 'insufficient' }];

  constructor() {
    super('probe conflict with details');
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

  @Get('transition')
  transition(): never {
    throw new ProbeTransitionException();
  }

  @Get('detailed')
  detailed(): never {
    throw new ProbeDetailedException();
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

  it('maps an illegal transition to 409 with its code', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/transition')
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      code: 'PROBE_TRANSITION',
      message: 'probe cannot move there',
    });
  });

  it('emits details when an application exception carries them, and only then', async () => {
    const detailed = await request(app.getHttpServer())
      .get('/probe/detailed')
      .expect(409);
    const plain = await request(app.getHttpServer())
      .get('/probe/application')
      .expect(409);

    expect(detailed.body).toEqual({
      statusCode: 409,
      code: 'PROBE_DETAILED',
      message: 'probe conflict with details',
      details: [{ productId: 'p-1', reason: 'insufficient' }],
    });
    expect(Object.keys(plain.body as object)).not.toContain('details');
  });
});

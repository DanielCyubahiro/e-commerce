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
});

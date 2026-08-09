import { Inject, Injectable } from '@nestjs/common';
import { ProductRepository } from '../../application/ports/product.repository.port';
import { DRIZZLE } from '../../../shared/infrastructure/database/postgres/drizzle.provider';
import type { DrizzleDB } from '../../../shared/infrastructure/database/postgres/drizzle.provider';

@Injectable()
export class DrizzleProductRepository implements ProductRepository {
  constructor(@Inject(DRIZZLE) private readonly drizzle: DrizzleDB) {}
}

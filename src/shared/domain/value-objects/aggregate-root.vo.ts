import { AggregateRoot as CQRSAggregateRoot } from '@nestjs/cqrs';
export abstract class AggregateRoot extends CQRSAggregateRoot {}

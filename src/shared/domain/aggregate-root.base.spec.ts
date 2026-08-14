import { AggregateRoot } from './aggregate-root.base';
import { Entity } from './entity.base';
import { UniqueId } from './value-objects/unique-id.vo';

class ProbeId extends UniqueId<'ProbeId'> {
  static create(value?: string): ProbeId {
    return new ProbeId(this.parse(value));
  }
}

class ProbeAggregate extends AggregateRoot<ProbeId> {
  constructor(id: ProbeId) {
    super(id);
  }
}

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

describe('AggregateRoot', () => {
  it('is an Entity', () => {
    expect(new ProbeAggregate(ProbeId.create(UUID))).toBeInstanceOf(Entity);
  });

  it('inherits identity equality', () => {
    expect(
      new ProbeAggregate(ProbeId.create(UUID)).equals(
        new ProbeAggregate(ProbeId.create(UUID)),
      ),
    ).toBe(true);
  });

  it('carries no framework event machinery a domain method could shadow', () => {
    const aggregate = new ProbeAggregate(
      ProbeId.create(UUID),
    ) as unknown as Record<string, unknown>;

    for (const member of [
      'apply',
      'commit',
      'uncommit',
      'publish',
      'publishAll',
      'loadFromHistory',
      'getUncommittedEvents',
      'autoCommit',
    ]) {
      expect(aggregate[member]).toBeUndefined();
    }
  });
});

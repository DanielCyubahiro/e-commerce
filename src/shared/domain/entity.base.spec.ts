import { Entity } from './entity.base';
import { UniqueId } from './value-objects/unique-id.vo';

class ProbeId extends UniqueId<'ProbeId'> {
  static create(value?: string): ProbeId {
    return new ProbeId(this.parse(value));
  }
}

class ProbeEntity extends Entity<ProbeId> {
  constructor(id: ProbeId) {
    super(id);
  }
}

class OtherProbeEntity extends Entity<ProbeId> {
  constructor(id: ProbeId) {
    super(id);
  }
}

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

describe('Entity', () => {
  it('exposes its identifier', () => {
    const id = ProbeId.create(UUID);

    expect(new ProbeEntity(id).id).toBe(id);
  });

  it('is equal to another of the same type with the same id', () => {
    expect(
      new ProbeEntity(ProbeId.create(UUID)).equals(
        new ProbeEntity(ProbeId.create(UUID)),
      ),
    ).toBe(true);
  });

  it('is equal to itself', () => {
    const entity = new ProbeEntity(ProbeId.create(UUID));

    expect(entity.equals(entity)).toBe(true);
  });

  it('is not equal when the ids differ', () => {
    expect(
      new ProbeEntity(ProbeId.create(UUID)).equals(
        new ProbeEntity(ProbeId.create()),
      ),
    ).toBe(false);
  });

  it('is not equal across entity types sharing an id', () => {
    expect(
      new ProbeEntity(ProbeId.create(UUID)).equals(
        new OtherProbeEntity(ProbeId.create(UUID)),
      ),
    ).toBe(false);
  });

  it('is not equal to values that are not entities', () => {
    const entity = new ProbeEntity(ProbeId.create(UUID));

    expect(entity.equals(null)).toBe(false);
    expect(entity.equals(undefined)).toBe(false);
    expect(entity.equals({ id: UUID })).toBe(false);
  });
});

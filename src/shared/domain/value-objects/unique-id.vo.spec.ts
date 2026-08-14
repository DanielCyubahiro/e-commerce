import { catchError } from '@test/support/catch-error';
import { InvalidIdentifierException } from '../exceptions/invalid-identifier.exception';
import { UniqueId } from './unique-id.vo';

class ProbeId extends UniqueId<'ProbeId'> {
  static create(value?: string): ProbeId {
    return new ProbeId(this.parse(value));
  }
}

class OtherProbeId extends UniqueId<'OtherProbeId'> {
  static create(value?: string): OtherProbeId {
    return new OtherProbeId(this.parse(value));
  }
}

const UUID = '3F2504E0-4F89-11D3-9A0C-0305E82C3301';

describe('UniqueId', () => {
  it('generates a uuid when given no value', () => {
    expect(ProbeId.create().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('generates a different value each time', () => {
    expect(ProbeId.create().value).not.toBe(ProbeId.create().value);
  });

  it('trims and lowercases a supplied value', () => {
    expect(ProbeId.create(`  ${UUID}  `).value).toBe(UUID.toLowerCase());
  });

  it('rejects values that are not uuids', () => {
    for (const invalid of ['nope', '', '   ', '3f2504e0-4f89-11d3-9a0c']) {
      expect(
        catchError(() => ProbeId.create(invalid), InvalidIdentifierException)
          .code,
      ).toBe('IDENTIFIER_INVALID');
    }
  });

  it('rejects one id type where another belongs, at compile time', () => {
    const probe = ProbeId.create(UUID);

    // @ts-expect-error the phantom brand must keep structurally identical id
    // types unassignable. If this line ever compiles, the brand has stopped
    // working and tsc fails here for the unused directive.
    const other: OtherProbeId = probe;

    expect(other.value).toBe(probe.value);
  });

  describe('equals', () => {
    it('is true for the same type and value', () => {
      expect(ProbeId.create(UUID).equals(ProbeId.create(UUID))).toBe(true);
    });

    it('is true regardless of the case supplied', () => {
      expect(
        ProbeId.create(UUID).equals(ProbeId.create(UUID.toLowerCase())),
      ).toBe(true);
    });

    it('is false for a different value', () => {
      expect(ProbeId.create(UUID).equals(ProbeId.create())).toBe(false);
    });

    it('is false across id types holding the same value', () => {
      expect(ProbeId.create(UUID).equals(OtherProbeId.create(UUID))).toBe(
        false,
      );
    });

    it('is false for values that are not identifiers', () => {
      const id = ProbeId.create(UUID);

      expect(id.equals(UUID)).toBe(false);
      expect(id.equals(null)).toBe(false);
      expect(id.equals(undefined)).toBe(false);
      expect(id.equals({ value: UUID })).toBe(false);
    });
  });
});

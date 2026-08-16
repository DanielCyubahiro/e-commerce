import { readAdrIndex } from './docs-model';

const { files, indexed } = readAdrIndex();

describe('ADR index', () => {
  it('indexes every ADR on disk', () => {
    expect(files.filter((file) => !indexed.includes(file))).toEqual([]);
  });

  it('links no ADR that does not exist', () => {
    expect(indexed.filter((entry) => !files.includes(entry))).toEqual([]);
  });
});

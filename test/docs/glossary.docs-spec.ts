import { readDocsModel, readGlossary } from './docs-model';

const contexts = readDocsModel().contexts;
const glossary = readGlossary();

describe('glossary', () => {
  it('has entries', () => {
    expect(glossary.length).toBeGreaterThan(0);
  });

  it.each(contexts)('every entry covers the %s context', (context) => {
    const missing = glossary
      .filter((entry) => !entry.isRepoWideRule)
      .filter((entry) => !entry.locations.includes(context))
      .map((entry) => entry.term);

    expect(missing).toEqual([]);
  });

  it('every entry has an instance table or the repo-wide-rule marker', () => {
    const neither = glossary
      .filter((entry) => !entry.isRepoWideRule && entry.locations.length === 0)
      .map((entry) => entry.term);

    expect(neither).toEqual([]);
  });

  it('no entry has both a table and the marker', () => {
    const both = glossary
      .filter((entry) => entry.isRepoWideRule && entry.locations.length > 0)
      .map((entry) => entry.term);

    expect(both).toEqual([]);
  });
});

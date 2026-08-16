import { CONTEXT_PAGE_HEADINGS, readDocsModel } from './docs-model';

const model = readDocsModel();
const pagePath = (context: string) => `docs/contexts/${context}.md`;
const contextPages = model.pages.filter((page) =>
  page.path.startsWith('docs/contexts/'),
);

describe('context pages', () => {
  it('every bounded context has a page', () => {
    const missing = model.contexts.filter(
      (context) => !model.pages.some((page) => page.path === pagePath(context)),
    );

    expect(missing).toEqual([]);
  });

  it('every page belongs to a bounded context', () => {
    const orphaned = contextPages
      .map((page) => page.path)
      .filter(
        (path) => !model.contexts.some((context) => pagePath(context) === path),
      );

    expect(orphaned).toEqual([]);
  });

  it.each(CONTEXT_PAGE_HEADINGS)('every page carries %s', (heading) => {
    const missing = contextPages
      .filter((page) => !page.headings.includes(heading))
      .map((page) => page.path);

    expect(missing).toEqual([]);
  });
});

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

  it('every page carries the required headings in order', () => {
    // Extra headings are legal anywhere; filtering the page's own heading
    // list down to the required set and comparing that subsequence against
    // CONTEXT_PAGE_HEADINGS checks position, not just presence.
    const required: readonly string[] = CONTEXT_PAGE_HEADINGS;

    const misordered = contextPages
      .map((page) => ({
        path: page.path,
        order: page.headings.filter((heading) => required.includes(heading)),
      }))
      .filter(
        ({ order }) => JSON.stringify(order) !== JSON.stringify(required),
      );

    expect(misordered).toEqual([]);
  });
});

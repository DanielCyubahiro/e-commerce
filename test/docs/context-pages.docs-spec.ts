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
    // Extra headings are legal anywhere; filtering each page's own heading
    // list down to the required set and diffing that against
    // CONTEXT_PAGE_HEADINGS checks position, not just presence. Diffing full
    // actual/expected objects, rather than collecting only the pages that
    // fail into a `misordered` array, is what makes Jest's failure output
    // name the expected order instead of printing it against `Expected: []`.
    const required: readonly string[] = CONTEXT_PAGE_HEADINGS;

    const actual = contextPages.map((page) => ({
      path: page.path,
      headings: page.headings.filter((heading) => required.includes(heading)),
    }));
    const expected = contextPages.map((page) => ({
      path: page.path,
      headings: [...required],
    }));

    expect(actual).toEqual(expected);
  });

  it('every context is linked from README', () => {
    const readmeLinks = model.links
      .filter((link) => link.file === 'README.md')
      .map((link) => link.targetPath);

    const missing = model.contexts.filter(
      (context) => !readmeLinks.includes(pagePath(context)),
    );

    expect(missing).toEqual([]);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readDocsModel, slugify, REPO_ROOT } from './docs-model';

const model = readDocsModel();
const describeLink = (link: {
  file: string;
  line: number;
  text: string;
  target: string;
}) => `${link.file}:${link.line} [${link.text}](${link.target})`;

describe('doc links', () => {
  it('every link target exists', () => {
    const broken = model.links
      .filter((link) => !existsSync(join(REPO_ROOT, link.targetPath)))
      .map(describeLink);

    expect(broken).toEqual([]);
  });

  it('every heading anchor resolves to a real heading', () => {
    const headingsByPath = new Map(
      model.pages.map((page) => [page.path, page.headings.map(slugify)]),
    );

    const broken = model.links
      .filter(
        (link) => link.anchor !== '' && headingsByPath.has(link.targetPath),
      )
      .filter((link) => {
        const headings = headingsByPath.get(link.targetPath);
        return headings !== undefined && !headings.includes(link.anchor);
      })
      .map(describeLink);

    expect(broken).toEqual([]);
  });

  it('carries no line anchors', () => {
    const anchored = model.links
      .filter((link) => /^L\d+/.test(link.anchor))
      .map(describeLink);

    expect(anchored).toEqual([]);
  });

  it('every link into source names a symbol that file contains', () => {
    // Link text that is just the filename is covered by the existence test
    // above. Anything else is read as a symbol: the last dotted segment, so
    // `Sku.MAX_LENGTH` requires `MAX_LENGTH` and `Product.create` requires
    // `create`. Catches renames, which is what makes a link wrong.
    const missing = model.links
      .filter((link) => link.targetPath.endsWith('.ts'))
      .filter((link) => link.text !== link.targetPath.split('/').pop())
      .filter((link) => {
        const segments = link.text.split('.');
        const symbol = (segments[segments.length - 1] ?? link.text).trim();
        return !readFileSync(join(REPO_ROOT, link.targetPath), 'utf8').includes(
          symbol,
        );
      })
      .map(describeLink);

    expect(missing).toEqual([]);
  });
});

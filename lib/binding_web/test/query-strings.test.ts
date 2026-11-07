import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Language, Parser, Query } from '../src';

let language: Language;
let parser: Parser;

beforeAll(async () => {
  await Parser.init();
  language = await Language.load('../../test/highlight-compat/vendor/baselines/tree-sitter-javascript/tree-sitter-javascript.wasm');
  parser = new Parser();
  parser.setLanguage(language);
});

afterAll(() => {
  parser.delete();
});

describe('query string values', () => {
  it('preserves counted operands in public predicates', () => {
    const values = ['', '\0.', '\0*', '\0.', 'a\0b', 'hé😀'];
    const query = new Query(language, `((identifier) @id (#probe! ${values.map(value => `"${value}"`).join(' ')}))`);
    try {
      expect(query.predicatesForPattern(0)).toEqual([{
        operator: 'probe!',
        operands: values.map(value => ({ type: 'string', value })),
      }]);
    } finally {
      query.delete();
    }
  });

  it.each(['eq?', 'any-of?'])('uses complete strings for %s', operator => {
    const tree = parser.parse('alpha; beta;')!;
    const query = new Query(language, `((identifier) @id (#${operator} @id "alpha\0suffix"))
      ((identifier) @id (#${operator} @id "beta"))`);
    try {
      expect(query.matches(tree.rootNode).map(match => match.captures[0].node.text)).toEqual(['beta']);
    } finally {
      query.delete();
      tree.delete();
    }
  });
});

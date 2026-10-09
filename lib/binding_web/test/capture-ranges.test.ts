import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Language, Parser, Query, type QueryOptions } from '../src';
import helper from './helper';

let JavaScript: Language;
const dispose: (() => void)[] = [];
beforeAll(async () => { ({ JavaScript } = await helper); });
afterEach(() => { for (const release of dispose.splice(0).reverse()) release(); });

function fixture() {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  dispose.push(() => { parser.delete(); });
  const tree = parser.parse('const alpha = "🎉";\nlet beta = alpha;\n')!;
  dispose.push(() => { tree.delete(); });
  const query = new Query(JavaScript, `
    ((identifier) @equal (#eq? @equal "alpha") (#set! role "local"))
    (lexical_declaration (variable_declarator name: (identifier) @name value: (_) @value))
    ((identifier) @member (#any-of? @member "alpha" "beta"))
    ((identifier) @regex (#match? @regex "^alpha$"))
    ((identifier) @reject (#not-eq? @reject "alpha"))
    ((identifier) @property (#is? local) (#is-not? global))
  `);
  dispose.push(() => { query.delete(); });
  return { parser, tree, query };
}

function expected(query: Query, tree: ReturnType<typeof fixture>['tree'], options: QueryOptions) {
  return query.matches(tree.rootNode, options).flatMap(match => match.captures.map(capture => ({
    patternIndex: match.patternIndex,
    name: capture.name,
    startIndex: capture.node.startIndex,
    endIndex: capture.node.endIndex,
    setProperties: match.setProperties,
    assertedProperties: match.assertedProperties,
    refutedProperties: match.refutedProperties,
  })));
}

describe('capture ranges', () => {
  it.each([
    {},
    { startIndex: 20, endIndex: 36 },
    { startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 17 } },
    { matchLimit: 1 },
    { startContainingIndex: 0, endContainingIndex: 19 },
    { startContainingPosition: { row: 0, column: 0 }, endContainingPosition: { row: 1, column: 0 } },
    { maxStartDepth: 0 },
    { maxStartDepth: 1 },
  ] as QueryOptions[])('matches flattened node captures and properties for %j', options => {
    const { tree, query } = fixture();
    const wanted = expected(query, tree, options);
    const exceeded = query.didExceedMatchLimit();
    expect(query.captureRanges(tree.rootNode, options)).toEqual(wanted);
    expect(query.didExceedMatchLimit()).toBe(exceeded);
    expect(query.captureRanges(tree.rootNode, options)).toEqual(wanted);
  });

  it('keeps complete match predicates and subsequent node queries intact', () => {
    const { tree, query } = fixture();
    const first = query.captureRanges(tree.rootNode);
    expect(first.length).toBeGreaterThan(0);
    expect(query.matches(tree.rootNode).flatMap(match => match.captures).map(capture => capture.node.text))
      .toContain('"🎉"');
    expect(query.captureRanges(tree.rootNode)).toEqual(first);
  });
});


describe('predicate-free native ranges', () => {
  it.each([
    ['JSON', '{"a":["🎉",1],"b":true}'],
    ['HTML', '<p>🎉<span>hello</span></p>'],
    ['C', 'int main(void) { return 42; }'],
    ['Python', 'alpha = "🎉"\nprint(alpha)\n'],
  ] as const)('preserves all named-node ranges for %s', async (language, source) => {
    const parser = new Parser();
    parser.setLanguage((await helper)[language]);
    dispose.push(() => { parser.delete(); });
    const tree = parser.parse(source)!;
    dispose.push(() => { tree.delete(); });
    const query = new Query((await helper)[language], '(_) @node');
    dispose.push(() => { query.delete(); });
    expect(query.captureRanges(tree.rootNode)).toEqual(expected(query, tree, {}));
    query.disableCapture('node');
    expect(query.captureRanges(tree.rootNode)).toEqual([]);
  });
});


it('recovers after a text callback throws during a predicate', () => {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  dispose.push(() => { parser.delete(); });
  const source = 'const alpha = "🎉";';
  let failRead = false;
  const tree = parser.parse((index, _position, endIndex) => {
    if (failRead) throw new TypeError('intentional source read failure');
    return source.slice(index, endIndex);
  })!;
  dispose.push(() => { tree.delete(); });
  const query = new Query(JavaScript, '((identifier) @name (#eq? @name "alpha"))');
  dispose.push(() => { query.delete(); });
  const wanted = expected(query, tree, {});
  failRead = true;
  expect(() => query.captureRanges(tree.rootNode, { progressCallback: () => false }))
    .toThrow('intentional source read failure');
  failRead = false;
  expect(query.captureRanges(tree.rootNode)).toEqual(wanted);
  expect(query.matches(tree.rootNode).length).toBe(1);
});


it('evaluates grouped and repeated capture predicates before flattening', () => {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  dispose.push(() => { parser.delete(); });
  const tree = parser.parse('alpha + alpha; alpha + beta; [alpha, beta]; [beta, beta];')!;
  dispose.push(() => { tree.delete(); });
  const query = new Query(JavaScript, `
    ((binary_expression left: (identifier) @left right: (identifier) @right)
      (#eq? @left @right))
    ((array (identifier) @member (identifier) @member) (#any-eq? @member "alpha"))
  `);
  dispose.push(() => { query.delete(); });
  const ranges = query.captureRanges(tree.rootNode);
  expect(ranges).toEqual(expected(query, tree, {}));
  expect(ranges.map(capture => capture.name)).toEqual(['left', 'right', 'member', 'member']);
});

it.each([
  { startIndex: 10, endIndex: 1 },
  { startPosition: { row: 1, column: 0 }, endPosition: { row: 0, column: 1 } },
  { startContainingIndex: 10, endContainingIndex: 1 },
  { startContainingPosition: { row: 1, column: 0 }, endContainingPosition: { row: 0, column: 1 } },
])('validates query bounds and recovers for %j', options => {
  const { tree, query } = fixture();
  expect(() => query.captureRanges(tree.rootNode, options)).toThrow();
  expect(query.captureRanges(tree.rootNode)).toEqual(expected(query, tree, {}));
});

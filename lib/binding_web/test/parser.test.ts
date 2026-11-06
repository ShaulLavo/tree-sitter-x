import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import helper, { type LanguageName } from './helper';
import type { ParseState, Tree, Range } from '../src';
import { Parser, Language, TextBuffer } from '../src';
import { C } from '../src/constants';

function includedRange(startIndex: number, endIndex: number): Range {
  return { startIndex, endIndex, startPosition: { row: 0, column: startIndex }, endPosition: { row: 0, column: endIndex } };
}

const invalidRanges: Range[][] = [
  [includedRange(3, 1)],
  [includedRange(0, 3), includedRange(2, 4)],
  [includedRange(2, 3), includedRange(0, 1)],
].concat([NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, 0x80000000].flatMap(value => [
    [{ ...includedRange(0, 4), startIndex: value }],
    [{ ...includedRange(0, 4), endIndex: value }],
    [{ ...includedRange(0, 4), startPosition: { row: 0, column: value } }],
    [{ ...includedRange(0, 4), endPosition: { row: 0, column: value } }],
  ]), [NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, 0x100000000].flatMap(value => [
    [{ ...includedRange(0, 4), startPosition: { row: value, column: 0 } }],
    [{ ...includedRange(0, 4), endPosition: { row: value, column: 4 } }],
  ]), [
  [{ ...includedRange(0, 4), startPosition: { row: 2, column: 0 }, endPosition: { row: 1, column: 4 } }],
  [{ ...includedRange(0, 4), startPosition: { row: 1, column: 5 }, endPosition: { row: 1, column: 4 } }],
]);

function assertRejectedRanges(parser: Parser, input: Parameters<Parser['parse']>[0], previousRanges: Range[]) {
  for (const includedRanges of invalidRanges) {
    expect(() => parser.parse(input, null, { includedRanges })?.delete()).toThrow(RangeError);
    expect(parser.getIncludedRanges()).toEqual(previousRanges);
  }
}

function parseSelectedRange(parser: Parser, input: Parameters<Parser['parse']>[0], includedRanges: Range[]) {
  const tree = parser.parse(input, null, { includedRanges })!;
  try {
    expect(tree.rootNode.text).toBe('水;');
  } finally {
    tree.delete();
  }
}

let JavaScript: Language;
let HTML: Language;
let JSON: Language;
let languageURL: (name: LanguageName) => string;

describe('Parser', () => {
  let parser: Parser;

  beforeAll(async () => {
    ({ JavaScript, HTML, JSON, languageURL } = await helper);
  });

  beforeEach(() => {
    parser = new Parser();
  });

  afterEach(() => {
    parser.delete();
  });

  it.each((['string', 'callback', 'buffer'] as const).flatMap(kind => [
    { kind, selected: false }, { kind, selected: true },
  ]))('rejects invalid included ranges atomically for $kind input, selected=$selected', ({ kind, selected }) => {
    parser.setLanguage(JavaScript);
    const text = 'a;水;';
    const buffer = kind === 'buffer' ? new TextBuffer(text) : null;
    const input = buffer ?? (kind === 'callback' ? (index: number) => text.slice(index) : text);
    const initial = parser.getIncludedRanges();
    const valid = [includedRange(2, 4)];
    const previousParse = C.currentParseCallback;
    const previousLog = C.currentLogCallback;
    const previousProgress = C.currentProgressCallback;
    const parseCallback = () => 'previous';
    const logCallback = () => {};
    const progressCallback = () => {};
    const calloc = vi.spyOn(C, '_calloc');
    C.currentParseCallback = parseCallback;
    C.currentLogCallback = logCallback;
    C.currentProgressCallback = progressCallback;
    try {
      if (selected) parseSelectedRange(parser, input, valid);
      calloc.mockClear();
      assertRejectedRanges(parser, input, selected ? valid : initial);
      expect(calloc).not.toHaveBeenCalled();
      expect(C.currentParseCallback).toBe(parseCallback);
      expect(C.currentLogCallback).toBe(logCallback);
      expect(C.currentProgressCallback).toBe(progressCallback);
      const recovered = parser.parse(input)!;
      expect(recovered.rootNode.text).toBe(text);
      recovered.delete();
    } finally {
      calloc.mockRestore();
      C.currentParseCallback = previousParse;
      C.currentLogCallback = previousLog;
      C.currentProgressCallback = previousProgress;
      buffer?.delete();
    }
  });

  describe('.setLanguage', () => {
    it('allows setting the language to null', () => {
      expect(parser.language).toBeNull();
      parser.setLanguage(JavaScript);
      expect(parser.language).toBe(JavaScript);
      parser.setLanguage(null);
      expect(parser.language).toBeNull();
    });

    it('throws an exception when the given object is not a tree-sitter language', () => {
      // @ts-expect-error Testing invalid arguments
      expect(() => { parser.setLanguage({}); }).toThrow(/Argument must be a Language/);
      // @ts-expect-error Testing invalid arguments
      expect(() => { parser.setLanguage(1); }).toThrow(/Argument must be a Language/);
    });
  });

  describe('.setLogger', () => {
    beforeEach(() => {
      parser.setLanguage(JavaScript);
    });

    it('calls the given callback for each parse event', () => {
      const debugMessages: string[] = [];
      parser.setLogger((message) => debugMessages.push(message));
      parser.parse('a + b + c')!;
      expect(debugMessages).toEqual(expect.arrayContaining([
        'skip character:\' \'',
        'consume character:\'b\'',
        'reduce sym:program, child_count:1',
        'accept'
      ]));
    });

    it('allows the callback to be retrieved later', () => {
      const callback = () => { return; };
      parser.setLogger(callback);
      expect(parser.getLogger()).toBe(callback);
      parser.setLogger(false);
      expect(parser.getLogger()).toBeNull();
    });

    it('disables debugging when given a falsy value', () => {
      const debugMessages: string[] = [];
      parser.setLogger((message) => debugMessages.push(message));
      parser.setLogger(false);
      parser.parse('a + b * c')!;
      expect(debugMessages).toHaveLength(0);
    });

    it('throws an error when given a truthy value that isn\'t a function', () => {
      // @ts-expect-error Testing invalid arguments
      expect(() => { parser.setLogger('5'); }).toThrow('Logger callback must be a function');
    });

    it('rethrows errors thrown by the logging callback', () => {
      const error = new Error('The error message');
      parser.setLogger(() => {
        throw error;
      });
      expect(() => parser.parse('ok;')).toThrow('The error message');
    });
  });

  describe('one included range', () => {
    it('parses the text within a range', () => {
      parser.setLanguage(HTML);
      const sourceCode = '<span>hi</span><script>console.log(\'sup\');</script>';
      const htmlTree = parser.parse(sourceCode)!;
      const scriptContentNode = htmlTree.rootNode.child(1)!.child(1)!;
      expect(scriptContentNode.type).toBe('raw_text');

      parser.setLanguage(JavaScript);
      expect(parser.getIncludedRanges()).toEqual([{
        startIndex: 0,
        endIndex: 2147483647,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 4294967295, column: 2147483647 }
      }]);

      const ranges = [{
        startIndex: scriptContentNode.startIndex,
        endIndex: scriptContentNode.endIndex,
        startPosition: scriptContentNode.startPosition,
        endPosition: scriptContentNode.endPosition,
      }];

      const jsTree = parser.parse(
        sourceCode,
        null,
        { includedRanges: ranges }
      )!;
      expect(parser.getIncludedRanges()).toEqual(ranges);

      expect(jsTree.rootNode.toString()).toBe(
        '(program (expression_statement (call_expression ' +
        'function: (member_expression object: (identifier) property: (property_identifier)) ' +
        'arguments: (arguments (string (string_fragment))))))'
      );
      expect(jsTree.rootNode.startPosition).toEqual({ row: 0, column: sourceCode.indexOf('console') });
    });
  });

  describe('multiple included ranges', () => {
    it('parses the text within multiple ranges', () => {
      parser.setLanguage(JavaScript);
      const sourceCode = 'html `<div>Hello, ${name.toUpperCase()}, it\'s <b>${now()}</b>.</div>`';
      const jsTree = parser.parse(sourceCode)!;
      const templateStringNode = jsTree.rootNode.descendantForIndex(
        sourceCode.indexOf('`<'),
        sourceCode.indexOf('>`')
      )!;
      expect(templateStringNode.type).toBe('template_string');

      const openQuoteNode = templateStringNode.child(0)!;
      const interpolationNode1 = templateStringNode.child(2)!;
      const interpolationNode2 = templateStringNode.child(4)!;
      const closeQuoteNode = templateStringNode.child(6)!;

      parser.setLanguage(HTML);
      const htmlRanges = [
        {
          startIndex: openQuoteNode.endIndex,
          startPosition: openQuoteNode.endPosition,
          endIndex: interpolationNode1.startIndex,
          endPosition: interpolationNode1.startPosition,
        },
        {
          startIndex: interpolationNode1.endIndex,
          startPosition: interpolationNode1.endPosition,
          endIndex: interpolationNode2.startIndex,
          endPosition: interpolationNode2.startPosition,
        },
        {
          startIndex: interpolationNode2.endIndex,
          startPosition: interpolationNode2.endPosition,
          endIndex: closeQuoteNode.startIndex,
          endPosition: closeQuoteNode.startPosition,
        },
      ];

      const htmlTree = parser.parse(sourceCode, null, { includedRanges: htmlRanges })!;

      expect(htmlTree.rootNode.toString()).toBe(
        '(document (element' +
        ' (start_tag (tag_name))' +
        ' (text)' +
        ' (element (start_tag (tag_name)) (end_tag (tag_name)))' +
        ' (text)' +
        ' (end_tag (tag_name))))'
      );
      expect(htmlTree.getIncludedRanges()).toEqual(htmlRanges);

      const divElementNode = htmlTree.rootNode.child(0)!;
      const helloTextNode = divElementNode.child(1)!;
      const bElementNode = divElementNode.child(2)!;
      const bStartTagNode = bElementNode.child(0)!;
      const bEndTagNode = bElementNode.child(1)!;

      expect(helloTextNode.type).toBe('text');
      expect(helloTextNode.startIndex).toBe(sourceCode.indexOf('Hello'));
      expect(helloTextNode.endIndex).toBe(sourceCode.indexOf(' <b>'));

      expect(bStartTagNode.type).toBe('start_tag');
      expect(bStartTagNode.startIndex).toBe(sourceCode.indexOf('<b>'));
      expect(bStartTagNode.endIndex).toBe(sourceCode.indexOf('${now()}'));

      expect(bEndTagNode.type).toBe('end_tag');
      expect(bEndTagNode.startIndex).toBe(sourceCode.indexOf('</b>'));
      expect(bEndTagNode.endIndex).toBe(sourceCode.indexOf('.</div>'));
    });
  });

  describe('an included range containing mismatched positions', () => {
    it('parses the text within the range', () => {
      const sourceCode = '<div>test</div>{_ignore_this_part_}';

      parser.setLanguage(HTML);

      const endIndex = sourceCode.indexOf('{_ignore_this_part_');

      const rangeToParse = {
        startIndex: 0,
        startPosition: { row: 10, column: 12 },
        endIndex,
        endPosition: { row: 10, column: 12 + endIndex },
      };

      const htmlTree = parser.parse(sourceCode, null, { includedRanges: [rangeToParse] })!;

      expect(htmlTree.getIncludedRanges()[0]).toEqual(rangeToParse);

      expect(htmlTree.rootNode.toString()).toBe(
        '(document (element (start_tag (tag_name)) (text) (end_tag (tag_name))))'
      );
    });
  });

  describe('.parse', () => {
    let tree: Tree | null;

    beforeEach(() => {
      tree = null;
      parser.setLanguage(JavaScript);
    });

    afterEach(() => {
      if (tree) tree.delete();
    });

    it('reads from the given input', () => {
      const parts = ['first', '_', 'second', '_', 'third'];
      tree = parser.parse(() => parts.shift())!;
      expect(tree.rootNode.toString()).toBe('(program (expression_statement (identifier)))');
    });

    it('stops reading when the input callback returns something that\'s not a string', () => {
      const parts = ['abc', 'def', 'ghi', {}, {}, {}, 'second-word', ' '];
      tree = parser.parse(() => parts.shift() as string)!;
      expect(tree.rootNode.toString()).toBe('(program (expression_statement (identifier)))');
      expect(tree.rootNode.endIndex).toBe(9);
      expect(parts).toHaveLength(2);
    });

    it('throws an exception when the given input is not a function', () => {
      // @ts-expect-error Testing invalid arguments
      expect(() => parser.parse(null)).toThrow('Argument must be a string or a function');
      // @ts-expect-error Testing invalid arguments
      expect(() => parser.parse(5)).toThrow('Argument must be a string or a function');
      // @ts-expect-error Testing invalid arguments
      expect(() => parser.parse({})).toThrow('Argument must be a string or a function');
    });

    it('handles long input strings', { timeout: 10000 }, () => {
      const repeatCount = 10000;
      const inputString = `[${Array(repeatCount).fill('0').join(',')}]`;

      tree = parser.parse(inputString)!;
      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.firstChild!.firstChild!.namedChildCount).toBe(repeatCount);
    });

    it('can use the bash parser', { timeout: 5000 }, async () => {
      parser.setLanguage(await Language.load(languageURL('bash')));
      tree = parser.parse('FOO=bar echo <<EOF 2> err.txt > hello.txt \nhello${FOO}\nEOF')!;
      expect(tree.rootNode.toString()).toBe(
        '(program ' +
        '(redirected_statement ' +
        'body: (command ' +
        '(variable_assignment name: (variable_name) value: (word)) ' +
        'name: (command_name (word))) ' +
        'redirect: (heredoc_redirect (heredoc_start) ' +
        'redirect: (file_redirect descriptor: (file_descriptor) destination: (word)) ' +
        'redirect: (file_redirect destination: (word)) ' +
        '(heredoc_body ' +
        '(expansion (variable_name)) (heredoc_content)) (heredoc_end))))'
      );
    });

    it('can use the c++ parser', { timeout: 5000 }, async () => {
      parser.setLanguage(await Language.load(languageURL('cpp')));
      tree = parser.parse('const char *s = R"EOF(HELLO WORLD)EOF";')!;
      expect(tree.rootNode.toString()).toBe(
        '(translation_unit (declaration ' +
        '(type_qualifier) ' +
        'type: (primitive_type) ' +
        'declarator: (init_declarator ' +
        'declarator: (pointer_declarator declarator: (identifier)) ' +
        'value: (raw_string_literal delimiter: (raw_string_delimiter) (raw_string_content) (raw_string_delimiter)))))'
      );
    });

    it('can use the HTML parser', { timeout: 5000 }, async () => {
      parser.setLanguage(await Language.load(languageURL('html')));
      tree = parser.parse('<div><span><custom></custom></span></div>')!;
      expect(tree.rootNode.toString()).toBe(
        '(document (element (start_tag (tag_name)) (element (start_tag (tag_name)) ' +
        '(element (start_tag (tag_name)) (end_tag (tag_name))) (end_tag (tag_name))) (end_tag (tag_name))))'
      );
    });

    it('can use the python parser', { timeout: 5000 }, async () => {
      parser.setLanguage(await Language.load(languageURL('python')));
      tree = parser.parse('class A:\n  def b():\n    c()')!;
      expect(tree.rootNode.toString()).toBe(
        '(module (class_definition ' +
        'name: (identifier) ' +
        'body: (block ' +
        '(function_definition ' +
        'name: (identifier) ' +
        'parameters: (parameters) ' +
        'body: (block (expression_statement (call ' +
        'function: (identifier) ' +
        'arguments: (argument_list))))))))'
      );
    });

    it('can use the rust parser', { timeout: 5000 }, async () => {
      parser.setLanguage(await Language.load(languageURL('rust')));
      tree = parser.parse('const x: &\'static str = r###"hello"###;')!;
      expect(tree.rootNode.toString()).toBe(
        '(source_file (const_item ' +
        'name: (identifier) ' +
        'type: (reference_type (lifetime (identifier)) type: (primitive_type)) ' +
        'value: (raw_string_literal (string_content))))'
      );
    });

    it('can use the typescript parser', { timeout: 5000 }, async () => {
      parser.setLanguage(await Language.load(languageURL('typescript')));
      tree = parser.parse('a()\nb()\n[c]')!;
      expect(tree.rootNode.toString()).toBe(
        '(program ' +
        '(expression_statement (call_expression function: (identifier) arguments: (arguments))) ' +
        '(expression_statement (subscript_expression ' +
        'object: (call_expression ' +
        'function: (identifier) ' +
        'arguments: (arguments)) ' +
        'index: (identifier))))'
      );
    });

    it('can use the tsx parser', { timeout: 5000 }, async () => {
      parser.setLanguage(await Language.load(languageURL('tsx')));
      tree = parser.parse('a()\nb()\n[c]')!;
      expect(tree.rootNode.toString()).toBe(
        '(program ' +
        '(expression_statement (call_expression function: (identifier) arguments: (arguments))) ' +
        '(expression_statement (subscript_expression ' +
        'object: (call_expression ' +
        'function: (identifier) ' +
        'arguments: (arguments)) ' +
        'index: (identifier))))',

      );
    });

    it('parses only the text within the `includedRanges` if they are specified', () => {
      const sourceCode = '<% foo() %> <% bar %>';

      const start1 = sourceCode.indexOf('foo');
      const end1 = start1 + 5;
      const start2 = sourceCode.indexOf('bar');
      const end2 = start2 + 3;

      const tree = parser.parse(sourceCode, null, {
        includedRanges: [
          {
            startIndex: start1,
            endIndex: end1,
            startPosition: { row: 0, column: start1 },
            endPosition: { row: 0, column: end1 },
          },
          {
            startIndex: start2,
            endIndex: end2,
            startPosition: { row: 0, column: start2 },
            endPosition: { row: 0, column: end2 },
          },
        ],
      })!;

      expect(tree.rootNode.toString()).toBe(
        '(program ' +
        '(expression_statement (call_expression function: (identifier) arguments: (arguments))) ' +
        '(expression_statement (identifier)))'
      );
    });

    it('parses with a timeout', { timeout: 5000 }, () => {
      parser.setLanguage(JSON);

      const startTime = performance.now();
      let currentByteOffset = 0;
      const progressCallback = (state: ParseState) => {
        expect(state.currentOffset).toBeGreaterThanOrEqual(currentByteOffset);
        currentByteOffset = state.currentOffset;

        if (performance.now() - startTime > 1) {
          return true;
        }
        return false;
      };

      expect(parser.parse(
        (offset) => offset === 0 ? '[' : ',0',
        null,
        { progressCallback },
      )).toBeNull();
    });

    it('times out when an error is detected', { timeout: 5000 }, () => {
      parser.setLanguage(JSON);

      let offset = 0;
      const erroneousCode = '!,';
      const progressCallback = (state: ParseState) => {
        offset = state.currentOffset;
        return state.hasError;
      };

      const tree = parser.parse(
        (offset) => {
          if (offset === 0) return '[';
          if (offset >= 1 && offset < 1000) return '0,';
          return erroneousCode;
        },
        null,
        { progressCallback },
      );

      // The callback is called at the end of parsing, however, what we're asserting here is that
      // parsing ends immediately as the error is detected. This is verified by checking the offset
      // of the last byte processed is the length of the erroneous code we inserted, aka, 1002, or
      // 1000 + the length of the erroneous code. Note that in this Wasm test, we multiply the offset
      // by 2 because JavaScript strings are UTF-16 encoded.
      expect(offset).toBe((1000 + erroneousCode.length) * 2);
      expect(tree).toBeNull();
    });
  });
});

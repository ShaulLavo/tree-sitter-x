import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adaptVscode } from '../src/fixtures/vscode.ts'
import { adaptTypescript } from '../src/fixtures/typescript.ts'
import { adaptTmgrammar } from '../src/fixtures/tmgrammar.ts'
import { adaptTreeSitter } from '../src/fixtures/tree-sitter.ts'
import { originalRange, physicalLines } from '../src/fixtures/source-map.ts'
import { fixtureArtifacts, fixtures } from '../src/fixtures/registry.ts'
import { harnessRoot } from '../src/fixtures/manifest.ts'

const text = (path: string) => readFileSync(new URL(path, harnessRoot), 'utf8')
const fixtureId = 'synthetic'
const file = 'assertions'

describe('VS Code capture conversion', () => {
  it('maps every real token to the same exact characters and records the annotation location', () => {
    const captures = fixtureArtifacts.filter(artifact => artifact.format === 'vscode-colorize')
    expect(captures).toHaveLength(5)
    for (const artifact of captures) {
      const fixture = fixtures.find(fixture => fixture.id === artifact.sourceFixtureId)!
      const source = text(fixture.path), json = text(artifact.path)
      const tokens = JSON.parse(json) as { c: string; t: string }[]
      const converted = adaptVscode(source, json, fixture.id, artifact.path)
      expect(converted).toHaveLength(tokens.length)
      converted.forEach((expectation, i) => {
        expect(source.slice(expectation.from, expectation.to)).toBe(tokens[i].c)
        expect(expectation.scopes).toEqual(tokens[i].t.split(' '))
        expect(physicalLines(json)[expectation.origin.line - 1].text).toContain('"c"')
      })
    }
  })

  it('preserves BOM, CRLF, lone CR, blank lines, tabs, astral UTF-16 length, and last column', () => {
    const source = '﻿a\r\n\r\n\t😀z\rlast'
    const json = JSON.stringify([{ c: '﻿a', t: 'source' }, { c: '\t😀', t: 'source string' }, { c: 'z', t: 'source' }, { c: 'last', t: 'source' }])
    const converted = adaptVscode(source, json, fixtureId, file)
    expect(converted.map(({ from, to }) => [from, to])).toEqual([[0, 2], [6, 9], [9, 10], [11, 15]])
    expect(converted.map(({ from, to }) => source.slice(from, to))).toEqual(['﻿a', '\t😀', 'z', 'last'])
  })

  it('does not find repeated text elsewhere or accept missing, empty, and cross-line tokens', () => {
    for (const tokens of [[{ c: 'a', t: 'scope' }], [{ c: 'b', t: 'scope' }], [{ c: '', t: 'scope' }], [{ c: 'ab', t: 'scope' }]]) {
      expect(() => adaptVscode('a\nb', JSON.stringify(tokens), fixtureId, file)).toThrow()
    }
    expect(adaptVscode('', '[]', fixtureId, file)).toEqual([])
    expect(() => adaptVscode('a', '{}', fixtureId, file)).toThrow()
  })
})

function baseline(source: string): string {
  const records = physicalLines(source).flatMap(line => [
    '>' + line.text,
    ' ' + '^'.repeat(line.text.length + 1),
    ' source.ts string',
  ])
  return 'original file\n---\n' + source.replace(/\r\n|\r/g, '\n') + '\n---\nGrammar: TypeScript.tmLanguage\n---\n' + records.join('\n')
}

describe('TypeScript baselines', () => {
  it('maps real carets to exact CRLF case text and excludes tokenizer sentinel characters', () => {
    const artifacts = fixtureArtifacts.filter(artifact => artifact.format === 'typescript-baseline')
    expect(artifacts).toHaveLength(4)
    for (const artifact of artifacts) {
      const fixture = fixtures.find(fixture => fixture.id === artifact.sourceFixtureId)!
      const source = text(fixture.path), stored = text(artifact.path)
      const sections = adaptTypescript(source, stored, fixture.id, artifact.path)
      expect(sections[0].grammar).toBe('TypeScript.tmLanguage')
      expect(sections[0].expectations.length).toBeGreaterThan(0)
      for (const section of sections) {
        for (const expectation of section.expectations) {
          const records = physicalLines(stored)
          const caret = records[expectation.origin.line - 1].text
          const marker = records.slice(0, expectation.origin.line - 1).findLast(line => line.text.startsWith('>'))!
          const column = caret.indexOf('^') - 1
          const expected = marker.text.slice(1).slice(column, column + caret.trim().length)
          expect(source.slice(expectation.from, expectation.to)).toBe(expected)
          expect(expected.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('maps first and last columns, tabs, astral characters and repeated lines past CRLF', () => {
    const source = '\t😀z\r\n\t😀z\r\n'
    const sections = adaptTypescript(source, baseline(source), fixtureId, file)
    expect(sections[0].expectations.map(({ from, to }) => [from, to])).toEqual([[0, 4], [6, 10]])
    expect(sections[0].expectations.map(({ from, to }) => source.slice(from, to))).toEqual(['\t😀z', '\t😀z'])
    const selected = 'Grammar: TypeScript.tmLanguage\n>x😀z\n ^\n source.ts first\n    ^^\n    source.ts last'
    const converted = adaptTypescript('x😀z', selected, fixtureId, file)[0].expectations
    expect(converted.map(({ from, to }) => [from, to])).toEqual([[0, 1], [3, 4]])
  })

  it('does not interpret grammar-like source text as a baseline section header', () => {
    const source = 'Grammar: TypeScript.tmLanguage\r\n'
    const converted = adaptTypescript(source, baseline(source), fixtureId, file)
    expect(converted).toHaveLength(1)
    expect(converted[0].expectations).toHaveLength(1)
    expect(source.slice(converted[0].expectations[0].from, converted[0].expectations[0].to)).toBe('Grammar: TypeScript.tmLanguage')
  })

  it('keeps alternate grammar sections separate and rejects stale text and excessive sentinels', () => {
    const first = baseline('x')
    const alternate = '\n\nGrammar: TypeScriptReact.tmLanguage\n>x\n ^\n source.tsx'
    expect(adaptTypescript('x', first + alternate, fixtureId, file).map(section => section.grammar))
      .toEqual(['TypeScript.tmLanguage', 'TypeScriptReact.tmLanguage'])
    expect(() => adaptTypescript('y', first, fixtureId, file)).toThrow(/mismatch/)
    expect(() => adaptTypescript('x', first.replace(' ^^', ' ^^^'), fixtureId, file)).toThrow(/outside/)
    expect(() => adaptTypescript('x', 'no grammar', fixtureId, file)).toThrow(/sections/)
  })
})

describe('tmgrammar inline assertions', () => {
  it('strips header and assertion lines with an exact two-way map across CRLF and UTF-16 columns', () => {
    const original = '// SYNTAX TEST "source.ts"\r\n\t😀x\r\n// ^ source.ts string - comment\r\n// <--- source.ts\r\nlast\r\n// <~-- source.ts\r\n// ^ source.ts\r\n'
    const adapted = adaptTmgrammar(original, fixtureId, file)
    expect(adapted.source).toBe('\t😀x\r\nlast\r\n')
    expect(adapted.strippedExpectations.map(({ from, to }) => [from, to])).toEqual([[3, 4], [0, 3], [7, 9], [9, 10]])
    adapted.expectations.forEach((expectation, i) => {
      const stripped = adapted.strippedExpectations[i]
      expect(original.slice(expectation.from, expectation.to)).toBe(adapted.source.slice(stripped.from, stripped.to))
      expect(originalRange(adapted.sourceMap, stripped.from, stripped.to)).toEqual({ from: expectation.from, to: expectation.to })
    })
    expect(adapted.expectations[0].not).toEqual(['comment'])
    expect(adapted.expectations[0].origin.line).toBe(3)
    expect(adapted.expectations[3].origin.line).toBe(7)
    expect(adapted.expectations[3].from).toBe(original.indexOf('last') + 3)
  })

  it('supports negative-only assertions, multiple caret groups, and keeps ordinary comments', () => {
    const original = '// SYNTAX TEST "source.ts"\nabcdefg\n// ^ ^ - comment\n// ordinary comment\n'
    const adapted = adaptTmgrammar(original, fixtureId, file)
    expect(adapted.source).toBe('abcdefg\n// ordinary comment\n')
    expect(adapted.strippedExpectations.map(({ from, to }) => [from, to])).toEqual([[3, 4], [5, 6]])
    expect(adapted.expectations.every(expectation => expectation.scopes.length === 0 && expectation.not?.[0] === 'comment')).toBe(true)
    expect(() => originalRange(adapted.sourceMap, 6, 10)).toThrow(/crosses/)
  })

  it('rejects missing headers, dangling, malformed, and out-of-range assertions', () => {
    for (const original of ['x', '// SYNTAX TEST "s"\n// <- scope', '// SYNTAX TEST "s"\nx\n// ^ scope', '// SYNTAX TEST "s"\nxxxx\n// ^ -']) {
      expect(() => adaptTmgrammar(original, fixtureId, file)).toThrow()
    }
  })
})

describe('Tree-sitter capture annotations', () => {
  it('converts all 55 real annotations with capture names and exact vendored offsets', () => {
    const selected = fixtures.filter(fixture => fixture.family === 'tree-sitter-highlight')
    expect(selected).toHaveLength(5)
    let total = 0
    for (const fixture of selected) {
      const source = text(fixture.path), lines = physicalLines(source)
      const converted = adaptTreeSitter(source, fixture.id, fixture.path)
      total += converted.length
      for (const expectation of converted) {
        expect(expectation).not.toHaveProperty('scopes')
        expect(source.slice(expectation.from, expectation.to)).not.toMatch(/^\s*$/)
        const annotation = lines[expectation.origin.line - 1].text
        expect(annotation).toContain(expectation.capture)
        const target = lines.find(line => expectation.from >= line.from && expectation.to <= line.to)!
        expect(target.number).toBeLessThan(expectation.origin.line)
        if (annotation.includes('^')) expect(expectation.from - target.from).toBe(annotation.indexOf('^'))
        else expect(expectation.from - target.from).toBe(annotation.indexOf('//'))
      }
    }
    expect(total).toBe(55)
  })

  it('uses grapheme columns and UTF-16 offsets across astral, combining, CRLF, tabs and blank annotation gaps', () => {
    const source = 'a😀é\tz\r\n//  ^ variable\r\n\r\n// ^ !string\r\nlast\r\n// <- keyword\r\n// ^ variable\r\n'
    const converted = adaptTreeSitter(source, fixtureId, file)
    expect(converted.map(({ from, to }) => source.slice(from, to))).toEqual(['z', '\t', 'l', 't'])
    expect(converted.map(({ from, to }) => [from, to])).toEqual([[6, 7], [5, 6], [source.indexOf('last'), source.indexOf('last') + 1], [source.indexOf('last') + 3, source.indexOf('last') + 4]])
    expect(converted[1].negative).toBe(true)
  })

  it('maps asserted astral and combining graphemes as whole UTF-16 ranges', () => {
    const source = 'a😀éz\r\n // <- string\r\n  // <- variable\r\n// ^ property'
    const converted = adaptTreeSitter(source, fixtureId, file)
    expect(converted.map(({ from, to }) => [from, to])).toEqual([[1, 3], [3, 5], [5, 6]])
    expect(converted.map(({ from, to }) => source.slice(from, to))).toEqual(['😀', 'é', 'z'])
  })

  it('keeps indented left arrows distinct from tmgrammar arrows and rejects dangling annotations', () => {
    expect(adaptTreeSitter('abc\n  // <- variable', fixtureId, file)[0].from).toBe(2)
    expect(() => adaptTreeSitter('// <- variable', fixtureId, file)).toThrow(/preceding/)
    expect(() => adaptTreeSitter('abc\n// ^', fixtureId, file)).toThrow(/invalid/)
    expect(adaptTreeSitter('const text = "// ^ string";', fixtureId, file)).toEqual([])
  })
})

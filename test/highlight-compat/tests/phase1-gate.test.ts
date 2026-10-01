import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { artifactDifferences, artifactHash } from '../src/artifacts.ts'
import { corpusInputs } from '../src/corpus.ts'
import { fixtures } from '../src/fixtures/registry.ts'
import { goldenProducers } from '../src/golden-producers.ts'
import { phase1GateReport } from '../src/phase1-gate.ts'
import { isReferenceProfile } from '../src/schema.ts'

it('keeps synthetic oracle grammar suites out of native fixture and golden denominators', () => {
  expect(fixtures).toHaveLength(16)
  expect(corpusInputs()).toHaveLength(44)
  expect(corpusInputs().every(input => !input.fixtureId.includes('conformance/') && !input.fixtureId.includes('vscode-textmate/'))).toBe(true)
  expect(Object.keys(goldenProducers).every(isReferenceProfile)).toBe(true)
})

it('fails the gate for differing pipeline hashes or failed self-tests', () => {
  expect(() => phase1GateReport([{ path: 'test', passed: 1, total: 2 }], 'a', 'a')).toThrow('self-tests failed')
  expect(() => phase1GateReport([{ path: 'test', passed: 2, total: 2 }], 'a', 'b')).toThrow('hashes differ')
  expect(phase1GateReport([{ path: 'test', passed: 2, total: 2 }], 'a', 'a')).toContain('| test | 2 | 2 |')
})

it('detects changed bytes, missing files and extra files in generated artifact trees', () => {
  const root = mkdtempSync(join(tmpdir(), 'highlight-compat-artifact-test-'))
  const left = join(root, 'left'), right = join(root, 'right')
  try {
    mkdirSync(left)
    mkdirSync(right)
    writeFileSync(join(left, 'report.md'), 'one')
    writeFileSync(join(right, 'report.md'), 'one')
    expect(artifactDifferences(left, right)).toEqual([])
    expect(artifactHash(left)).toBe(artifactHash(right))
    writeFileSync(join(right, 'report.md'), 'changed')
    writeFileSync(join(left, 'missing.md'), 'missing')
    writeFileSync(join(right, 'extra.md'), 'extra')
    expect(artifactDifferences(left, right)).toEqual(['extra.md: extra committed artifact', 'missing.md: missing committed artifact', 'report.md: bytes differ'])
    expect(artifactHash(left)).not.toBe(artifactHash(right))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

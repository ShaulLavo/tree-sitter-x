import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { artifactDifferences, artifactHash } from '../src/artifacts.ts'
import { buildBaselineReport } from '../src/baseline-report.ts'
import { fixtureReport } from '../src/fixtures/report.ts'
import { readManifest } from '../src/fixtures/manifest.ts'
import { goldenProducers } from '../src/golden-producers.ts'
import { updateGoldens } from '../src/golden.ts'
import { buildHistoricalReport } from '../src/historical-report.ts'
import { phase1GateReport } from '../src/phase1-gate.ts'
import type { GateTestCount } from '../src/phase1-gate.ts'
import { buildReferenceReport } from '../src/reference-report.ts'
import { isReferenceProfile } from '../src/schema.ts'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const SELF_TESTS = [
  'build', 'validate', 'serialize', 'compare', 'categorize', 'sweep', 'memory', 'streaming-source',
  'golden', 'sparse-goldens', 'oracle-core', 'oracle-conformance', 'product-document',
  'fixture-adapters', 'expectations', 'original-fixtures', 'baselines', 'baseline-theme', 'phase1-gate',
].map(name => `tests/${name}.test.ts`)

interface VitestResult {
  readonly success: boolean
  readonly testResults: readonly {
    readonly name: string
    readonly assertionResults: readonly { readonly status: string }[]
  }[]
}

function selfTestCounts(scratch: string): GateTestCount[] {
  const output = join(scratch, 'tests.json')
  execFileSync(process.execPath, [join(ROOT, 'node_modules/vitest/vitest.mjs'), 'run', ...SELF_TESTS, '--reporter=json', `--outputFile=${output}`], { cwd: ROOT, stdio: 'inherit' })
  const result = JSON.parse(readFileSync(output, 'utf8')) as VitestResult
  if (!result.success) throw new Error('mandatory Phase 1 self-tests failed')
  return SELF_TESTS.map(path => {
    const tests = result.testResults.filter(file => file.name.replaceAll('\\', '/').endsWith('/' + path)).flatMap(file => file.assertionResults)
    if (tests.length === 0) throw new Error(`no executed self-tests for ${path}`)
    return { path, passed: tests.filter(test => test.status === 'passed').length, total: tests.length }
  })
}

function write(root: string, path: string, content: string): void {
  const destination = join(root, path)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, content)
}

async function generateTree(root: string): Promise<void> {
  const goldens = join(root, 'goldens')
  for (const [profile, producer] of Object.entries(goldenProducers)) {
    if (producer === undefined || !isReferenceProfile(profile)) throw new Error(`invalid golden producer ${profile}`)
    const result = await updateGoldens(goldens, profile, producer)
    console.log(`${profile}: ${result.written.length + result.unchanged.length} regenerated cases`)
  }
  write(root, 'reports/fixtures.md', fixtureReport(readManifest()))
  const references = await buildReferenceReport()
  if (references.attribution.unexplained.length + references.attribution.ambiguous.length + references.attribution.unobserved.length !== 0) throw new Error('reference difference expectations do not explain the observations')
  write(root, 'reports/reference-differences.md', references.markdown)
  write(root, 'reports/historical-expectations.md', buildHistoricalReport(goldens))
  write(root, 'reports/baselines.md', await buildBaselineReport(goldens))
}

function committedDifferences(generated: string): string[] {
  return ['goldens', 'reports'].flatMap(directory => artifactDifferences(join(generated, directory), join(ROOT, directory)).map(message => `${directory}/${message}`))
}

const mode = process.argv[2]
if (!['--check', '--update'].includes(mode ?? '') || process.argv.length !== 3) throw new Error('usage: node scripts/regenerate.ts --check|--update')
const scratch = mkdtempSync(join(tmpdir(), 'highlight-compat-regenerate-'))
try {
  const counts = selfTestCounts(scratch)
  const first = join(scratch, 'first'), second = join(scratch, 'second')
  await generateTree(first)
  const firstHash = artifactHash(first)
  await generateTree(second)
  const secondHash = artifactHash(second)
  console.log(`pipeline content SHA-256 ${firstHash} ${secondHash}`)
  const gate = phase1GateReport(counts, firstHash, secondHash)
  write(first, 'reports/phase-1-gate.md', gate)
  write(second, 'reports/phase-1-gate.md', gate)
  const repeated = artifactDifferences(first, second)
  if (repeated.length > 0) throw new Error(`repeated generation differs:\n${repeated.join('\n')}`)
  console.log(`full artifact SHA-256 ${artifactHash(first)} ${artifactHash(second)}`)
  if (mode === '--update') {
    for (const directory of ['goldens', 'reports']) {
      rmSync(join(ROOT, directory), { recursive: true, force: true })
      cpSync(join(first, directory), join(ROOT, directory), { recursive: true })
    }
    console.log('updated reference goldens and reports from two identical runs')
  } else {
    const differences = committedDifferences(first)
    if (differences.length > 0) throw new Error(`committed artifacts are stale:\n${differences.join('\n')}`)
    console.log('all committed goldens and reports match two full regenerations')
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

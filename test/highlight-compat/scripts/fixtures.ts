import { readFileSync, writeFileSync } from 'node:fs'
import { harnessRoot, readManifest } from '../src/fixtures/manifest.ts'
import { registrySource } from '../src/fixtures/generate.ts'
import { fixtureReport } from '../src/fixtures/report.ts'

const mode = process.argv[2]
if (!['--check', '--update', '--report'].includes(mode) || process.argv.length !== 3) {
  throw new Error('usage: node scripts/fixtures.ts --check|--update|--report')
}
const manifest = readManifest()
if (mode === '--report') {
  process.stdout.write(fixtureReport(manifest))
} else {
  const outputs = [['src/fixtures/registry.ts', registrySource(manifest)], ['reports/fixtures.md', fixtureReport(manifest)]] as const
  for (const [path, content] of outputs) {
    const url = new URL(path, harnessRoot)
    if (mode === '--update') writeFileSync(url, content)
    else if (readFileSync(url, 'utf8') !== content) throw new Error(`${path} differs from regeneration; run npm run fixtures:update`)
  }
  console.log(mode === '--update' ? 'Updated fixture registry and report' : 'Fixture registry and report match regeneration')
}

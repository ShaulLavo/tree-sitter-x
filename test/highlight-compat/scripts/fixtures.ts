import { readFileSync, writeFileSync } from 'node:fs'
import { harnessRoot, readManifest } from '../src/fixtures/manifest.ts'
import { registrySource } from '../src/fixtures/generate.ts'
import { commentMetadataSource } from '../src/fixtures/comments.ts'
import { fixtureReport } from '../src/fixtures/report.ts'

const mode = process.argv[2]
if (!['--check', '--update', '--report', '--comments'].includes(mode) ||
  (mode === '--comments' ? ![4, 5].includes(process.argv.length) : process.argv.length !== 3)) {
  throw new Error('usage: node scripts/fixtures.ts --check|--update|--report or --comments <parser-nodes.json> [--check]')
}
const manifest = readManifest()
if (mode === '--comments') {
  if (process.argv[4] !== undefined && process.argv[4] !== '--check') throw new Error('comments mode accepts --check')
  const content = commentMetadataSource(JSON.parse(readFileSync(process.argv[3], 'utf8')))
  const url = new URL('src/fixtures/comment-nodes.ts', harnessRoot)
  if (process.argv[4] === '--check') {
    if (readFileSync(url, 'utf8') !== content) throw new Error('comment metadata differs from parser-derived nodes')
    console.log('Comment metadata matches parser-derived nodes')
  } else {
    writeFileSync(url, content)
    console.log('Updated parser-derived comment metadata')
  }
} else if (mode === '--report') {
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

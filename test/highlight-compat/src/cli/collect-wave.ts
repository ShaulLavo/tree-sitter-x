import { resolve } from 'node:path'
import { checkJsJsxWave, collectJsJsxWave, diagnostic } from '../wave-collection.ts'
import type { WaveCollectionOptions } from '../wave-collection.ts'

export function parseWaveArgs(args: readonly string[]): WaveCollectionOptions & { readonly check: boolean } {
  const values = new Map<string, string>()
  let check = false
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    if (key === '--check' && !check) { check = true; continue }
    if (!['--split', '--references', '--out'].includes(key) || values.has(key)) throw new Error('Unknown/duplicate option')
    const value = args[++i]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`)
    values.set(key, value)
  }
  const split = values.get('--split'), references = values.get('--references'), out = values.get('--out')
  if ((split !== 'development' && split !== 'evaluation') || !references || !out) throw new Error('Require --split development|evaluation --references DIRECTORY --out DIRECTORY [--check]')
  return { split, references: resolve(references), out: resolve(out), check }
}
async function main(): Promise<number> {
  let options: ReturnType<typeof parseWaveArgs>
  try { options = parseWaveArgs(process.argv.slice(2)) }
  catch (error) { process.stderr.write(diagnostic(error) + '\n'); return 2 }
  try { return await (options.check ? checkJsJsxWave(options) : collectJsJsxWave(options)) }
  catch (error) { process.stderr.write(diagnostic(error) + '\n'); return 3 }
}
if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) process.exitCode = await main()

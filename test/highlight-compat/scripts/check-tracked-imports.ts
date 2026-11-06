import { fileURLToPath } from 'node:url'
import { runTrackedImports } from './tracked-imports.ts'

await runTrackedImports(process.argv.slice(2), fileURLToPath(import.meta.url))

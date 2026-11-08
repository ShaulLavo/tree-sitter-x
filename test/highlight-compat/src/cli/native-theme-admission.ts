import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { ADMISSION_ROOT } from '../oracles/theme-admission/schema.ts'
import { generateAdmissionSuite, suiteBytes } from '../oracles/theme-admission/reference.ts'
import { referenceDependencies } from '../oracles/theme-admission/independence.ts'
import { loadAdmissionSuite } from '../oracles/theme-admission/load.ts'

const mode = process.argv[2]
assert(process.argv.length === 3 && (mode === '--check' || mode === '--update'), 'usage: node src/cli/native-theme-admission.ts --check|--update')
const suite = await generateAdmissionSuite(referenceDependencies())
const bytes = suiteBytes(suite)
loadAdmissionSuite(bytes)
const file = new URL('suite.json', ADMISSION_ROOT)
if (mode === '--update') writeFileSync(file, bytes)
else assert.equal(readFileSync(file, 'utf8'), bytes, 'admission supplement differs; review inputs and explicit regeneration')
const attempts = suite.fixtures.flatMap(fixture => fixture.attempts)
process.stdout.write(`${mode}: ${suite.schema}, ${suite.fixtures.length} inputs, ${attempts.length} attempts, ${attempts.filter(attempt => attempt.result.kind === 'error').length} target errors, identity ${suite.identity}\n`)

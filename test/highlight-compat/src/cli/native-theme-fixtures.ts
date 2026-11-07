import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { generateNativeThemeSuite } from '../oracles/native-theme-reference.ts'
import { directNativeTheme, NATIVE_THEME_CONTROL_GRAMMAR, nativeThemeSpansEqual } from '../oracles/native-theme-direct.ts'
import { NATIVE_THEME_MANIFEST } from '../oracles/native-theme-schema.ts'
import { nativeThemeDiagnosticFixtures } from '../oracles/native-theme-diagnostics.ts'

const option = process.argv[2]
assert(process.argv.length === 3 && (option === '--check' || option === '--update'), 'usage: node src/cli/native-theme-fixtures.ts --check|--update')
const suite = generateNativeThemeSuite()
const controls = await Promise.all(suite.fixtures.filter(fixture => fixture.id === 'inheritance').map(async fixture => {
  const observation = await directNativeTheme(fixture.normalized, fixture.profile, NATIVE_THEME_CONTROL_GRAMMAR, '(xy)')
  assert(nativeThemeSpansEqual(observation.direct, observation.repaint, 4), `${fixture.profile} direct reference/repaint`)
  return { profile: fixture.profile, ...observation }
}))
for (const [file, content] of [['suite.json', suite], ['controls.json', controls], ['diagnostics.json', nativeThemeDiagnosticFixtures()]] as const) {
  const url = new URL(file, NATIVE_THEME_MANIFEST)
  const expected = `${JSON.stringify(content, null, 2)}\n`
  if (option === '--update') writeFileSync(url, expected)
  else assert.equal(readFileSync(url, 'utf8'), expected, `${file}: run explicit reference regeneration`)
}
process.stdout.write(`${option}: native-theme-oracle/v1, ${suite.fixtures.length} fixtures, ${suite.fixtures.reduce((count, fixture) => count + fixture.cases.length, 0)} scope cases, identity ${suite.identity}\n`)

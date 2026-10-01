import { writeFileSync } from 'node:fs'
import { buildBaselineReport } from '../baseline-report.ts'

writeFileSync(new URL('../../reports/baselines.md', import.meta.url), await buildBaselineReport())
console.log('wrote reports/baselines.md')

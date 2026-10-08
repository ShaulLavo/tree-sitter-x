import { writeFileSync } from 'node:fs'
import { buildHistoricalReport } from '../historical-report.ts'

writeFileSync(new URL('../../reports/historical-expectations.md', import.meta.url), buildHistoricalReport())
console.log('wrote reports/historical-expectations.md')

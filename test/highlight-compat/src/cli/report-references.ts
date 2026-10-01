import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { buildReferenceReport, REPORT_PATH } from '../reference-report.ts'

const { markdown, attribution } = await buildReferenceReport()
mkdirSync(dirname(REPORT_PATH), { recursive: true })
writeFileSync(REPORT_PATH, markdown)
const problems = attribution.unexplained.length + attribution.ambiguous.length + attribution.unobserved.length
console.log(`wrote ${REPORT_PATH}`)
if (problems > 0) {
  console.error(
    `${attribution.unexplained.length} unexplained, ${attribution.ambiguous.length} ambiguous, ${attribution.unobserved.length} unobserved; see the report's last section`,
  )
  process.exitCode = 1
}

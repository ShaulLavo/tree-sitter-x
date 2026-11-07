import { materializeJsJsxRows, readJsJsxIntake } from '../src/fixtures/js-jsx-wave.ts'

const intake = readJsJsxIntake()
const rows = materializeJsJsxRows(intake)
process.stdout.write(JSON.stringify({
  selectionSha256: intake.selectionSha256,
  inputs: intake.inputs.length,
  development: intake.inputs.filter(input => input.split === 'development').length,
  evaluation: intake.inputs.filter(input => input.split === 'evaluation').length,
  themeRows: rows.themeRows.length,
  scopeRequests: rows.scopeRows.length,
  metadataAvailability: intake.metadataAvailability,
}, null, 2) + '\n')

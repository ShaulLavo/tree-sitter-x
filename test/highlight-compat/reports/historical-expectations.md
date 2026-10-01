# Historical expectation drift

Diagnostic only. Historical snapshots have no stamped generation revision. The inspected maintainer grammars and the product @shikijs/langs 4.4.3 grammar identities remain distinct. These assertions gate no scope pack and never become reference goldens.

Inputs are the byte-verified real fixture registry. Results are raw and product reference goldens generated from those exact sources. Ordered scope subsequences and negative scopes use checkExpectations unchanged. An assertion checks its selected UTF-16 interval, not unasserted text or full-file coverage.

Coverage is 545 VS Code assertions and 1,603 TypeScript-TmLanguage assertions per reference. The two positionless VS Code Tree-sitter snapshots remain unconverted. Tree-sitter capture annotations have their own type and are outside this TextMate diagnostic.

## By family

| Reference | Family | Passed | Assertions | Pass rate |
| --- | --- | ---: | ---: | ---: |
| raw | typescript-tmlanguage | 1601 | 1603 | 99.88% |
| product | typescript-tmlanguage | 1601 | 1603 | 99.88% |
| raw | vscode-colorize | 545 | 545 | 100.00% |
| product | vscode-colorize | 545 | 545 | 100.00% |

## By fixture

| Reference | Fixture | Passed | Assertions | Pass rate |
| --- | --- | ---: | ---: | ---: |
| raw | typescript-tmlanguage/tests/cases/AsConstSatisfies.ts | 18 | 18 | 100.00% |
| product | typescript-tmlanguage/tests/cases/AsConstSatisfies.ts | 18 | 18 | 100.00% |
| raw | typescript-tmlanguage/tests/cases/autoAccessor.ts | 44 | 44 | 100.00% |
| product | typescript-tmlanguage/tests/cases/autoAccessor.ts | 44 | 44 | 100.00% |
| raw | typescript-tmlanguage/tests/cases/awaitUsing.ts | 1073 | 1075 | 99.81% |
| product | typescript-tmlanguage/tests/cases/awaitUsing.ts | 1073 | 1075 | 99.81% |
| raw | typescript-tmlanguage/tests/cases/constTypeParameter.ts | 466 | 466 | 100.00% |
| product | typescript-tmlanguage/tests/cases/constTypeParameter.ts | 466 | 466 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-brackets.tsx | 40 | 40 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-brackets.tsx | 40 | 40 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-keywords.ts | 21 | 21 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-keywords.ts | 21 | 21 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-object-literals.ts | 27 | 27 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-object-literals.ts | 27 | 27 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | 351 | 351 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | 351 | 351 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json | 106 | 106 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json | 106 | 106 | 100.00% |

## By grammar section

| Reference | Fixture / grammar section | Passed | Assertions | Pass rate |
| --- | --- | ---: | ---: | ---: |
| raw | typescript-tmlanguage/tests/cases/AsConstSatisfies.ts / TypeScript.tmLanguage | 18 | 18 | 100.00% |
| product | typescript-tmlanguage/tests/cases/AsConstSatisfies.ts / TypeScript.tmLanguage | 18 | 18 | 100.00% |
| raw | typescript-tmlanguage/tests/cases/autoAccessor.ts / TypeScript.tmLanguage | 44 | 44 | 100.00% |
| product | typescript-tmlanguage/tests/cases/autoAccessor.ts / TypeScript.tmLanguage | 44 | 44 | 100.00% |
| raw | typescript-tmlanguage/tests/cases/awaitUsing.ts / TypeScript.tmLanguage | 1073 | 1075 | 99.81% |
| product | typescript-tmlanguage/tests/cases/awaitUsing.ts / TypeScript.tmLanguage | 1073 | 1075 | 99.81% |
| raw | typescript-tmlanguage/tests/cases/constTypeParameter.ts / TypeScript.tmLanguage | 466 | 466 | 100.00% |
| product | typescript-tmlanguage/tests/cases/constTypeParameter.ts / TypeScript.tmLanguage | 466 | 466 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-brackets.tsx / vscode-source.tsx | 40 | 40 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-brackets.tsx / vscode-source.tsx | 40 | 40 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-keywords.ts / vscode-source.ts | 21 | 21 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-keywords.ts / vscode-source.ts | 21 | 21 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-object-literals.ts / vscode-source.ts | 27 | 27 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-object-literals.ts / vscode-source.ts | 27 | 27 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js / vscode-source.js | 351 | 351 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js / vscode-source.js | 351 | 351 | 100.00% |
| raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json / vscode-source.json | 106 | 106 | 100.00% |
| product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json / vscode-source.json | 106 | 106 | 100.00% |

## Top failing scope patterns

| Reference | Expected ordered scopes | Failing assertions |
| --- | --- | ---: |
| product | source.ts support.variable.property.dom.ts | 2 |
| raw | source.ts support.variable.property.dom.ts | 2 |

## Non-complete references

None.

Regenerate with `npm run report:historical`. Goldens are updated separately by reference-only `golden:update`.

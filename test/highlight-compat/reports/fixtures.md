# Fixture coverage

242 catalog languages; 16 runnable source fixtures; 27 vendored primary artifacts; 1475 skipped primary artifacts.

Runnable means a cleared, locally available input. It makes no reference-completeness, native-support, or comparison-success claim.

## Selection accounting

The manifest selects 30 primary artifacts. This registry holds 27. The following 3 oracle-suite artifacts belong to L2, together with the 67 selected dependencies.

- `vscode-textmate:test-cases/first-mate/tests.json`. Deferred to the oracle-conformance vendor registry.
- `vscode-textmate:test-cases/suite1/tests.json`. Deferred to the oracle-conformance vendor registry.
- `vscode-textmate:test-cases/suite1/whileTests.json`. Deferred to the oracle-conformance vendor registry.

The 27 artifacts comprise 16 source inputs and 11 stored expectations. Source fixtures are deduplicated by SHA-256. Stored expectation bytes are distinct artifacts linked to a source fixture.

## Lane and split denominators

| Lane | Development sources | Evaluation sources | Stored artifacts |
| --- | ---: | ---: | ---: |
| language-regression | 9 | 0 | 0 |
| annotated-expectation | 5 | 0 | 11 |
| catalog-smoke | 2 | 0 | 0 |
| adversarial | 0 | 0 | 0 |
| held-out | 0 | 0 | 0 |

All selected inputs are development data. No selected, licence-cleared held-out corpus exists in this manifest. Evaluation has zero fixtures; hash disjointness is enforced but makes no generalization claim. L2 owns adversarial originals, outside this registry.

## Expectation denominators

| Family | TextMate position expectations | Capture position expectations |
| --- | ---: | ---: |
| vscode-colorize | 545 | 0 |
| typescript-tmlanguage | 1603 | 0 |
| textmate-grammars-themes | 0 | 0 |
| tree-sitter-highlight | 0 | 55 |
| tmgrammar | 0 | 0 |

tmgrammar has synthetic format tests only. No selected fixture uses that format. TypeScript section counts include each named grammar separately; the loader preserves section identity.

Historical VS Code captures and TypeScript baselines are diagnostic. Generated-against revisions are unstamped (null) in the inventory. Registry provenance separately records inspected checkout, upstream grammar metadata, grammar hash, product revision, and product grammar hash. No historical expectation is a product golden.

The two stored VS Code Tree-sitter captures are byte-verified diagnostic artifacts. They lack source positions and omit uncaptured text, so this lane does not infer positions by searching token text. The five annotated Tree-sitter inputs supply the capture expectations. Capture names never count as TextMate scopes.

## Runnable fixtures per catalog language

| Language | Runnable sources |
| --- | ---: |
| abap | 0 |
| actionscript-3 | 0 |
| ada | 0 |
| ahk | 0 |
| ahk2 | 0 |
| angular-html | 0 |
| angular-ts | 0 |
| apache | 0 |
| apex | 0 |
| apl | 0 |
| applescript | 0 |
| ara | 0 |
| asciidoc | 0 |
| asm | 0 |
| astro | 0 |
| awk | 0 |
| ballerina | 0 |
| bat | 0 |
| beancount | 0 |
| berry | 0 |
| bibtex | 0 |
| bicep | 0 |
| bird2 | 0 |
| blade | 0 |
| bsl | 0 |
| c | 0 |
| c3 | 0 |
| cadence | 0 |
| cairo | 0 |
| chapel | 0 |
| clarity | 0 |
| clojure | 0 |
| cmake | 0 |
| cobol | 0 |
| codeowners | 0 |
| codeql | 0 |
| coffee | 0 |
| common-lisp | 0 |
| coq | 0 |
| cpp | 0 |
| crystal | 0 |
| csharp | 0 |
| css | 0 |
| csv | 0 |
| cue | 0 |
| cypher | 0 |
| d | 0 |
| dart | 0 |
| dax | 0 |
| desktop | 0 |
| diff | 0 |
| docker | 0 |
| dotenv | 0 |
| dream-maker | 0 |
| edge | 0 |
| elixir | 0 |
| elm | 0 |
| emacs-lisp | 0 |
| erb | 0 |
| erlang | 0 |
| fennel | 0 |
| fish | 0 |
| fluent | 0 |
| fortran-fixed-form | 0 |
| fortran-free-form | 0 |
| fsharp | 0 |
| gdresource | 0 |
| gdscript | 0 |
| gdshader | 0 |
| genie | 0 |
| gherkin | 0 |
| git-commit | 0 |
| git-rebase | 0 |
| gleam | 0 |
| glimmer-js | 0 |
| glimmer-ts | 0 |
| glsl | 0 |
| gn | 0 |
| gnuplot | 0 |
| go | 0 |
| graphql | 0 |
| groovy | 0 |
| hack | 0 |
| haml | 0 |
| handlebars | 0 |
| haskell | 0 |
| haxe | 0 |
| hcl | 0 |
| hjson | 0 |
| hlsl | 0 |
| html | 0 |
| html-derivative | 0 |
| http | 0 |
| hurl | 0 |
| hxml | 0 |
| hy | 0 |
| imba | 0 |
| ini | 0 |
| java | 0 |
| javascript | 7 |
| jinja | 0 |
| jison | 0 |
| json | 1 |
| json5 | 0 |
| jsonc | 0 |
| jsonl | 0 |
| jsonnet | 0 |
| jssm | 0 |
| jsx | 0 |
| julia | 0 |
| just | 0 |
| kdl | 0 |
| kotlin | 0 |
| kusto | 0 |
| latex | 0 |
| lean | 0 |
| less | 0 |
| liquid | 0 |
| llvm | 0 |
| log | 0 |
| logo | 0 |
| lua | 0 |
| luau | 0 |
| make | 0 |
| markdown | 0 |
| marko | 0 |
| matlab | 0 |
| mdc | 0 |
| mdx | 0 |
| mermaid | 0 |
| mipsasm | 0 |
| mojo | 0 |
| moonbit | 0 |
| move | 0 |
| narrat | 0 |
| nextflow | 0 |
| nextflow-groovy | 0 |
| nginx | 0 |
| nim | 0 |
| nix | 0 |
| nsis | 0 |
| nushell | 0 |
| objective-c | 0 |
| objective-cpp | 0 |
| ocaml | 0 |
| odin | 0 |
| openscad | 0 |
| org | 0 |
| pascal | 0 |
| perl | 0 |
| php | 0 |
| pkl | 0 |
| plsql | 0 |
| po | 0 |
| polar | 0 |
| postcss | 0 |
| powerquery | 0 |
| powershell | 0 |
| prisma | 0 |
| prolog | 0 |
| proto | 0 |
| pug | 0 |
| puppet | 0 |
| purescript | 0 |
| python | 0 |
| qml | 0 |
| qmldir | 0 |
| qss | 0 |
| r | 0 |
| racket | 0 |
| raku | 0 |
| razor | 0 |
| rbs | 0 |
| reg | 0 |
| regexp | 0 |
| rel | 0 |
| riscv | 0 |
| ron | 0 |
| rosmsg | 0 |
| rst | 0 |
| ruby | 0 |
| rust | 0 |
| sas | 0 |
| sass | 0 |
| scala | 0 |
| scheme | 0 |
| scss | 0 |
| sdbl | 0 |
| shaderlab | 0 |
| shellscript | 0 |
| shellsession | 0 |
| smalltalk | 0 |
| smithy | 0 |
| solidity | 0 |
| soy | 0 |
| sparql | 0 |
| splunk | 0 |
| sql | 0 |
| ssh-config | 0 |
| stata | 0 |
| stylus | 0 |
| surrealql | 0 |
| svelte | 0 |
| swift | 0 |
| system-verilog | 0 |
| systemd | 0 |
| talonscript | 0 |
| tasl | 0 |
| tcl | 0 |
| templ | 0 |
| terraform | 0 |
| tex | 0 |
| toml | 0 |
| ts-tags | 0 |
| tsv | 0 |
| tsx | 1 |
| turtle | 0 |
| twig | 0 |
| typescript | 7 |
| typespec | 0 |
| typst | 0 |
| v | 0 |
| vala | 0 |
| vb | 0 |
| verilog | 0 |
| vhdl | 0 |
| viml | 0 |
| vue | 0 |
| vue-html | 0 |
| vue-vine | 0 |
| vyper | 0 |
| wasm | 0 |
| wenyan | 0 |
| wgsl | 0 |
| wikitext | 0 |
| wit | 0 |
| wolfram | 0 |
| xml | 0 |
| xsl | 0 |
| yaml | 0 |
| zenscript | 0 |
| zig | 0 |

## Vendored artifacts by family

| Family | Source inputs | Stored expectations | Licence |
| --- | ---: | ---: | --- |
| textmate-grammars-themes | 2 | 0 | MIT; per-file notices in fixtures/textmate-grammars-themes/NOTICE |
| tree-sitter-highlight | 5 | 0 | MIT; per-file notices in fixtures/tree-sitter-highlight/NOTICE |
| typescript-tmlanguage | 4 | 4 | MIT; per-file notices in fixtures/typescript-tmlanguage/NOTICE |
| vscode-colorize | 5 | 7 | MIT; per-file notices in fixtures/vscode-colorize/NOTICE |

## Skipped primary files

Each inventory exclusion remains visible. Empty snapshots, permission gaps and unreviewed files contribute no runnable fixture.

| Source set | Upstream file | Reason |
| --- | --- | --- |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/12750.html | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/13448.html | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/14119.less | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/25920.html | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/COMMIT_EDITMSG | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/Dockerfile | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/basic.java | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/git-rebase-todo | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/issue-1550.yaml | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/issue-224862.yaml | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/issue-279576.md | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/issue-28354.php | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/issue-4008.yaml | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/issue-6303.yaml | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/issue-76997.php | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/makefile | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/md-math.md | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-13777.go | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-166781.rs | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-173216.sh | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-173224.sh | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-173336.sh | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-23630.cpp | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-23850.cpp | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-241001.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-33886.md | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-4287.pug | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-6611.rs | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-7115.xml | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-78769.cpp | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-80644.cpp | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-cssvariables.less | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-cssvariables.scss | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-embedding.html | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-freeze-56377.py | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-freeze-56476.ps1 | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-function-inv.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-issue11.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-issue241715.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-issue5431.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-issue5465.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-issue5566.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-jsdoc-multiline-type.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-members.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-regex.coffee | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-strings.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-this.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test-variables.css | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.bat | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.bib | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.c | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.cc | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.clj | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.code-snippets | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.coffee | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.cpp | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.cs | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.cshtml | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.css | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.cu | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.dart | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.diff | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.env | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.fs | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.go | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.groovy | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.handlebars | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.hbs | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.hlsl | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.html | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.ini | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.jl | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.jsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.less | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.log | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.lua | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.m | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.md | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.mm | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.p6 | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.php | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.pl | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.ps1 | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.pug | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.py | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.r | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.rb | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.regexp.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.rs | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.rst | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.scss | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.sh | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.shader | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.sql | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.sty | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.swift | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.tex | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.vb | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.xml | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test.yaml | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test2.pl | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/test6916.js | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-fixtures | extensions/vscode-colorize-tests/test/colorize-fixtures/tsconfig_off.json | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/12750_html.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/13448_html.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/14119_less.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/25920_html.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/COMMIT_EDITMSG.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/Dockerfile.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/basic_java.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/git-rebase-todo.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/issue-1550_yaml.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/issue-224862_yaml.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/issue-279576_md.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/issue-28354_php.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/issue-4008_yaml.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/issue-6303_yaml.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/issue-76997_php.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/makefile.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/md-math_md.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-13777_go.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-166781_rs.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-173216_sh.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-173224_sh.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-173336_sh.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-23630_cpp.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-23850_cpp.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-241001_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-33886_md.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-4287_pug.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-6611_rs.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-7115_xml.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-78769_cpp.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-80644_cpp.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-cssvariables_less.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-cssvariables_scss.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-embedding_html.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-freeze-56377_py.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-freeze-56476_ps1.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-function-inv_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-issue11_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-issue241715_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-issue5431_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-issue5465_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-issue5566_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-jsdoc-multiline-type_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-members_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-regex_coffee.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-strings_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-this_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test-variables_css.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test2_pl.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test6916_js.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_bat.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_bib.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_c.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_cc.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_clj.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_code-snippets.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_coffee.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_cpp.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_cs.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_cshtml.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_css.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_cu.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_dart.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_diff.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_env.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_fs.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_go.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_groovy.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_handlebars.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_hbs.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_hlsl.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_html.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_ini.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_jl.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_jsx.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_less.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_log.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_lua.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_m.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_md.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_mm.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_p6.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_php.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_pl.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_ps1.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_pug.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_py.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_r.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_rb.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_regexp.ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_rs.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_rst.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_scss.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_sh.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_shader.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_sql.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_sty.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_swift.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_tex.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_vb.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_xml.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/test_yaml.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-results | extensions/vscode-colorize-tests/test/colorize-results/tsconfig_off_json.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/12750_html.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/13448_html.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/14119_less.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/25920_html.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/COMMIT_EDITMSG.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/Dockerfile.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/basic_java.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/git-rebase-todo.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/issue-1550_yaml.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/issue-224862_yaml.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/issue-279576_md.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/issue-28354_php.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/issue-4008_yaml.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/issue-6303_yaml.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/issue-76997_php.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/makefile.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/md-math_md.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-13777_go.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-166781_rs.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-173216_sh.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-173224_sh.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-173336_sh.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-23630_cpp.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-23850_cpp.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-241001_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-33886_md.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-4287_pug.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-6611_rs.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-7115_xml.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-78769_cpp.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-80644_cpp.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-brackets_tsx.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-cssvariables_less.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-cssvariables_scss.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-embedding_html.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-freeze-56377_py.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-freeze-56476_ps1.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-function-inv_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-issue11_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-issue241715_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-issue5431_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-issue5465_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-issue5566_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-jsdoc-multiline-type_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-members_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-regex_coffee.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-strings_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-this_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test-variables_css.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test2_pl.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test6916_js.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_bat.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_bib.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_c.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_cc.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_clj.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_code-snippets.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_coffee.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_cpp.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_cs.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_cshtml.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_css.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_cu.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_dart.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_diff.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_env.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_fs.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_go.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_groovy.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_handlebars.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_hbs.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_hlsl.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_html.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_ini.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_jl.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_js.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_json.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_jsx.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_less.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_log.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_lua.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_m.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_md.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_mm.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_p6.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_php.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_pl.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_ps1.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_pug.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_py.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_r.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_rb.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_regexp.ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_rs.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_rst.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_scss.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_sh.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_shader.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_sql.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_sty.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_swift.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_tex.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_ts.json | Source-file permission review is unresolved or restricted. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_vb.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_xml.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/test_yaml.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| vscode-colorize-tree-sitter-results | extensions/vscode-colorize-tests/test/colorize-tree-sitter-results/tsconfig_off_json.json | Empty capture provides no successful scope/style reference and is excluded from comparison denominators. |
| typescript-tmlanguage-cases | tests/cases/Abstracts.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/ArrowFunctionInsideTypeAssertion.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Comments.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/FunctionMethodOverloads.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/FunctionMethodParameters.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/FunctionMethodReturnTypes.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue10.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue1006.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue11.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue110.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue112.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue114.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue115.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue119.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue124.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue131.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue133.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue135.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue139.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue142.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue143.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue146.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue148.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue149.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue152.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue153.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue154.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue155.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue156.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue157.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue158.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue161.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue163.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue166.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue171.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue172.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue175.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue177.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue178.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue180.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue182.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue183.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue186.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue187.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue191.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue193.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue197.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue198.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue200.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue202.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue203.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue206.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue208.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue212.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue215.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue216.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue217.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue218.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue219.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue22.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue221.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue223.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue226.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue230.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue232.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue235.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue236.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue237.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue239.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue241.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue243.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue244.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue247.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue248.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue249.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue250.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue251.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue252.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue262.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue264.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue276.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue28.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue280.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue283.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue285.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue288.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue292.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue294.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue3.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue304.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue305.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue307.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue314.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue318.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue32.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue321.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue322.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue326.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue334.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue335.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue337.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue338.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue339.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue343.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue344.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue346.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue347.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue351.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue356.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue357.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue359.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue36.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue361.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue365.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue366.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue368.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue37.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue375.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue376.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue377.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue379.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue380.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue381.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue382.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue383.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue384.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue387.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue388.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue389.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue391.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue393.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue394.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue396.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue397.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue398.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue402.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue403IncorrectlyDetectedArrowTypeParameters.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue403IncorrectlyDetectedFunctionCallAsArrow.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue405.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue407.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue408.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue415.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue417.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue418.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue42.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue420.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue421.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue423.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue427.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue428.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue43.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue430.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue431.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue433.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue434.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue435.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue44.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue441.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue444.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue445.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue450.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue452.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue453.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue455.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue458.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue460.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue461.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue463.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue466.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue468.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue470.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue471.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue472.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue476.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue477.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue478.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue480.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue482.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue484.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue485.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue486.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue491.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue496.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue499.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue5.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue500.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue502.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue506.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue510.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue513.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue515.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue518.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue521.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue522.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue525.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue526.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue530.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue531.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue536.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue538.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue540.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue543.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue549.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue550.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue551.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue554.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue556.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue558.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue559.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue562.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue566.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue567.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue569.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue571.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue572.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue572ForLoop.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue575.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue578.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue579.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue580.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue581.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue584.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue585.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue586.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue59.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue590.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue591.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue592.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue595.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue598.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue601.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue602.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue604.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue605.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue606.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue607.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue608.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue609.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue610.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue612.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue613.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue616.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue62.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue623.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue624.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue625.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue626.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue628.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue629.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue63.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue632.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue634.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue635.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue636.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue637.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue637a.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue637b.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue638.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue639.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue64.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue642.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue643.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue646.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue647.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue65.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue650.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue651.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue652.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue653.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue654.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue66.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue661.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue662.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue663.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue665.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue666.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue667.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue668.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue670.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue672.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue673.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue674.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue675.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue677.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue677arrow.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue683.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue684.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue685.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue686.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue687.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue688.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue689.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue692.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue695.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue698.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue701.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue702.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue711.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue715.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue717.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue720.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue721.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue724.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue727.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue728.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue730.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue732.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue737.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue741.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue743.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue744.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue748.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue750.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue751.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue754.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue756.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue760.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue762.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue763.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue766.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue77.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue774.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue780.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue782.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue785.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue786.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue787.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue790.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue791.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue793.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue794.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue796.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue797.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue811.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue816.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue82.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue822.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue823.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue832.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue836.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue840.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue841.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue844.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue846.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue850.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue858.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue868.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue87.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue870.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue88.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue89.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue90.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue921.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue923.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue924.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue96.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue964.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issue975.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issues573.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issues597.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issues648.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/Issues649.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/ParameterProperties.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/SyntacticallyIncorrectStrings.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/TsxSamples.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/arbitraryModuleNamespaceIdentifiers.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/arrow.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/arrowInsideCall.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/assertions.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/awaitColoring.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/awaitUsedInExpression.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/awaited.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/bigint.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/binder.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/conditionalTypes.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/constType.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/constTypeAssert.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/constants.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/constructorType.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/destructuringWithDefaults.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/directives.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/docComments.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/enumMemberWithIntializer.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/enumMemberWithQuotedMemberName.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/exportDeclarations.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/forof.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/generator.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/genericTaggedTemplate.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/importAssert.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/importTypeOnly.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/importTypes.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/inferTypes.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/intrinsic.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue1005.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue327.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue522_1.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue534.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue776.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue806.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue807.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue807ts.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue809.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue812.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue814.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue824.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue907.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue909.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue916.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue927.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue930.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue932.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue935.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue940.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue948.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue949.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue951.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue957.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/issue971.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/javascript.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/javascriptClasses.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/jsdocProperty.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/jsdocType.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/jsxTagWithTypeArguments.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/keyof.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/mappedType.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/modifierOperators.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/multilineArrow.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/multilineDestructuringParametersOfArrow.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/multineTag.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/multipleVariableDeclaration.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/namedTuples.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/namespaceAndModule.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/notMultilineArrow1.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/notMultilineArrow2.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/notMultilineArrow3.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/numeric.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/numericAsType.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/objectLiteral.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/objectLiteralWithCast.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/objectType.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/optionalChaining.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/parameterBindingPattern.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/partialTypeArguments.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/pr48_noSemiColon.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/pr557_namespacedJsx.tsx | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/privateFields.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/property.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/propertyNameInObjectBindingElement.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/readonly.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/readonlyModifier.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/regexp.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/resolutionMode.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/restAndSpreadExpression.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/restInBindingPattern.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/satisfies.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/specialNew.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/templateLiteralType.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/typeofClass.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/typeparameterDefault.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/using.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/variableBindingPattern.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-cases | tests/cases/varianceAnnotations.ts | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| typescript-tmlanguage-baselines | tests/baselines/Abstracts.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/ArrowFunctionInsideTypeAssertion.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Comments.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/FunctionMethodOverloads.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/FunctionMethodParameters.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/FunctionMethodReturnTypes.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue10.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue1006.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue11.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue110.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue112.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue114.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue115.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue119.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue124.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue131.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue133.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue135.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue139.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue142.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue143.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue146.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue148.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue149.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue152.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue153.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue154.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue155.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue156.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue157.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue158.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue161.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue163.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue166.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue171.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue172.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue175.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue177.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue178.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue180.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue182.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue183.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue186.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue187.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue191.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue193.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue197.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue198.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue200.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue202.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue203.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue206.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue208.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue212.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue215.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue216.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue217.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue218.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue219.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue22.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue221.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue223.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue226.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue230.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue232.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue235.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue236.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue237.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue239.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue241.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue243.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue244.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue247.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue248.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue249.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue250.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue251.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue252.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue262.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue264.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue276.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue28.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue280.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue283.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue285.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue288.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue292.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue294.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue3.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue304.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue305.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue307.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue314.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue318.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue32.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue321.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue322.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue326.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue334.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue335.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue337.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue338.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue339.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue343.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue344.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue346.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue347.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue351.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue356.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue357.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue359.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue36.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue361.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue365.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue366.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue368.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue37.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue375.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue376.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue377.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue379.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue380.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue381.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue382.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue383.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue384.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue387.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue388.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue389.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue391.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue393.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue394.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue396.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue397.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue398.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue402.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue403IncorrectlyDetectedArrowTypeParameters.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue403IncorrectlyDetectedFunctionCallAsArrow.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue405.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue407.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue408.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue415.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue417.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue418.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue42.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue420.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue421.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue423.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue427.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue428.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue43.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue430.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue431.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue433.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue434.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue435.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue44.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue441.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue444.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue445.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue450.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue452.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue453.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue455.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue458.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue460.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue461.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue463.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue466.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue468.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue470.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue471.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue472.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue476.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue477.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue478.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue480.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue482.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue484.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue485.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue486.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue491.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue496.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue499.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue5.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue500.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue502.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue506.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue510.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue513.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue515.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue518.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue521.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue522.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue525.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue526.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue530.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue531.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue536.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue538.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue540.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue543.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue549.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue550.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue551.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue554.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue556.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue558.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue559.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue562.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue566.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue567.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue569.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue571.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue572.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue572ForLoop.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue575.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue578.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue579.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue580.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue581.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue584.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue585.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue586.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue59.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue590.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue591.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue592.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue595.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue598.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue601.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue602.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue604.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue605.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue606.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue607.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue608.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue609.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue610.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue612.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue613.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue616.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue62.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue623.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue624.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue625.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue626.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue628.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue629.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue63.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue632.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue634.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue635.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue636.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue637.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue637a.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue637b.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue638.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue639.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue64.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue642.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue643.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue646.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue647.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue65.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue650.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue651.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue652.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue653.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue654.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue66.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue661.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue662.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue663.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue665.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue666.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue667.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue668.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue670.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue672.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue673.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue674.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue675.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue677.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue677arrow.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue683.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue684.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue685.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue686.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue687.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue688.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue689.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue692.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue695.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue698.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue701.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue702.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue711.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue715.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue717.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue720.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue721.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue724.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue727.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue728.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue730.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue732.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue737.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue741.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue743.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue744.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue748.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue750.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue751.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue754.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue756.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue760.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue762.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue763.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue766.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue77.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue774.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue780.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue782.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue785.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue786.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue787.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue790.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue791.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue793.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue794.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue796.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue797.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue811.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue816.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue82.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue822.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue823.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue832.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue836.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue840.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue841.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue844.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue846.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue850.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue858.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue868.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue87.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue870.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue88.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue89.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue90.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue921.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue923.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue924.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue96.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue964.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issue975.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issues573.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issues597.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issues648.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/Issues649.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/ParameterProperties.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/SyntacticallyIncorrectStrings.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/TsxSamples.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/arbitraryModuleNamespaceIdentifiers.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/arrow.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/arrowInsideCall.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/assertions.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/awaitColoring.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/awaitUsedInExpression.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/awaited.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/bigint.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/binder.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/conditionalTypes.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/constType.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/constTypeAssert.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/constants.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/constructorType.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/destructuringWithDefaults.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/directives.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/docComments.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/enumMemberWithIntializer.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/enumMemberWithQuotedMemberName.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/exportDeclarations.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/forof.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/generator.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/genericTaggedTemplate.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/importAssert.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/importTypeOnly.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/importTypes.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/inferTypes.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/intrinsic.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue1005.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue327.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue522_1.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue534.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue776.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue806.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue807.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue807ts.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue809.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue812.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue814.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue824.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue907.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue909.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue916.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue927.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue930.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue932.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue935.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue940.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue948.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue949.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue951.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue957.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/issue971.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/javascript.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/javascriptClasses.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/jsdocProperty.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/jsdocType.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/jsxTagWithTypeArguments.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/keyof.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/mappedType.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/modifierOperators.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/multilineArrow.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/multilineDestructuringParametersOfArrow.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/multineTag.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/multipleVariableDeclaration.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/namedTuples.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/namespaceAndModule.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/notMultilineArrow1.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/notMultilineArrow2.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/notMultilineArrow3.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/numeric.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/numericAsType.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/objectLiteral.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/objectLiteralWithCast.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/objectType.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/optionalChaining.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/parameterBindingPattern.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/partialTypeArguments.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/pr48_noSemiColon.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/pr557_namespacedJsx.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/privateFields.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/property.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/propertyNameInObjectBindingElement.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/readonly.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/readonlyModifier.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/regexp.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/resolutionMode.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/restAndSpreadExpression.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/restInBindingPattern.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/satisfies.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/specialNew.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/templateLiteralType.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/typeofClass.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/typeparameterDefault.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/using.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/variableBindingPattern.baseline.txt | Source-file permission review is unresolved or restricted. |
| typescript-tmlanguage-baselines | tests/baselines/varianceAnnotations.baseline.txt | Source-file permission review is unresolved or restricted. |
| catalog-samples | samples/abap.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/actionscript-3.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ada.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ahk.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ahk2.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/angular-html.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/angular-ts.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/apache.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/apex.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/apl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/applescript.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ara.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/asciidoc.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/asm.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/astro.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/awk.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ballerina.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/bat.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/beancount.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/berry.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/bibtex.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/bicep.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/bird2.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/blade.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/bsl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/c.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/c3.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/cadence.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/cairo.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/chapel.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/clarity.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/clojure.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/cmake.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/cobol.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/codeowners.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/codeql.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/coffee.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/common-lisp.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/coq.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/cpp.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/crystal.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/csharp.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/css.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/csv.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/cue.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/cypher.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/d.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/dart.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/dax.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/desktop.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/diff.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/docker.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/dotenv.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/dream-maker.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/edge.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/elixir.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/elm.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/emacs-lisp.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/erb.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/erlang.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/fennel.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/fish.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/fluent.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/fortran-fixed-form.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/fortran-free-form.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/fsharp.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/gdresource.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/gdscript.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/gdshader.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/genie.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/gherkin.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/gleam.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/glimmer-js.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/glimmer-ts.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/glsl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/gn.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/gnuplot.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/go.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/graphql.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/groovy.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/hack.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/haml.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/handlebars.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/haskell.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/haxe.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/hcl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/hjson.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/hlsl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/html.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/http.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/hurl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/hxml.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/hy.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/imba.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ini.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/java.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/jinja.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/jison.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/json.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/json5.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/jsonc.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/jsonl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/jsonnet.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/jssm.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/jsx.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/julia.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/just.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/kdl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/kotlin.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/kusto.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/latex.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/lean.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/less.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/liquid.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/llvm.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/log.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/logo.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/lua.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/luau.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/make.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/markdown.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/marko.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/matlab.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/mdc.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/mdx.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/mermaid.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/mipsasm.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/mojo.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/moonbit.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/move.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/narrat.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/nextflow.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/nginx.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/nim.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/nix.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/nsis.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/nushell.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/objective-c.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/objective-cpp.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ocaml.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/odin.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/openscad.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/org.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/pascal.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/perl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/php.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/pkl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/plsql.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/po.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/polar.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/postcss.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/powerquery.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/powershell.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/prisma.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/prolog.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/proto.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/pug.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/puppet.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/purescript.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/python.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/qml.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/qmldir.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/qss.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/r.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/racket.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/raku.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/razor.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/rbs.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/reg.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/regexp.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/rel.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/riscv.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ron.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/rosmsg.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/rst.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ruby.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/rust.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/sas.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/sass.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/scala.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/scheme.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/scss.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/sdbl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/shaderlab.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/shellscript.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/shellsession.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/smalltalk.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/smithy.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/solidity.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/soy.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/sparql.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/splunk.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/sql.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ssh-config.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/stata.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/stylus.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/surrealql.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/svelte.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/swift.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/system-verilog.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/systemd.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/talonscript.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/tasl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/tcl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/templ.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/terraform.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/tex.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/toml.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/ts-tags.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/tsv.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/tsx.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/turtle.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/twig.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/typespec.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/typst.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/v.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/vala.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/vb.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/verilog.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/vhdl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/viml.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/vue-html.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/vue-vine.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/vue.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/vyper.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/wasm.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/wenyan.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/wgsl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/wikitext.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/wit.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/wolfram.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/xml.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/xsl.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/yaml.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/zenscript.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |
| catalog-samples | samples/zig.sample | Inventoried only. Per-file permission/provenance review remains open; excluded from the runnable denominator. |

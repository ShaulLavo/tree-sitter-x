# Native scope pilot candidate report

Limited experiment. This report is candidate evidence and never a golden. Phase 2 acceptance remains OPEN until safety/schema CI and every strict improvement cell pass. No performance benefit or consumer cutover is claimed.

Stable report input identity: 7f519aa5ec304b978232f214b4614c9eda63732e5b48b71a8f0faf5b7940e744. Identity uses runtime/artifact/input content hashes and never moving Git HEAD.

## Identities

- json: {"componentSha256":"94efc88752468b1f5246c449b10f05c61dd6e10b05d5c471f3f37d1350b407c8","sourceDigest":"55a3aed35752e87ab5263d1a5168db9d123630cebb4899baaeaa55996b23678e","runtimeSha256":"c99c9d5aece8a52e7fe01232950ec19f8bc644d6d22adf06aeb615794c999175","abi":"1","packId":"json","packVersion":"pilot-1","querySha256":"2a7d911634197084f96a7ebc6f149f8bc29012b45943268d0939d049d0fbaccf","languageId":"json","parserLanguageId":"json","parserSha256":"d2119fb98d5912719b13f9458574f8608d2d29dfbe45f6be1f860ea1fe2a2405","composition":"scope-compat-compose-1+contained-span-order-1","predicateDialect":"eq/any-of/make-range/priority;text-class-ascii-1;prefix-utf16-1;make-span-utf16-1;source-gap-utf16-max2-1","selectedOrderPolicy":"legacy-1"}
- typescript: {"componentSha256":"94efc88752468b1f5246c449b10f05c61dd6e10b05d5c471f3f37d1350b407c8","sourceDigest":"55a3aed35752e87ab5263d1a5168db9d123630cebb4899baaeaa55996b23678e","runtimeSha256":"c99c9d5aece8a52e7fe01232950ec19f8bc644d6d22adf06aeb615794c999175","abi":"1","packId":"typescript","packVersion":"pilot-1","querySha256":"61b2abc87d286b290049d2b6448e9334c9ac381684a3b495f984f51d0bf1b60d","languageId":"typescript","parserLanguageId":"typescript","parserSha256":"778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d","composition":"scope-compat-compose-1+contained-span-order-1","predicateDialect":"eq/any-of/make-range/priority;text-class-ascii-1;prefix-utf16-1;make-span-utf16-1;source-gap-utf16-max2-1","selectedOrderPolicy":"contained-span-order-1"}
- tsx: {"componentSha256":"94efc88752468b1f5246c449b10f05c61dd6e10b05d5c471f3f37d1350b407c8","sourceDigest":"55a3aed35752e87ab5263d1a5168db9d123630cebb4899baaeaa55996b23678e","runtimeSha256":"c99c9d5aece8a52e7fe01232950ec19f8bc644d6d22adf06aeb615794c999175","abi":"1","packId":"tsx","packVersion":"pilot-1","querySha256":"8c08bab69525e44ccd968978d884bcd999c797d89acd5dbd4579d09b9016d415","languageId":"tsx","parserLanguageId":"tsx","parserSha256":"79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8","composition":"scope-compat-compose-1+contained-span-order-1","predicateDialect":"eq/any-of/make-range/priority;text-class-ascii-1;prefix-utf16-1;make-span-utf16-1;source-gap-utf16-max2-1","selectedOrderPolicy":"contained-span-order-1"}
- markdown: {"LICENSE":"1cf2a3936adda9351dc283c619665a77b48d094cb9c63f68ec7ca60dd7355f18","NOTICE.md":"fc739a000b9c57359150b65a90795c0e4f639349bc13ae06cfeca3a8d04f418a","tree-sitter-markdown.wasm":"27d067c772acc4adce2c79217aaec5168914338246ad5d8ecaf4bd9d0d0548d5","tree-sitter-md.wasm":"a62768930dddde0a5d9cf49cd35f583d83e9b4aedb34de0f047fcd7879df5159","licenses/cloudlibc.txt":"c8b789cf5a746611e6300a0cc7750dbf92b61912a709d04e639245f7290656d0","licenses/cmark-gfm.txt":"c22e885f33b821bddb24cf007145e5540655b6c0f403e49e6c76a93c28e6d9a9","licenses/cmark.txt":"c22e885f33b821bddb24cf007145e5540655b6c0f403e49e6c76a93c28e6d9a9","licenses/dlmalloc.txt":"0205ac38409bb02178268367a550adf1968b34ce8e21041259505e2038540379","licenses/icu.txt":"6a18c5fac70d7860b57f5b72b4e2c9a1ba6b3d2741eef7ff9767c5379364f10d","licenses/llvm.txt":"a6c48161a09acc75a0e25503bab66a731eb5fba5392ed4bb4743e4ba5085327a","licenses/markdown-cjk-friendly.txt":"2556e6c4c696ca913376e7937b5e4125226296aafa74106a3e9b097172cf6d99","licenses/micromark-extension-gfm-strikethrough.txt":"536804b3adbff17dbbb9ed0d2bf9655b78f07640278581e37e3d7475282d5e61","licenses/micromark.txt":"dd1081884a92952802f4803110a6bb543acea9a814c786d58605b4c1219b5ebb","licenses/musl.txt":"b870108ec5e7790e9f9919064f1b9421d62d5f9b0e6c230c6adf7ea2da62e97b","licenses/tree-sitter-markdown.txt":"52ec8a1bf8256511e2a92613e0bb41ffefba3897f16fa958d7bb28c466dd4804","licenses/tree-sitter.txt":"c5cfb43042b6b72045f4ba997834d0a7786d2793d91680868b5815b39f14fc78","licenses/wasi-libc.txt":"23f18e03dc49df91622fe2a76176497404e46ced8a715d9d2b67a7446571cca3"}
- markdownCommit: f02e277a34375f326572b4ade2602f44ac769005
- markdownManifest: 5ad738fbb9bd385bf2dfbb24b2ca12d348133a92a48601329130ff8d210f5c65
- packManifests: d29880aff18f99a0f67505ea1b6cc8a08885d4cb0f0e935fabb955c946c4ee23
- corpus: 9432a17cd3b922025decb15bb3f4f1b7067383da23ae1221f5c2e23de3a82a5e
- references: f8c92516fa9f660ccbd76c90a7e84e4d9d581e5be7e9772fd4c6becec23a77d9
- baselines: 62b6ab7006b068634d33ca47ea5f264df255ea8280228b12f74dd6c34ed9e38f

## Coverage and limits

Two bounded pilot pack-authoring rounds. JSON is the unchanged PR A pack; TypeScript and TSX are explicit variants. JavaScript and JSX are distinct deferred variants. Regex predicates, local analysis, JSDoc tag specialization and contextual all-caps naming are deferred. Unsupported operators fail pack load; they are never silently skipped. Markdown uses current consumer Git pin f02e277, package version 0.1.32 plus unreleased changes, flags 3. The historical 0.1.1 baseline is unchanged.

| Language | Inputs | Complete | Unsupported | Error | Timeout |
| --- | ---: | ---: | ---: | ---: | ---: |
| json | 7 | 7 | 0 | 0 | 0 |
| typescript | 24 | 24 | 0 | 0 | 0 |
| tsx | 5 | 5 | 0 | 0 | 0 |
| markdown | 1 | 1 | 0 | 0 | 0 |
| javascript | 7 | 0 | 7 | 0 | 0 |
| jsx | 0 | 0 | 0 | 0 | 0 |

Scope tables use the unchanged raw, product and shiki-api reference scopes; shiki-api is scope-only. Markdown product:warm remains separate from cold product and raw. Styles use each raw/product reference matcher and theme normalization unchanged, and are reported rather than gated. A union includes a reference-complete file when any applicable candidate completed it. An incomplete native or applicable baseline receives zero matching units on that same union, including per-file macro. Baselines outside their declared language support are N/A, including both Markdown baselines. Reference failures and files all candidates fail have no comparable truth/output and are listed explicitly. Empty denominators are N/A.

## Exact scope agreement on common union denominators

| Language | Reference | Lane | Candidate | Complete / inputs | All | Non-whitespace | File macro | Matching / union | Non-whitespace matching / union |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| javascript | raw | real | native | 0/7 | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | raw | real | baseline:captures | 7/7 | 5.21% | 0.00% | 6.19% | 380/7297 | 0/5601 |
| javascript | raw | real | baseline:vscode-ts | 0/7 | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | product | real | native | 0/7 | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | product | real | baseline:captures | 7/7 | 5.21% | 0.00% | 6.19% | 380/7297 | 0/5601 |
| javascript | product | real | baseline:vscode-ts | 0/7 | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | shiki-api | real | native | 0/7 | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | shiki-api | real | baseline:captures | 7/7 | 5.21% | 0.00% | 6.19% | 380/7297 | 0/5601 |
| javascript | shiki-api | real | baseline:vscode-ts | 0/7 | N/A | N/A | N/A | 0/0 | 0/0 |
| typescript | raw | real | native | 7/7 | 58.73% | 56.91% | 72.97% | 3491/5944 | 2541/4465 |
| typescript | raw | real | baseline:captures | 7/7 | 8.40% | 0.00% | 7.04% | 499/5944 | 0/4465 |
| typescript | raw | real | baseline:vscode-ts | 7/7 | 8.87% | 0.63% | 7.20% | 527/5944 | 28/4465 |
| typescript | product | real | native | 7/7 | 58.73% | 56.91% | 72.97% | 3491/5944 | 2541/4465 |
| typescript | product | real | baseline:captures | 7/7 | 8.40% | 0.00% | 7.04% | 499/5944 | 0/4465 |
| typescript | product | real | baseline:vscode-ts | 7/7 | 8.87% | 0.63% | 7.20% | 527/5944 | 28/4465 |
| typescript | shiki-api | real | native | 7/7 | 58.73% | 56.91% | 72.97% | 3491/5944 | 2541/4465 |
| typescript | shiki-api | real | baseline:captures | 7/7 | 8.40% | 0.00% | 7.04% | 499/5944 | 0/4465 |
| typescript | shiki-api | real | baseline:vscode-ts | 7/7 | 8.87% | 0.63% | 7.20% | 527/5944 | 28/4465 |
| tsx | raw | real | native | 1/1 | 97.86% | 100.00% | 97.86% | 137/140 | 114/114 |
| tsx | raw | real | baseline:captures | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 | 0/114 |
| tsx | raw | real | baseline:vscode-ts | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 | 0/114 |
| tsx | product | real | native | 1/1 | 97.86% | 100.00% | 97.86% | 137/140 | 114/114 |
| tsx | product | real | baseline:captures | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 | 0/114 |
| tsx | product | real | baseline:vscode-ts | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 | 0/114 |
| tsx | shiki-api | real | native | 1/1 | 97.86% | 100.00% | 97.86% | 137/140 | 114/114 |
| tsx | shiki-api | real | baseline:captures | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 | 0/114 |
| tsx | shiki-api | real | baseline:vscode-ts | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 | 0/114 |
| json | raw | real | native | 1/1 | 38.12% | 21.76% | 38.12% | 85/223 | 37/170 |
| json | raw | real | baseline:captures | 1/1 | 5.83% | 0.00% | 5.83% | 13/223 | 0/170 |
| json | raw | real | baseline:vscode-ts | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | real | native | 1/1 | 38.12% | 21.76% | 38.12% | 85/223 | 37/170 |
| json | product | real | baseline:captures | 1/1 | 5.83% | 0.00% | 5.83% | 13/223 | 0/170 |
| json | product | real | baseline:vscode-ts | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| json | shiki-api | real | native | 1/1 | 38.12% | 21.76% | 38.12% | 85/223 | 37/170 |
| json | shiki-api | real | baseline:captures | 1/1 | 5.83% | 0.00% | 5.83% | 13/223 | 0/170 |
| json | shiki-api | real | baseline:vscode-ts | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| json | raw | original | native | 6/6 | 99.85% | 99.85% | 61.39% | 20025/20055 | 20002/20032 |
| json | raw | original | baseline:captures | 6/6 | 0.06% | 0.00% | 14.51% | 13/20055 | 0/20032 |
| json | raw | original | baseline:vscode-ts | 0/6 | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | original | native | 6/6 | 99.85% | 99.85% | 61.39% | 20025/20055 | 20002/20032 |
| json | product | original | baseline:captures | 6/6 | 0.06% | 0.00% | 14.51% | 13/20055 | 0/20032 |
| json | product | original | baseline:vscode-ts | 0/6 | N/A | N/A | N/A | 0/0 | 0/0 |
| json | shiki-api | original | native | 6/6 | 0.15% | 0.04% | 41.39% | 30/20055 | 8/20032 |
| json | shiki-api | original | baseline:captures | 6/6 | 0.06% | 0.00% | 14.51% | 13/20055 | 0/20032 |
| json | shiki-api | original | baseline:vscode-ts | 0/6 | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | native | 1/1 | 31.94% | 23.08% | 31.94% | 23/72 | 12/52 |
| markdown | raw | original | baseline:captures | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | baseline:vscode-ts | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | native | 1/1 | 31.94% | 23.08% | 31.94% | 23/72 | 12/52 |
| markdown | product | original | baseline:captures | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | baseline:vscode-ts | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | shiki-api | original | native | 1/1 | 31.94% | 23.08% | 31.94% | 23/72 | 12/52 |
| markdown | shiki-api | original | baseline:captures | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | shiki-api | original | baseline:vscode-ts | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product:warm | original | native | 1/1 | 77.78% | 71.15% | 77.78% | 56/72 | 37/52 |
| markdown | product:warm | original | baseline:captures | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product:warm | original | baseline:vscode-ts | 0/1 | N/A | N/A | N/A | 0/0 | 0/0 |
| tsx | raw | original | native | 4/4 | 99.81% | 99.85% | 77.25% | 20081/20120 | 20049/20080 |
| tsx | raw | original | baseline:captures | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 | 0/20080 |
| tsx | raw | original | baseline:vscode-ts | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 | 0/20080 |
| tsx | product | original | native | 4/4 | 99.81% | 99.85% | 77.25% | 20081/20120 | 20049/20080 |
| tsx | product | original | baseline:captures | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 | 0/20080 |
| tsx | product | original | baseline:vscode-ts | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 | 0/20080 |
| tsx | shiki-api | original | native | 4/4 | 0.40% | 0.25% | 52.27% | 81/20120 | 50/20080 |
| tsx | shiki-api | original | baseline:captures | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 | 0/20080 |
| tsx | shiki-api | original | baseline:vscode-ts | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 | 0/20080 |
| typescript | raw | original | native | 17/17 | 99.99% | 99.99% | 97.41% | 80306/80315 | 80184/80189 |
| typescript | raw | original | baseline:captures | 17/17 | 0.06% | 0.00% | 15.10% | 46/80315 | 0/80189 |
| typescript | raw | original | baseline:vscode-ts | 17/17 | 0.06% | 0.00% | 15.10% | 46/80315 | 0/80189 |
| typescript | product | original | native | 17/17 | 50.18% | 50.11% | 79.92% | 40299/80315 | 40181/80189 |
| typescript | product | original | baseline:captures | 17/17 | 0.05% | 0.00% | 8.02% | 43/80315 | 0/80189 |
| typescript | product | original | baseline:vscode-ts | 17/17 | 0.05% | 0.00% | 8.02% | 43/80315 | 0/80189 |
| typescript | shiki-api | original | native | 17/17 | 25.28% | 25.17% | 79.92% | 20300/80315 | 20182/80189 |
| typescript | shiki-api | original | baseline:captures | 17/17 | 0.05% | 0.00% | 14.27% | 44/80315 | 0/80189 |
| typescript | shiki-api | original | baseline:vscode-ts | 17/17 | 0.05% | 0.00% | 14.27% | 44/80315 | 0/80189 |

## Style agreement by theme

| Language | Reference | Lane | Candidate | Theme | All | Non-whitespace | File macro | Matching / union | Non-whitespace matching / union |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| javascript | raw | real | native | dracula | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | raw | real | baseline:captures | dracula | 94.34% | 92.63% | 96.00% | 6884/7297 | 5188/5601 |
| javascript | raw | real | baseline:vscode-ts | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | raw | real | native | github-dark | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | raw | real | baseline:captures | github-dark | 94.82% | 93.25% | 97.19% | 6919/7297 | 5223/5601 |
| javascript | raw | real | baseline:vscode-ts | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | raw | real | native | light-plus | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | raw | real | baseline:captures | light-plus | 94.26% | 92.52% | 96.72% | 6878/7297 | 5182/5601 |
| javascript | raw | real | baseline:vscode-ts | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | raw | real | native | vesper | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | raw | real | baseline:captures | vesper | 96.81% | 95.84% | 97.96% | 7064/7297 | 5368/5601 |
| javascript | raw | real | baseline:vscode-ts | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | product | real | native | dracula | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | product | real | baseline:captures | dracula | 94.34% | 92.63% | 96.00% | 6884/7297 | 5188/5601 |
| javascript | product | real | baseline:vscode-ts | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | product | real | native | github-dark | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | product | real | baseline:captures | github-dark | 94.82% | 93.25% | 97.19% | 6919/7297 | 5223/5601 |
| javascript | product | real | baseline:vscode-ts | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | product | real | native | light-plus | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | product | real | baseline:captures | light-plus | 94.26% | 92.52% | 96.72% | 6878/7297 | 5182/5601 |
| javascript | product | real | baseline:vscode-ts | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| javascript | product | real | native | vesper | 0.00% | 0.00% | 0.00% | 0/7297 | 0/5601 |
| javascript | product | real | baseline:captures | vesper | 96.81% | 95.84% | 97.96% | 7064/7297 | 5368/5601 |
| javascript | product | real | baseline:vscode-ts | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| typescript | raw | real | native | dracula | 92.03% | 92.63% | 97.30% | 5470/5944 | 4136/4465 |
| typescript | raw | real | baseline:captures | dracula | 88.17% | 85.04% | 83.18% | 5241/5944 | 3797/4465 |
| typescript | raw | real | baseline:vscode-ts | dracula | 92.23% | 90.44% | 90.41% | 5482/5944 | 4038/4465 |
| typescript | raw | real | native | github-dark | 91.23% | 91.58% | 97.04% | 5423/5944 | 4089/4465 |
| typescript | raw | real | baseline:captures | github-dark | 87.72% | 84.43% | 88.09% | 5214/5944 | 3770/4465 |
| typescript | raw | real | baseline:vscode-ts | github-dark | 88.43% | 85.38% | 86.99% | 5256/5944 | 3812/4465 |
| typescript | raw | real | native | light-plus | 84.57% | 82.71% | 94.82% | 5027/5944 | 3693/4465 |
| typescript | raw | real | baseline:captures | light-plus | 79.74% | 73.82% | 79.77% | 4740/5944 | 3296/4465 |
| typescript | raw | real | baseline:vscode-ts | light-plus | 84.93% | 80.72% | 88.18% | 5048/5944 | 3604/4465 |
| typescript | raw | real | native | vesper | 92.08% | 92.70% | 97.31% | 5473/5944 | 4139/4465 |
| typescript | raw | real | baseline:captures | vesper | 91.03% | 88.85% | 90.00% | 5411/5944 | 3967/4465 |
| typescript | raw | real | baseline:vscode-ts | vesper | 93.30% | 91.87% | 92.10% | 5546/5944 | 4102/4465 |
| typescript | product | real | native | dracula | 92.03% | 92.63% | 97.30% | 5470/5944 | 4136/4465 |
| typescript | product | real | baseline:captures | dracula | 88.17% | 85.04% | 83.18% | 5241/5944 | 3797/4465 |
| typescript | product | real | baseline:vscode-ts | dracula | 92.23% | 90.44% | 90.41% | 5482/5944 | 4038/4465 |
| typescript | product | real | native | github-dark | 91.23% | 91.58% | 97.04% | 5423/5944 | 4089/4465 |
| typescript | product | real | baseline:captures | github-dark | 87.72% | 84.43% | 88.09% | 5214/5944 | 3770/4465 |
| typescript | product | real | baseline:vscode-ts | github-dark | 88.43% | 85.38% | 86.99% | 5256/5944 | 3812/4465 |
| typescript | product | real | native | light-plus | 84.57% | 82.71% | 94.82% | 5027/5944 | 3693/4465 |
| typescript | product | real | baseline:captures | light-plus | 79.74% | 73.82% | 79.77% | 4740/5944 | 3296/4465 |
| typescript | product | real | baseline:vscode-ts | light-plus | 84.93% | 80.72% | 88.18% | 5048/5944 | 3604/4465 |
| typescript | product | real | native | vesper | 92.08% | 92.70% | 97.31% | 5473/5944 | 4139/4465 |
| typescript | product | real | baseline:captures | vesper | 91.03% | 88.85% | 90.00% | 5411/5944 | 3967/4465 |
| typescript | product | real | baseline:vscode-ts | vesper | 93.30% | 91.87% | 92.10% | 5546/5944 | 4102/4465 |
| tsx | raw | real | native | dracula | 98.57% | 100.00% | 98.57% | 138/140 | 114/114 |
| tsx | raw | real | baseline:captures | dracula | 91.43% | 89.47% | 91.43% | 128/140 | 102/114 |
| tsx | raw | real | baseline:vscode-ts | dracula | 100.00% | 100.00% | 100.00% | 140/140 | 114/114 |
| tsx | raw | real | native | github-dark | 98.57% | 100.00% | 98.57% | 138/140 | 114/114 |
| tsx | raw | real | baseline:captures | github-dark | 95.71% | 94.74% | 95.71% | 134/140 | 108/114 |
| tsx | raw | real | baseline:vscode-ts | github-dark | 98.57% | 98.25% | 98.57% | 138/140 | 112/114 |
| tsx | raw | real | native | light-plus | 98.57% | 100.00% | 98.57% | 138/140 | 114/114 |
| tsx | raw | real | baseline:captures | light-plus | 96.43% | 95.61% | 96.43% | 135/140 | 109/114 |
| tsx | raw | real | baseline:vscode-ts | light-plus | 100.00% | 100.00% | 100.00% | 140/140 | 114/114 |
| tsx | raw | real | native | vesper | 98.57% | 100.00% | 98.57% | 138/140 | 114/114 |
| tsx | raw | real | baseline:captures | vesper | 96.43% | 95.61% | 96.43% | 135/140 | 109/114 |
| tsx | raw | real | baseline:vscode-ts | vesper | 100.00% | 100.00% | 100.00% | 140/140 | 114/114 |
| tsx | product | real | native | dracula | 98.57% | 100.00% | 98.57% | 138/140 | 114/114 |
| tsx | product | real | baseline:captures | dracula | 91.43% | 89.47% | 91.43% | 128/140 | 102/114 |
| tsx | product | real | baseline:vscode-ts | dracula | 100.00% | 100.00% | 100.00% | 140/140 | 114/114 |
| tsx | product | real | native | github-dark | 98.57% | 100.00% | 98.57% | 138/140 | 114/114 |
| tsx | product | real | baseline:captures | github-dark | 95.71% | 94.74% | 95.71% | 134/140 | 108/114 |
| tsx | product | real | baseline:vscode-ts | github-dark | 98.57% | 98.25% | 98.57% | 138/140 | 112/114 |
| tsx | product | real | native | light-plus | 98.57% | 100.00% | 98.57% | 138/140 | 114/114 |
| tsx | product | real | baseline:captures | light-plus | 96.43% | 95.61% | 96.43% | 135/140 | 109/114 |
| tsx | product | real | baseline:vscode-ts | light-plus | 100.00% | 100.00% | 100.00% | 140/140 | 114/114 |
| tsx | product | real | native | vesper | 98.57% | 100.00% | 98.57% | 138/140 | 114/114 |
| tsx | product | real | baseline:captures | vesper | 96.43% | 95.61% | 96.43% | 135/140 | 109/114 |
| tsx | product | real | baseline:vscode-ts | vesper | 100.00% | 100.00% | 100.00% | 140/140 | 114/114 |
| json | raw | real | native | dracula | 84.75% | 81.18% | 84.75% | 189/223 | 138/170 |
| json | raw | real | baseline:captures | dracula | 55.61% | 41.76% | 55.61% | 124/223 | 71/170 |
| json | raw | real | baseline:vscode-ts | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| json | raw | real | native | github-dark | 84.75% | 81.18% | 84.75% | 189/223 | 138/170 |
| json | raw | real | baseline:captures | github-dark | 62.33% | 50.59% | 62.33% | 139/223 | 86/170 |
| json | raw | real | baseline:vscode-ts | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| json | raw | real | native | light-plus | 92.83% | 91.76% | 92.83% | 207/223 | 156/170 |
| json | raw | real | baseline:captures | light-plus | 62.33% | 50.59% | 62.33% | 139/223 | 86/170 |
| json | raw | real | baseline:vscode-ts | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| json | raw | real | native | vesper | 89.24% | 87.06% | 89.24% | 199/223 | 148/170 |
| json | raw | real | baseline:captures | vesper | 62.33% | 50.59% | 62.33% | 139/223 | 86/170 |
| json | raw | real | baseline:vscode-ts | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | real | native | dracula | 84.75% | 81.18% | 84.75% | 189/223 | 138/170 |
| json | product | real | baseline:captures | dracula | 55.61% | 41.76% | 55.61% | 124/223 | 71/170 |
| json | product | real | baseline:vscode-ts | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | real | native | github-dark | 84.75% | 81.18% | 84.75% | 189/223 | 138/170 |
| json | product | real | baseline:captures | github-dark | 62.33% | 50.59% | 62.33% | 139/223 | 86/170 |
| json | product | real | baseline:vscode-ts | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | real | native | light-plus | 92.83% | 91.76% | 92.83% | 207/223 | 156/170 |
| json | product | real | baseline:captures | light-plus | 62.33% | 50.59% | 62.33% | 139/223 | 86/170 |
| json | product | real | baseline:vscode-ts | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | real | native | vesper | 89.24% | 87.06% | 89.24% | 199/223 | 148/170 |
| json | product | real | baseline:captures | vesper | 62.33% | 50.59% | 62.33% | 139/223 | 86/170 |
| json | product | real | baseline:vscode-ts | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| json | raw | original | native | dracula | 99.95% | 99.96% | 89.30% | 20045/20055 | 20024/20032 |
| json | raw | original | baseline:captures | dracula | 99.91% | 99.91% | 84.32% | 20037/20055 | 20014/20032 |
| json | raw | original | baseline:vscode-ts | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| json | raw | original | native | github-dark | 99.95% | 99.96% | 89.30% | 20045/20055 | 20024/20032 |
| json | raw | original | baseline:captures | github-dark | 99.94% | 99.94% | 88.24% | 20043/20055 | 20020/20032 |
| json | raw | original | baseline:vscode-ts | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| json | raw | original | native | light-plus | 99.99% | 100.00% | 97.14% | 20053/20055 | 20032/20032 |
| json | raw | original | baseline:captures | light-plus | 99.94% | 99.94% | 88.24% | 20043/20055 | 20020/20032 |
| json | raw | original | baseline:vscode-ts | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| json | raw | original | native | vesper | 99.97% | 99.98% | 90.99% | 20049/20055 | 20028/20032 |
| json | raw | original | baseline:captures | vesper | 99.94% | 99.94% | 88.24% | 20043/20055 | 20020/20032 |
| json | raw | original | baseline:vscode-ts | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | original | native | dracula | 99.95% | 99.96% | 89.30% | 20045/20055 | 20024/20032 |
| json | product | original | baseline:captures | dracula | 99.91% | 99.91% | 84.32% | 20037/20055 | 20014/20032 |
| json | product | original | baseline:vscode-ts | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | original | native | github-dark | 99.95% | 99.96% | 89.30% | 20045/20055 | 20024/20032 |
| json | product | original | baseline:captures | github-dark | 99.94% | 99.94% | 88.24% | 20043/20055 | 20020/20032 |
| json | product | original | baseline:vscode-ts | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | original | native | light-plus | 99.99% | 100.00% | 97.14% | 20053/20055 | 20032/20032 |
| json | product | original | baseline:captures | light-plus | 99.94% | 99.94% | 88.24% | 20043/20055 | 20020/20032 |
| json | product | original | baseline:vscode-ts | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| json | product | original | native | vesper | 99.97% | 99.98% | 90.99% | 20049/20055 | 20028/20032 |
| json | product | original | baseline:captures | vesper | 99.94% | 99.94% | 88.24% | 20043/20055 | 20020/20032 |
| json | product | original | baseline:vscode-ts | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | native | dracula | 61.11% | 48.08% | 61.11% | 44/72 | 25/52 |
| markdown | raw | original | baseline:captures | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | baseline:vscode-ts | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | native | github-dark | 61.11% | 48.08% | 61.11% | 44/72 | 25/52 |
| markdown | raw | original | baseline:captures | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | baseline:vscode-ts | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | native | light-plus | 43.06% | 38.46% | 43.06% | 31/72 | 20/52 |
| markdown | raw | original | baseline:captures | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | baseline:vscode-ts | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | native | vesper | 62.50% | 50.00% | 62.50% | 45/72 | 26/52 |
| markdown | raw | original | baseline:captures | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | raw | original | baseline:vscode-ts | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | native | dracula | 61.11% | 48.08% | 61.11% | 44/72 | 25/52 |
| markdown | product | original | baseline:captures | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | baseline:vscode-ts | dracula | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | native | github-dark | 61.11% | 48.08% | 61.11% | 44/72 | 25/52 |
| markdown | product | original | baseline:captures | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | baseline:vscode-ts | github-dark | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | native | light-plus | 43.06% | 38.46% | 43.06% | 31/72 | 20/52 |
| markdown | product | original | baseline:captures | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | baseline:vscode-ts | light-plus | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | native | vesper | 62.50% | 50.00% | 62.50% | 45/72 | 26/52 |
| markdown | product | original | baseline:captures | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| markdown | product | original | baseline:vscode-ts | vesper | N/A | N/A | N/A | 0/0 | 0/0 |
| tsx | raw | original | native | dracula | 99.99% | 100.00% | 98.13% | 20117/20120 | 20079/20080 |
| tsx | raw | original | baseline:captures | dracula | 99.93% | 99.93% | 90.94% | 20105/20120 | 20065/20080 |
| tsx | raw | original | baseline:vscode-ts | dracula | 99.91% | 99.91% | 88.55% | 20102/20120 | 20062/20080 |
| tsx | raw | original | native | github-dark | 99.99% | 100.00% | 98.13% | 20117/20120 | 20079/20080 |
| tsx | raw | original | baseline:captures | github-dark | 99.92% | 99.92% | 90.71% | 20104/20120 | 20064/20080 |
| tsx | raw | original | baseline:vscode-ts | github-dark | 99.89% | 99.89% | 86.23% | 20098/20120 | 20058/20080 |
| tsx | raw | original | native | light-plus | 99.99% | 100.00% | 98.13% | 20117/20120 | 20079/20080 |
| tsx | raw | original | baseline:captures | light-plus | 99.87% | 99.87% | 84.81% | 20094/20120 | 20054/20080 |
| tsx | raw | original | baseline:vscode-ts | light-plus | 99.79% | 99.79% | 73.99% | 20077/20120 | 20037/20080 |
| tsx | raw | original | native | vesper | 99.99% | 100.00% | 98.13% | 20117/20120 | 20079/20080 |
| tsx | raw | original | baseline:captures | vesper | 99.95% | 99.95% | 93.48% | 20109/20120 | 20069/20080 |
| tsx | raw | original | baseline:vscode-ts | vesper | 99.80% | 99.80% | 75.69% | 20080/20120 | 20040/20080 |
| tsx | product | original | native | dracula | 99.99% | 100.00% | 98.13% | 20117/20120 | 20079/20080 |
| tsx | product | original | baseline:captures | dracula | 99.93% | 99.93% | 90.94% | 20105/20120 | 20065/20080 |
| tsx | product | original | baseline:vscode-ts | dracula | 99.91% | 99.91% | 88.55% | 20102/20120 | 20062/20080 |
| tsx | product | original | native | github-dark | 99.99% | 100.00% | 98.13% | 20117/20120 | 20079/20080 |
| tsx | product | original | baseline:captures | github-dark | 99.92% | 99.92% | 90.71% | 20104/20120 | 20064/20080 |
| tsx | product | original | baseline:vscode-ts | github-dark | 99.89% | 99.89% | 86.23% | 20098/20120 | 20058/20080 |
| tsx | product | original | native | light-plus | 99.99% | 100.00% | 98.13% | 20117/20120 | 20079/20080 |
| tsx | product | original | baseline:captures | light-plus | 99.87% | 99.87% | 84.81% | 20094/20120 | 20054/20080 |
| tsx | product | original | baseline:vscode-ts | light-plus | 99.79% | 99.79% | 73.99% | 20077/20120 | 20037/20080 |
| tsx | product | original | native | vesper | 99.99% | 100.00% | 98.13% | 20117/20120 | 20079/20080 |
| tsx | product | original | baseline:captures | vesper | 99.95% | 99.95% | 93.48% | 20109/20120 | 20069/20080 |
| tsx | product | original | baseline:vscode-ts | vesper | 99.80% | 99.80% | 75.69% | 20080/20120 | 20040/20080 |
| typescript | raw | original | native | dracula | 99.98% | 100.00% | 96.68% | 80301/80315 | 80189/80189 |
| typescript | raw | original | baseline:captures | dracula | 99.99% | 99.99% | 98.38% | 80306/80315 | 80180/80189 |
| typescript | raw | original | baseline:vscode-ts | dracula | 100.00% | 100.00% | 100.00% | 80315/80315 | 80189/80189 |
| typescript | raw | original | native | github-dark | 99.98% | 100.00% | 96.68% | 80301/80315 | 80189/80189 |
| typescript | raw | original | baseline:captures | github-dark | 99.99% | 99.99% | 97.14% | 80305/80315 | 80179/80189 |
| typescript | raw | original | baseline:vscode-ts | github-dark | 99.96% | 99.96% | 93.32% | 80285/80315 | 80159/80189 |
| typescript | raw | original | native | light-plus | 99.98% | 100.00% | 96.68% | 80301/80315 | 80189/80189 |
| typescript | raw | original | baseline:captures | light-plus | 99.98% | 99.98% | 96.57% | 80302/80315 | 80176/80189 |
| typescript | raw | original | baseline:vscode-ts | light-plus | 99.99% | 99.99% | 97.14% | 80305/80315 | 80179/80189 |
| typescript | raw | original | native | vesper | 99.98% | 100.00% | 96.68% | 80301/80315 | 80189/80189 |
| typescript | raw | original | baseline:captures | vesper | 100.00% | 100.00% | 100.00% | 80315/80315 | 80189/80189 |
| typescript | raw | original | baseline:vscode-ts | vesper | 100.00% | 100.00% | 100.00% | 80315/80315 | 80189/80189 |
| typescript | product | original | native | dracula | 50.16% | 50.11% | 77.02% | 40287/80315 | 40183/80189 |
| typescript | product | original | baseline:captures | dracula | 50.17% | 50.10% | 78.71% | 40292/80315 | 40174/80189 |
| typescript | product | original | baseline:vscode-ts | dracula | 50.18% | 50.11% | 80.33% | 40301/80315 | 40183/80189 |
| typescript | product | original | native | github-dark | 50.16% | 50.11% | 77.02% | 40287/80315 | 40183/80189 |
| typescript | product | original | baseline:captures | github-dark | 50.17% | 50.10% | 77.47% | 40291/80315 | 40173/80189 |
| typescript | product | original | baseline:vscode-ts | github-dark | 50.14% | 50.07% | 73.66% | 40272/80315 | 40154/80189 |
| typescript | product | original | native | light-plus | 50.16% | 50.11% | 77.02% | 40287/80315 | 40183/80189 |
| typescript | product | original | baseline:captures | light-plus | 50.16% | 50.09% | 76.90% | 40288/80315 | 40170/80189 |
| typescript | product | original | baseline:vscode-ts | light-plus | 50.17% | 50.10% | 77.47% | 40291/80315 | 40173/80189 |
| typescript | product | original | native | vesper | 50.16% | 50.11% | 77.02% | 40287/80315 | 40183/80189 |
| typescript | product | original | baseline:captures | vesper | 50.18% | 50.11% | 80.33% | 40301/80315 | 40183/80189 |
| typescript | product | original | baseline:vscode-ts | vesper | 50.18% | 50.11% | 80.33% | 40301/80315 | 40183/80189 |

## Per-file regressions

| Language | Reference | Lane | Fixture | Baseline | Native matching | Baseline matching | Union units |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| javascript | raw | real | textmate-grammars-themes/samples/javascript.sample | baseline:captures | 0, non-whitespace 0 | 202, non-whitespace 0 | 3946 |
| javascript | product | real | textmate-grammars-themes/samples/javascript.sample | baseline:captures | 0, non-whitespace 0 | 202, non-whitespace 0 | 3946 |
| javascript | shiki-api | real | textmate-grammars-themes/samples/javascript.sample | baseline:captures | 0, non-whitespace 0 | 202, non-whitespace 0 | 3946 |
| javascript | raw | real | tree-sitter-highlight/test/highlight/functions.js | baseline:captures | 0, non-whitespace 0 | 55, non-whitespace 0 | 603 |
| javascript | product | real | tree-sitter-highlight/test/highlight/functions.js | baseline:captures | 0, non-whitespace 0 | 55, non-whitespace 0 | 603 |
| javascript | shiki-api | real | tree-sitter-highlight/test/highlight/functions.js | baseline:captures | 0, non-whitespace 0 | 55, non-whitespace 0 | 603 |
| javascript | raw | real | tree-sitter-highlight/test/highlight/imports.js | baseline:captures | 0, non-whitespace 0 | 4, non-whitespace 0 | 139 |
| javascript | product | real | tree-sitter-highlight/test/highlight/imports.js | baseline:captures | 0, non-whitespace 0 | 4, non-whitespace 0 | 139 |
| javascript | shiki-api | real | tree-sitter-highlight/test/highlight/imports.js | baseline:captures | 0, non-whitespace 0 | 4, non-whitespace 0 | 139 |
| javascript | raw | real | tree-sitter-highlight/test/highlight/injection.js | baseline:captures | 0, non-whitespace 0 | 6, non-whitespace 0 | 96 |
| javascript | product | real | tree-sitter-highlight/test/highlight/injection.js | baseline:captures | 0, non-whitespace 0 | 6, non-whitespace 0 | 96 |
| javascript | shiki-api | real | tree-sitter-highlight/test/highlight/injection.js | baseline:captures | 0, non-whitespace 0 | 6, non-whitespace 0 | 96 |
| javascript | raw | real | tree-sitter-highlight/test/highlight/keywords.js | baseline:captures | 0, non-whitespace 0 | 22, non-whitespace 0 | 181 |
| javascript | product | real | tree-sitter-highlight/test/highlight/keywords.js | baseline:captures | 0, non-whitespace 0 | 22, non-whitespace 0 | 181 |
| javascript | shiki-api | real | tree-sitter-highlight/test/highlight/keywords.js | baseline:captures | 0, non-whitespace 0 | 22, non-whitespace 0 | 181 |
| javascript | raw | real | tree-sitter-highlight/test/highlight/variables.js | baseline:captures | 0, non-whitespace 0 | 52, non-whitespace 0 | 1184 |
| javascript | product | real | tree-sitter-highlight/test/highlight/variables.js | baseline:captures | 0, non-whitespace 0 | 52, non-whitespace 0 | 1184 |
| javascript | shiki-api | real | tree-sitter-highlight/test/highlight/variables.js | baseline:captures | 0, non-whitespace 0 | 52, non-whitespace 0 | 1184 |
| javascript | raw | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | baseline:captures | 0, non-whitespace 0 | 39, non-whitespace 0 | 1148 |
| javascript | product | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | baseline:captures | 0, non-whitespace 0 | 39, non-whitespace 0 | 1148 |
| javascript | shiki-api | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | baseline:captures | 0, non-whitespace 0 | 39, non-whitespace 0 | 1148 |

## Mismatch categories

| Language | Reference | Lane | Category | Runs | Units |
| --- | --- | --- | --- | ---: | ---: |
| typescript | raw | real | leaf | 18 | 24 |
| typescript | raw | real | missing-scope | 850 | 1767 |
| typescript | raw | real | extra-scope | 30 | 53 |
| typescript | raw | real | ancestor | 133 | 255 |
| typescript | raw | real | other | 159 | 354 |
| typescript | product | real | leaf | 18 | 24 |
| typescript | product | real | missing-scope | 850 | 1767 |
| typescript | product | real | extra-scope | 30 | 53 |
| typescript | product | real | ancestor | 133 | 255 |
| typescript | product | real | other | 159 | 354 |
| typescript | shiki-api | real | leaf | 18 | 24 |
| typescript | shiki-api | real | missing-scope | 850 | 1767 |
| typescript | shiki-api | real | extra-scope | 30 | 53 |
| typescript | shiki-api | real | ancestor | 133 | 255 |
| typescript | shiki-api | real | other | 159 | 354 |
| tsx | raw | real | missing-scope | 1 | 3 |
| tsx | product | real | missing-scope | 1 | 3 |
| tsx | shiki-api | real | missing-scope | 1 | 3 |
| json | raw | real | leaf | 21 | 33 |
| json | raw | real | missing-scope | 11 | 25 |
| json | raw | real | ancestor | 9 | 62 |
| json | raw | real | other | 18 | 18 |
| json | product | real | leaf | 21 | 33 |
| json | product | real | missing-scope | 11 | 25 |
| json | product | real | ancestor | 9 | 62 |
| json | product | real | other | 18 | 18 |
| json | shiki-api | real | leaf | 21 | 33 |
| json | shiki-api | real | missing-scope | 11 | 25 |
| json | shiki-api | real | ancestor | 9 | 62 |
| json | shiki-api | real | other | 18 | 18 |
| json | raw | original | leaf | 15 | 18 |
| json | raw | original | ancestor | 4 | 4 |
| json | raw | original | other | 8 | 8 |
| json | product | original | leaf | 15 | 18 |
| json | product | original | ancestor | 4 | 4 |
| json | product | original | other | 8 | 8 |
| json | shiki-api | original | leaf | 13 | 16 |
| json | shiki-api | original | ancestor | 3 | 3 |
| json | shiki-api | original | other | 6 | 6 |
| json | shiki-api | original | extra-scope | 10 | 20000 |
| markdown | raw | original | leaf | 2 | 6 |
| markdown | raw | original | missing-scope | 3 | 8 |
| markdown | raw | original | extra-scope | 29 | 35 |
| markdown | product | original | leaf | 2 | 6 |
| markdown | product | original | missing-scope | 3 | 8 |
| markdown | product | original | extra-scope | 29 | 35 |
| markdown | shiki-api | original | leaf | 2 | 6 |
| markdown | shiki-api | original | missing-scope | 3 | 8 |
| markdown | shiki-api | original | extra-scope | 29 | 35 |
| markdown | product:warm | original | leaf | 5 | 5 |
| markdown | product:warm | original | missing-scope | 3 | 8 |
| markdown | product:warm | original | ancestor | 1 | 1 |
| markdown | product:warm | original | other | 2 | 2 |
| tsx | raw | original | ancestor | 25 | 38 |
| tsx | raw | original | missing-scope | 1 | 1 |
| tsx | product | original | ancestor | 25 | 38 |
| tsx | product | original | missing-scope | 1 | 1 |
| tsx | shiki-api | original | ancestor | 25 | 38 |
| tsx | shiki-api | original | missing-scope | 1 | 1 |
| tsx | shiki-api | original | extra-scope | 2 | 20000 |
| typescript | raw | original | missing-scope | 4 | 6 |
| typescript | raw | original | extra-scope | 2 | 3 |
| typescript | product | original | extra-scope | 6 | 40005 |
| typescript | product | original | missing-scope | 1 | 2 |
| typescript | product | original | leaf | 2 | 2 |
| typescript | product | original | other | 5 | 7 |
| typescript | shiki-api | original | missing-scope | 3 | 4 |
| typescript | shiki-api | original | extra-scope | 5 | 60002 |
| typescript | shiki-api | original | leaf | 2 | 2 |
| typescript | shiki-api | original | other | 5 | 7 |

## Smallest mismatch in each category and language/profile/lane cell

### typescript / raw / real / extra-scope

textmate-grammars-themes/samples/typescript.sample:3:32, [107, 108), excerpt ";"

Reference: source.ts punctuation.terminator.statement.ts

Native: source.ts meta.type.declaration.ts punctuation.terminator.statement.ts

- [76, 108) meta.type.declaration.ts, pattern 40, interval ordinal 28, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:123
- [107, 108) punctuation.terminator.statement.ts, pattern 214, interval ordinal 134, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:383

### typescript / raw / real / missing-scope

textmate-grammars-themes/samples/typescript.sample:6:16, [230, 231), excerpt " "

Reference: source.ts meta.type.declaration.ts meta.object.type.ts meta.field.declaration.ts

Native: source.ts meta.type.declaration.ts meta.object.type.ts

- [215, 246) meta.type.declaration.ts, pattern 40, interval ordinal 28, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:123
- [229, 245) meta.object.type.ts, pattern 32, interval ordinal 22, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:115

### typescript / raw / real / leaf

textmate-grammars-themes/samples/typescript.sample:31:23, [954, 955), excerpt ","

Reference: source.ts meta.function.ts meta.parameters.ts punctuation.separator.parameter.ts

Native: source.ts meta.function.ts meta.parameters.ts punctuation.separator.comma.ts

- [932, 994) meta.function.ts, pattern 23, interval ordinal 17, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:106
- [944, 966) meta.parameters.ts, pattern 29, interval ordinal 20, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:112
- [954, 955) punctuation.separator.comma.ts, pattern 215, interval ordinal 135, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:384

### typescript / product / real / extra-scope

textmate-grammars-themes/samples/typescript.sample:3:32, [107, 108), excerpt ";"

Reference: source.ts punctuation.terminator.statement.ts

Native: source.ts meta.type.declaration.ts punctuation.terminator.statement.ts

- [76, 108) meta.type.declaration.ts, pattern 40, interval ordinal 28, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:123
- [107, 108) punctuation.terminator.statement.ts, pattern 214, interval ordinal 134, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:383

### typescript / product / real / missing-scope

textmate-grammars-themes/samples/typescript.sample:6:16, [230, 231), excerpt " "

Reference: source.ts meta.type.declaration.ts meta.object.type.ts meta.field.declaration.ts

Native: source.ts meta.type.declaration.ts meta.object.type.ts

- [215, 246) meta.type.declaration.ts, pattern 40, interval ordinal 28, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:123
- [229, 245) meta.object.type.ts, pattern 32, interval ordinal 22, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:115

### typescript / product / real / leaf

textmate-grammars-themes/samples/typescript.sample:31:23, [954, 955), excerpt ","

Reference: source.ts meta.function.ts meta.parameters.ts punctuation.separator.parameter.ts

Native: source.ts meta.function.ts meta.parameters.ts punctuation.separator.comma.ts

- [932, 994) meta.function.ts, pattern 23, interval ordinal 17, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:106
- [944, 966) meta.parameters.ts, pattern 29, interval ordinal 20, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:112
- [954, 955) punctuation.separator.comma.ts, pattern 215, interval ordinal 135, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:384

### typescript / shiki-api / real / extra-scope

textmate-grammars-themes/samples/typescript.sample:3:32, [107, 108), excerpt ";"

Reference: source.ts punctuation.terminator.statement.ts

Native: source.ts meta.type.declaration.ts punctuation.terminator.statement.ts

- [76, 108) meta.type.declaration.ts, pattern 40, interval ordinal 28, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:123
- [107, 108) punctuation.terminator.statement.ts, pattern 214, interval ordinal 134, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:383

### typescript / shiki-api / real / missing-scope

textmate-grammars-themes/samples/typescript.sample:6:16, [230, 231), excerpt " "

Reference: source.ts meta.type.declaration.ts meta.object.type.ts meta.field.declaration.ts

Native: source.ts meta.type.declaration.ts meta.object.type.ts

- [215, 246) meta.type.declaration.ts, pattern 40, interval ordinal 28, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:123
- [229, 245) meta.object.type.ts, pattern 32, interval ordinal 22, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:115

### typescript / shiki-api / real / leaf

textmate-grammars-themes/samples/typescript.sample:31:23, [954, 955), excerpt ","

Reference: source.ts meta.function.ts meta.parameters.ts punctuation.separator.parameter.ts

Native: source.ts meta.function.ts meta.parameters.ts punctuation.separator.comma.ts

- [932, 994) meta.function.ts, pattern 23, interval ordinal 17, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:106
- [944, 966) meta.parameters.ts, pattern 29, interval ordinal 20, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:112
- [954, 955) punctuation.separator.comma.ts, pattern 215, interval ordinal 135, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:384

### typescript / raw / real / other

typescript-tmlanguage/tests/cases/awaitUsing.ts:10:3, [174, 175), excerpt "x"

Reference: source.ts meta.objectliteral.ts meta.object.member.ts meta.object-literal.key.ts

Native: source.ts variable.other.property.ts

- [174, 175) variable.other.property.ts, pattern 229, interval ordinal 53, priority 0, kept, lib/scope-compat/packs/typescript/typescript.scm:11

### typescript / raw / real / ancestor

typescript-tmlanguage/tests/cases/constTypeParameter.ts:2:20, [96, 97), excerpt "<"

Reference: source.ts meta.function.ts meta.type.parameters.ts punctuation.definition.typeparameters.begin.ts

Native: source.ts meta.definition.function.ts meta.type.parameters.ts punctuation.definition.typeparameters.begin.ts

- [85, 115) meta.definition.function.ts, pattern 27, interval ordinal 18, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:110
- [96, 105) meta.type.parameters.ts, pattern 36, interval ordinal 25, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:119
- [96, 97) punctuation.definition.typeparameters.begin.ts, pattern 212, interval ordinal 132, priority 25, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:381

### typescript / product / real / other

typescript-tmlanguage/tests/cases/awaitUsing.ts:10:3, [174, 175), excerpt "x"

Reference: source.ts meta.objectliteral.ts meta.object.member.ts meta.object-literal.key.ts

Native: source.ts variable.other.property.ts

- [174, 175) variable.other.property.ts, pattern 229, interval ordinal 53, priority 0, kept, lib/scope-compat/packs/typescript/typescript.scm:11

### typescript / product / real / ancestor

typescript-tmlanguage/tests/cases/constTypeParameter.ts:2:20, [96, 97), excerpt "<"

Reference: source.ts meta.function.ts meta.type.parameters.ts punctuation.definition.typeparameters.begin.ts

Native: source.ts meta.definition.function.ts meta.type.parameters.ts punctuation.definition.typeparameters.begin.ts

- [85, 115) meta.definition.function.ts, pattern 27, interval ordinal 18, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:110
- [96, 105) meta.type.parameters.ts, pattern 36, interval ordinal 25, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:119
- [96, 97) punctuation.definition.typeparameters.begin.ts, pattern 212, interval ordinal 132, priority 25, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:381

### typescript / shiki-api / real / other

typescript-tmlanguage/tests/cases/awaitUsing.ts:10:3, [174, 175), excerpt "x"

Reference: source.ts meta.objectliteral.ts meta.object.member.ts meta.object-literal.key.ts

Native: source.ts variable.other.property.ts

- [174, 175) variable.other.property.ts, pattern 229, interval ordinal 53, priority 0, kept, lib/scope-compat/packs/typescript/typescript.scm:11

### typescript / shiki-api / real / ancestor

typescript-tmlanguage/tests/cases/constTypeParameter.ts:2:20, [96, 97), excerpt "<"

Reference: source.ts meta.function.ts meta.type.parameters.ts punctuation.definition.typeparameters.begin.ts

Native: source.ts meta.definition.function.ts meta.type.parameters.ts punctuation.definition.typeparameters.begin.ts

- [85, 115) meta.definition.function.ts, pattern 27, interval ordinal 18, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:110
- [96, 105) meta.type.parameters.ts, pattern 36, interval ordinal 25, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:119
- [96, 97) punctuation.definition.typeparameters.begin.ts, pattern 212, interval ordinal 132, priority 25, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:381

### tsx / raw / real / missing-scope

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-brackets.tsx:4:1, [79, 82), excerpt "   "

Reference: source.tsx meta.interface.tsx meta.field.declaration.tsx

Native: source.tsx meta.interface.tsx

- [49, 101) meta.interface.tsx, pattern 37, interval ordinal 26, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:120

### tsx / product / real / missing-scope

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-brackets.tsx:4:1, [79, 82), excerpt "   "

Reference: source.tsx meta.interface.tsx meta.field.declaration.tsx

Native: source.tsx meta.interface.tsx

- [49, 101) meta.interface.tsx, pattern 37, interval ordinal 26, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:120

### tsx / shiki-api / real / missing-scope

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test-brackets.tsx:4:1, [79, 82), excerpt "   "

Reference: source.tsx meta.interface.tsx meta.field.declaration.tsx

Native: source.tsx meta.interface.tsx

- [49, 101) meta.interface.tsx, pattern 37, interval ordinal 26, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:120

### json / raw / real / leaf

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:1:1, [0, 1), excerpt "{"

Reference: source.json meta.structure.dictionary.json punctuation.definition.dictionary.begin.json

Native: source.json meta.structure.dictionary.json punctuation.definition.structure.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [0, 1) punctuation.definition.structure.json, pattern 10, @punctuation.definition.structure, priority 0, kept, lib/scope-compat/packs/json/json.scm:12

### json / raw / real / missing-scope

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:4:17, [46, 47), excerpt ","

Reference: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json punctuation.separator.dictionary.pair.json

Native: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json punctuation.separator.dictionary.pair.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [26, 221) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [28, 221) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [46, 47) punctuation.separator.dictionary.pair.json, pattern 11, @punctuation.separator.dictionary.pair, priority 0, kept, lib/scope-compat/packs/json/json.scm:13

### json / raw / real / other

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:3:2, [17, 18), excerpt "\""

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json punctuation.support.type.property-name.begin.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json punctuation.definition.string.begin.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [17, 26) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [17, 26) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [17, 26) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [17, 18) punctuation.definition.string.begin.json, pattern 8, @punctuation.definition.string.begin, priority 0, kept, lib/scope-compat/packs/json/json.scm:10

### json / raw / real / ancestor

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:11:5, [203, 206), excerpt "foo"

Reference: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json string.json support.type.property-name.json

Native: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [26, 221) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [28, 221) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [195, 218) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [197, 218) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [202, 207) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [202, 207) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [202, 207) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8

### json / product / real / leaf

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:1:1, [0, 1), excerpt "{"

Reference: source.json meta.structure.dictionary.json punctuation.definition.dictionary.begin.json

Native: source.json meta.structure.dictionary.json punctuation.definition.structure.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [0, 1) punctuation.definition.structure.json, pattern 10, @punctuation.definition.structure, priority 0, kept, lib/scope-compat/packs/json/json.scm:12

### json / product / real / missing-scope

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:4:17, [46, 47), excerpt ","

Reference: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json punctuation.separator.dictionary.pair.json

Native: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json punctuation.separator.dictionary.pair.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [26, 221) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [28, 221) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [46, 47) punctuation.separator.dictionary.pair.json, pattern 11, @punctuation.separator.dictionary.pair, priority 0, kept, lib/scope-compat/packs/json/json.scm:13

### json / product / real / other

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:3:2, [17, 18), excerpt "\""

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json punctuation.support.type.property-name.begin.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json punctuation.definition.string.begin.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [17, 26) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [17, 26) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [17, 26) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [17, 18) punctuation.definition.string.begin.json, pattern 8, @punctuation.definition.string.begin, priority 0, kept, lib/scope-compat/packs/json/json.scm:10

### json / product / real / ancestor

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:11:5, [203, 206), excerpt "foo"

Reference: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json string.json support.type.property-name.json

Native: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [26, 221) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [28, 221) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [195, 218) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [197, 218) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [202, 207) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [202, 207) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [202, 207) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8

### json / shiki-api / real / leaf

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:1:1, [0, 1), excerpt "{"

Reference: source.json meta.structure.dictionary.json punctuation.definition.dictionary.begin.json

Native: source.json meta.structure.dictionary.json punctuation.definition.structure.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [0, 1) punctuation.definition.structure.json, pattern 10, @punctuation.definition.structure, priority 0, kept, lib/scope-compat/packs/json/json.scm:12

### json / shiki-api / real / missing-scope

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:4:17, [46, 47), excerpt ","

Reference: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json punctuation.separator.dictionary.pair.json

Native: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json punctuation.separator.dictionary.pair.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [26, 221) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [28, 221) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [46, 47) punctuation.separator.dictionary.pair.json, pattern 11, @punctuation.separator.dictionary.pair, priority 0, kept, lib/scope-compat/packs/json/json.scm:13

### json / shiki-api / real / other

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:3:2, [17, 18), excerpt "\""

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json punctuation.support.type.property-name.begin.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json punctuation.definition.string.begin.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [17, 26) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [17, 26) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [17, 26) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [17, 18) punctuation.definition.string.begin.json, pattern 8, @punctuation.definition.string.begin, priority 0, kept, lib/scope-compat/packs/json/json.scm:10

### json / shiki-api / real / ancestor

vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json:11:5, [203, 206), excerpt "foo"

Reference: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json string.json support.type.property-name.json

Native: source.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json meta.structure.dictionary.value.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json

- [0, 223) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [26, 221) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [28, 221) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [195, 218) meta.structure.dictionary.value.json, pattern 13, make-range meta.structure.dictionary.value, priority 0, kept, lib/scope-compat/packs/json/json.scm:15
- [197, 218) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [202, 207) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [202, 207) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [202, 207) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8

### json / raw / original / leaf

original/bom:1:2, [1, 2), excerpt "{"

Reference: source.json meta.structure.dictionary.json punctuation.definition.dictionary.begin.json

Native: source.json meta.structure.dictionary.json punctuation.definition.structure.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [1, 2) punctuation.definition.structure.json, pattern 10, @punctuation.definition.structure, priority 0, kept, lib/scope-compat/packs/json/json.scm:12

### json / raw / original / other

original/bom:1:3, [2, 3), excerpt "\""

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json punctuation.support.type.property-name.begin.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json punctuation.definition.string.begin.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [2, 5) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [2, 5) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 5) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 3) punctuation.definition.string.begin.json, pattern 8, @punctuation.definition.string.begin, priority 0, kept, lib/scope-compat/packs/json/json.scm:10

### json / raw / original / ancestor

original/bom:1:4, [3, 4), excerpt "a"

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [2, 5) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [2, 5) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 5) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8

### json / product / original / leaf

original/bom:1:2, [1, 2), excerpt "{"

Reference: source.json meta.structure.dictionary.json punctuation.definition.dictionary.begin.json

Native: source.json meta.structure.dictionary.json punctuation.definition.structure.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [1, 2) punctuation.definition.structure.json, pattern 10, @punctuation.definition.structure, priority 0, kept, lib/scope-compat/packs/json/json.scm:12

### json / product / original / other

original/bom:1:3, [2, 3), excerpt "\""

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json punctuation.support.type.property-name.begin.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json punctuation.definition.string.begin.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [2, 5) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [2, 5) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 5) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 3) punctuation.definition.string.begin.json, pattern 8, @punctuation.definition.string.begin, priority 0, kept, lib/scope-compat/packs/json/json.scm:10

### json / product / original / ancestor

original/bom:1:4, [3, 4), excerpt "a"

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [2, 5) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [2, 5) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 5) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8

### json / shiki-api / original / leaf

original/bom:1:2, [1, 2), excerpt "{"

Reference: source.json meta.structure.dictionary.json punctuation.definition.dictionary.begin.json

Native: source.json meta.structure.dictionary.json punctuation.definition.structure.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [1, 2) punctuation.definition.structure.json, pattern 10, @punctuation.definition.structure, priority 0, kept, lib/scope-compat/packs/json/json.scm:12

### json / shiki-api / original / other

original/bom:1:3, [2, 3), excerpt "\""

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json punctuation.support.type.property-name.begin.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json punctuation.definition.string.begin.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [2, 5) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [2, 5) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 5) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 3) punctuation.definition.string.begin.json, pattern 8, @punctuation.definition.string.begin, priority 0, kept, lib/scope-compat/packs/json/json.scm:10

### json / shiki-api / original / ancestor

original/bom:1:4, [3, 4), excerpt "a"

Reference: source.json meta.structure.dictionary.json string.json support.type.property-name.json

Native: source.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json

- [1, 12) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [2, 5) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [2, 5) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [2, 5) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8

### json / shiki-api / original / extra-scope

original/line-20000:1:1, [0, 1), excerpt "{"

Reference: (empty)

Native: source.json meta.structure.dictionary.json punctuation.definition.structure.json

- [0, 20000) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [0, 1) punctuation.definition.structure.json, pattern 10, @punctuation.definition.structure, priority 0, kept, lib/scope-compat/packs/json/json.scm:12

### markdown / raw / original / missing-scope

original/fences:1:1, [0, 1), excerpt "#"

Reference: text.html.markdown markup.heading.markdown heading.1.markdown punctuation.definition.heading.markdown

Native: text.html.markdown

No child-pack interval covers this mismatch. The remaining path comes from the Markdown parent and resolver fence frame.

### markdown / raw / original / leaf

original/fences:3:4, [13, 15), excerpt "ts"

Reference: text.html.markdown markup.fenced_code.block.markdown fenced_code.block.language

Native: text.html.markdown markup.fenced_code.block.markdown fenced_code.block.language.markdown

No child-pack interval covers this mismatch. The remaining path comes from the Markdown parent and resolver fence frame.

### markdown / raw / original / extra-scope

original/fences:4:6, [21, 22), excerpt " "

Reference: text.html.markdown markup.fenced_code.block.markdown

Native: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.typescript meta.var.expr.ts

- [16, 27) meta.var.expr.ts, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:22

### markdown / product / original / missing-scope

original/fences:1:1, [0, 1), excerpt "#"

Reference: text.html.markdown markup.heading.markdown heading.1.markdown punctuation.definition.heading.markdown

Native: text.html.markdown

No child-pack interval covers this mismatch. The remaining path comes from the Markdown parent and resolver fence frame.

### markdown / product / original / leaf

original/fences:3:4, [13, 15), excerpt "ts"

Reference: text.html.markdown markup.fenced_code.block.markdown fenced_code.block.language

Native: text.html.markdown markup.fenced_code.block.markdown fenced_code.block.language.markdown

No child-pack interval covers this mismatch. The remaining path comes from the Markdown parent and resolver fence frame.

### markdown / product / original / extra-scope

original/fences:4:6, [21, 22), excerpt " "

Reference: text.html.markdown markup.fenced_code.block.markdown

Native: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.typescript meta.var.expr.ts

- [16, 27) meta.var.expr.ts, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:22

### markdown / shiki-api / original / missing-scope

original/fences:1:1, [0, 1), excerpt "#"

Reference: text.html.markdown markup.heading.markdown heading.1.markdown punctuation.definition.heading.markdown

Native: text.html.markdown

No child-pack interval covers this mismatch. The remaining path comes from the Markdown parent and resolver fence frame.

### markdown / shiki-api / original / leaf

original/fences:3:4, [13, 15), excerpt "ts"

Reference: text.html.markdown markup.fenced_code.block.markdown fenced_code.block.language

Native: text.html.markdown markup.fenced_code.block.markdown fenced_code.block.language.markdown

No child-pack interval covers this mismatch. The remaining path comes from the Markdown parent and resolver fence frame.

### markdown / shiki-api / original / extra-scope

original/fences:4:6, [21, 22), excerpt " "

Reference: text.html.markdown markup.fenced_code.block.markdown

Native: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.typescript meta.var.expr.ts

- [16, 27) meta.var.expr.ts, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:22

### markdown / product:warm / original / missing-scope

original/fences:1:1, [0, 1), excerpt "#"

Reference: text.html.markdown markup.heading.markdown heading.1.markdown punctuation.definition.heading.markdown

Native: text.html.markdown

No child-pack interval covers this mismatch. The remaining path comes from the Markdown parent and resolver fence frame.

### markdown / product:warm / original / leaf

original/fences:10:1, [54, 55), excerpt "{"

Reference: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.json meta.structure.dictionary.json punctuation.definition.dictionary.begin.json

Native: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.json meta.structure.dictionary.json punctuation.definition.structure.json

- [54, 67) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [54, 55) punctuation.definition.structure.json, pattern 10, @punctuation.definition.structure, priority 0, kept, lib/scope-compat/packs/json/json.scm:12

### markdown / product:warm / original / other

original/fences:10:2, [55, 56), excerpt "\""

Reference: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.json meta.structure.dictionary.json string.json support.type.property-name.json punctuation.support.type.property-name.begin.json

Native: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json punctuation.definition.string.begin.json

- [54, 67) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [55, 58) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [55, 58) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [55, 58) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [55, 56) punctuation.definition.string.begin.json, pattern 8, @punctuation.definition.string.begin, priority 0, kept, lib/scope-compat/packs/json/json.scm:10

### markdown / product:warm / original / ancestor

original/fences:10:3, [56, 57), excerpt "k"

Reference: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.json meta.structure.dictionary.json string.json support.type.property-name.json

Native: text.html.markdown markup.fenced_code.block.markdown meta.embedded.block.json meta.structure.dictionary.json string.quoted.double.json support.type.property-name.json

- [54, 67) meta.structure.dictionary.json, pattern 0, @meta.structure.dictionary, priority 0, kept, lib/scope-compat/packs/json/json.scm:1
- [55, 58) string.quoted.double.json, pattern 2, @string.quoted.double, priority 0, exclusive, lib/scope-compat/packs/json/json.scm:3
- [55, 58) string.quoted.double.json, pattern 7, @string.quoted.double, priority 10, kept, lib/scope-compat/packs/json/json.scm:8
- [55, 58) support.type.property-name.json, pattern 7, @support.type.property-name, priority 10, kept, lib/scope-compat/packs/json/json.scm:8

### tsx / raw / original / ancestor

original/crlf:1:11, [10, 11), excerpt "<"

Reference: source.tsx meta.var.expr.tsx meta.tag.without-attributes.tsx punctuation.definition.tag.begin.tsx

Native: source.tsx meta.var.expr.tsx meta.tag.tsx punctuation.definition.tag.begin.tsx

- [0, 24) meta.var.expr.tsx, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:22
- [10, 24) meta.tag.tsx, pattern 220, interval ordinal 140, priority 0, kept, lib/scope-compat/packs/tsx/tsx.scm:2
- [10, 11) punctuation.definition.tag.begin.tsx, pattern 223, interval ordinal 142, priority 25, kept, lib/scope-compat/packs/tsx/tsx.scm:5

### tsx / product / original / ancestor

original/crlf:1:11, [10, 11), excerpt "<"

Reference: source.tsx meta.var.expr.tsx meta.tag.without-attributes.tsx punctuation.definition.tag.begin.tsx

Native: source.tsx meta.var.expr.tsx meta.tag.tsx punctuation.definition.tag.begin.tsx

- [0, 24) meta.var.expr.tsx, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:22
- [10, 24) meta.tag.tsx, pattern 220, interval ordinal 140, priority 0, kept, lib/scope-compat/packs/tsx/tsx.scm:2
- [10, 11) punctuation.definition.tag.begin.tsx, pattern 223, interval ordinal 142, priority 25, kept, lib/scope-compat/packs/tsx/tsx.scm:5

### tsx / shiki-api / original / ancestor

original/crlf:1:11, [10, 11), excerpt "<"

Reference: source.tsx meta.var.expr.tsx meta.tag.without-attributes.tsx punctuation.definition.tag.begin.tsx

Native: source.tsx meta.var.expr.tsx meta.tag.tsx punctuation.definition.tag.begin.tsx

- [0, 24) meta.var.expr.tsx, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:22
- [10, 24) meta.tag.tsx, pattern 220, interval ordinal 140, priority 0, kept, lib/scope-compat/packs/tsx/tsx.scm:2
- [10, 11) punctuation.definition.tag.begin.tsx, pattern 223, interval ordinal 142, priority 25, kept, lib/scope-compat/packs/tsx/tsx.scm:5

### tsx / raw / original / missing-scope

original/empty-line-jsx:1:7, [6, 7), excerpt "e"

Reference: source.tsx meta.var.expr.tsx meta.var-single-variable.expr.tsx meta.definition.variable.tsx variable.other.constant.tsx entity.name.function.tsx

Native: source.tsx meta.var.expr.tsx meta.var-single-variable.expr.tsx meta.definition.variable.tsx variable.other.constant.tsx

- [0, 39) meta.var.expr.tsx, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:22
- [6, 8) meta.var-single-variable.expr.tsx, pattern 16, interval ordinal 0, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 8) meta.var-single-variable.expr.tsx, pattern 19, interval ordinal 0, priority 20, duplicate, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92
- [6, 7) meta.definition.variable.tsx, pattern 16, interval ordinal 1, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 7) meta.definition.variable.tsx, pattern 19, interval ordinal 1, priority 20, duplicate, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92
- [6, 7) variable.other.constant.tsx, pattern 16, interval ordinal 14, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 7) variable.other.readwrite.tsx, pattern 19, interval ordinal 5, priority 20, exclusive, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92

### tsx / product / original / missing-scope

original/empty-line-jsx:1:7, [6, 7), excerpt "e"

Reference: source.tsx meta.var.expr.tsx meta.var-single-variable.expr.tsx meta.definition.variable.tsx variable.other.constant.tsx entity.name.function.tsx

Native: source.tsx meta.var.expr.tsx meta.var-single-variable.expr.tsx meta.definition.variable.tsx variable.other.constant.tsx

- [0, 39) meta.var.expr.tsx, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:22
- [6, 8) meta.var-single-variable.expr.tsx, pattern 16, interval ordinal 0, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 8) meta.var-single-variable.expr.tsx, pattern 19, interval ordinal 0, priority 20, duplicate, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92
- [6, 7) meta.definition.variable.tsx, pattern 16, interval ordinal 1, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 7) meta.definition.variable.tsx, pattern 19, interval ordinal 1, priority 20, duplicate, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92
- [6, 7) variable.other.constant.tsx, pattern 16, interval ordinal 14, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 7) variable.other.readwrite.tsx, pattern 19, interval ordinal 5, priority 20, exclusive, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92

### tsx / shiki-api / original / missing-scope

original/empty-line-jsx:1:7, [6, 7), excerpt "e"

Reference: source.tsx meta.var.expr.tsx meta.var-single-variable.expr.tsx meta.definition.variable.tsx variable.other.constant.tsx entity.name.function.tsx

Native: source.tsx meta.var.expr.tsx meta.var-single-variable.expr.tsx meta.definition.variable.tsx variable.other.constant.tsx

- [0, 39) meta.var.expr.tsx, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:22
- [6, 8) meta.var-single-variable.expr.tsx, pattern 16, interval ordinal 0, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 8) meta.var-single-variable.expr.tsx, pattern 19, interval ordinal 0, priority 20, duplicate, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92
- [6, 7) meta.definition.variable.tsx, pattern 16, interval ordinal 1, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 7) meta.definition.variable.tsx, pattern 19, interval ordinal 1, priority 20, duplicate, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92
- [6, 7) variable.other.constant.tsx, pattern 16, interval ordinal 14, priority 25, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:81
- [6, 7) variable.other.readwrite.tsx, pattern 19, interval ordinal 5, priority 20, exclusive, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:92

### tsx / shiki-api / original / extra-scope

original/line-20000:1:1, [0, 2), excerpt "//"

Reference: (empty)

Native: source.tsx comment.line.double-slash.tsx punctuation.definition.comment.tsx

- [0, 20000) comment.line.double-slash.tsx, pattern 131, interval ordinal 1, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:276
- [0, 2) punctuation.definition.comment.tsx, pattern 131, interval ordinal 2, priority 0, kept, lib/scope-compat/packs/tsx/../shared/typescript-common.scm:276

### typescript / raw / original / missing-scope

original/crlf-then-trailing-cr:2:10, [20, 21), excerpt "\r"

Reference: source.ts meta.var.expr.ts

Native: source.ts

No native capture or range interval covers this mismatch. The remaining path comes from root and terminator composition.

### typescript / product / original / extra-scope

original/crlf-then-trailing-cr:2:10, [20, 21), excerpt "\r"

Reference: (empty)

Native: source.ts

No native capture or range interval covers this mismatch. The remaining path comes from root and terminator composition.

### typescript / shiki-api / original / missing-scope

original/crlf-then-trailing-cr:2:10, [20, 21), excerpt "\r"

Reference: source.ts meta.var.expr.ts

Native: source.ts

No native capture or range interval covers this mismatch. The remaining path comes from root and terminator composition.

### typescript / product / original / missing-scope

original/empty-line-block-comment:5:1, [15, 17), excerpt "*/"

Reference: source.ts comment.block.ts punctuation.definition.comment.ts

Native: source.ts comment.block.ts

- [0, 17) comment.block.ts, pattern 133, interval ordinal 2, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:285

### typescript / raw / original / extra-scope

original/empty-line-declaration:3:3, [13, 14), excerpt "1"

Reference: source.ts constant.numeric.decimal.ts

Native: source.ts meta.var.expr.ts constant.numeric.decimal.ts

- [0, 14) meta.var.expr.ts, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:22
- [13, 14) constant.numeric.decimal.ts, pattern 119, interval ordinal 66, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:262
- [13, 14) constant.numeric.ts, pattern 126, interval ordinal 70, priority 0, exclusive, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:269

### typescript / shiki-api / original / extra-scope

original/line-20000:1:1, [0, 2), excerpt "//"

Reference: (empty)

Native: source.ts comment.line.double-slash.ts punctuation.definition.comment.ts

- [0, 20000) comment.line.double-slash.ts, pattern 131, interval ordinal 1, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:276
- [0, 2) punctuation.definition.comment.ts, pattern 131, interval ordinal 2, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:276

### typescript / product / original / other

original/line-20001-closes-open-comment:3:5, [20009, 20010), excerpt "z"

Reference: source.ts comment.block.ts

Native: source.ts meta.var.expr.ts meta.var-single-variable.expr.ts meta.definition.variable.ts variable.other.readwrite.ts

- [20005, 20014) meta.var.expr.ts, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:22
- [20009, 20011) meta.var-single-variable.expr.ts, pattern 19, interval ordinal 0, priority 20, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:92
- [20009, 20010) meta.definition.variable.ts, pattern 19, interval ordinal 1, priority 20, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:92
- [20009, 20010) variable.other.readwrite.ts, pattern 19, interval ordinal 5, priority 20, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:92
- [20009, 20010) variable.other.readwrite.ts, pattern 228, interval ordinal 5, priority 0, exclusive, lib/scope-compat/packs/typescript/typescript.scm:10

### typescript / product / original / leaf

original/line-20001-closes-open-comment:3:4, [20008, 20009), excerpt " "

Reference: source.ts comment.block.ts

Native: source.ts meta.var.expr.ts

- [20005, 20014) meta.var.expr.ts, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:22

### typescript / shiki-api / original / other

original/line-20001-closes-open-comment:3:5, [20009, 20010), excerpt "z"

Reference: source.ts comment.block.ts

Native: source.ts meta.var.expr.ts meta.var-single-variable.expr.ts meta.definition.variable.ts variable.other.readwrite.ts

- [20005, 20014) meta.var.expr.ts, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:22
- [20009, 20011) meta.var-single-variable.expr.ts, pattern 19, interval ordinal 0, priority 20, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:92
- [20009, 20010) meta.definition.variable.ts, pattern 19, interval ordinal 1, priority 20, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:92
- [20009, 20010) variable.other.readwrite.ts, pattern 19, interval ordinal 5, priority 20, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:92
- [20009, 20010) variable.other.readwrite.ts, pattern 228, interval ordinal 5, priority 0, exclusive, lib/scope-compat/packs/typescript/typescript.scm:10

### typescript / shiki-api / original / leaf

original/line-20001-closes-open-comment:3:4, [20008, 20009), excerpt " "

Reference: source.ts comment.block.ts

Native: source.ts meta.var.expr.ts

- [20005, 20014) meta.var.expr.ts, pattern 14, interval ordinal 0, priority 0, kept, lib/scope-compat/packs/typescript/../shared/typescript-common.scm:22


## Markdown regions and observations

| Fixture | Reference | Region | Matching / units | Non-whitespace matching / units |
| --- | --- | --- | ---: | ---: |
| original/fences | raw | recognized fence content | 4/39 | 0/27 |
| original/fences | raw | markdown parent outside the pilot | 19/33 | 12/25 |
| original/fences | product | recognized fence content | 4/39 | 0/27 |
| original/fences | product | markdown parent outside the pilot | 19/33 | 12/25 |
| original/fences | shiki-api | recognized fence content | 4/39 | 0/27 |
| original/fences | shiki-api | markdown parent outside the pilot | 19/33 | 12/25 |
| original/fences | product:warm | recognized fence content | 31/39 | 19/27 |
| original/fences | product:warm | markdown parent outside the pilot | 25/33 | 18/25 |

- original/fences: {"resolverSetText":1,"childParses":2} ; child ranges [{"languageId":"typescript","start":16,"end":41,"rootStart":16,"rootEnd":41},{"languageId":"json","start":54,"end":68,"rootStart":54,"rootEnd":68}].

Parser.prototype.parse and tsmd_set_text are observed separately in native-markdown-worker.ts. A positive baseline parse arms the parser observer; a fresh-process first use parses each recognized child once, a scope pass adds zero parses, and warm repetition matches decoded output. The focused runtime allocator plus core allocator fixture has retained resolver, child and TextBuffer positive controls and construction-unwind tests. Component block count alone is not ownership evidence.

## Incomplete comparisons

| Candidate | Language | Reference | Lane | Fixture | State | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| native | javascript | raw | real | textmate-grammars-themes/samples/javascript.sample | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | raw | real | textmate-grammars-themes/samples/javascript.sample | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | product | real | textmate-grammars-themes/samples/javascript.sample | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | product | real | textmate-grammars-themes/samples/javascript.sample | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | shiki-api | real | textmate-grammars-themes/samples/javascript.sample | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | shiki-api | real | textmate-grammars-themes/samples/javascript.sample | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | raw | real | tree-sitter-highlight/test/highlight/functions.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | raw | real | tree-sitter-highlight/test/highlight/functions.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | product | real | tree-sitter-highlight/test/highlight/functions.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | product | real | tree-sitter-highlight/test/highlight/functions.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/functions.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/functions.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | raw | real | tree-sitter-highlight/test/highlight/imports.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | raw | real | tree-sitter-highlight/test/highlight/imports.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | product | real | tree-sitter-highlight/test/highlight/imports.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | product | real | tree-sitter-highlight/test/highlight/imports.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/imports.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/imports.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | raw | real | tree-sitter-highlight/test/highlight/injection.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | raw | real | tree-sitter-highlight/test/highlight/injection.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | product | real | tree-sitter-highlight/test/highlight/injection.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | product | real | tree-sitter-highlight/test/highlight/injection.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/injection.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/injection.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | raw | real | tree-sitter-highlight/test/highlight/keywords.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | raw | real | tree-sitter-highlight/test/highlight/keywords.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | product | real | tree-sitter-highlight/test/highlight/keywords.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | product | real | tree-sitter-highlight/test/highlight/keywords.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/keywords.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/keywords.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | raw | real | tree-sitter-highlight/test/highlight/variables.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | raw | real | tree-sitter-highlight/test/highlight/variables.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | product | real | tree-sitter-highlight/test/highlight/variables.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | product | real | tree-sitter-highlight/test/highlight/variables.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/variables.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | shiki-api | real | tree-sitter-highlight/test/highlight/variables.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | raw | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | raw | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | product | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | product | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| native | javascript | shiki-api | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | unsupported | javascript: distinct variant, no native pack in the pilot (Phase 5) |
| baseline:vscode-ts | javascript | shiki-api | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | raw | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | product | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | shiki-api | real | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | raw | original | original/bom | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | product | original | original/bom | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | shiki-api | original | original/bom | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | raw | original | original/crlf | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | product | original | original/crlf | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | shiki-api | original | original/crlf | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | raw | original | original/empty-line-object | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | product | original | original/empty-line-object | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | shiki-api | original | original/empty-line-object | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | raw | original | original/empty | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | product | original | original/empty | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | shiki-api | original | original/empty | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | raw | original | original/line-20000 | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | product | original | original/line-20000 | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | shiki-api | original | original/line-20000 | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | raw | original | original/no-trailing-newline | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | product | original | original/no-trailing-newline | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:vscode-ts | json | shiki-api | original | original/no-trailing-newline | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:captures | markdown | raw | original | original/fences | unsupported | pinned tree-sitter-md 0.1.1 uses MarkdownDocument.highlights; no external highlights query or markdown_inline parser is configured |
| baseline:vscode-ts | markdown | raw | original | original/fences | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:captures | markdown | product | original | original/fences | unsupported | pinned tree-sitter-md 0.1.1 uses MarkdownDocument.highlights; no external highlights query or markdown_inline parser is configured |
| baseline:vscode-ts | markdown | product | original | original/fences | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:captures | markdown | shiki-api | original | original/fences | unsupported | pinned tree-sitter-md 0.1.1 uses MarkdownDocument.highlights; no external highlights query or markdown_inline parser is configured |
| baseline:vscode-ts | markdown | shiki-api | original | original/fences | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |
| baseline:captures | markdown | product:warm | original | original/fences | unsupported | pinned tree-sitter-md 0.1.1 uses MarkdownDocument.highlights; no external highlights query or markdown_inline parser is configured |
| baseline:vscode-ts | markdown | product:warm | original | original/fences | unsupported | VS Code TypeScript query applies only to the TypeScript and TSX variants |

## Implementation and acceptance

- Component build, CI and sanitizer command are PR A; merge approval and green CI are independent prerequisites for PR B.
- Native pack output, Markdown mapping/ownership and zero-extra-parse controls are implemented. Executed verification and independent review/CI state belong in impl-007b/REPORT.md, not this byte-compared candidate artifact.
- This report is generated by report:native and checked by report:native -- --check. Goldens and artifacts:check are unchanged.

Strict improvement cells failing: 0. Each raw/product language/lane cell must improve both all-text and non-whitespace agreement over each applicable named baseline. Ties fail. Empty cells are N/A and cannot establish acceptance.


Phase 2 acceptance: OPEN pending independently approved safety/schema CI.

Regenerate with npm run report:native. At most two productive pack rounds were authorized; no parity tuning, fixture changes, denominator changes or golden changes were used.

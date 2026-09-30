# highlight-compat

Development harness that compares TextMate scope and style output between reference profiles (`product`, `raw`, `vscode`) and candidates (`native`, `baseline:<name>`). The plan is `docs/plans/textmate-scope-compatibility.md`.

```sh
npm ci
npm test                                   # read-only: fails on any golden difference
npx tsc --noEmit
npm run compare -- ref.json cand.json [--source file] [--theme id] [--runs n] [--json out.json]
npm run golden:update -- --profile product # the only writer; reference profiles only
```

## Result contract

`src/schema.ts` defines `DocumentResult`. `src/validate.ts` is the JSON boundary; everything past it trusts the type.

- Offsets are half-open UTF-16 code units into the exact source string. Line endings and BOMs are never normalised.
- `sourceSha256` hashes the source as WTF-8. For well-formed text that equals `sha256sum` of the UTF-8 file; lone surrogates stay distinct from U+FFFD.
- A `complete` result's scope, metadata and style tracks each tile `[0, sourceLength)` with raw, uncoalesced token spans. An empty source has zero spans.
- Scope names, paths, language ids and styles are interned in first-use order, and the validator rejects any other order. Build results with `ResultBuilder` (`src/build.ts`) so equal content always means equal JSON.
- Scope names contain no whitespace. Colours are lowercase `#rrggbb` or `#rrggbbaa`. An absent style field inherits the theme default; `fontStyle: 'reset'` is an explicit empty font style.
- Any other status carries no spans and at least one diagnostic. Such results are never comparable and never become goldens (`unsupported` is the one exception that may be recorded).
- Timing stays out of results (`ResultTiming` is a separate sidecar); `engine` holds identities only.

## Goldens

`goldens/<profileId>/<languageId>/<fixtureId>.json`, written only by `golden:update` from producers registered in `src/golden-producers.ts`. The update validates every case against its source, refuses non-reference profiles and failed reference work, writes nothing on any failure, and removes stale files.

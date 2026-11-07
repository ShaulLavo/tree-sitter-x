# Native theme oracle fixtures, version 1

These fixtures test a syntax matcher on reference scope stacks. They do not change the 65-language catalog, old goldens, scope scores, or production selection. Expected styles come from the pinned reference packages. No candidate normalization or matcher runs during generation.

From `test/highlight-compat`, with its locked dependencies installed:

```sh
node src/cli/native-theme-fixtures.ts --check
node src/cli/native-theme-fixtures.ts --update
npx vitest run tests/native-theme-oracle*.test.ts
```

`--update` is the only writer. Ordinary tests and `--check` are read-only. Both modes run the direct-token controls before checking or writing data. Review changed input bytes and regenerated expectations together.

## Style fixtures

`suite.json` has discriminator `native-theme-oracle/v1`, a SHA-256 identity, exact target identities, and `fixtures`. Select a fixture by its `id` and `profile`, `raw` or `product`. Each fixture contains:

- `input`: exact UTF-8 JSON resource bytes, resource identities, relative file paths, individual SHA-256 hashes, root, ordered resolved include edges, an independently authored expanded registration, scope stacks, and expected outside-score warnings. A resource's `bytes` is the exact UTF-8 text in its tracked `file`. Include resources are in base-first order. Expansion is fixture input, not an implementation of candidate include loading.
- `normalized`: the actual ordered registration returned by the existing raw adapter or the pinned product normalizer. Preserve array order. Product registration fields such as `fg`, `bg`, and `type` remain observable. The oracle consumes these settings directly with the pinned fork `Theme`.
- `defaults`: the actual folded, fully resolved reference defaults.
- `cases`: an `id`, an outermost-first `scopes` array, `effective`, `applied`, and a `trace` entry per scope node.

Every effective style contains canonical lowercase `#rrggbbaa` foreground/background, a numeric `fontMask`, and `fontStyle`. Mask bits are italic 1, bold 2, underline 4 and strikethrough 8. Effective zero serializes as `fontStyle: "reset"`. A partial field is exactly `{ "kind": "inherit" }` or `{ "kind": "set", "value": ... }`. Partial colors use the same canonical RGBA strings. A set font mask zero is an explicit clear. Transparent black is the present color `#00000000`.

`effective` includes background in both profiles to expose matcher behavior. `applied` includes it only for raw. Product tokens apply foreground and font style. An empty ordinary path resolves defaults. This is not a newline/separator fixture. Existing separator handling and old empty-default golden conventions are unchanged.

Trace fields report the pinned matcher's returned values, including fields inherited inside its trie. The target exposes no original rule/alternative identity. No such identity is invented here. Future native tests can compare their debug presence/style fields to these observations and test source diagnostic ordinals separately.

`acquisitionIdentity`, `normalizedSettingsIdentity`, `contentIdentity`, and the suite `identity` use distinct `native-theme-oracle/*/v1` domains. Each digest field has a four-byte big-endian UTF-8 byte length prefix. Acquisition identity covers root, ordered resource IDs/formats/byte hashes and ordered include edges. Content identity additionally covers profile, all recorded target identities, the declared authored expansion policy and ordered normalized settings. Suite identity covers targets and all fixture content. These are fixture identities, not a proposed replacement for the native owner's production identity API.

`inheritance` and `inheritance-changed` keep the same display name with changed root bytes. `included` and `included-changed` keep root bytes unchanged and alter only acquired base content. Their expanded registrations are separately authored `include-expanded*.json` files. Consumers must acquire the resources and independently produce the expansion before comparing normalization and style output.

## Direct controls and target limits

`controls.json` records actual raw registry output and actual product scoped-tokenizer output for `(xy)`, their reference scopes and independent repaint. Raw packed runs may merge adjacent equal styles. Compare partitions on the union of boundaries. The focused tests require complete coverage, no overlaps, named-field equality, and detection of omitted clear/context/background and fabricated product-background mutations. All nonempty scope matrices also run through actual direct tokenization. The product's plain-line path supplies an actual empty-scope control.

Raw preflight allows at most 255 distinct uppercase original color spellings, including implicit `#000000`/`#FFFFFF` and every normalized rule/default color, even superseded values. Equivalent spellings such as `#123` and `#112233` consume separate target palette entries and count separately. Each `palette-*-253` theme supplies 253 distinct rule colors and two defaults, producing 256 target slots including reserved zero. Both roles have a direct-versus-repaint boundary control. Each `palette-*-254` theme is explicitly unsupported for raw before target compilation; its packed overflow is never expected truth. Product remains eligible and gets a direct control beyond the raw bound.

Tail components `hasOwnProperty` and `__proto__` are rejected before either target compiles them. Context occurrences and `constructor` remain supported and have direct reference cases. Scope input names are unrestricted by this tail-only safety preflight. This preflight covers two pinned-target limits. It is not a candidate selector parser or a general input validator.

## Diagnostic fixtures

`diagnostics.json` has discriminator `native-theme-diagnostics/v1`. Its `cases` are independently authored amended-contract expectations, not reference matcher output. Each case has an operation, a request descriptor and an exact expected outcome. Unsupported inputs reject the whole theme. They are never submitted to a reference compiler or scored as partial success.

For `input`, decode each resource's `bytes` as UTF-8 and supply the declared root/resources/edges. `inputFile` means read that exact relative JSON file as the sole resource `fixture:/rejected`. `fixture` selects a successful style fixture as `id/profile`. `paths` lists ordinary outermost-first paths; `[]` requests zero records and `[[]]` requests one empty-path record. Resolve request `inputLimits` narrows path-encoding caps. `limits` narrows the named operation's caps. Input-cap cases attached to normalization constrain acquisition/normalization together. Missing options use the amended defaults. Explicit zero remains zero. Diagnostic locations use resource/local-rule ordinals, not profile-generated default ordinals. Null byte offsets mean the fixture does not claim a decoder-provided offset.

Diagnostic data covers schema/JSON/input format, includes, unsupported operators/properties/font words/color forms, invalid selectors/colors/fonts, reserved tail components, raw palette rejection, input/compile/resolve budgets, exact and first-over byte limits, zero requests and malformed limit fields. Semantic/UI fields are warning-only in the successful `outside-score` input. These data establish expected outcomes for implementation tests. This oracle PR does not execute a native normalizer, compile budget, packet decoder, allocator, session, cache or presentation lifecycle. Nonfinite JavaScript options cannot appear in JSON; native boundary tests must additionally exercise NaN and infinities in memory.

`src/oracles/native-theme-schema.ts` defines the fixture types. `native-theme-reference.ts` exposes generation and observed partial/effective extraction. `native-theme-direct.ts` provides actual-token controls and union-boundary comparison. The diagnostic table is separate in `native-theme-diagnostics.ts`. Tests verify the reference dependency graph contains no candidate/native import.

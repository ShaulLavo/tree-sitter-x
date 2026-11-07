# Strict reference language metadata

The private reference harness accepts a serializable document option:

```ts
const result = await runDocument({
  kind: 'document',
  profileId: 'raw',
  languageId: 'json',
  source: '{"message":"🌿"}',
  themeIds: ['github-dark'],
  metadata: 'required-language-v1',
})
```

Absent the option, all five profiles retain their scope/style behavior and
existing engine identities. Unknown request keys and unknown or malformed
metadata options reject. This option changes reference configuration explicitly;
it is not version negotiation.

Schema 1 is unchanged. Its metadata track contains stable canonical language
names and UTF-16 spans only. It contains no token types, bracket flags, numeric
native IDs or no-token values. A successful nonempty required request must have
one full measured track. Missing evidence returns `unsupported` with ranges and
reasons, without partial scope, style or metadata output. Empty sources may omit
the zero-unit track and remain lifecycle controls with N/A semantic ratios.

Raw profiles configure initial language ID 1 instead of the default unset 0,
then observe the actual binary tokens from the existing first style pass.
Shiki observes the selected grammar's binary calls during the first theme's
existing `codeToTokensBase` call, restoring its exact method property in `finally`.
Product optionally calls binary tokenization inside its existing scope line
owner, with the same prior state and time limit. It requires equal resulting
scope/binary rule stacks and retains the original scope state and token snapshot.
Later themes do not repeat metadata acquisition. No second tokenizer or document
owner, persistent public token field, or global interception is used.

Codebooks belong to individual requests. They bind native IDs in 1..255 to
canonical registration names and root scopes. Unset, unmapped, duplicate or
conflicting bindings reject. Shiki/product ID 1 means the selected canonical
registration, such as `javascript`/`source.js` or `jsx`/`source.js.jsx`. It does
not identify an embedded child. The opt-in records its codebook, semantic
restriction and changed raw configuration in engine provenance.

Successful whole-source root admission is deliberately bounded to the pinned
JSON grammar in this unit. Other roots, including every nonempty JS/JSX request,
remain unsupported across the full source because independent embedded-language
identity or whole-source semantics have not been established. This conservative
restriction avoids deriving child identities or their absence from scopes.
Synthetic configured root/child controls test numeric normalization separately;
they do not authorize a real-language contribution map.

Real LF/CRLF separators have no measured language value. Shiki skips empty lines
and lines at least 20,000 units long; product skips empty lines and lines longer
than 20,000 and strips a final bare CR. Raw tokenizes physical empty lines. These
rules stay distinct. No skipped line is retokenized through another profile, and
no terminator or plain token receives an invented root assignment.

`runDocument` validates source, schema, profile and language identity before
enforcing required metadata again. Scope/style-only complete answers, clipped
tracks, wrong canonical bindings, failed observations and incomplete outcomes
cannot satisfy the requirement.

Run the configured tests with `npm --prefix test/highlight-compat test --
tests/reference-metadata.test.ts tests/reference-metadata-targets.test.ts`.
These tests run in ordinary CI Vitest discovery. This bounded capture/admission
feature does not complete Plan 010's full-wave, all-field, theme, consumer,
performance or promotion gates. Separators and skipped units need a separately
approved representation; actual embedded identities need independent evidence.

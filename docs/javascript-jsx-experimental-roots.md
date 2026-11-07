# Experimental JavaScript and JSX roots

The private native loader accepts `javascript` and `jsx` packs at
`experimental-1`. Both use the pinned tree-sitter-javascript 0.25.0 parser.
Their public identities stay distinct: `source.js` with `.js`, and
`source.js.jsx` with `.js.jsx`. A crossed pack fails before tree borrowing or
result retention, even though the parser object is shared.

These packs are not promoted. Complete native scope output means the classifier
completed its work, not that the output matches every reference region. Required
JavaScript and JSX metadata remains unavailable. Scope ABI 1 and the existing
owner, session, and theme APIs are unchanged.

## Bounded coverage

The deliberately shared JavaScript query covers named imports, top-level and
block `const`/`let` declarations, exported declarations, identifier bindings,
ordinary calls, selected member-expression contexts, object pairs, decimal
integers, strings, templates, arrow headers, and comment prefixes. JSX adds tag
frames, ASCII tag-name classification, attributes and their surrounding gaps,
embedded expressions, spreads, children, and entity punctuation. Ordered repeated
ancestors are preserved. The shared query is authored from JS-family reference
observations, not TypeScript queries or converted TypeScript expectations.

Recovery rules recognize terminal open call/object/array shapes with two
comma-terminated numeric elements and JSX attribute-call shapes with one. They
also recognize terminal double-quoted JSX attribute strings and a narrow JavaScript
unterminated double-quoted string followed immediately by LF or CRLF and a
recovered `const` declaration. The newline rule requires a nonempty printable
ASCII fragment and exact source gaps. EOF, continuations, indentation before the
next keyword, tabs, non-ASCII fragments, and other damaged shapes are not admitted
by that rule. Terminal recovery requires the damaged declaration to be the only
named program child. Recovery is not a general lexical tokenizer.

## Limits

Regex and JSDoc parsers, arbitrary tagged-language injections, broad Unicode or
namespace tag classification, complete numeric forms, destructuring, deep member
chains, and complete function/class/control-flow scopes remain outside this
bounded unit. Other AST shapes can receive partial or mismatching scopes. The
historical development corpus still has mismatches. No complete-language parity,
held-out result, performance claim, or promotion threshold follows from this unit.

BOM keeps the root. Native offsets and windows count UTF-16 units, including
surrogate halves. Physical LF/CRLF masking remains unchanged. Product long-line
framing is opt-in through a full `ScopeLease` and
`future010-product-lines-v1`, or the existing presentation option with that
identity. `nativeDocument` remains the unframed diagnostic path. Masking a full
parse cannot reproduce tokenizer state skipped across an oversized line.

The fixed 007 experiment still loads only its original three packs. Its seven
JavaScript native rows remain unsupported, and missing-pack diagnostics remain
explicit. Markdown fence membership and aliases do not grow with root availability.

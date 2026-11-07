# Private native scope query dialect

The optional scope component compiles Tree-sitter queries into scope intervals over a borrowed UTF-16LE source. This dialect is private. Scope ABI 1, parser exports, and result layouts are unchanged.

## Text predicates

The existing `eq?`, `not-eq?`, `any-eq?`, `any-not-eq?`, `any-of?`, and `not-any-of?` retain their capture-pair, membership, and absent-capture behavior.

```scheme
(#text-class? @name "[$_A-Za-z]" "[-$._0-9A-Za-z]" "[$_0-9A-Za-z]")
(#not-text-class? @name "[a-z]" "[0-9a-z]")
(#starts-with? @comment "//")
(#not-starts-with? @comment "/*")
```

Class predicates take one capture, a first set, a tail set, and an optional last set. A set is one nonempty bracketed sequence of printable ASCII literals or ascending inclusive ranges. Literal `-` occurs only first; otherwise it joins range endpoints. `^`, backslash, `[` and `]` are reserved inside the sequence. Duplicate members are unions. Empty, reversed, incomplete, nested, escaped, non-ASCII, POSIX, and trailing-text forms are invalid. This is not a regular expression language.

A positive class test requires nonempty captured text, its first unit in the first set, and every later unit in the tail set. The optional last set also constrains the final unit. A one-unit name must satisfy both first and last sets. Every non-ASCII source unit fails membership, including surrogate units. The ASCII guard does not cover Unicode tag-name categories. Namespace classification applies to the captured local name.

Prefix predicates take one capture and one literal string. The compiler decodes the literal to UTF-16 once. Comparison is literal, without normalization. An empty prefix matches an empty node; a longer prefix fails.

Class and prefix predicates are universal over the capture occurrences in one match. Negation applies to each occurrence. For zero occurrences, both positive and negative tests pass. For mixed passing and failing occurrences, both fail. A real empty node fails a positive class test. A false predicate rejects the entire match. These operators have no `any-` variants. `match?`, `offset!`, and aliases remain unsupported.

## Bounded source gaps

```scheme
(#source-gap? @left @right "\r\n")
```

The three arguments are exactly two capture steps followed by one literal string. The strict UTF-8 decoder admits zero, one or two UTF-16 units. An astral scalar occupies two units. NUL and metacharacters compare literally. Longer literals, malformed UTF-8, swapped argument kinds and extra arguments are invalid. There are no negative, quantified or directive variants.

Each operand ID must occur exactly once in the match, even when both roles reuse that ID. Every gap's roles are checked in absolute compiled-operation order after all capture ranges and byte parity are validated, before any boolean short circuit. A false earlier equality, class or gap cannot hide an absent or repeated later gap role. Legacy quantifiers retain their existing behavior.

Comparison covers the complete gap from the left node's end to the right node's start in the full borrowed source. Reversed order, overlap and width mismatch return false without reading source. Equal-width gaps compare at most two units. An empty literal requires exact adjacency, including coincident zero-width or EOF endpoints. A nonempty literal cannot match coincident EOF endpoints. There is no search, trimming, normalization, offset adjustment or source lookaround.

A gap emits no interval and does not select contained-span ordering. Only an actual `make-span!` selects it. Evaluation precedes window clipping. Strict-role failures use `INVALID`, detail 3, with the absolute compiled-operation ordinal and zero public data. Gap evaluation allocates nothing; role scans cost `O(G * C)` for `G` gap operations and `C` captures, with at most `2 * G` source reads. Other predicates and span ancestry retain their separate costs.

The capability label is `source-gap-utf16-max2-1`. A printable-ASCII recovered-declaration LF/CRLF query is a capability test. It does not establish complete JavaScript recovery, provide a shipped JavaScript root pack, or accept a mandatory case's complete output.

## Contained spans

```scheme
(#make-span! "scope" @container @left "start" "0" @right "end" "0")
```

The eight arguments are scope string, container capture, left capture, left edge, left adjustment, right capture, right edge, and right adjustment. Each edge is `start` or `end`. The complete adjustment grammar is `-2`, `-1`, `0`, `1`, or `2`. Values such as `+1`, `01`, `-0`, and `1e0` are invalid. The scope gets the pack suffix, as ordinary captures and `make-range!` scopes do. Helper capture names beginning with `_` do not emit node scopes.

On an accepted match, each role requires exactly one capture occurrence. The same capture ID can fill all three roles. Repeated occurrences remain invalid even if their nodes are equal. Each anchor must be the container or an actual descendant, checked through node parents. Equal coordinates alone do not prove ancestry.

The compiler does not alter captures. Resolution selects an original node edge and adds the signed adjustment in a wide integer. The result must remain inside that anchor's closed boundary interval, the container, and the source. Start must not exceed end. A gap uses the end of its left anchor and the start of its right anchor, with zero adjustments. A captured structural container makes gap-only query windows observable.

The collector validates all captured source spans before text reads, and resolves each new span before window clipping or filtering. It retains logical endpoints and then clips emitted endpoints. Empty spans consume interval capacity, have empty disposition, and add no path segment. Positions and adjustments count UTF-16 code units, including windows that split a surrogate pair or combining sequence. No BOM, profile, or recovery policy is added.

`make-range!` keeps its old minimum-start, maximum-end, absent-endpoint, and repeated-endpoint rules.

## Ordering and explanations

A compiled pack with a real `make-span!` selects contained-span ordering, even if its predicates never accept a match. Other packs retain legacy composition, including clipped-parent ancestry guards. Comments and literal text do not select a policy.

Contained-span ordering compares logical start ascending, logical end descending, then kind: new span, node, old range. Equal-extent nodes follow actual ancestor order, then pattern and capture order. Ranges and spans use pattern and directive order. A coextensive new frame precedes its node; a smaller punctuation span follows the enclosing node.

Same-node competition applies only to node captures from different patterns. Higher priority wins, then earlier pattern. Captures from the winning pattern keep capture order. Deliberate spans and ranges do not lose with a node pattern. Equal logical endpoints and scope collapse to the first surviving interval. Distinct logical extents retain repeated scope names when clipping makes emitted extents equal. The sweep still uses clipped endpoints, existing terminator masking, and existing tiling.

Explain rows keep eight words. Word 5 can mean a capture ID or a directive ordinal. Extended packs therefore render neutral `interval ordinal N` provenance. Legacy rendering remains unchanged. Engine capability labels describe both supported policies. The host derives the exposed `selectedOrderPolicy` from structured predicate metadata for the exact joined query after native load succeeds, and releases its temporary Query in `finally`. Binding metadata alone is not native acceptance.

## Failures and resource limits

| Condition | Status and detail | Value |
| --- | --- | --- |
| Malformed recognized operator | `INVALID`, `BAD_ARGUMENTS` 3 | Existing pack diagnostic convention |
| Unknown operator | `UNSUPPORTED`, `UNKNOWN_OPERATOR` 2 | Existing pack diagnostic convention |
| Missing or repeated role, wrong ancestry | `INVALID`, detail 3 | Absolute compiled-predicate index |
| Adjustment outside anchor | `INVALID`, `WINDOW` 19 | Unadjusted edge in code units |
| Reversed endpoints | `INVALID`, detail 19 | Computed end |
| Odd tree offset | `INVALID`, detail 21 | Offending byte offset |
| Node outside source | `INVALID`, detail 20 | Offending end byte offset |
| Existing match, interval, or segment limit | `BUDGET`, details 22, 23, or 24 | Existing limit value |
| Component allocation failure | `NO_MEMORY`, zero detail and value | Zero |

Failures return zero public data and statistics, including failures after earlier valid matches. The host admits runtime detail 3 only with `INVALID`, and rejects partial failure packets.

Class maps are inline in compiled operations. Prefixes reuse decoded literals. Text evaluation allocates nothing and reads complete validated captures. Its cost sums inspected units across predicates and matches. Span resolution scans capture roles and walks at most two parent chains. Each `ts_node_parent` searches from the root, so repeated lookups can take quadratic work on a deep chain, with additional child-search costs. Small containers reduce walks; existing limits do not provide a global ancestry-work deadline.

New intervals use existing limits and allocation accounting. Core zero-width descendant lookup uses recursion capped at 64, followed by a heap-backed fallback. Those core allocations are outside the component allocator, failure injection, and live counter. Core allocation failure may abort; it does not promise structured component `NO_MEMORY`. The native sanitizer tests include a real missing-node resolver with 99 ancestor levels, plus component allocation-unwind controls. That depth control does not instrument the core fallback allocation itself.

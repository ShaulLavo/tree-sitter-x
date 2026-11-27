; YAML TextMate scope-compat pack (source.yaml, suffix .yaml)

; Comments
((comment) @_c
 (#make-span! "comment.line.number-sign" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "1"))

; Document markers
"---" @entity.other.document.begin
"..." @entity.other.document.end

; Directives & tags
[(yaml_directive) (tag_directive) (reserved_directive)] @meta.directive
(tag) @storage.type.tag-handle

; Anchors & aliases
(anchor) @meta.property
(anchor "&" @keyword.control.property.anchor @punctuation.definition.anchor)
(anchor_name) @entity.name.type.anchor
(alias "*" @keyword.control.flow.alias @punctuation.definition.alias)
(alias_name) @variable.other.alias

; Flow containers
(flow_sequence) @meta.flow-sequence
(flow_sequence "[" @punctuation.definition.sequence.begin)
(flow_sequence "]" @punctuation.definition.sequence.end)
(flow_sequence "," @punctuation.separator.sequence)
(flow_mapping) @meta.flow-mapping
(flow_mapping "{" @punctuation.definition.mapping.begin)
(flow_mapping "}" @punctuation.definition.mapping.end)
(flow_mapping "," @punctuation.separator.mapping)

; Mapping keys (higher priority than plain string values)
((block_mapping_pair
  key: (flow_node (plain_scalar (string_scalar) @entity.name.tag)))
 (#set! priority "20"))
((block_mapping_pair
  key: (flow_node [(double_quote_scalar) (single_quote_scalar)] @entity.name.tag))
 (#set! priority "20"))
((flow_pair
  key: (flow_node (plain_scalar (string_scalar) @entity.name.tag)))
 (#set! priority "20"))
((flow_pair
  key: (flow_node [(double_quote_scalar) (single_quote_scalar)] @entity.name.tag))
 (#set! priority "20"))

; Scalars & literals
(boolean_scalar) @constant.language.boolean
(null_scalar) @constant.language.null
(integer_scalar) @constant.numeric.integer
(float_scalar) @constant.numeric.float
(timestamp_scalar) @constant.other.timestamp
(string_scalar) @string.unquoted.plain.out

((double_quote_scalar) @_s
 (#make-span! "string.quoted.double" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))
((single_quote_scalar) @_s
 (#make-span! "string.quoted.single" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))

((block_scalar) @_b
 (#starts-with? @_b "|")
 (#make-span! "keyword.control.flow.block-scalar.literal" @_b @_b "start" "0" @_b "start" "1")
 (#make-span! "string.unquoted.block" @_b @_b "start" "1" @_b "end" "0"))
((block_scalar) @_b
 (#starts-with? @_b ">")
 (#make-span! "keyword.control.flow.block-scalar.folded" @_b @_b "start" "0" @_b "start" "1")
 (#make-span! "string.unquoted.block" @_b @_b "start" "1" @_b "end" "0"))

; Punctuation
(block_mapping_pair ":" @punctuation.separator.key-value.mapping)
(flow_pair ":" @punctuation.separator.key-value.mapping)
(block_sequence_item "-" @punctuation.definition.block.sequence.item)
"?" @keyword.control.flow.block-mapping-key

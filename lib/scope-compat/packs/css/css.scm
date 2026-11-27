; CSS TextMate scope-compat pack (source.css, suffix .css)

; Comments
((comment) @_c
 (#make-span! "comment.block" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment.begin" @_c @_c "start" "0" @_c "start" "2")
 (#make-span! "punctuation.definition.comment.end" @_c @_c "end" "-2" @_c "end" "0"))

; Frames
(selectors) @meta.selector
(rule_set (block) @meta.property-list)
(keyframe_block (block) @meta.property-list)
(attribute_selector) @meta.attribute-selector

; Selectors
(tag_name) @entity.name.tag
(universal_selector) @entity.name.tag.wildcard
(nesting_selector) @entity.name.tag
(class_selector "." @entity.other.attribute-name.class @punctuation.definition.entity (class_name) @entity.other.attribute-name.class)
(id_selector "#" @entity.other.attribute-name.id @punctuation.definition.entity (id_name) @entity.other.attribute-name.id)
(pseudo_class_selector ":" @entity.other.attribute-name.pseudo-class @punctuation.definition.entity (class_name) @entity.other.attribute-name.pseudo-class)
(pseudo_element_selector "::" @entity.other.attribute-name.pseudo-element @punctuation.definition.entity (tag_name) @entity.other.attribute-name.pseudo-element)
((pseudo_element_selector (tag_name) @entity.other.attribute-name.pseudo-element) (#set! priority "20"))
(attribute_selector (attribute_name) @entity.other.attribute-name)
(attribute_selector "[" @punctuation.definition.entity.begin.bracket.square)
(attribute_selector "]" @punctuation.definition.entity.end.bracket.square)
(attribute_selector (plain_value) @string.unquoted.attribute-value)
(namespace_name) @entity.name.tag

; Combinators & operators
(child_selector ">" @keyword.operator.combinator)
(adjacent_sibling_selector "+" @keyword.operator.combinator)
(sibling_selector "~" @keyword.operator.combinator)
["=" "~=" "|=" "^=" "$=" "*="] @keyword.operator.pattern
["+" "-" "*" "/"] @keyword.operator.arithmetic
["and" "or" "not" "only"] @keyword.operator.logical

; At-rules
((import_statement "@import" @_at)
 (#make-span! "keyword.control.at-rule.import" @_at @_at "start" "0" @_at "end" "0")
 (#make-span! "punctuation.definition.keyword" @_at @_at "start" "0" @_at "start" "1"))
((media_statement "@media" @_at)
 (#make-span! "keyword.control.at-rule.media" @_at @_at "start" "0" @_at "end" "0")
 (#make-span! "punctuation.definition.keyword" @_at @_at "start" "0" @_at "start" "1"))
((keyframes_statement "@keyframes" @_at)
 (#make-span! "keyword.control.at-rule.keyframes" @_at @_at "start" "0" @_at "end" "0")
 (#make-span! "punctuation.definition.keyword" @_at @_at "start" "0" @_at "start" "1"))
((supports_statement "@supports" @_at)
 (#make-span! "keyword.control.at-rule.supports" @_at @_at "start" "0" @_at "end" "0")
 (#make-span! "punctuation.definition.keyword" @_at @_at "start" "0" @_at "start" "1"))
((charset_statement "@charset" @_at)
 (#make-span! "keyword.control.at-rule.charset" @_at @_at "start" "0" @_at "end" "0")
 (#make-span! "punctuation.definition.keyword" @_at @_at "start" "0" @_at "start" "1"))
((namespace_statement "@namespace" @_at)
 (#make-span! "keyword.control.at-rule.namespace" @_at @_at "start" "0" @_at "end" "0")
 (#make-span! "punctuation.definition.keyword" @_at @_at "start" "0" @_at "start" "1"))
((at_keyword) @_at
 (#make-span! "keyword.control.at-rule" @_at @_at "start" "0" @_at "end" "0")
 (#make-span! "punctuation.definition.keyword" @_at @_at "start" "0" @_at "start" "1"))

(keyframes_name) @variable.parameter.keyframe-list
[(from) (to)] @entity.other.keyframe-offset
(feature_name) @support.type.property-name.media
(keyword_query) @support.constant.media

; Declarations: properties and values
(declaration (property_name) @support.type.property-name)
((declaration (property_name) @variable)
 (#starts-with? @variable "--")
 (#set! priority "20"))
(declaration ":" @punctuation.separator.key-value)
(declaration ";" @punctuation.terminator.rule)
(declaration (plain_value) @support.constant.property-value)
((plain_value) @variable.argument
 (#starts-with? @variable.argument "--")
 (#set! priority "20"))
(important) @keyword.other.important

; Functions
(call_expression (function_name) @support.function.misc)
((call_expression (function_name) @support.function.url)
 (#eq? @support.function.url "url")
 (#set! priority "15"))
((call_expression (function_name) @support.function.calc)
 (#any-of? @support.function.calc "calc" "min" "max" "clamp")
 (#set! priority "15"))
((call_expression (function_name) @support.function.transform)
 (#any-of? @support.function.transform "translate" "translateX" "translateY" "translateZ" "translate3d" "scale" "scaleX" "scaleY" "rotate" "skew" "matrix")
 (#set! priority "15"))
(arguments "(" @punctuation.section.function.begin.bracket.round)
(arguments ")" @punctuation.section.function.end.bracket.round)
(arguments "," @punctuation.separator.list.comma)

; Literals
((string_value) @_s
 (#starts-with? @_s "\"")
 (#make-span! "string.quoted.double" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))
((string_value) @_s
 (#starts-with? @_s "'")
 (#make-span! "string.quoted.single" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))

(color_value) @constant.other.color.rgb-value.hex
(color_value "#" @punctuation.definition.constant)
[(integer_value) (float_value)] @constant.numeric
(unit) @keyword.other.unit

; Punctuation
(block "{" @punctuation.section.property-list.begin.bracket.curly)
(block "}" @punctuation.section.property-list.end.bracket.curly)
(keyframe_block_list "{" @punctuation.section.keyframes.begin.bracket.curly)
(keyframe_block_list "}" @punctuation.section.keyframes.end.bracket.curly)
(feature_query "(" @punctuation.definition.parameters.begin.bracket.round)
(feature_query ")" @punctuation.definition.parameters.end.bracket.round)
(feature_query ":" @punctuation.separator.key-value)
"," @punctuation.separator.list.comma
";" @punctuation.terminator.rule

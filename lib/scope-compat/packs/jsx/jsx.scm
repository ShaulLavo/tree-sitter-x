; Tag frames and name roles do not add JavaScript expression scopes to names.
(jsx_element) @meta.tag
((jsx_element open_tag: (jsx_opening_element !name)) @meta.tag.without-attributes (#set! priority "10"))
(jsx_self_closing_element) @meta.tag
(jsx_opening_element "<" @punctuation.definition.tag.begin ">" @punctuation.definition.tag.end)
(jsx_closing_element "</" @punctuation.definition.tag.begin ">" @punctuation.definition.tag.end)
(jsx_self_closing_element "<" @punctuation.definition.tag.begin "/>" @punctuation.definition.tag.end)

([(jsx_opening_element name: (identifier) @entity.name.tag)
  (jsx_closing_element name: (identifier) @entity.name.tag)
  (jsx_self_closing_element name: (identifier) @entity.name.tag)]
 (#text-class? @entity.name.tag "[a-z]" "[0-9a-z]") (#set! priority "30"))
([(jsx_opening_element name: (identifier) @entity.name.tag @support.class.component)
  (jsx_closing_element name: (identifier) @entity.name.tag @support.class.component)
  (jsx_self_closing_element name: (identifier) @entity.name.tag @support.class.component)]
 (#text-class? @entity.name.tag "[$_A-Za-z]" "[-$._0-9A-Za-z]" "[$_0-9A-Za-z]")
 (#not-text-class? @entity.name.tag "[a-z]" "[0-9a-z]") (#set! priority "30"))
[(jsx_opening_element name: (member_expression) @entity.name.tag @support.class.component)
 (jsx_closing_element name: (member_expression) @entity.name.tag @support.class.component)
 (jsx_self_closing_element name: (member_expression) @entity.name.tag @support.class.component)]

((jsx_element open_tag: (jsx_opening_element) @_open close_tag: (jsx_closing_element) @_close) @_element
 (#make-span! "meta.jsx.children" @_element @_open "end" "0" @_close "start" "0"))
((jsx_opening_element name: (_) @_name ">" @_close) @_tag
 (#make-span! "meta.tag.attributes" @_tag @_name "end" "0" @_close "start" "0"))
((jsx_self_closing_element name: (_) @_name "/>" @_close) @_tag
 (#make-span! "meta.tag.attributes" @_tag @_name "end" "0" @_close "start" "0"))
(jsx_attribute (property_identifier) @entity.other.attribute-name)
((jsx_expression "{" @punctuation.section.embedded.begin "}" @punctuation.section.embedded.end) @_expression
 (#make-span! "meta.embedded.expression" @_expression @punctuation.section.embedded.begin "end" "0" @punctuation.section.embedded.end "start" "0"))
((html_character_reference) @constant.character.entity
 (#make-span! "punctuation.definition.entity" @constant.character.entity @constant.character.entity "start" "0" @constant.character.entity "start" "1")
 (#make-span! "punctuation.definition.entity" @constant.character.entity @constant.character.entity "end" "-1" @constant.character.entity "end" "0"))

(arrow_function body: (jsx_element)) @meta.arrow

; Terminal incomplete tag attribute containing an open call and one numeric arg.
((program . (ERROR . "const" @storage.type . (identifier) @meta.definition.variable @variable.other.constant
  "=" @keyword.operator.assignment . "<" @punctuation.definition.tag.begin . (identifier) @_name
  . (identifier) @entity.other.attribute-name "=" @_assign . "{" @punctuation.section.embedded.begin
  . (identifier) @entity.name.function . "(" @meta.brace.round . (number) . "," .) @_error .) @_program
 (#make-span! "meta.var.expr" @_program @storage.type "start" "0" @_program "end" "0")
 (#make-span! "meta.var-single-variable.expr" @_error @meta.definition.variable "start" "0" @keyword.operator.assignment "start" "0")
 (#make-span! "meta.tag" @_program @punctuation.definition.tag.begin "start" "0" @_program "end" "0")
 (#make-span! "meta.tag.attributes" @_program @_name "end" "0" @_program "end" "0")
 (#make-span! "entity.name.tag" @_name @_name "start" "0" @_name "end" "0")
 (#make-span! "meta.embedded.expression" @_program @punctuation.section.embedded.begin "end" "0" @_program "end" "0")
 (#make-span! "keyword.operator.assignment" @_assign @_assign "start" "0" @_assign "end" "0")
 (#make-span! "meta.function-call" @entity.name.function @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "40"))
; Component classification is independent of declaration recovery and uses the
; same validated ASCII tag classes as well-formed tags.
([(program . (ERROR . "const" . (identifier) "=" . "<" . (identifier) @_name
    . (identifier) "=" . "{" . (identifier) . "(" . (number) . "," .) .)
  (program . (ERROR . "const" . (identifier) "=" . "<" . (identifier) @_name
    . (identifier) "=" . "\"" . (string_fragment) .) .)]
 (#text-class? @_name "[$_A-Za-z]" "[-$._0-9A-Za-z]" "[$_0-9A-Za-z]")
 (#not-text-class? @_name "[a-z]" "[0-9a-z]")
 (#make-span! "support.class.component" @_name @_name "start" "0" @_name "end" "0"))

; Unterminated JSX attribute strings retain lexical ancestors across physical LF.
((program . (ERROR . "const" @storage.type . (identifier) @meta.definition.variable @variable.other.constant
  "=" @keyword.operator.assignment . "<" @punctuation.definition.tag.begin . (identifier) @_name
  . (identifier) @entity.other.attribute-name "=" @_assign
  . "\"" @punctuation.definition.string.begin . (string_fragment) @_fragment .) @_error .) @_program
 (#source-gap? @punctuation.definition.string.begin @_fragment "")
 (#make-span! "meta.var.expr" @_program @storage.type "start" "0" @_program "end" "0")
 (#make-span! "meta.var-single-variable.expr" @_error @meta.definition.variable "start" "0" @keyword.operator.assignment "start" "0")
 (#make-span! "meta.tag" @_program @punctuation.definition.tag.begin "start" "0" @_program "end" "0")
 (#make-span! "meta.tag.attributes" @_program @_name "end" "0" @_program "end" "0")
 (#make-span! "entity.name.tag" @_name @_name "start" "0" @_name "end" "0")
 (#make-span! "string.quoted.double" @_error @punctuation.definition.string.begin "start" "0" @_fragment "end" "0")
 (#make-span! "keyword.operator.assignment" @_assign @_assign "start" "0" @_assign "end" "0")
 (#set! priority "40"))

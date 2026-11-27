; TSX-specific JSX rules layered on top of typescript-common.scm.
(jsx_element) @meta.tag
((jsx_element open_tag: (jsx_opening_element !name)) @meta.tag.without-attributes (#set! priority "10"))
(jsx_self_closing_element) @meta.tag
((jsx_opening_element "<" @punctuation.definition.tag.begin ">" @punctuation.definition.tag.end) (#set! priority "25"))
((jsx_closing_element "</" @punctuation.definition.tag.begin ">" @punctuation.definition.tag.end) (#set! priority "25"))
((jsx_self_closing_element "<" @punctuation.definition.tag.begin "/>" @punctuation.definition.tag.end) (#set! priority "25"))

([(jsx_opening_element name: (identifier) @entity.name.tag)
  (jsx_closing_element name: (identifier) @entity.name.tag)
  (jsx_self_closing_element name: (identifier) @entity.name.tag)]
 (#text-class? @entity.name.tag "[a-z]" "[0-9a-z]") (#set! priority "30"))
([(jsx_opening_element name: (identifier) @entity.name.tag @support.class.component)
  (jsx_closing_element name: (identifier) @entity.name.tag @support.class.component)
  (jsx_self_closing_element name: (identifier) @entity.name.tag @support.class.component)]
 (#text-class? @entity.name.tag "[$_A-Za-z]" "[-$._0-9A-Za-z]" "[$_0-9A-Za-z]")
 (#not-text-class? @entity.name.tag "[a-z]" "[0-9a-z]") (#set! priority "30"))
([(jsx_opening_element name: (member_expression) @entity.name.tag @support.class.component)
  (jsx_closing_element name: (member_expression) @entity.name.tag @support.class.component)
  (jsx_self_closing_element name: (member_expression) @entity.name.tag @support.class.component)]
 (#set! priority "30"))

((jsx_element open_tag: (jsx_opening_element) @_open close_tag: (jsx_closing_element) @_close) @_element
 (#make-span! "meta.jsx.children" @_element @_open "end" "0" @_close "start" "0"))
((jsx_opening_element name: (_) @_name ">" @_close) @_tag
 (#make-span! "meta.tag.attributes" @_tag @_name "end" "0" @_close "start" "0"))
((jsx_self_closing_element name: (_) @_name "/>" @_close) @_tag
 (#make-span! "meta.tag.attributes" @_tag @_name "end" "0" @_close "start" "0"))
((jsx_attribute (property_identifier) @entity.other.attribute-name) (#set! priority "25"))
((jsx_expression "{" @punctuation.section.embedded.begin "}" @punctuation.section.embedded.end) @_expression
 (#make-span! "meta.embedded.expression" @_expression @punctuation.section.embedded.begin "end" "0" @punctuation.section.embedded.end "start" "0")
 (#set! priority "25"))
((html_character_reference) @constant.character.entity
 (#make-span! "punctuation.definition.entity" @constant.character.entity @constant.character.entity "start" "0" @constant.character.entity "start" "1")
 (#make-span! "punctuation.definition.entity" @constant.character.entity @constant.character.entity "end" "-1" @constant.character.entity "end" "0"))

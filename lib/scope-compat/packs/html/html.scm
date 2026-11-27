; HTML TextMate scope-compat pack (text.html.basic, suffix .html)

; Comments
(comment) @comment.block

; Doctype
(doctype) @meta.tag.metadata.doctype
(doctype "<!" @punctuation.definition.tag.begin)
(doctype "doctype" @entity.name.tag)
(doctype ">" @punctuation.definition.tag.end)

; Tags
[(start_tag) (self_closing_tag) (end_tag)] @meta.tag
["<" "</"] @punctuation.definition.tag.begin
[">" "/>"] @punctuation.definition.tag.end
(tag_name) @entity.name.tag
(erroneous_end_tag_name) @invalid.illegal.tag

; Attributes
(attribute) @meta.attribute
(attribute_name) @entity.other.attribute-name
(attribute "=" @punctuation.separator.key-value)
((quoted_attribute_value) @_s
 (#starts-with? @_s "\"")
 (#make-span! "string.quoted.double" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))
((quoted_attribute_value) @_s
 (#starts-with? @_s "'")
 (#make-span! "string.quoted.single" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))
((attribute (attribute_value) @string.unquoted))

; Character entities (&amp;, &#123;)
((entity) @_e
 (#not-text-class? @_e "[&]" "[A-Za-z0-9#]")
 (#make-span! "constant.character.entity" @_e @_e "start" "0" @_e "end" "0")
 (#make-span! "punctuation.definition.entity" @_e @_e "start" "0" @_e "start" "1")
 (#make-span! "punctuation.definition.entity" @_e @_e "end" "-1" @_e "end" "0"))

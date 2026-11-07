; JSX is explicit in the TSX variant; JavaScript/JSX remain deferred.
(jsx_element) @meta.tag
(jsx_self_closing_element) @meta.tag
(jsx_opening_element name: (identifier) @entity.name.tag)
(jsx_closing_element name: (identifier) @entity.name.tag)
(jsx_self_closing_element name: (identifier) @entity.name.tag)
(jsx_attribute (property_identifier) @entity.other.attribute-name)
(jsx_expression) @meta.embedded.expression
(jsx_text) @text
["<" ">" "</" "/>"] @punctuation.definition.tag

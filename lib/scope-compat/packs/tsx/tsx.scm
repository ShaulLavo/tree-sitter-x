; JSX is explicit in the TSX variant; JavaScript/JSX remain deferred.
((lexical_declaration
   kind: _ @_declaration_start
   (variable_declarator) @_declaration_end .)
  (#make-range! "meta.var.expr" @_declaration_start @_declaration_end))

((lexical_declaration
   kind: _ @_declaration_start
   (variable_declarator) @_declaration_end . (comment)* . (comment) .)
  (#make-range! "meta.var.expr" @_declaration_start @_declaration_end))

(jsx_element) @meta.tag
(jsx_self_closing_element) @meta.tag
(jsx_opening_element name: (identifier) @entity.name.tag)
(jsx_closing_element name: (identifier) @entity.name.tag)
(jsx_self_closing_element name: (identifier) @entity.name.tag)
(jsx_attribute (property_identifier) @entity.other.attribute-name)
(jsx_expression) @meta.embedded.expression
(jsx_text) @text
["<" ">" "</" "/>"] @punctuation.definition.tag

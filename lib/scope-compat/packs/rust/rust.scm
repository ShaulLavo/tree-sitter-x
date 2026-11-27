; Rust TextMate scope-compat pack (source.rust, suffix .rust)

; Comments
((line_comment) @_c
 (#starts-with? @_c "///")
 (#make-span! "comment.line.documentation" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))
((line_comment) @_c
 (#starts-with? @_c "//!")
 (#make-span! "comment.line.documentation" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))
((line_comment) @_c
 (#not-starts-with? @_c "///")
 (#not-starts-with? @_c "//!")
 (#make-span! "comment.line.double-slash" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))
((block_comment) @_c
 (#starts-with? @_c "/**")
 (#make-span! "comment.block.documentation" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))
((block_comment) @_c
 (#not-starts-with? @_c "/**")
 (#make-span! "comment.block" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))

; Attributes
[(attribute_item) (inner_attribute_item)] @meta.attribute
(attribute_item "#" @punctuation.definition.attribute)
(inner_attribute_item "#" @punctuation.definition.attribute)
(attribute_item ["[" "]"] @punctuation.brackets.attribute)
(inner_attribute_item ["[" "]"] @punctuation.brackets.attribute)

; Keywords
[
  "if" "else" "match" "loop" "while" "for" "in"
  "break" "continue" "return" "yield" "await"
] @keyword.control

[
  "use" "pub" "impl" "mod" "where" "as" "extern" "unsafe" "async"
  "move" "ref" "dyn" "default" "macro_rules!"
] @keyword.other
(crate) @keyword.other
(super) @keyword.other
(mutable_specifier) @storage.modifier.mut
(function_item "fn" @keyword.other.fn)
(function_signature_item "fn" @keyword.other.fn)
["const" "static" "let" "type" "union"] @storage.type
((struct_item "struct" @_kw)
 (#make-span! "keyword.declaration.struct" @_kw @_kw "start" "0" @_kw "end" "0")
 (#make-span! "storage.type" @_kw @_kw "start" "0" @_kw "end" "0"))
((enum_item "enum" @_kw)
 (#make-span! "keyword.declaration.enum" @_kw @_kw "start" "0" @_kw "end" "0")
 (#make-span! "storage.type" @_kw @_kw "start" "0" @_kw "end" "0"))
((trait_item "trait" @_kw)
 (#make-span! "keyword.declaration.trait" @_kw @_kw "start" "0" @_kw "end" "0")
 (#make-span! "storage.type" @_kw @_kw "start" "0" @_kw "end" "0"))

; Types & lifetimes
(type_identifier) @entity.name.type
((type_identifier) @variable.language.self (#eq? @variable.language.self "Self") (#set! priority "25"))
((struct_item name: (type_identifier) @entity.name.type.struct) (#set! priority "20"))
((enum_item name: (type_identifier) @entity.name.type.enum) (#set! priority "20"))
((trait_item name: (type_identifier) @entity.name.type.trait) (#set! priority "20"))
(type_item name: (type_identifier) @entity.name.type)
(primitive_type) @entity.name.type.primitive
((primitive_type) @entity.name.type.numeric
 (#any-of? @entity.name.type.numeric "i8" "i16" "i32" "i64" "i128" "isize" "u8" "u16" "u32" "u64" "u128" "usize" "f32" "f64")
 (#set! priority "15"))

(lifetime "'" @punctuation.definition.lifetime)
(lifetime (identifier) @entity.name.type.lifetime)

; Namespaces, paths & imports
(use_declaration) @meta.use
(scoped_identifier path: (identifier) @entity.name.namespace)
(scoped_identifier path: (scoped_identifier name: (identifier) @entity.name.namespace))
((scoped_identifier path: (identifier) @entity.name.type)
 (#text-class? @entity.name.type "[A-Z]" "[A-Za-z0-9_]")
 (#set! priority "15"))
((use_declaration (scoped_identifier name: (identifier) @entity.name.type))
 (#text-class? @entity.name.type "[A-Z]" "[A-Za-z0-9_]")
 (#set! priority "18"))
((scoped_type_identifier path: (identifier) @entity.name.namespace))
(mod_item name: (identifier) @entity.name.namespace)

; Functions, methods & macros
((function_item name: (identifier) @entity.name.function) (#set! priority "20"))
((function_signature_item name: (identifier) @entity.name.function) (#set! priority "20"))
((call_expression function: (identifier) @entity.name.function) (#set! priority "20"))
((call_expression function: (field_expression field: (field_identifier) @entity.name.function)) (#set! priority "25"))
((call_expression function: (scoped_identifier name: (identifier) @entity.name.function)) (#set! priority "25"))
((call_expression function: (generic_function function: (identifier) @entity.name.function)) (#set! priority "20"))
((call_expression function: (generic_function function: (field_expression field: (field_identifier) @entity.name.function))) (#set! priority "25"))
((call_expression function: (generic_function function: (scoped_identifier name: (identifier) @entity.name.function))) (#set! priority "25"))
((enum_variant name: (identifier) @entity.name.function) (#set! priority "15"))
((macro_invocation macro: (identifier) @entity.name.function.macro "!" @entity.name.function.macro) (#set! priority "25"))
((macro_invocation macro: (scoped_identifier name: (identifier) @entity.name.function.macro) "!" @entity.name.function.macro) (#set! priority "25"))

; Variables, constants, self & fields
(self) @variable.language.self
(identifier) @variable.other
((identifier) @entity.name.type
 (#text-class? @entity.name.type "[A-Z]" "[A-Za-z0-9_]")
 (#set! priority "8"))
((identifier) @constant.other.caps
 (#text-class? @constant.other.caps "[A-Z]" "[A-Z0-9_]")
 (#set! priority "14"))
((const_item name: (identifier) @constant.other.caps) (#set! priority "20"))
((static_item name: (identifier) @constant.other.caps) (#set! priority "20"))
(field_declaration name: (field_identifier) @variable.other)
(field_initializer field: (field_identifier) @variable.other)
(shorthand_field_initializer (identifier) @variable.other)

; Literals
(boolean_literal) @constant.language.bool
(integer_literal) @constant.numeric.decimal
(float_literal) @constant.numeric.decimal

(string_literal) @string.quoted.double
(string_literal "\"" @punctuation.definition.string)
(raw_string_literal) @string.quoted.double
((char_literal) @_ch
 (#make-span! "string.quoted.single.char" @_ch @_ch "start" "0" @_ch "end" "0")
 (#make-span! "punctuation.definition.char" @_ch @_ch "start" "0" @_ch "start" "1")
 (#make-span! "punctuation.definition.char" @_ch @_ch "end" "-1" @_ch "end" "0"))
(escape_sequence) @constant.character.escape

; Operators & punctuation
"::" @keyword.operator.namespace
"->" @keyword.operator.arrow.skinny
"=>" @keyword.operator.arrow.fat
"." @keyword.operator.access.dot
":" @keyword.operator.key-value
"=" @keyword.operator.assignment.equal
["+=" "-=" "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>="] @keyword.operator.assignment
["==" "!=" "<" "<=" ">" ">="] @keyword.operator.comparison
["&&" "||" "!"] @keyword.operator.logical
["+" "-" "*" "/" "%"] @keyword.operator.math
"&" @keyword.operator.borrow.and
[".." "..="] @keyword.operator.range
"?" @keyword.operator.question

";" @punctuation.semi
"," @punctuation.comma
["{" "}"] @punctuation.brackets.curly
["(" ")"] @punctuation.brackets.round
["[" "]"] @punctuation.brackets.square
(type_parameters ["<" ">"] @punctuation.brackets.angle)
((type_parameters ["<" ">"] @punctuation.brackets.angle) (#set! priority "20"))
((type_arguments ["<" ">"] @punctuation.brackets.angle) (#set! priority "20"))

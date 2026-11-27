; Go TextMate scope-compat pack (source.go, suffix .go)

; Comments
((comment) @_c
 (#starts-with? @_c "//")
 (#make-span! "comment.line.double-slash" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))
((comment) @_c
 (#starts-with? @_c "/*")
 (#make-span! "comment.block" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))

; Keywords
"package" @keyword.package
"import" @keyword.control.import
"const" @keyword.const
"var" @keyword.var
"type" @keyword.type
"func" @keyword.function
"struct" @keyword.struct
"interface" @keyword.interface
"map" @keyword.map
"chan" @keyword.channel
[
  "if" "else" "for" "range" "switch" "case" "default"
  "select" "return" "break" "continue" "goto" "fallthrough" "defer" "go"
] @keyword.control

; Packages & imports
(package_clause (package_identifier) @entity.name.type.package)
(qualified_type package: (package_identifier) @entity.name.type)
(import_spec path: (interpreted_string_literal (interpreted_string_literal_content) @entity.name.import))

; Types & builtin types
(type_identifier) @entity.name.type
((type_identifier) @storage.type.numeric
 (#any-of? @storage.type.numeric
  "int" "int8" "int16" "int32" "int64" "uint" "uint8" "uint16" "uint32" "uint64" "uintptr"
  "float32" "float64" "complex64" "complex128")
 (#set! priority "20"))
((type_identifier) @storage.type.byte (#eq? @storage.type.byte "byte") (#set! priority "20"))
((type_identifier) @storage.type.rune (#eq? @storage.type.rune "rune") (#set! priority "20"))
((type_identifier) @storage.type.string (#eq? @storage.type.string "string") (#set! priority "20"))
((type_identifier) @storage.type.boolean (#eq? @storage.type.boolean "bool") (#set! priority "20"))
((type_identifier) @storage.type.error (#eq? @storage.type.error "error") (#set! priority "20"))
((type_identifier) @storage.type.any (#eq? @storage.type.any "any") (#set! priority "20"))

; Functions & methods
(function_declaration name: (identifier) @entity.name.function)
(method_declaration name: (field_identifier) @entity.name.function)
(method_elem name: (field_identifier) @entity.name.function.support)
((call_expression function: (identifier) @entity.name.function.support) (#set! priority "20"))
((call_expression function: (selector_expression field: (field_identifier) @entity.name.function.support)) (#set! priority "25"))
((call_expression function: (identifier) @support.function.builtin)
 (#any-of? @support.function.builtin
  "append" "cap" "clear" "close" "complex" "copy" "delete" "imag" "len" "make" "max" "min" "new" "panic" "print" "println" "real" "recover")
 (#set! priority "25"))

; Variables, constants, parameters & properties
(identifier) @variable.other
(field_identifier) @variable.other
((const_spec name: (identifier) @variable.other.constant) (#set! priority "20"))
((short_var_declaration left: (expression_list (identifier) @variable.other.assignment)) (#set! priority "18"))
((parameter_declaration name: (identifier) @variable.parameter) (#set! priority "20"))
((variadic_parameter_declaration name: (identifier) @variable.parameter) (#set! priority "20"))
((field_declaration name: (field_identifier) @variable.other.property) (#set! priority "20"))
((keyed_element (literal_element (identifier) @variable.other.property) ":") (#set! priority "20"))

; Literals
[(true) (false)] @constant.language.boolean
(nil) @constant.language.null
(iota) @constant.language.iota
(int_literal) @constant.numeric.decimal
(float_literal) @constant.numeric.floating-point
(imaginary_literal) @constant.numeric.imaginary

(interpreted_string_literal) @string.quoted.double
((interpreted_string_literal . "\"" @punctuation.definition.string.begin) @_s (#not-eq? @_s "\"\""))
((interpreted_string_literal "\"" @punctuation.definition.string.end .) @_s (#not-eq? @_s "\"\""))
((interpreted_string_literal) @_s
 (#eq? @_s "\"\"")
 (#make-span! "string.quoted.double" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))
(raw_string_literal) @string.quoted.raw
(rune_literal) @string.quoted.rune
(escape_sequence) @constant.character.escape

; Operators & punctuation
["=" ":=" "+=" "-=" "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>=" "&^="] @keyword.operator.assignment
["==" "!=" "<" "<=" ">" ">="] @keyword.operator.comparison
["&&" "||" "!"] @keyword.operator.logical
["++" "--"] @keyword.operator.increment
["+" "-" "*" "/" "%"] @keyword.operator.arithmetic
["&" "|" "^" "<<" ">>" "&^" "~"] @keyword.operator.bitwise
"<-" @keyword.operator.channel
"..." @keyword.operator.ellipsis
((pointer_type "*" @keyword.operator.address) (#set! priority "20"))
((unary_expression "&" @keyword.operator.address) (#set! priority "20"))
((unary_expression "*" @keyword.operator.address) (#set! priority "20"))

"{" @punctuation.definition.begin.bracket.curly
"}" @punctuation.definition.end.bracket.curly
"(" @punctuation.definition.begin.bracket.round
")" @punctuation.definition.end.bracket.round
"[" @punctuation.definition.begin.bracket.square
"]" @punctuation.definition.end.bracket.square
(import_spec_list "(" @punctuation.definition.imports.begin.bracket.round)
(import_spec_list ")" @punctuation.definition.imports.end.bracket.round)
"," @punctuation.other.comma
"." @punctuation.other.period
":" @punctuation.other.colon
";" @punctuation.terminator

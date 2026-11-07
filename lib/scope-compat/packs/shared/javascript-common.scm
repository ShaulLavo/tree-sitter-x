; Authored against the JavaScript and JSX DEV references, not the TypeScript pilot.
; These roots remain experimental. Missing injection dependencies stay unclassified.

((import_statement source: (string) @_source) @_import
 (#make-span! "meta.import" @_import @_import "start" "0" @_source "end" "0"))
(import_statement "import" @keyword.control.import "from" @keyword.control.from)
(named_imports) @meta.block
(named_imports ["{" "}"] @punctuation.definition.block)
(import_specifier name: (identifier) @variable.other.readwrite "as" @keyword.control.as alias: (identifier) @variable.other.readwrite.alias)
((import_specifier name: (identifier) @variable.other.readwrite.alias !alias) (#set! priority "10"))
(import_clause (identifier) @variable.other.readwrite.alias)

; Only direct program/block declarations and exports acquire the lexical frame.
; Comments after the last declarator and the semicolon remain outside it.
([(program (lexical_declaration (variable_declarator) @_last . (comment)* .) @_decl)
  (statement_block (lexical_declaration (variable_declarator) @_last . (comment)* .) @_decl)]
 (#make-span! "meta.var.expr" @_decl @_decl "start" "0" @_last "end" "0"))
((export_statement declaration: (lexical_declaration (variable_declarator) @_last . (comment)* .)) @_export
 (#make-span! "meta.var.expr" @_export @_export "start" "0" @_last "end" "0"))
(export_statement "export" @keyword.control.export)
["const" "let" "var"] @storage.type

((lexical_declaration kind: "const" (variable_declarator name: (identifier) @meta.definition.variable @variable.other.constant "=" @_equals) @_decl)
 (#make-span! "meta.var-single-variable.expr" @_decl @meta.definition.variable "start" "0" @_equals "start" "0")
 (#set! priority "10"))
((lexical_declaration kind: "const" (variable_declarator name: (identifier) @meta.definition.variable @variable.other.constant @entity.name.function "=" @_equals value: [(arrow_function) (function_expression)]) @_decl)
 (#make-span! "meta.var-single-variable.expr" @_decl @meta.definition.variable "start" "0" @_equals "start" "0")
 (#set! priority "20"))
((variable_declarator name: (identifier) @meta.definition.variable @variable.other.readwrite "=" @_equals) @_decl
 (#make-span! "meta.var-single-variable.expr" @_decl @meta.definition.variable "start" "0" @_equals "start" "0"))

; Callee frames end before the argument punctuation.
((call_expression function: (identifier) @entity.name.function)
 (#make-span! "meta.function-call" @entity.name.function @entity.name.function "start" "0" @entity.name.function "end" "0"))
(call_expression function: (member_expression) @meta.function-call)
(call_expression function: (member_expression property: (property_identifier) @entity.name.function))
(arguments ["(" ")"] @meta.brace.round)
; Expression contexts exclude JSX tag-name member expressions.
[(binary_expression (member_expression object: (identifier) @variable.other.object "." @punctuation.accessor property: (property_identifier) @variable.other.property))
 (jsx_expression (member_expression object: (identifier) @variable.other.object "." @punctuation.accessor property: (property_identifier) @variable.other.property))
 (variable_declarator value: (member_expression object: (identifier) @variable.other.object "." @punctuation.accessor property: (property_identifier) @variable.other.property))]
(call_expression function: (member_expression object: (identifier) @variable.other.object "." @punctuation.accessor property: (property_identifier) @entity.name.function))
((jsx_expression (member_expression property: (property_identifier) @support.variable.property))
 (#any-of? @support.variable.property "length" "prototype") (#set! priority "10"))
[(expression_statement (identifier) @variable.other.readwrite)
 (binary_expression (identifier) @variable.other.readwrite)
 (arguments (identifier) @variable.other.readwrite)
 (template_substitution (identifier) @variable.other.readwrite)
 (jsx_expression (identifier) @variable.other.readwrite)
 (spread_element (identifier) @variable.other.readwrite)
 (variable_declarator value: (identifier) @variable.other.readwrite)
 (return_statement (identifier) @variable.other.readwrite)]
(shorthand_property_identifier) @variable.other.readwrite

(function_declaration "function" @storage.type.function name: (identifier) @entity.name.function)
(function_expression "function" @storage.type.function)
(formal_parameters) @meta.parameters
(formal_parameters ["(" @punctuation.definition.parameters.begin ")" @punctuation.definition.parameters.end])
(formal_parameters (identifier) @variable.parameter)
(formal_parameters (assignment_pattern left: (identifier) @variable.parameter))
(arrow_function parameter: (identifier) @variable.parameter)
(arrow_function "=>" @storage.type.function.arrow)
((arrow_function body: [(binary_expression) (call_expression) (identifier) (number) (statement_block) (parenthesized_expression)] @_body) @_arrow
 (#make-span! "meta.arrow" @_arrow @_arrow "start" "0" @_body "start" "0"))
((variable_declarator "=" @_equals value: (arrow_function) @_arrow) @_decl
 (#make-span! "meta.arrow" @_decl @_equals "end" "0" @_arrow "start" "0"))

(object) @meta.objectliteral
(object ["{" "}"] @punctuation.definition.block)
((pair key: (_) @_key ":" @_colon) @_pair
 (#make-span! "meta.object-literal.key" @_pair @_key "start" "0" @_colon "end" "0"))
((object (pair) @_member . "}" @_close) @_object
 (#make-span! "meta.object.member" @_object @_member "start" "0" @_close "start" "0"))
((object (pair) @_member "," @_comma) @_object
 (#make-span! "meta.object.member" @_object @_member "start" "0" @_comma "start" "0"))
[(arguments (array) @meta.array.literal)
 (array (array) @meta.array.literal)
 (return_statement (array) @meta.array.literal)]
(array ["[" "]"] @meta.brace.square)
((variable_declarator "=" @_equals value: (array) @_array) @_decl
 (#make-span! "meta.array.literal" @_decl @_equals "end" "0" @_array "end" "0"))
((pair ":" @_colon value: (array) @_array) @_pair
 (#make-span! "meta.array.literal" @_pair @_colon "end" "0" @_array "end" "0"))

((number) @constant.numeric.decimal (#text-class? @constant.numeric.decimal "[0-9]" "[0-9]"))
[(true) (false)] @constant.language.boolean
(null) @constant.language.null
(string "\"" @punctuation.definition.string.begin "\"" @punctuation.definition.string.end) @string.quoted.double
(string "'" @punctuation.definition.string.begin "'" @punctuation.definition.string.end) @string.quoted.single
(escape_sequence) @constant.character.escape
(template_string) @string.template
(template_string . "`" @punctuation.definition.string.template.begin)
(template_string "`" @punctuation.definition.string.template.end .)
((template_substitution "${" @punctuation.definition.template-expression.begin "}" @punctuation.definition.template-expression.end) @meta.template.expression
 (#make-span! "meta.embedded.line" @meta.template.expression @punctuation.definition.template-expression.begin "end" "0" @punctuation.definition.template-expression.end "start" "0"))

((comment) @comment.line.double-slash
 (#starts-with? @comment.line.double-slash "//")
 (#make-span! "punctuation.definition.comment" @comment.line.double-slash @comment.line.double-slash "start" "0" @comment.line.double-slash "start" "2"))
((comment) @comment.block (#starts-with? @comment.block "/*"))

"=" @keyword.operator.assignment
["+" "-" "*" "/" "%" "**"] @keyword.operator.arithmetic
(binary_expression operator: ["==" "===" "!=" "!==" "<" ">" "<=" ">="] @keyword.operator.comparison)
["&&" "||" "!" "??"] @keyword.operator.logical
["return" "if" "else" "for" "while" "throw" "try" "catch" "finally" "switch" "case" "break" "continue"] @keyword.control
";" @punctuation.terminator.statement
"," @punctuation.separator.comma
":" @punctuation.separator.key-value
(rest_pattern "..." @keyword.operator.rest)
(spread_element "..." @keyword.operator.spread)

; A printable-ASCII fragment ending immediately before LF/CRLF and the recovered
; const keyword. EOF, indentation, escapes and other recovery shapes do not match.
((variable_declarator
  (ERROR "\"" @punctuation.definition.string.begin . (string_fragment) @_fragment . (identifier) @storage.type .) @_error
  value: (assignment_expression left: (identifier) @meta.definition.variable @variable.other.constant "=" @_assign right: (_) @_value)) @_decl
 (#eq? @storage.type "const")
 (#source-gap? @punctuation.definition.string.begin @_fragment "")
 (#source-gap? @_fragment @storage.type "\n")
 (#text-class? @_fragment "[ -~]" "[ -~]")
 (#make-span! "string.quoted.double" @_error @punctuation.definition.string.begin "start" "0" @_fragment "end" "0")
 (#make-span! "invalid.illegal.newline" @_fragment @_fragment "end" "-1" @_fragment "end" "0")
 (#make-span! "meta.var-single-variable.expr" @_decl @meta.definition.variable "start" "0" @_assign "start" "0")
 (#make-span! "keyword.operator.assignment" @_decl @_assign "start" "0" @_assign "end" "0")
 (#set! priority "20"))
((variable_declarator
  (ERROR "\"" @punctuation.definition.string.begin . (string_fragment) @_fragment . (identifier) @storage.type .) @_error
  value: (assignment_expression left: (identifier) @meta.definition.variable @variable.other.constant "=" @_assign right: (_) @_value)) @_decl
 (#eq? @storage.type "const")
 (#source-gap? @punctuation.definition.string.begin @_fragment "")
 (#source-gap? @_fragment @storage.type "\r\n")
 (#text-class? @_fragment "[ -~]" "[ -~]")
 (#make-span! "string.quoted.double" @_error @punctuation.definition.string.begin "start" "0" @_fragment "end" "0")
 (#make-span! "invalid.illegal.newline" @_fragment @_fragment "end" "-1" @_fragment "end" "0")
 (#make-span! "meta.var-single-variable.expr" @_decl @meta.definition.variable "start" "0" @_assign "start" "0")
 (#make-span! "keyword.operator.assignment" @_decl @_assign "start" "0" @_assign "end" "0")
 (#set! priority "20"))

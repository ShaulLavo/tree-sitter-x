; Bounded pilot, authoring round 1. Capture names omit the language suffix.
; Regex-based all-caps, documentation comments, contextual identifiers and local
; analysis are deferred: #match?, #is? and #is-not? are rejected, not emulated.
(function_declaration) @meta.function
(function_expression) @meta.function
(arrow_function) @meta.arrow
(formal_parameters) @meta.parameters
(statement_block) @meta.block
(arguments) @meta.brace.round
(object) @meta.objectliteral
(array) @meta.array.literal
(type_annotation) @meta.type.annotation
(type_arguments) @meta.type.parameters
(type_parameters) @meta.type.parameters
(interface_declaration) @meta.interface
(class_declaration) @meta.class

((function_declaration name: (identifier) @entity.name.function) (#set! priority "20"))
((function_expression name: (identifier) @entity.name.function) (#set! priority "20"))
((variable_declarator name: (identifier) @entity.name.function value: (arrow_function)) (#set! priority "20"))
((required_parameter pattern: (identifier) @variable.parameter) (#set! priority "20"))
((optional_parameter pattern: (identifier) @variable.parameter) (#set! priority "20"))
((call_expression function: (identifier) @entity.name.function) (#set! priority "20"))
((method_definition name: (property_identifier) @entity.name.function) (#set! priority "20"))
(identifier) @variable.other.readwrite
(property_identifier) @variable.other.property
(shorthand_property_identifier) @variable.other.readwrite
(type_identifier) @entity.name.type
(predefined_type) @support.type.primitive
(this) @variable.language.this
(super) @variable.language.super
(number) @constant.numeric
[(true) (false)] @constant.language.boolean
(null) @constant.language.null
(undefined) @constant.language.undefined
(comment) @comment.block

((string . "'") @string.quoted.single (#set! priority "10"))
((string . "\"") @string.quoted.double (#set! priority "10"))
(string . ["'" "\""] @punctuation.definition.string.begin)
(string ["'" "\""] @punctuation.definition.string.end .)
(template_string) @string.template
(template_string . "`" @punctuation.definition.string.template.begin)
(template_string "`" @punctuation.definition.string.template.end .)
(template_substitution) @meta.template.expression
(escape_sequence) @constant.character.escape
(regex) @string.regexp

["const" "let" "var"] @storage.type
["function" "class" "interface" "type" "enum" "namespace"] @storage.type
["return" "throw" "if" "else" "switch" "case" "break" "continue" "for" "while" "do" "try" "catch" "finally" "yield" "await"] @keyword.control
["import" "export" "from" "as" "default"] @keyword.control
["new" "delete" "typeof" "void" "instanceof" "in" "of"] @keyword.operator
["async" "static" "readonly" "public" "private" "protected" "abstract" "declare"] @storage.modifier
["=" "+=" "-=" "*=" "/=" "??="] @keyword.operator.assignment
["+" "-" "*" "/" "%" "**"] @keyword.operator.arithmetic
["==" "===" "!=" "!==" "<" ">" "<=" ">="] @keyword.operator.comparison
["!" "&&" "||" "??"] @keyword.operator.logical
"=>" @storage.type.function.arrow
";" @punctuation.terminator.statement
"," @punctuation.separator.comma
"." @punctuation.accessor
":" @punctuation.separator.key-value
["(" ")"] @meta.brace.round
["[" "]"] @meta.brace.square
["{" "}"] @punctuation.definition.block

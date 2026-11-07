; Other malformed shapes remain experimental.
; Terminal open call/object/array with comma-terminated numeric elements. Anchor
; every role to adjacent siblings instead of classifying arbitrary ERROR names.
((program . (ERROR . "const" @storage.type . (identifier) @meta.definition.variable @variable.other.constant
  "=" @keyword.operator.assignment . (identifier) @entity.name.function
  . "(" @meta.brace.round . "{" @punctuation.definition.block
  . (property_identifier) @_key . ":" @punctuation.separator.key-value
  . "[" @meta.brace.square . (number) . "," . (number) . "," .) @_error .) @_program
 (#make-span! "meta.var.expr" @_program @storage.type "start" "0" @_program "end" "0")
 (#make-span! "meta.var-single-variable.expr" @_error @meta.definition.variable "start" "0" @keyword.operator.assignment "start" "0")
 (#make-span! "meta.objectliteral" @_program @punctuation.definition.block "start" "0" @_program "end" "0")
 (#make-span! "meta.object.member" @_program @_key "start" "0" @_program "end" "0")
 (#make-span! "meta.object-literal.key" @_error @_key "start" "0" @punctuation.separator.key-value "end" "0")
 (#make-span! "meta.array.literal" @_program @punctuation.separator.key-value "end" "0" @_program "end" "0")
 (#make-span! "meta.function-call" @entity.name.function @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "40"))

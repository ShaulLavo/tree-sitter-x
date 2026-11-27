; Python TextMate scope-compat pack (source.python, suffix .python)

; Comments
((comment) @_c
 (#make-span! "comment.line.number-sign" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "1"))

; Imports & control flow keywords
["import" "from"] @keyword.control.import
[
  "if" "elif" "else" "for" "in" "while" "break" "continue"
  "return" "yield" "try" "except" "finally" "raise" "with"
  "as" "pass" "assert" "del" "match" "case" "await"
] @keyword.control.flow
["global" "nonlocal"] @storage.modifier.declaration
"lambda" @storage.type.function.lambda
(class_definition "class" @storage.type.class)
(function_definition "def" @storage.type.function)
(function_definition "async" @storage.type.function.async)

; Classes, functions & decorators
((class_definition name: (identifier) @entity.name.type.class) (#set! priority "20"))
((function_definition name: (identifier) @entity.name.function) (#set! priority "20"))
(decorator) @meta.function.decorator
(decorator "@" @entity.name.function.decorator @punctuation.definition.decorator)
((decorator (identifier) @entity.name.function.decorator) (#set! priority "20"))
((decorator (call function: (identifier) @entity.name.function.decorator)) (#set! priority "20"))
((decorator (attribute attribute: (identifier) @entity.name.function.decorator)) (#set! priority "20"))

; Parameters & keyword arguments
((parameters (identifier) @variable.parameter.function.language) (#set! priority "20"))
((typed_parameter (identifier) @variable.parameter.function.language) (#set! priority "20"))
((default_parameter name: (identifier) @variable.parameter.function.language) (#set! priority "20"))
((typed_default_parameter name: (identifier) @variable.parameter.function.language) (#set! priority "20"))
((list_splat_pattern (identifier) @variable.parameter.function.language) (#set! priority "20"))
((dictionary_splat_pattern (identifier) @variable.parameter.function.language) (#set! priority "20"))
((parameters (identifier) @variable.parameter.function.language.special.self)
 (#any-of? @variable.parameter.function.language.special.self "self" "cls")
 (#set! priority "25"))
((keyword_argument name: (identifier) @variable.parameter.function-call) (#set! priority "20"))

; Function & method calls
(call) @meta.function-call
((call function: (identifier) @meta.function-call.generic) (#set! priority "12"))
((call function: (attribute attribute: (identifier) @meta.function-call.generic)) (#set! priority "15"))
((call function: (identifier) @support.function.builtin)
 (#any-of? @support.function.builtin
  "abs" "aiter" "all" "anext" "any" "ascii" "bin" "bool" "breakpoint" "bytearray" "bytes"
  "callable" "chr" "classmethod" "compile" "complex" "delattr" "dict" "dir" "divmod"
  "enumerate" "eval" "exec" "filter" "float" "format" "frozenset" "getattr" "globals"
  "hasattr" "hash" "help" "hex" "id" "input" "int" "isinstance" "issubclass" "iter"
  "len" "list" "locals" "map" "max" "memoryview" "min" "next" "object" "oct" "open"
  "ord" "pow" "print" "property" "range" "repr" "reversed" "round" "set" "setattr"
  "slice" "sorted" "staticmethod" "str" "sum" "super" "tuple" "type" "vars" "zip" "__import__")
 (#set! priority "25"))

; Types & builtin exceptions/types
((type (identifier) @support.type)
 (#any-of? @support.type
  "int" "str" "float" "bool" "bytes" "bytearray" "list" "dict" "set" "frozenset" "tuple"
  "object" "type" "complex" "slice" "range" "memoryview")
 (#set! priority "20"))
((identifier) @support.type.exception
 (#any-of? @support.type.exception
  "BaseException" "Exception" "ArithmeticError" "AssertionError" "AttributeError"
  "EOFError" "FileExistsError" "FileNotFoundError" "ImportError" "IndexError"
  "KeyError" "KeyboardInterrupt" "LookupError" "MemoryError" "ModuleNotFoundError"
  "NameError" "NotImplementedError" "OSError" "OverflowError" "PermissionError"
  "RecursionError" "RuntimeError" "StopIteration" "SyntaxError" "SystemError"
  "SystemExit" "TimeoutError" "TypeError" "UnboundLocalError" "UnicodeError"
  "ValueError" "ZeroDivisionError")
 (#set! priority "20"))

; Magic & special identifiers
"__future__" @support.variable.magic
((identifier) @constant.other.caps
 (#text-class? @constant.other.caps "[A-Z]" "[A-Z0-9_]")
 (#set! priority "15"))
((identifier) @variable.language.special.self
 (#any-of? @variable.language.special.self "self" "cls")
 (#set! priority "18"))
((attribute attribute: (identifier) @meta.attribute) (#set! priority "10"))
(attribute "." @punctuation.separator.period)

; Constants & literals
[(true) (false) (none)] @constant.language
(integer) @constant.numeric.dec
(float) @constant.numeric.float

; Strings, f-strings & docstrings
(string (string_start) @string.quoted.single @punctuation.definition.string.begin)
(string (string_content) @string.quoted.single)
(string (string_end) @string.quoted.single @punctuation.definition.string.end)
((expression_statement (string (string_start) @_ds (string_content) @string.quoted.docstring.multi))
 (#starts-with? @_ds "\"\"\"")
 (#set! priority "25"))
((expression_statement (string (string_start) @string.quoted.docstring.multi @punctuation.definition.string.begin))
 (#starts-with? @string.quoted.docstring.multi "\"\"\"")
 (#set! priority "25"))
((expression_statement (string (string_start) @_ds (string_end) @string.quoted.docstring.multi @punctuation.definition.string.end))
 (#starts-with? @_ds "\"\"\"")
 (#set! priority "25"))
((string (string_start) @_prefix)
 (#starts-with? @_prefix "f")
 (#make-span! "storage.type.string" @_prefix @_prefix "start" "0" @_prefix "start" "1")
 (#set! priority "25"))
((string (string_start) @_prefix)
 (#starts-with? @_prefix "r")
 (#make-span! "storage.type.string" @_prefix @_prefix "start" "0" @_prefix "start" "1")
 (#set! priority "25"))
((string (string_start) @_prefix)
 (#starts-with? @_prefix "b")
 (#make-span! "storage.type.string" @_prefix @_prefix "start" "0" @_prefix "start" "1")
 (#set! priority "25"))
(interpolation) @meta.fstring
(interpolation "{" @constant.character.format.placeholder.other)
(interpolation "}" @constant.character.format.placeholder.other)
(escape_sequence) @constant.character.escape

; Operators & punctuation
["and" "or" "not" "is" "is not" "not in"] @keyword.operator.logical
["=" ":=" "+=" "-=" "*=" "/=" "//=" "%=" "**=" "&=" "|=" "^=" ">>=" "<<=" "@="] @keyword.operator.assignment
["==" "!=" "<" "<=" ">" ">=" "<>"] @keyword.operator.comparison
["+" "-" "*" "**" "/" "//" "%" "@"] @keyword.operator.arithmetic
["&" "|" "^" "~" "<<" ">>"] @keyword.operator.bitwise

(function_definition "->" @punctuation.separator.annotation.result)
(class_definition ":" @punctuation.section.class.begin)
(function_definition ":" @punctuation.section.function.begin)
(typed_parameter ":" @punctuation.separator.annotation)
(typed_default_parameter ":" @punctuation.separator.annotation)
":" @punctuation.separator.colon
"," @punctuation.separator.element
(parameters "(" @punctuation.definition.parameters.begin)
(parameters ")" @punctuation.definition.parameters.end)
(argument_list "(" @punctuation.definition.arguments.begin)
(argument_list ")" @punctuation.definition.arguments.end)
(dictionary "{" @punctuation.definition.dict.begin)
(dictionary "}" @punctuation.definition.dict.end)
(list "[" @punctuation.definition.list.begin)
(list "]" @punctuation.definition.list.end)
(subscript "[" @punctuation.definition.arguments.begin)
(subscript "]" @punctuation.definition.arguments.end)
(type_parameter "[" @punctuation.definition.arguments.begin)
(type_parameter "]" @punctuation.definition.arguments.end)

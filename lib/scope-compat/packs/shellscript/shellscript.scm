; Shellscript / Bash TextMate scope-compat pack (source.shell, suffix .shell)

; Comments & shebang
((comment) @_c
 (#starts-with? @_c "#!")
 (#make-span! "comment.line.number-sign" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "meta.shebang" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment.shebang" @_c @_c "start" "0" @_c "start" "2"))
((comment) @_c
 (#make-span! "comment.line.number-sign" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "1"))

; Control flow keywords
"if" @keyword.control.if
"then" @keyword.control.then
"elif" @keyword.control.elif
"else" @keyword.control.else
"fi" @keyword.control.fi
"for" @keyword.control.for
"select" @keyword.control.select
"in" @keyword.control.in
"do" @keyword.control.do
"done" @keyword.control.done
"while" @keyword.control.while
"until" @keyword.control.until
"case" @keyword.control.case
"esac" @keyword.control.esac
"function" @storage.type.function

; Declaration modifiers
(declaration_command "export" @storage.modifier.export)
(declaration_command "readonly" @storage.modifier.readonly)
(declaration_command "local" @storage.modifier.local)
(declaration_command "declare" @storage.modifier.declare)
(declaration_command "typeset" @storage.modifier.typeset)
(unset_command "unset" @support.function.builtin)

; Functions
(function_definition name: (word) @entity.name.function)
(function_definition "(" @punctuation.definition.arguments)
(function_definition ")" @punctuation.definition.arguments)
(compound_statement ["{" "}"] @punctuation.definition.group)

; Variables & assignments
(variable_assignment name: (variable_name) @variable.other.assignment)
(variable_assignment "=" @keyword.operator.assignment)
(for_statement variable: (variable_name) @variable.other.for)

; Commands & builtins
(command_name (word) @entity.name.function.call @entity.name.command)
((command_name (word) @support.function.builtin)
 (#any-of? @support.function.builtin
  "alias" "bg" "bind" "break" "builtin" "caller" "cd" "command" "compgen" "complete" "continue"
  "dirs" "disown" "echo" "enable" "eval" "exec" "exit" "false" "fc" "fg" "getopts" "hash" "help"
  "history" "jobs" "kill" "let" "logout" "mapfile" "popd" "printf" "pushd" "pwd" "read" "readarray"
  "return" "set" "shift" "shopt" "source" "suspend" "test" "times" "trap" "true" "type" "ulimit"
  "umask" "unalias" "wait" ".")
 (#set! priority "20"))

; Command arguments, options, for-values, case patterns & redirects
((command argument: (word) @string.unquoted.argument) (#set! priority "5"))
((command argument: (word) @_opt)
 (#starts-with? @_opt "-")
 (#make-span! "string.unquoted.argument" @_opt @_opt "start" "0" @_opt "end" "0")
 (#make-span! "constant.other.option" @_opt @_opt "start" "0" @_opt "end" "0")
 (#set! priority "15"))
(for_statement value: (word) @string.unquoted)
(case_item value: [(word) (extglob_pattern)] @string.unquoted.pattern @string.regexp.unquoted)
(file_redirect destination: (word) @string.unquoted.argument)
((file_redirect ">&" (number) @keyword.operator.redirect) (#set! priority "20"))

; Test expressions & operators
(test_command ["[[" "]]" "[" "]"] @punctuation.definition.logical-expression)
(test_operator) @keyword.operator.logical
["&&" "||" "!"] @keyword.operator.logical
"|" @keyword.operator.pipe
"|&" @keyword.operator.pipe
[">" ">>" "<" "<<<" ">&" "<&" "&>" "&>>"] @keyword.operator.redirect
(file_descriptor) @keyword.operator.redirect.stderr
";" @punctuation.terminator.statement.semicolon
";;" @punctuation.terminator.statement.case
(case_item ")" @keyword.operator.pattern.case)
(case_item "|" @punctuation.separator.regex.alternation)

; Expansions & substitutions
(simple_expansion "$" @punctuation.definition.variable @variable.other.normal)
(simple_expansion (variable_name) @variable.other.normal)
(simple_expansion (special_variable_name) @variable.other.positional)
(expansion "${" @punctuation.section.bracket.curly.variable.begin)
(expansion "}" @punctuation.section.bracket.curly.variable.end)
(expansion (variable_name) @variable.other.normal)
(expansion [":-" "-" ":=" "=" ":?" "?" ":+" "+" "#" "##" "%" "%%" "/" "//"] @keyword.operator.expansion)
(command_substitution ["$(" ")"] @punctuation.definition.subshell.single)

; Strings & heredocs
(string) @string.quoted.double
(string . "\"" @punctuation.definition.string.begin)
(string "\"" @punctuation.definition.string.end .)
((raw_string) @_s
 (#make-span! "string.quoted.single" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))
(ansi_c_string) @string.quoted.other
(heredoc_body) @string.unquoted.heredoc
(heredoc_start) @keyword.control.heredoc-token
(heredoc_end) @keyword.control.heredoc-token

; Numbers
(number) @constant.numeric.integer

(object) @meta.structure.dictionary
(array) @meta.structure.array
(string) @string.quoted.double
(escape_sequence) @constant.character.escape
(number) @constant.numeric
[(true) (false)] @constant.language.boolean
(null) @constant.language.null
((pair key: (string) @string.quoted.double @support.type.property-name)
 (#set! priority "10"))
(string . "\"" @punctuation.definition.string.begin)
(string "\"" @punctuation.definition.string.end .)
["{" "}" "[" "]"] @punctuation.definition.structure
"," @punctuation.separator.dictionary.pair
":" @punctuation.separator.dictionary.key-value
((pair ":" @_colon value: (_) @_value)
 (#make-range! "meta.structure.dictionary.value" @_colon @_value))
(ERROR) @invalid.illegal

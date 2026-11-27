; TOML TextMate scope-compat pack (source.toml, suffix .toml)

; Comments
((comment) @_c
 (#make-span! "comment.line.number-sign" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "1"))

; Tables & table arrays
(table "[" @punctuation.definition.section.begin)
(table "]" @punctuation.definition.section.end)
((table "[" (bare_key) @entity.name.section "]") (#set! priority "20"))
((table "[" (dotted_key) @entity.name.section "]") (#set! priority "20"))
((table "[" (quoted_key) @entity.name.section "]") (#set! priority "20"))

(table_array_element "[[" @punctuation.definition.section.begin)
(table_array_element "]]" @punctuation.definition.section.end)
((table_array_element "[[" (bare_key) @entity.name.section "]]") (#set! priority "20"))
((table_array_element "[[" (dotted_key) @entity.name.section "]]") (#set! priority "20"))
((table_array_element "[[" (quoted_key) @entity.name.section "]]") (#set! priority "20"))

; Pairs & keys
(pair (bare_key) @variable.other.key)
(pair (dotted_key) @variable.other.key)
(pair (quoted_key) @variable.other.key)
(pair "=" @punctuation.separator.key-value)

; Containers
(array) @meta.array
(array "[" @punctuation.definition.array.begin)
(array "]" @punctuation.definition.array.end)
(array "," @punctuation.separator.array)

(inline_table) @meta.inline-table
(inline_table "{" @punctuation.definition.inline-table.begin)
(inline_table "}" @punctuation.definition.inline-table.end)
(inline_table "," @punctuation.separator.inline-table)

; Strings
((string) @_s
 (#starts-with? @_s "\"\"\"")
 (#make-span! "string.quoted.triple.double" @_s @_s "start" "0" @_s "end" "0"))
((string) @_s
 (#starts-with? @_s "'''")
 (#make-span! "string.quoted.triple.single" @_s @_s "start" "0" @_s "end" "0"))
((string) @_s
 (#starts-with? @_s "\"")
 (#not-starts-with? @_s "\"\"\"")
 (#make-span! "string.quoted.double" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))
((string) @_s
 (#starts-with? @_s "'")
 (#not-starts-with? @_s "'''")
 (#make-span! "string.quoted.single" @_s @_s "start" "0" @_s "end" "0")
 (#make-span! "punctuation.definition.string.begin" @_s @_s "start" "0" @_s "start" "1")
 (#make-span! "punctuation.definition.string.end" @_s @_s "end" "-1" @_s "end" "0"))
(escape_sequence) @constant.character.escape

; Literals
(boolean) @constant.language.boolean
(integer) @constant.numeric.integer
(float) @constant.numeric.float
[(offset_date_time) (local_date_time) (local_date) (local_time)] @constant.other.date

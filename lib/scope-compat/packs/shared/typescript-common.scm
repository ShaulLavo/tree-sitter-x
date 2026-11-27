; TypeScript / TSX shared TextMate scope pack.
; Capture names omit the language suffix (.ts / .tsx), which is appended at load time.

; --- Enclosing declaration and statement frames ---
((import_statement source: (string) @_source) @_import
 (#make-span! "meta.import" @_import @_import "start" "0" @_source "end" "0"))
(named_imports) @meta.block
(import_statement "import" @keyword.control.import)
(import_statement "from" @keyword.control.from)
(import_specifier name: (identifier) @variable.other.readwrite "as" @keyword.control.as alias: (identifier) @variable.other.readwrite.alias)
((import_specifier name: (identifier) @variable.other.readwrite.alias !alias) (#set! priority "20"))
(import_clause (identifier) @variable.other.readwrite.alias)
(namespace_import "*" @constant.language.import-export-all "as" @keyword.control.as (identifier) @variable.other.readwrite.alias)
(export_statement "export" @keyword.control.export)
(export_statement "default" @keyword.control.default)
(export_statement "from" @keyword.control.from)
(export_specifier name: (identifier) @variable.other.readwrite "as" @keyword.control.as alias: (identifier) @variable.other.readwrite.alias)
((export_specifier name: (identifier) @variable.other.readwrite !alias) (#set! priority "20"))
(namespace_export "*" @constant.language.import-export-all "as" @keyword.control.as (identifier) @variable.other.readwrite.alias)

; Variable declaration frames (exclude trailing comments, terminators, and double-framing on exports).
([(program (lexical_declaration (variable_declarator) @_last .) @_decl)
  (program (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (statement_block (lexical_declaration (variable_declarator) @_last .) @_decl)
  (statement_block (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (switch_case (lexical_declaration (variable_declarator) @_last .) @_decl)
  (switch_case (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (switch_default (lexical_declaration (variable_declarator) @_last .) @_decl)
  (switch_default (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (for_statement (lexical_declaration (variable_declarator) @_last .) @_decl)
  (for_statement (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (for_in_statement (lexical_declaration (variable_declarator) @_last .) @_decl)
  (for_in_statement (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (if_statement (lexical_declaration (variable_declarator) @_last .) @_decl)
  (if_statement (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (else_clause (lexical_declaration (variable_declarator) @_last .) @_decl)
  (else_clause (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (while_statement (lexical_declaration (variable_declarator) @_last .) @_decl)
  (while_statement (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (do_statement (lexical_declaration (variable_declarator) @_last .) @_decl)
  (do_statement (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (labeled_statement (lexical_declaration (variable_declarator) @_last .) @_decl)
  (labeled_statement (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (with_statement (lexical_declaration (variable_declarator) @_last .) @_decl)
  (with_statement (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (ambient_declaration (lexical_declaration (variable_declarator) @_last .) @_decl)
  (ambient_declaration (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (program (variable_declaration (variable_declarator) @_last .) @_decl)
  (program (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (statement_block (variable_declaration (variable_declarator) @_last .) @_decl)
  (statement_block (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (switch_case (variable_declaration (variable_declarator) @_last .) @_decl)
  (switch_case (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (switch_default (variable_declaration (variable_declarator) @_last .) @_decl)
  (switch_default (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (for_statement (variable_declaration (variable_declarator) @_last .) @_decl)
  (for_statement (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (for_in_statement (variable_declaration (variable_declarator) @_last .) @_decl)
  (for_in_statement (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (if_statement (variable_declaration (variable_declarator) @_last .) @_decl)
  (if_statement (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (else_clause (variable_declaration (variable_declarator) @_last .) @_decl)
  (else_clause (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (while_statement (variable_declaration (variable_declarator) @_last .) @_decl)
  (while_statement (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (do_statement (variable_declaration (variable_declarator) @_last .) @_decl)
  (do_statement (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (labeled_statement (variable_declaration (variable_declarator) @_last .) @_decl)
  (labeled_statement (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (with_statement (variable_declaration (variable_declarator) @_last .) @_decl)
  (with_statement (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)
  (ambient_declaration (variable_declaration (variable_declarator) @_last .) @_decl)
  (ambient_declaration (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .) @_decl)]
 (#make-span! "meta.var.expr" @_decl @_decl "start" "0" @_last "end" "0"))
((export_statement declaration: [(lexical_declaration (variable_declarator) @_last .)
                                 (lexical_declaration (variable_declarator) @_last . (comment)* . (comment) .)
                                 (variable_declaration (variable_declarator) @_last .)
                                 (variable_declaration (variable_declarator) @_last . (comment)* . (comment) .)]) @_export
 (#make-span! "meta.var.expr" @_export @_export "start" "0" @_last "end" "0"))

((lexical_declaration kind: "const" (variable_declarator name: (identifier) @variable.other.constant "=" @_equals) @_decl)
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.constant "start" "0" @_equals "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.constant "start" "0" @variable.other.constant "end" "0")
 (#set! priority "25"))
((lexical_declaration kind: "const" (variable_declarator name: (identifier) @variable.other.constant @entity.name.function "=" @_equals value: [(arrow_function) (function_expression)]) @_decl)
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.constant "start" "0" @_equals "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.constant "start" "0" @variable.other.constant "end" "0")
 (#set! priority "30"))
((lexical_declaration kind: "const" (variable_declarator name: (identifier) @variable.other.constant !value) @_decl)
 (#make-span! "meta.definition.variable" @_decl @variable.other.constant "start" "0" @variable.other.constant "end" "0")
 (#set! priority "25"))
((variable_declarator name: (identifier) @variable.other.readwrite "=" @_equals) @_decl
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.readwrite "start" "0" @_equals "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.readwrite "start" "0" @variable.other.readwrite "end" "0")
 (#set! priority "20"))
((variable_declarator name: (identifier) @variable.other.readwrite @entity.name.function "=" @_equals value: [(arrow_function) (function_expression)]) @_decl
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.readwrite "start" "0" @_equals "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.readwrite "start" "0" @variable.other.readwrite "end" "0")
 (#set! priority "26"))
((variable_declarator name: (identifier) @variable.other.readwrite !value) @_decl
 (#make-span! "meta.definition.variable" @_decl @variable.other.readwrite "start" "0" @variable.other.readwrite "end" "0")
 (#set! priority "20"))
((for_in_statement "const" left: (identifier) @variable.other.constant) (#set! priority "25"))

; Function, method, class, interface, type alias, enum frames.
(function_declaration) @meta.function
(generator_function_declaration) @meta.function
(function_expression) @meta.function
(generator_function) @meta.function
(function_signature) @meta.definition.function
(arrow_function) @meta.arrow
(formal_parameters) @meta.parameters
(statement_block) @meta.block
(object) @meta.objectliteral
(object_type) @meta.object.type
(array) @meta.array.literal
(type_annotation) @meta.type.annotation
(type_arguments) @meta.type.parameters
(type_parameters) @meta.type.parameters
(interface_declaration) @meta.interface
(class_declaration) @meta.class
(abstract_class_declaration) @meta.class
(type_alias_declaration) @meta.type.declaration
(enum_declaration) @meta.enum.declaration
(new_expression) @new.expr
((public_field_definition . [(decorator) (accessibility_modifier) (comment) "static" "readonly" "override" "abstract" "declare" "accessor"]* . name: (_) @_name) @_field
 (#make-span! "meta.field.declaration" @_field @_name "start" "0" @_field "end" "0"))
((property_signature name: (_) @_name) @_prop
 (#make-span! "meta.field.declaration" @_prop @_name "start" "0" @_prop "end" "0"))

; Return type annotations use meta.return.type in TextMate.
((function_declaration return_type: (type_annotation) @meta.return.type) (#set! priority "10"))
((generator_function_declaration return_type: (type_annotation) @meta.return.type) (#set! priority "10"))
((function_expression return_type: (type_annotation) @meta.return.type) (#set! priority "10"))
((function_signature return_type: (type_annotation) @meta.return.type) (#set! priority "10"))
((arrow_function return_type: (type_annotation) @meta.return.type) (#set! priority "10"))
((method_definition return_type: (type_annotation) @meta.return.type) (#set! priority "10"))
((method_signature return_type: (type_annotation) @meta.return.type) (#set! priority "10"))

; Object literal keys and members (anchored comma; single meta.object-literal.key).
((pair key: (property_identifier) @meta.object-literal.key) (#set! priority "20"))
((pair key: (property_identifier) @_key ":" @_colon) @_pair
 (#make-span! "meta.object-literal.key" @_pair @_key "end" "0" @_colon "end" "0"))
((pair key: [(string) (number) (computed_property_name)] @_key ":" @_colon) @_pair
 (#make-span! "meta.object-literal.key" @_pair @_key "start" "0" @_colon "end" "0"))
((pair key: (property_identifier) @entity.name.function value: [(function_expression) (arrow_function)]) (#set! priority "25"))
(pair) @meta.object.member
((object (pair) @_member . "," @_comma) @_object
 (#make-span! "meta.object.member" @_object @_member "end" "0" @_comma "start" "0"))
((object [(pair) @_member "}" @_close]+) @_object
 (#any-not-eq? @_member "")
 (#any-eq? @_close "}")
 (#make-span! "meta.object.member" @_object @_member "end" "0" @_close "start" "0"))

; --- Function, method, class, type, and property definitions ---
((function_declaration name: (identifier) @entity.name.function) @_fn
 (#make-span! "meta.definition.function" @_fn @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((generator_function_declaration name: (identifier) @entity.name.function) @_fn
 (#make-span! "meta.definition.function" @_fn @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((function_expression name: (identifier) @entity.name.function) @_fn
 (#make-span! "meta.definition.function" @_fn @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((generator_function name: (identifier) @entity.name.function) @_fn
 (#make-span! "meta.definition.function" @_fn @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((function_signature name: (identifier) @entity.name.function) @_fn
 (#make-span! "meta.definition.function" @_fn @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((method_definition name: (property_identifier) @entity.name.function) @_fn
 (#make-span! "meta.definition.method" @_fn @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((class_body (method_definition name: (property_identifier) @storage.type) @_fn)
 (#eq? @storage.type "constructor")
 (#make-span! "meta.definition.method" @_fn @storage.type "start" "0" @storage.type "end" "0")
 (#set! priority "30"))
((method_signature name: (property_identifier) @entity.name.function) @_fn
 (#make-span! "meta.definition.method" @_fn @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((abstract_method_signature name: (property_identifier) @entity.name.function) @_fn
 (#make-span! "meta.definition.method" @_fn @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((assignment_expression left: (identifier) @entity.name.function right: [(function_expression) (arrow_function)]) (#set! priority "25"))
((assignment_expression left: (member_expression property: (property_identifier) @entity.name.function) right: [(function_expression) (arrow_function)]) (#set! priority "25"))

; Property and field declarations.
((public_field_definition name: (property_identifier) @variable.object.property) @_field
 (#make-span! "meta.definition.property" @_field @variable.object.property "start" "0" @variable.object.property "end" "0")
 (#set! priority "20"))
((public_field_definition "accessor" @storage.type.property . name: (_)) (#set! priority "30"))
((public_field_definition "accessor" @variable.object.property (ERROR "=")) @_field
 (#make-span! "meta.field.declaration" @_field @variable.object.property "start" "0" @_field "end" "0")
 (#make-span! "meta.definition.property" @_field @variable.object.property "start" "0" @variable.object.property "end" "0")
 (#set! priority "35"))
((public_field_definition name: (property_identifier) @storage.type.property (ERROR (identifier) @variable.object.property)) @_field
 (#eq? @storage.type.property "accessor")
 (#make-span! "meta.definition.property" @_field @variable.object.property "start" "0" @variable.object.property "end" "0")
 (#set! priority "30"))
((property_signature name: (property_identifier) @variable.object.property) @_prop
 (#make-span! "meta.definition.property" @_prop @variable.object.property "start" "0" @variable.object.property "end" "0")
 (#set! priority "20"))
((enum_body name: (property_identifier) @variable.other.enummember) (#set! priority "20"))
((enum_assignment name: (property_identifier) @variable.other.enummember) (#set! priority "20"))

; Parameters.
((required_parameter pattern: (identifier) @variable.parameter) (#set! priority "25"))
((required_parameter pattern: (rest_pattern (identifier) @variable.parameter)) (#set! priority "25"))
((required_parameter pattern: (object_pattern (shorthand_property_identifier_pattern) @variable.parameter)) (#set! priority "25"))
((required_parameter pattern: (array_pattern (identifier) @variable.parameter)) (#set! priority "25"))
((optional_parameter pattern: (identifier) @variable.parameter) (#set! priority "25"))
((optional_parameter pattern: (object_pattern (shorthand_property_identifier_pattern) @variable.parameter)) (#set! priority "25"))
((arrow_function parameter: (identifier) @variable.parameter) (#set! priority "25"))
((catch_clause parameter: (identifier) @variable.parameter) (#set! priority "25"))
((index_signature name: (identifier) @variable.parameter) (#set! priority "25"))
((type_predicate name: (identifier) @variable.parameter) (#set! priority "25"))

; Function and method calls.
((call_expression function: (identifier) @entity.name.function)
 (#make-span! "meta.function-call" @entity.name.function @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
(call_expression function: (member_expression) @meta.function-call)
((call_expression function: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function)) (#set! priority "25"))
((call_expression function: (member_expression ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function)) (#set! priority "24"))
((new_expression constructor: (identifier) @entity.name.function)
 (#make-span! "meta.function-call" @entity.name.function @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "25"))
((new_expression constructor: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function)) (#set! priority "25"))
((new_expression constructor: (member_expression ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function)) (#set! priority "24"))

; Expression member expressions and identifiers (guarded from JSX tag names).
[(expression_statement (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (binary_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (unary_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (update_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (assignment_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (augmented_assignment_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (ternary_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (parenthesized_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (subscript_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (arguments (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (array (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (pair (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (return_statement (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (throw_statement (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (await_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (yield_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (template_substitution (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (spread_element (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (variable_declarator value: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (arrow_function body: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (for_in_statement (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (as_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (satisfies_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (non_null_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (public_field_definition value: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (export_statement (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (expression_statement (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (binary_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (unary_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (assignment_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (augmented_assignment_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (ternary_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (parenthesized_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (subscript_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (arguments (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (array (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (pair (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (return_statement (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (throw_statement (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (await_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (yield_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (template_substitution (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (spread_element (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (variable_declarator value: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (arrow_function body: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (for_in_statement (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (as_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (satisfies_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (non_null_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (public_field_definition value: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (export_statement (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (call_expression function: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function))
 (new_expression constructor: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function))
 (member_expression object: [(this) (super) (call_expression) (subscript_expression) (parenthesized_expression) (non_null_expression) (new_expression) (await_expression)] ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property)]

[(expression_statement (identifier) @variable.other.readwrite)
 (binary_expression (identifier) @variable.other.readwrite)
 (unary_expression (identifier) @variable.other.readwrite)
 (update_expression (identifier) @variable.other.readwrite)
 (assignment_expression (identifier) @variable.other.readwrite)
 (augmented_assignment_expression (identifier) @variable.other.readwrite)
 (ternary_expression (identifier) @variable.other.readwrite)
 (parenthesized_expression (identifier) @variable.other.readwrite)
 (subscript_expression (identifier) @variable.other.readwrite)
 (arguments (identifier) @variable.other.readwrite)
 (array (identifier) @variable.other.readwrite)
 (pair value: (identifier) @variable.other.readwrite)
 (template_substitution (identifier) @variable.other.readwrite)
 (spread_element (identifier) @variable.other.readwrite)
 (variable_declarator value: (identifier) @variable.other.readwrite)
 (return_statement (identifier) @variable.other.readwrite)
 (throw_statement (identifier) @variable.other.readwrite)
 (await_expression (identifier) @variable.other.readwrite)
 (yield_expression (identifier) @variable.other.readwrite)
 (arrow_function body: (identifier) @variable.other.readwrite)
 (for_in_statement (identifier) @variable.other.readwrite)
 (switch_case (identifier) @variable.other.readwrite)
 (export_statement (identifier) @variable.other.readwrite)
 (computed_property_name (identifier) @variable.other.readwrite)
 (sequence_expression (identifier) @variable.other.readwrite)
 (public_field_definition value: (identifier) @variable.other.readwrite)
 (assignment_pattern right: (identifier) @variable.other.readwrite)
 (as_expression (identifier) @variable.other.readwrite)
 (satisfies_expression (identifier) @variable.other.readwrite)
 (non_null_expression (identifier) @variable.other.readwrite)]

; Special built-in names in expression positions (below declaration priorities).
([(call_expression function: (member_expression object: (identifier) @support.class.promise))
  (expression_statement (member_expression object: (identifier) @support.class.promise))
  (variable_declarator value: (member_expression object: (identifier) @support.class.promise))
  (return_statement (member_expression object: (identifier) @support.class.promise))]
 (#eq? @support.class.promise "Promise") (#set! priority "26"))
([(call_expression function: (member_expression property: (property_identifier) @support.variable.property))
  (expression_statement (member_expression property: (property_identifier) @support.variable.property))
  (binary_expression (member_expression property: (property_identifier) @support.variable.property))
  (arguments (member_expression property: (property_identifier) @support.variable.property))
  (variable_declarator value: (member_expression property: (property_identifier) @support.variable.property))
  (return_statement (member_expression property: (property_identifier) @support.variable.property))]
 (#any-of? @support.variable.property "length" "prototype") (#set! priority "18"))
([(arguments (identifier) @support.type.object.module)
  (expression_statement (identifier) @support.type.object.module)
  (assignment_expression left: (identifier) @support.type.object.module)
  (assignment_expression left: (member_expression object: (identifier) @support.type.object.module))
  (expression_statement (member_expression object: (identifier) @support.type.object.module))
  (call_expression function: (member_expression object: (identifier) @support.type.object.module))]
 (#any-of? @support.type.object.module "module" "exports") (#set! priority "16"))
([(expression_statement (identifier) @constant.language.nan)
  (binary_expression (identifier) @constant.language.nan)
  (unary_expression (identifier) @constant.language.nan)
  (update_expression (identifier) @constant.language.nan)
  (assignment_expression right: (identifier) @constant.language.nan)
  (augmented_assignment_expression right: (identifier) @constant.language.nan)
  (ternary_expression (identifier) @constant.language.nan)
  (parenthesized_expression (identifier) @constant.language.nan)
  (subscript_expression (identifier) @constant.language.nan)
  (arguments (identifier) @constant.language.nan)
  (array (identifier) @constant.language.nan)
  (pair value: (identifier) @constant.language.nan)
  (template_substitution (identifier) @constant.language.nan)
  (spread_element (identifier) @constant.language.nan)
  (variable_declarator value: (identifier) @constant.language.nan)
  (return_statement (identifier) @constant.language.nan)
  (throw_statement (identifier) @constant.language.nan)
  (await_expression (identifier) @constant.language.nan)
  (yield_expression (identifier) @constant.language.nan)
  (arrow_function body: (identifier) @constant.language.nan)
  (for_in_statement right: (identifier) @constant.language.nan)
  (switch_case value: (identifier) @constant.language.nan)
  (export_statement value: (identifier) @constant.language.nan)
  (computed_property_name (identifier) @constant.language.nan)
  (sequence_expression (identifier) @constant.language.nan)
  (public_field_definition value: (identifier) @constant.language.nan)
  (assignment_pattern right: (identifier) @constant.language.nan)
  (as_expression (identifier) @constant.language.nan)
  (satisfies_expression (identifier) @constant.language.nan)
  (non_null_expression (identifier) @constant.language.nan)]
 (#eq? @constant.language.nan "NaN") (#set! priority "10"))
([(expression_statement (identifier) @constant.language.infinity)
  (binary_expression (identifier) @constant.language.infinity)
  (unary_expression (identifier) @constant.language.infinity)
  (update_expression (identifier) @constant.language.infinity)
  (assignment_expression right: (identifier) @constant.language.infinity)
  (augmented_assignment_expression right: (identifier) @constant.language.infinity)
  (ternary_expression (identifier) @constant.language.infinity)
  (parenthesized_expression (identifier) @constant.language.infinity)
  (subscript_expression (identifier) @constant.language.infinity)
  (arguments (identifier) @constant.language.infinity)
  (array (identifier) @constant.language.infinity)
  (pair value: (identifier) @constant.language.infinity)
  (template_substitution (identifier) @constant.language.infinity)
  (spread_element (identifier) @constant.language.infinity)
  (variable_declarator value: (identifier) @constant.language.infinity)
  (return_statement (identifier) @constant.language.infinity)
  (throw_statement (identifier) @constant.language.infinity)
  (await_expression (identifier) @constant.language.infinity)
  (yield_expression (identifier) @constant.language.infinity)
  (arrow_function body: (identifier) @constant.language.infinity)
  (for_in_statement right: (identifier) @constant.language.infinity)
  (switch_case value: (identifier) @constant.language.infinity)
  (export_statement value: (identifier) @constant.language.infinity)
  (computed_property_name (identifier) @constant.language.infinity)
  (sequence_expression (identifier) @constant.language.infinity)
  (public_field_definition value: (identifier) @constant.language.infinity)
  (assignment_pattern right: (identifier) @constant.language.infinity)
  (as_expression (identifier) @constant.language.infinity)
  (satisfies_expression (identifier) @constant.language.infinity)
  (non_null_expression (identifier) @constant.language.infinity)]
 (#eq? @constant.language.infinity "Infinity") (#set! priority "10"))

; Types and heritage.
((class_declaration name: (type_identifier) @entity.name.type.class) (#set! priority "25"))
((abstract_class_declaration name: (type_identifier) @entity.name.type.class) (#set! priority "25"))
((class name: (type_identifier) @entity.name.type.class) (#set! priority "25"))
((interface_declaration name: (type_identifier) @entity.name.type.interface) (#set! priority "25"))
((type_alias_declaration name: (type_identifier) @entity.name.type.alias) (#set! priority "25"))
((enum_declaration name: (identifier) @entity.name.type.enum) (#set! priority "25"))
((internal_module name: (identifier) @entity.name.type.module) (#set! priority "25"))
((extends_clause value: (identifier) @entity.other.inherited-class) (#set! priority "25"))
((extends_type_clause type: (type_identifier) @entity.other.inherited-class) (#set! priority "25"))
((implements_clause (type_identifier) @entity.other.inherited-class) (#set! priority "25"))
(nested_type_identifier "." @punctuation.accessor)
(type_identifier) @entity.name.type
(predefined_type) @support.type.primitive
((literal_type [(null) (undefined) (true) (false)] @support.type.builtin) (#set! priority "25"))
((as_expression "const" @entity.name.type) (#set! priority "25"))

(private_property_identifier) @variable.other.property
(shorthand_property_identifier) @variable.other.readwrite
(shorthand_property_identifier_pattern) @variable.other.readwrite
(this) @variable.language.this
(super) @variable.language.super

; --- Literals and comments ---
((number) @constant.numeric.decimal (#text-class? @constant.numeric.decimal "[0-9]" "[-0-9._eE+]"))
((number) @constant.numeric.hex (#starts-with? @constant.numeric.hex "0x") (#set! priority "10"))
((number) @constant.numeric.hex (#starts-with? @constant.numeric.hex "0X") (#set! priority "10"))
((number) @constant.numeric.binary (#starts-with? @constant.numeric.binary "0b") (#set! priority "10"))
((number) @constant.numeric.binary (#starts-with? @constant.numeric.binary "0B") (#set! priority "10"))
((number) @constant.numeric.octal (#starts-with? @constant.numeric.octal "0o") (#set! priority "10"))
((number) @constant.numeric.octal (#starts-with? @constant.numeric.octal "0O") (#set! priority "10"))
(number) @constant.numeric
(true) @constant.language.boolean.true
(false) @constant.language.boolean.false
(null) @constant.language.null
(undefined) @constant.language.undefined

; Emit comment container before punctuation.definition.comment so bare "//" and "/*" stay ordered.
((comment) @_c
 (#starts-with? @_c "//")
 (#make-span! "comment.line.double-slash" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))
((comment) @_c
 (#starts-with? @_c "/**")
 (#not-eq? @_c "/**/")
 (#make-span! "comment.block.documentation" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))
((comment) @_c
 (#starts-with? @_c "/*")
 (#not-starts-with? @_c "/**")
 (#make-span! "comment.block" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))
((comment) @_c
 (#eq? @_c "/**/")
 (#make-span! "comment.block" @_c @_c "start" "0" @_c "end" "0")
 (#make-span! "punctuation.definition.comment" @_c @_c "start" "0" @_c "start" "2"))

((string . "'") @string.quoted.single (#set! priority "10"))
((string . "\"") @string.quoted.double (#set! priority "10"))
(string . ["'" "\""] @punctuation.definition.string.begin)
(string ["'" "\""] @punctuation.definition.string.end .)
(template_string) @string.template
(template_literal_type) @string.template
(template_string . "`" @punctuation.definition.string.template.begin)
(template_string "`" @punctuation.definition.string.template.end .)
(template_literal_type . "`" @punctuation.definition.string.template.begin)
(template_literal_type "`" @punctuation.definition.string.template.end .)
((template_substitution "${" @punctuation.definition.template-expression.begin "}" @punctuation.definition.template-expression.end) @meta.template.expression
 (#make-span! "meta.embedded.line" @meta.template.expression @punctuation.definition.template-expression.begin "end" "0" @punctuation.definition.template-expression.end "start" "0"))
((template_type "${" @punctuation.definition.template-expression.begin "}" @punctuation.definition.template-expression.end) @meta.template.expression
 (#make-span! "meta.embedded.line" @meta.template.expression @punctuation.definition.template-expression.begin "end" "0" @punctuation.definition.template-expression.end "start" "0"))
(escape_sequence) @constant.character.escape
(regex) @string.regexp
((regex "/" @punctuation.definition.string.begin (regex_pattern) "/" @punctuation.definition.string.end) (#set! priority "20"))
((regex_flags) @keyword.other (#set! priority "20"))

; --- Keywords, storage, modifiers, and operators ---
["const" "let" "var"] @storage.type
((type_parameter "const" @storage.modifier) (#set! priority "25"))
"function" @storage.type.function
"class" @storage.type.class
"interface" @storage.type.interface
"type" @storage.type.type
"enum" @storage.type.enum
["namespace" "module"] @storage.type.namespace
["get" "set"] @storage.type.property
"=>" @storage.type.function.arrow
["async" "static" "readonly" "public" "private" "protected" "abstract" "declare" "override" "extends" "implements"] @storage.modifier

["return" "yield" "await" "break" "continue"] @keyword.control.flow
["if" "else" "switch" "case"] @keyword.control.conditional
["for" "while" "do"] @keyword.control.loop
["try" "catch" "finally" "throw"] @keyword.control.trycatch
"default" @keyword.control.default
"as" @keyword.control.as
"satisfies" @keyword.control.satisfies
"import" @keyword.control.import
"export" @keyword.control.export
"from" @keyword.control.from
["debugger" "with"] @keyword.control

"new" @keyword.operator.new
"typeof" @keyword.operator.expression.typeof
"instanceof" @keyword.operator.expression.instanceof
"in" @keyword.operator.expression.in
"of" @keyword.operator.expression.of
"delete" @keyword.operator.expression.delete
(unary_expression "void" @keyword.operator.expression.void)
"keyof" @keyword.operator.expression.keyof
"infer" @keyword.operator.expression.infer
"is" @keyword.operator.expression.is
(generator_function_declaration "*" @keyword.generator.asterisk)
(generator_function "*" @keyword.generator.asterisk)

"=" @keyword.operator.assignment
["+=" "-=" "*=" "/=" "%=" "**=" "<<=" ">>=" ">>>=" "&=" "^=" "|=" "&&=" "||=" "??="] @keyword.operator.assignment.compound
["+" "-" "*" "/" "%" "**"] @keyword.operator.arithmetic
"++" @keyword.operator.increment
"--" @keyword.operator.decrement
["==" "===" "!=" "!=="] @keyword.operator.comparison
(binary_expression operator: ["<" "<=" ">" ">="] @keyword.operator.relational)
["!" "&&" "||" "??"] @keyword.operator.logical
["~" "&" "|" "^" "<<" ">>" ">>>"] @keyword.operator.bitwise
((union_type "|" @keyword.operator.type) (#set! priority "20"))
((intersection_type "&" @keyword.operator.type) (#set! priority "20"))
((type_annotation ":" @keyword.operator.type.annotation) (#set! priority "20"))
((index_signature ":" @keyword.operator.type.annotation) (#set! priority "20"))
((type_predicate_annotation ":" @keyword.operator.type.annotation) (#set! priority "20"))
((omitting_type_annotation "-?:" @keyword.operator.type.annotation) (#set! priority "20"))
((opting_type_annotation "?:" @keyword.operator.type.annotation) (#set! priority "20"))
((ternary_expression ["?" ":"] @keyword.operator.ternary) (#set! priority "20"))
((conditional_type ["?" ":"] @keyword.operator.ternary) (#set! priority "20"))
((public_field_definition "?" @keyword.operator.optional) (#set! priority "20"))
((property_signature "?" @keyword.operator.optional) (#set! priority "20"))
((method_signature "?" @keyword.operator.optional) (#set! priority "20"))
((optional_parameter "?" @keyword.operator.optional) (#set! priority "20"))
((optional_chain "?." @punctuation.accessor.optional) (#set! priority "20"))
((rest_pattern "..." @keyword.operator.rest) (#set! priority "20"))
((rest_type "..." @keyword.operator.rest) (#set! priority "20"))
((spread_element "..." @keyword.operator.spread) (#set! priority "20"))

; --- Punctuation ---
((formal_parameters "(" @punctuation.definition.parameters.begin ")" @punctuation.definition.parameters.end) (#set! priority "20"))
((type_parameters "<" @punctuation.definition.typeparameters.begin ">" @punctuation.definition.typeparameters.end) (#set! priority "25"))
((type_arguments "<" @punctuation.definition.typeparameters.begin ">" @punctuation.definition.typeparameters.end) (#set! priority "25"))
";" @punctuation.terminator.statement
"," @punctuation.separator.comma
":" @punctuation.separator.key-value
["(" ")"] @meta.brace.round
["[" "]"] @meta.brace.square
["{" "}"] @punctuation.definition.block

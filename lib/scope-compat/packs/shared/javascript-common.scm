; Authored against the JavaScript and JSX DEV references.
; Preserves exact ancestor framing while covering full JS expression, class,
; function, regex, and control-flow grammar constructs.

((import_statement source: (string) @_source) @_import
 (#make-span! "meta.import" @_import @_import "start" "0" @_source "end" "0"))
(import_statement "import" @keyword.control.import)
(import_statement "from" @keyword.control.from)
(named_imports) @meta.block
(named_imports ["{" "}"] @punctuation.definition.block)
(import_specifier name: (identifier) @variable.other.readwrite "as" @keyword.control.as alias: (identifier) @variable.other.readwrite.alias)
((import_specifier name: (identifier) @variable.other.readwrite.alias !alias) (#set! priority "10"))
(import_clause (identifier) @variable.other.readwrite.alias)
(namespace_import "*" @constant.language.import-export-all "as" @keyword.control.as (identifier) @variable.other.readwrite.alias)
(export_statement "export" @keyword.control.export)
(export_statement "default" @keyword.control.default)
(export_statement "from" @keyword.control.from)
(export_specifier name: (identifier) @variable.other.readwrite "as" @keyword.control.as alias: (identifier) @variable.other.readwrite.alias)
((export_specifier name: (identifier) @variable.other.readwrite !alias) (#set! priority "10"))
(namespace_export "*" @constant.language.import-export-all "as" @keyword.control.as (identifier) @variable.other.readwrite.alias)

; Only direct program/block declarations and exports acquire the lexical frame.
; Comments after the last declarator and the semicolon remain outside it.
([(program (lexical_declaration (variable_declarator) @_last . (comment)* .) @_decl)
  (statement_block (lexical_declaration (variable_declarator) @_last . (comment)* .) @_decl)
  (program (variable_declaration (variable_declarator) @_last . (comment)* .) @_decl)
  (statement_block (variable_declaration (variable_declarator) @_last . (comment)* .) @_decl)]
 (#make-span! "meta.var.expr" @_decl @_decl "start" "0" @_last "end" "0"))
((export_statement declaration: [(lexical_declaration (variable_declarator) @_last . (comment)* .)
                                 (variable_declaration (variable_declarator) @_last . (comment)* .)]) @_export
 (#make-span! "meta.var.expr" @_export @_export "start" "0" @_last "end" "0"))
["const" "let" "var"] @storage.type

((lexical_declaration kind: "const" (variable_declarator name: (identifier) @variable.other.constant "=" @_equals) @_decl)
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.constant "start" "0" @_equals "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.constant "start" "0" @variable.other.constant "end" "0")
 (#set! priority "15"))
((lexical_declaration kind: "const" (variable_declarator name: (identifier) @variable.other.constant @entity.name.function "=" @_equals value: [(arrow_function) (function_expression) (generator_function)]) @_decl)
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.constant "start" "0" @_equals "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.constant "start" "0" @variable.other.constant "end" "0")
 (#set! priority "20"))
((lexical_declaration kind: "const" (variable_declarator name: (identifier) @variable.other.constant !value) @_decl)
 (#make-span! "meta.definition.variable" @_decl @variable.other.constant "start" "0" @variable.other.constant "end" "0")
 (#set! priority "15"))
((variable_declarator name: (identifier) @variable.other.readwrite "=" @_equals) @_decl
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.readwrite "start" "0" @_equals "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.readwrite "start" "0" @variable.other.readwrite "end" "0")
 (#set! priority "12"))
((variable_declarator name: (identifier) @variable.other.readwrite @entity.name.function "=" @_equals value: [(arrow_function) (function_expression) (generator_function)]) @_decl
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.readwrite "start" "0" @_equals "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.readwrite "start" "0" @variable.other.readwrite "end" "0")
 (#set! priority "18"))
((variable_declarator name: (identifier) @variable.other.readwrite !value) @_decl
 (#make-span! "meta.definition.variable" @_decl @variable.other.readwrite "start" "0" @variable.other.readwrite "end" "0")
 (#set! priority "12"))
((for_in_statement "const" left: (identifier) @variable.other.constant) (#set! priority "20"))

; Callee frames end before the argument punctuation.
((call_expression function: (identifier) @entity.name.function)
 (#make-span! "meta.function-call" @entity.name.function @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "20"))
((call_expression function: (identifier) @entity.name.function.tagged-template arguments: (template_string))
 (#set! priority "25"))
(call_expression function: (member_expression) @meta.function-call)
((call_expression function: (member_expression property: (property_identifier) @entity.name.function)) (#set! priority "20"))
((new_expression constructor: (identifier) @entity.name.function)
 (#make-span! "meta.function-call" @entity.name.function @entity.name.function "start" "0" @entity.name.function "end" "0")
 (#set! priority "20"))
((new_expression constructor: (member_expression property: (property_identifier) @entity.name.function)) (#set! priority "20"))
(new_expression) @new.expr
(arguments ["(" ")"] @meta.brace.round)

; Member expressions outside JSX tag names.
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
 (jsx_expression (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (spread_element (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (variable_declarator value: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (arrow_function body: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (for_in_statement (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (field_definition value: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
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
 (jsx_expression (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (spread_element (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (variable_declarator value: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (arrow_function body: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (for_in_statement (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (field_definition value: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (export_statement (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property))
 (member_expression object: [(this) (super) (call_expression) (subscript_expression) (parenthesized_expression) (new_expression) (await_expression)] ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.property)]
(call_expression function: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function))
(call_expression function: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function))
(call_expression function: (member_expression object: [(this) (super) (call_expression) (member_expression) (subscript_expression)] ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function))
(new_expression constructor: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function))
(new_expression constructor: (member_expression object: (member_expression object: (identifier) @variable.other.object ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @variable.other.object.property) ["." @punctuation.accessor (optional_chain)] property: (property_identifier) @entity.name.function))

([(jsx_expression (member_expression property: (property_identifier) @support.variable.property))
  (expression_statement (member_expression property: (property_identifier) @support.variable.property))
  (binary_expression (member_expression property: (property_identifier) @support.variable.property))
  (arguments (member_expression property: (property_identifier) @support.variable.property))
  (variable_declarator value: (member_expression property: (property_identifier) @support.variable.property))
  (return_statement (member_expression property: (property_identifier) @support.variable.property))]
 (#any-of? @support.variable.property "length" "prototype") (#set! priority "10"))
([(expression_statement (member_expression object: (identifier) @support.type.object.module))
  (assignment_expression left: (member_expression object: (identifier) @support.type.object.module))
  (assignment_expression right: (member_expression object: (identifier) @support.type.object.module))
  (variable_declarator value: (member_expression object: (identifier) @support.type.object.module))
  (call_expression function: (member_expression object: (identifier) @support.type.object.module))
  (arguments (member_expression object: (identifier) @support.type.object.module))]
 (#any-of? @support.type.object.module "module" "exports") (#set! priority "25"))
([(expression_statement (member_expression property: (property_identifier) @support.type.object.module))
  (assignment_expression left: (member_expression property: (property_identifier) @support.type.object.module))
  (assignment_expression right: (member_expression property: (property_identifier) @support.type.object.module))
  (variable_declarator value: (member_expression property: (property_identifier) @support.type.object.module))
  (call_expression function: (member_expression property: (property_identifier) @support.type.object.module))
  (arguments (member_expression property: (property_identifier) @support.type.object.module))]
 (#eq? @support.type.object.module "exports") (#set! priority "25"))
([(call_expression function: (member_expression object: (identifier) @support.class.promise))
  (expression_statement (member_expression object: (identifier) @support.class.promise))
  (variable_declarator value: (member_expression object: (identifier) @support.class.promise))
  (return_statement (member_expression object: (identifier) @support.class.promise))]
 (#eq? @support.class.promise "Promise") (#set! priority "16"))

; Expression identifiers outside JSX tag names.
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
 (jsx_expression (identifier) @variable.other.readwrite)
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
 (field_definition value: (identifier) @variable.other.readwrite)
 (assignment_pattern right: (identifier) @variable.other.readwrite)]
((arguments (identifier) @support.type.object.module) (#any-of? @support.type.object.module "module" "exports") (#set! priority "16"))
((assignment_expression left: (identifier) @support.type.object.module) (#any-of? @support.type.object.module "module" "exports") (#set! priority "16"))
((expression_statement (identifier) @support.type.object.module) (#any-of? @support.type.object.module "module" "exports") (#set! priority "16"))
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
  (jsx_expression (identifier) @constant.language.nan)
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
  (field_definition value: (identifier) @constant.language.nan)
  (assignment_pattern right: (identifier) @constant.language.nan)]
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
  (jsx_expression (identifier) @constant.language.infinity)
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
  (field_definition value: (identifier) @constant.language.infinity)
  (assignment_pattern right: (identifier) @constant.language.infinity)]
 (#eq? @constant.language.infinity "Infinity") (#set! priority "10"))
(shorthand_property_identifier) @variable.other.readwrite
(shorthand_property_identifier_pattern) @variable.other.readwrite
(this) @variable.language.this
(super) @variable.language.super

; Functions, generators, classes, and methods.
((function_declaration "function" @storage.type.function name: (identifier) @entity.name.function) (#set! priority "20"))
((generator_function_declaration "function" @storage.type.function "*" @keyword.generator.asterisk name: (identifier) @entity.name.function) (#set! priority "20"))
(function_expression "function" @storage.type.function)
((function_expression name: (identifier) @entity.name.function) (#set! priority "20"))
(generator_function "function" @storage.type.function "*" @keyword.generator.asterisk)
((generator_function name: (identifier) @entity.name.function) (#set! priority "20"))
((class_declaration "class" @storage.type.class name: (identifier) @entity.name.type.class) (#set! priority "20"))
(class "class" @storage.type.class)
((class name: (identifier) @entity.name.type.class) (#set! priority "20"))
(class_heritage "extends" @storage.modifier (identifier) @entity.other.inherited-class)
((method_definition name: (property_identifier) @entity.name.function) (#set! priority "20"))
((class_body (method_definition name: (property_identifier) @storage.type))
 (#eq? @storage.type "constructor") (#set! priority "25"))
((method_definition ["get" "set"] @storage.type.property) (#set! priority "20"))
((method_definition "static" @storage.modifier) (#set! priority "20"))
((method_definition "async" @storage.modifier.async) (#set! priority "20"))
((field_definition "static" @storage.modifier) (#set! priority "20"))
((field_definition property: (property_identifier) @variable.object.property) (#set! priority "15"))
((pair key: (property_identifier) @entity.name.function value: [(function_expression) (arrow_function) (generator_function)]) (#set! priority "20"))
((assignment_expression left: (identifier) @entity.name.function right: [(function_expression) (arrow_function) (generator_function)]) (#set! priority "20"))
((assignment_expression left: (member_expression property: (property_identifier) @entity.name.function) right: [(function_expression) (arrow_function) (generator_function)]) (#set! priority "20"))

(formal_parameters) @meta.parameters
(formal_parameters ["(" @punctuation.definition.parameters.begin ")" @punctuation.definition.parameters.end])
((formal_parameters (identifier) @variable.parameter) (#set! priority "20"))
((formal_parameters (assignment_pattern left: (identifier) @variable.parameter)) (#set! priority "20"))
((formal_parameters (rest_pattern (identifier) @variable.parameter)) (#set! priority "20"))
((formal_parameters (object_pattern (shorthand_property_identifier_pattern) @variable.parameter)) (#set! priority "20"))
((formal_parameters (object_pattern (pair_pattern key: (property_identifier) @variable.object.property value: (identifier) @variable.parameter))) (#set! priority "20"))
((formal_parameters (object_pattern (pair_pattern key: (property_identifier) @variable.object.property value: (assignment_pattern left: (identifier) @variable.parameter)))) (#set! priority "20"))
((formal_parameters (array_pattern (identifier) @variable.parameter)) (#set! priority "20"))
((catch_clause parameter: (identifier) @variable.other.readwrite) (#set! priority "20"))
((catch_clause ["(" ")"] @meta.brace.round))
((for_statement ["(" ")"] @meta.brace.round))
((for_in_statement ["(" ")"] @meta.brace.round))
((arrow_function parameter: (identifier) @variable.parameter) (#set! priority "20"))
(arrow_function "=>" @storage.type.function.arrow)
((arrow_function body: [(binary_expression) (call_expression) (identifier) (number) (statement_block) (parenthesized_expression)] @_body) @_arrow
 (#make-span! "meta.arrow" @_arrow @_arrow "start" "0" @_body "start" "0"))
((variable_declarator "=" @_equals value: (arrow_function) @_arrow) @_decl
 (#make-span! "meta.arrow" @_decl @_equals "end" "0" @_arrow "start" "0"))

(object) @meta.objectliteral
(object ["{" "}"] @punctuation.definition.block)
(statement_block ["{" "}"] @punctuation.definition.block)
(class_body ["{" "}"] @punctuation.definition.block)
(switch_body ["{" "}"] @punctuation.definition.block)
(object_pattern ["{" "}"] @punctuation.definition.block)
((pair key: (_) @_key ":" @_colon) @_pair
 (#make-span! "meta.object-literal.key" @_pair @_key "start" "0" @_colon "end" "0"))
(pair) @meta.object.member
((object (pair) @_member . "," @_comma) @_object
 (#make-span! "meta.object.member" @_object @_member "end" "0" @_comma "start" "0"))
((object (pair) @_member . "}" @_close) @_object
 (#source-gap? @_member @_close " ")
 (#make-span! "meta.object.member" @_object @_member "end" "0" @_close "start" "0"))
((object (pair) @_member . "}" @_close) @_object
 (#source-gap? @_member @_close "  ")
 (#make-span! "meta.object.member" @_object @_member "end" "0" @_close "start" "0"))
((object (pair) @_member . "}" @_close) @_object
 (#source-gap? @_member @_close "\t")
 (#make-span! "meta.object.member" @_object @_member "end" "0" @_close "start" "0"))
((object (pair) @_member . "}" @_close) @_object
 (#source-gap? @_member @_close "\n")
 (#make-span! "meta.object.member" @_object @_member "end" "0" @_close "start" "0"))
((object (pair) @_member . "}" @_close) @_object
 (#source-gap? @_member @_close "\r\n")
 (#make-span! "meta.object.member" @_object @_member "end" "0" @_close "start" "0"))
[(arguments (array) @meta.array.literal)
 (array (array) @meta.array.literal)
 (return_statement (array) @meta.array.literal)]
(array ["[" "]"] @meta.brace.square)
(subscript_expression ["[" "]"] @meta.brace.square)
(array_pattern ["[" "]"] @meta.brace.square)
(parenthesized_expression ["(" ")"] @meta.brace.round)
((variable_declarator "=" @_equals value: (array) @_array) @_decl
 (#make-span! "meta.array.literal" @_decl @_equals "end" "0" @_array "end" "0"))
((pair ":" @_colon value: (array) @_array) @_pair
 (#make-span! "meta.array.literal" @_pair @_colon "end" "0" @_array "end" "0"))

((number) @constant.numeric.decimal (#text-class? @constant.numeric.decimal "[0-9]" "[-0-9._eE+]"))
((number) @constant.numeric.hex (#starts-with? @constant.numeric.hex "0x") (#set! priority "10"))
((number) @constant.numeric.hex (#starts-with? @constant.numeric.hex "0X") (#set! priority "10"))
((number) @constant.numeric.binary (#starts-with? @constant.numeric.binary "0b") (#set! priority "10"))
((number) @constant.numeric.binary (#starts-with? @constant.numeric.binary "0B") (#set! priority "10"))
((number) @constant.numeric.octal (#starts-with? @constant.numeric.octal "0o") (#set! priority "10"))
((number) @constant.numeric.octal (#starts-with? @constant.numeric.octal "0O") (#set! priority "10"))
(true) @constant.language.boolean.true
(false) @constant.language.boolean.false
(null) @constant.language.null
(undefined) @constant.language.undefined
(string "\"" @punctuation.definition.string.begin "\"" @punctuation.definition.string.end) @string.quoted.double
(string "'" @punctuation.definition.string.begin "'" @punctuation.definition.string.end) @string.quoted.single
(escape_sequence) @constant.character.escape
(template_string) @string.template
(template_string . "`" @punctuation.definition.string.template.begin)
(template_string "`" @punctuation.definition.string.template.end .)
((template_substitution "${" @punctuation.definition.template-expression.begin "}" @punctuation.definition.template-expression.end) @meta.template.expression
 (#make-span! "meta.embedded.line" @meta.template.expression @punctuation.definition.template-expression.begin "end" "0" @punctuation.definition.template-expression.end "start" "0"))
((regex) @string.regexp (#set! priority "15"))
((regex "/" @punctuation.definition.string.begin (regex_pattern) "/" @punctuation.definition.string.end) (#set! priority "20"))
((regex_flags) @keyword.other (#set! priority "20"))

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
 (#make-span! "comment.block" @_c @_c "start" "0" @_c "end" "0"))
((comment) @_c
 (#eq? @_c "/**/")
 (#make-span! "comment.block" @_c @_c "start" "0" @_c "end" "0"))

"async" @storage.modifier.async
"new" @keyword.operator.new
"typeof" @keyword.operator.expression.typeof
"instanceof" @keyword.operator.expression.instanceof
"in" @keyword.operator.expression.in
"of" @keyword.operator.expression.of
"delete" @keyword.operator.expression.delete
"void" @keyword.operator.expression.void
"=" @keyword.operator.assignment
["+=" "-=" "*=" "/=" "%=" "**=" "<<=" ">>=" ">>>=" "&=" "^=" "|=" "&&=" "||=" "??="] @keyword.operator.assignment.compound
(binary_expression operator: ["+" "-" "*" "/" "%" "**"] @keyword.operator.arithmetic)
(unary_expression operator: ["+" "-"] @keyword.operator.arithmetic)
"++" @keyword.operator.increment
"--" @keyword.operator.decrement
(binary_expression operator: ["==" "===" "!=" "!=="] @keyword.operator.comparison)
(binary_expression operator: ["<" ">" "<=" ">="] @keyword.operator.relational)
["&&" "||" "!" "??"] @keyword.operator.logical
["~" "&" "|" "^" "<<" ">>" ">>>"] @keyword.operator.bitwise
((ternary_expression ["?" ":"] @keyword.operator.ternary) (#set! priority "20"))
((optional_chain) @punctuation.accessor.optional (#set! priority "20"))
["return" "yield" "await" "break" "continue"] @keyword.control.flow
["if" "else" "switch" "case"] @keyword.control.conditional
["for" "while" "do"] @keyword.control.loop
["try" "catch" "finally" "throw"] @keyword.control.trycatch
["debugger" "with"] @keyword.control
";" @punctuation.terminator.statement
"," @punctuation.separator.comma
":" @punctuation.separator.key-value
(rest_pattern "..." @keyword.operator.rest)
(spread_element "..." @keyword.operator.spread)

; A printable-ASCII fragment ending immediately before LF/CRLF and the recovered
; const keyword. EOF, indentation, escapes and other recovery shapes do not match.
((variable_declarator
  (ERROR "\"" @punctuation.definition.string.begin . (string_fragment) @_fragment . (identifier) @storage.type .) @_error
  value: (assignment_expression left: (identifier) @variable.other.constant "=" @_assign right: (_) @_value)) @_decl
 (#eq? @storage.type "const")
 (#source-gap? @punctuation.definition.string.begin @_fragment "")
 (#source-gap? @_fragment @storage.type "\n")
 (#text-class? @_fragment "[ -~]" "[ -~]")
 (#make-span! "string.quoted.double" @_error @punctuation.definition.string.begin "start" "0" @_fragment "end" "0")
 (#make-span! "invalid.illegal.newline" @_fragment @_fragment "end" "-1" @_fragment "end" "0")
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.constant "start" "0" @_assign "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.constant "start" "0" @variable.other.constant "end" "0")
 (#make-span! "keyword.operator.assignment" @_decl @_assign "start" "0" @_assign "end" "0")
 (#set! priority "20"))
((variable_declarator
  (ERROR "\"" @punctuation.definition.string.begin . (string_fragment) @_fragment . (identifier) @storage.type .) @_error
  value: (assignment_expression left: (identifier) @variable.other.constant "=" @_assign right: (_) @_value)) @_decl
 (#eq? @storage.type "const")
 (#source-gap? @punctuation.definition.string.begin @_fragment "")
 (#source-gap? @_fragment @storage.type "\r\n")
 (#text-class? @_fragment "[ -~]" "[ -~]")
 (#make-span! "string.quoted.double" @_error @punctuation.definition.string.begin "start" "0" @_fragment "end" "0")
 (#make-span! "invalid.illegal.newline" @_fragment @_fragment "end" "-1" @_fragment "end" "0")
 (#make-span! "meta.var-single-variable.expr" @_decl @variable.other.constant "start" "0" @_assign "start" "0")
 (#make-span! "meta.definition.variable" @_decl @variable.other.constant "start" "0" @variable.other.constant "end" "0")
 (#make-span! "keyword.operator.assignment" @_decl @_assign "start" "0" @_assign "end" "0")
 (#set! priority "20"))

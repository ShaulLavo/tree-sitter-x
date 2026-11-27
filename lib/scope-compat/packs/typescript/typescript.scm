; TypeScript-only rules (no JSX elements exist in this grammar).
(type_assertion) @meta.type.assertion
((member_expression object: (identifier) @variable.other.object) (#set! priority "12"))
(identifier) @variable.other.readwrite
(property_identifier) @variable.other.property
"." @punctuation.accessor

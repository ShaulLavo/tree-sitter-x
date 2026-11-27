; TypeScript-only rules (no JSX elements exist in this grammar).
(type_assertion) @meta.type.assertion
((member_expression object: (identifier) @variable.other.object) (#set! priority "12"))
((member_expression object: (member_expression property: (property_identifier) @variable.other.object.property)) (#set! priority "16"))
((member_expression object: (identifier) @support.class.promise) (#eq? @support.class.promise "Promise") (#set! priority "26"))
((member_expression property: (property_identifier) @support.variable.property) (#any-of? @support.variable.property "length" "prototype") (#set! priority "18"))
((identifier) @support.type.object.module (#any-of? @support.type.object.module "module" "exports") (#set! priority "16"))
((identifier) @constant.language.nan (#eq? @constant.language.nan "NaN") (#set! priority "10"))
((identifier) @constant.language.infinity (#eq? @constant.language.infinity "Infinity") (#set! priority "10"))
(identifier) @variable.other.readwrite
(property_identifier) @variable.other.property
"." @punctuation.accessor

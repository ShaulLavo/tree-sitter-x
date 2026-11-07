#ifndef SCOPE_COMPAT_THEME_H_
#define SCOPE_COMPAT_THEME_H_
#include "scope_compat.h"

#define SCOPE_COMPAT_THEME_ABI_VERSION 1u
typedef struct ScopeCompatTheme ScopeCompatTheme;
typedef struct { uint32_t foreground, background, font_mask; } ScopeCompatThemeStyle;
typedef struct {
  uint32_t abi_version, status, detail, detail_value, path_count;
  const ScopeCompatThemeStyle *styles;
} ScopeCompatThemeResult;
typedef struct { uint32_t present, foreground, background, font_mask, rule, alternative; } ScopeCompatThemeMatchRecord;
typedef struct {
  uint32_t abi_version, status, detail, detail_value, count;
  const ScopeCompatThemeMatchRecord *records;
} ScopeCompatThemeMatch;

typedef enum {
  SC_THEME_PACKET = 100, SC_THEME_UTF8, SC_THEME_SELECTOR_ATOM, SC_THEME_CONTEXT,
  SC_THEME_PROPERTY, SC_THEME_PATH, SC_THEME_INPUT_BYTES, SC_THEME_RULES,
  SC_THEME_ATOMS, SC_THEME_CONTEXT_EDGES, SC_THEME_ATOM_BYTES, SC_THEME_CONTEXT_ATOMS,
  SC_THEME_COMPILE_STEPS, SC_THEME_TRIE_NODES, SC_THEME_CONTEXT_RULES, SC_THEME_OWNED_BYTES,
  SC_THEME_RESOLVE_STEPS, SC_THEME_OUTPUT_BYTES, SC_THEME_PATHS, SC_THEME_PACKET_BYTES,
  SC_THEME_ALLOCATION, SC_THEME_NOT_COMPILED,
} ScopeCompatThemeDetail;

SC_EXPORT(scope_compat_theme_abi_version) uint32_t scope_compat_theme_abi_version(void);
SC_EXPORT(scope_compat_theme_layout) const uint32_t *scope_compat_theme_layout(void);
SC_EXPORT(scope_compat_theme_new)
ScopeCompatTheme *scope_compat_theme_new(const uint8_t *packet, uint32_t bytes,
  uint32_t max_steps, uint32_t max_trie_nodes, uint32_t max_context_rules, uint32_t max_owned_bytes);
SC_EXPORT(scope_compat_theme_status) uint32_t scope_compat_theme_status(const ScopeCompatTheme *theme);
SC_EXPORT(scope_compat_theme_detail) uint32_t scope_compat_theme_detail(const ScopeCompatTheme *theme);
SC_EXPORT(scope_compat_theme_detail_value) uint32_t scope_compat_theme_detail_value(const ScopeCompatTheme *theme);
SC_EXPORT(scope_compat_theme_error_rule) uint32_t scope_compat_theme_error_rule(const ScopeCompatTheme *theme);
SC_EXPORT(scope_compat_theme_error_alternative) uint32_t scope_compat_theme_error_alternative(const ScopeCompatTheme *theme);
SC_EXPORT(scope_compat_theme_error_offset) uint32_t scope_compat_theme_error_offset(const ScopeCompatTheme *theme);
SC_EXPORT(scope_compat_theme_delete) void scope_compat_theme_delete(ScopeCompatTheme *theme);
SC_EXPORT(scope_compat_theme_resolve)
ScopeCompatThemeResult *scope_compat_theme_resolve(const ScopeCompatTheme *theme,
  const uint8_t *paths, uint32_t bytes, uint32_t max_steps, uint32_t max_output_bytes);
SC_EXPORT(scope_compat_theme_result_delete) void scope_compat_theme_result_delete(ScopeCompatThemeResult *result);
SC_EXPORT(scope_compat_theme_match)
ScopeCompatThemeMatch *scope_compat_theme_match(const ScopeCompatTheme *theme,
  const uint8_t *paths, uint32_t bytes, uint32_t path_id, uint32_t max_steps);
SC_EXPORT(scope_compat_theme_match_delete) void scope_compat_theme_match_delete(ScopeCompatThemeMatch *match);
#endif

#ifndef SCOPE_COMPAT_H_
#define SCOPE_COMPAT_H_
#include <tree_sitter/api.h>
#include <stdint.h>

/* Experimental synchronous ABI. Pack/tree arguments must be trusted live handles.
 * Source must be readable for length * 2 bytes and correspond exactly to tree.
 * The allocation counter and test failures cover component allocations only.
 * Core allocation failures may abort. Zero limits select the documented defaults. */
#ifdef __wasm32__
#define SC_EXPORT(name) __attribute__((export_name(#name)))
#else
#define SC_EXPORT(name)
#endif

#define SCOPE_COMPAT_ABI_VERSION 1u
#define SCOPE_COMPAT_ENCODING_UTF16LE 1u
#define SCOPE_COMPAT_NONE UINT32_MAX

typedef enum {
  SCOPE_COMPAT_OK = 0,
  SCOPE_COMPAT_UNSUPPORTED = 1, /* a valid request the pilot does not implement */
  SCOPE_COMPAT_BUDGET = 2,      /* a declared work limit stopped the pass */
  SCOPE_COMPAT_INVALID = 3,     /* inconsistent or malformed input */
  SCOPE_COMPAT_NO_MEMORY = 4,
} ScopeCompatStatus;

typedef enum {
  SCOPE_COMPAT_DETAIL_NONE = 0,
  /* pack load */
  SCOPE_COMPAT_DETAIL_QUERY_SYNTAX = 1,      /* value: TSQueryError; offset: query byte */
  SCOPE_COMPAT_DETAIL_UNKNOWN_OPERATOR = 2,  /* name: operator */
  SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS = 3,     /* name: operator; value: step index */
  SCOPE_COMPAT_DETAIL_UNKNOWN_SETTING = 4,   /* name: #set! key */
  SCOPE_COMPAT_DETAIL_BAD_PRIORITY = 5,
  SCOPE_COMPAT_DETAIL_BAD_SCOPE_NAME = 6,    /* empty, contains a space, or too long */
  SCOPE_COMPAT_DETAIL_NULL_ARGUMENT = 7,
  /* run */
  SCOPE_COMPAT_DETAIL_ENCODING = 16,
  SCOPE_COMPAT_DETAIL_PACK_NOT_LOADED = 17,
  SCOPE_COMPAT_DETAIL_LANGUAGE_MISMATCH = 18,
  SCOPE_COMPAT_DETAIL_WINDOW = 19,           /* value: window_end */
  SCOPE_COMPAT_DETAIL_TREE_EXCEEDS_SOURCE = 20, /* value: offending byte */
  SCOPE_COMPAT_DETAIL_ODD_OFFSET = 21,       /* value: offending byte */
  SCOPE_COMPAT_DETAIL_MATCH_LIMIT = 22,
  SCOPE_COMPAT_DETAIL_INTERVAL_LIMIT = 23,   /* value: limit */
  SCOPE_COMPAT_DETAIL_SEGMENT_LIMIT = 24,    /* value: limit */
} ScopeCompatDetail;

typedef struct ScopeCompatPack ScopeCompatPack; /* opaque */

/* Fixed layout; the harness verifies it against scope_compat_layout(). */
typedef struct {
  uint32_t abi_version;
  uint32_t status;            /* ScopeCompatStatus */
  uint32_t detail;            /* ScopeCompatDetail */
  uint32_t detail_value;
  uint32_t window_start;      /* UTF-16 code units */
  uint32_t window_end;
  uint32_t segment_count;
  const uint32_t *segments;   /* segment_count triples: from, to, path_id */
  uint32_t path_count;
  const uint32_t *paths;      /* path_count pairs: parent_path_id, scope_id */
  uint32_t captures_seen;
  uint32_t intervals_kept;
  uint32_t dropped_empty;
  uint32_t dropped_exclusive;
  uint32_t dropped_duplicate;
} ScopeCompatResult;

typedef struct {
  uint32_t abi_version;
  uint32_t status;
  uint32_t detail;
  uint32_t detail_value;
  uint32_t interval_count;
  const uint32_t *intervals;  /* interval_count records of 8: from, to, scope_id,
                                 pattern, priority, capture_id, nest, disposition */
} ScopeCompatExplain;

SC_EXPORT(scope_compat_abi_version)
uint32_t scope_compat_abi_version(void);
SC_EXPORT(scope_compat_layout)
const uint32_t * scope_compat_layout(void); /* count, sizeof result, offsets..., sizeof explain, offsets... */
SC_EXPORT(scope_compat_live_allocations)
uint32_t scope_compat_live_allocations(void);
SC_EXPORT(scope_compat_bytes_new)
uint8_t * scope_compat_bytes_new(uint32_t size); /* caller-owned scratch for query and names */
SC_EXPORT(scope_compat_bytes_delete)
void scope_compat_bytes_delete(uint8_t *bytes);

SC_EXPORT(scope_compat_pack_new)
ScopeCompatPack * scope_compat_pack_new(const TSLanguage *language,
                                       const char *query, uint32_t query_length,
                                       const char *root_scope, uint32_t root_scope_length,
                                       const char *scope_suffix, uint32_t scope_suffix_length);
SC_EXPORT(scope_compat_pack_status)
uint32_t scope_compat_pack_status(const ScopeCompatPack *pack);
SC_EXPORT(scope_compat_pack_detail)
uint32_t scope_compat_pack_detail(const ScopeCompatPack *pack);
SC_EXPORT(scope_compat_pack_error_value)
uint32_t scope_compat_pack_error_value(const ScopeCompatPack *pack);
SC_EXPORT(scope_compat_pack_error_pattern)
uint32_t scope_compat_pack_error_pattern(const ScopeCompatPack *pack);  /* NONE if none */
SC_EXPORT(scope_compat_pack_error_offset)
uint32_t scope_compat_pack_error_offset(const ScopeCompatPack *pack);   /* query byte, NONE if none */
SC_EXPORT(scope_compat_pack_error_name)
const char * scope_compat_pack_error_name(const ScopeCompatPack *pack);  /* "" if none */
SC_EXPORT(scope_compat_pack_pattern_count)
uint32_t scope_compat_pack_pattern_count(const ScopeCompatPack *pack);
SC_EXPORT(scope_compat_pack_pattern_start)
uint32_t scope_compat_pack_pattern_start(const ScopeCompatPack *pack, uint32_t pattern);
SC_EXPORT(scope_compat_pack_scope_count)
uint32_t scope_compat_pack_scope_count(const ScopeCompatPack *pack);
SC_EXPORT(scope_compat_pack_scope_name)
const char * scope_compat_pack_scope_name(const ScopeCompatPack *pack, uint32_t scope_id);
SC_EXPORT(scope_compat_pack_delete)
void scope_compat_pack_delete(ScopeCompatPack *pack);

SC_EXPORT(scope_compat_run)
ScopeCompatResult * scope_compat_run(const ScopeCompatPack *pack, const TSTree *tree,
                                    const uint16_t *source, uint32_t source_length,
                                    uint32_t encoding, uint32_t window_start, uint32_t window_end,
                                    uint32_t match_limit, uint32_t max_intervals,
                                    uint32_t max_segments);
SC_EXPORT(scope_compat_result_delete)
void scope_compat_result_delete(ScopeCompatResult *result);

SC_EXPORT(scope_compat_explain)
ScopeCompatExplain * scope_compat_explain(const ScopeCompatPack *pack, const TSTree *tree,
                                         const uint16_t *source, uint32_t source_length,
                                         uint32_t encoding, uint32_t window_start,
                                         uint32_t window_end, uint32_t match_limit,
                                         uint32_t max_intervals);
SC_EXPORT(scope_compat_explain_delete)
void scope_compat_explain_delete(ScopeCompatExplain *explain);

#ifdef SCOPE_COMPAT_TESTING
SC_EXPORT(scope_compat_test_fail_after)
void scope_compat_test_fail_after(uint32_t index);
#endif
#endif

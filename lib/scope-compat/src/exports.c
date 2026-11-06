#include "internal.h"
#include <stddef.h>

#define RESULT_OFFSETS \
  offsetof(ScopeCompatResult, abi_version), offsetof(ScopeCompatResult, status), \
  offsetof(ScopeCompatResult, detail), offsetof(ScopeCompatResult, detail_value), \
  offsetof(ScopeCompatResult, window_start), offsetof(ScopeCompatResult, window_end), \
  offsetof(ScopeCompatResult, segment_count), offsetof(ScopeCompatResult, segments), \
  offsetof(ScopeCompatResult, path_count), offsetof(ScopeCompatResult, paths), \
  offsetof(ScopeCompatResult, captures_seen), offsetof(ScopeCompatResult, intervals_kept), \
  offsetof(ScopeCompatResult, dropped_empty), offsetof(ScopeCompatResult, dropped_exclusive), \
  offsetof(ScopeCompatResult, dropped_duplicate)
#define EXPLAIN_OFFSETS \
  offsetof(ScopeCompatExplain, abi_version), offsetof(ScopeCompatExplain, status), \
  offsetof(ScopeCompatExplain, detail), offsetof(ScopeCompatExplain, detail_value), \
  offsetof(ScopeCompatExplain, interval_count), offsetof(ScopeCompatExplain, intervals)

#ifdef __wasm32__
_Static_assert(sizeof(ScopeCompatResult) == 60 && _Alignof(ScopeCompatResult) == 4, "result ABI");
_Static_assert(sizeof(ScopeCompatExplain) == 24 && _Alignof(ScopeCompatExplain) == 4, "explain ABI");
#define CHECK_RESULT(field, index) _Static_assert(offsetof(ScopeCompatResult, field) == (index) * 4, "result offset")
CHECK_RESULT(abi_version, 0); CHECK_RESULT(status, 1); CHECK_RESULT(detail, 2); CHECK_RESULT(detail_value, 3);
CHECK_RESULT(window_start, 4); CHECK_RESULT(window_end, 5); CHECK_RESULT(segment_count, 6); CHECK_RESULT(segments, 7);
CHECK_RESULT(path_count, 8); CHECK_RESULT(paths, 9); CHECK_RESULT(captures_seen, 10); CHECK_RESULT(intervals_kept, 11);
CHECK_RESULT(dropped_empty, 12); CHECK_RESULT(dropped_exclusive, 13); CHECK_RESULT(dropped_duplicate, 14);
#define CHECK_EXPLAIN(field, index) _Static_assert(offsetof(ScopeCompatExplain, field) == (index) * 4, "explain offset")
CHECK_EXPLAIN(abi_version, 0); CHECK_EXPLAIN(status, 1); CHECK_EXPLAIN(detail, 2);
CHECK_EXPLAIN(detail_value, 3); CHECK_EXPLAIN(interval_count, 4); CHECK_EXPLAIN(intervals, 5);
#endif

uint32_t scope_compat_abi_version(void) { return SCOPE_COMPAT_ABI_VERSION; }
const uint32_t *scope_compat_layout(void) {
  static const uint32_t layout[] = {26, sizeof(ScopeCompatResult), _Alignof(ScopeCompatResult), RESULT_OFFSETS,
                                  sizeof(ScopeCompatExplain), _Alignof(ScopeCompatExplain), EXPLAIN_OFFSETS};
  return layout;
}
uint32_t scope_compat_live_allocations(void) { return sc_live(); }
uint8_t *scope_compat_bytes_new(uint32_t size) { return sc_alloc(size, 1); }
void scope_compat_bytes_delete(uint8_t *bytes) { sc_free(bytes); }

static void statistics(ScopeCompatResult *r, const ScCollection *c) {
  r->captures_seen = c->captures_seen;
  for (uint32_t i = 0; i < c->count; ++i) {
    switch (c->items[i].disposition) {
      case 0: ++r->intervals_kept; break;
      case 1: ++r->dropped_empty; break;
      case 2: ++r->dropped_exclusive; break;
      case 3: ++r->dropped_duplicate; break;
    }
  }
}

ScopeCompatResult *scope_compat_run(const ScopeCompatPack *p, const TSTree *tree,
                                    const uint16_t *source, uint32_t length, uint32_t encoding,
                                    uint32_t ws, uint32_t we, uint32_t match_limit,
                                    uint32_t interval_limit, uint32_t segment_limit) {
  ScopeCompatResult *r = sc_alloc(1, sizeof *r);
  if (!r) return NULL;
  r->abi_version = SCOPE_COMPAT_ABI_VERSION; r->window_start = ws; r->window_end = we;
  ScCollection c = sc_collect(p, tree, source, length, encoding, ws, we, match_limit, interval_limit);
  r->status = c.status; r->detail = c.detail; r->detail_value = c.value;
  if (c.status == SCOPE_COMPAT_OK) sc_compose(r, &c, source, length, segment_limit);
  if (r->status == SCOPE_COMPAT_OK) statistics(r, &c);
  else r->segment_count = 0;
  sc_free(c.items);
  return r;
}

void scope_compat_result_delete(ScopeCompatResult *r) {
  if (!r) return;
  sc_free((void *)r->segments); sc_free((void *)r->paths); sc_free(r);
}

static void explain_record(uint32_t *output, ScInterval v) {
  uint32_t values[] = {v.from, v.to, v.scope, v.pattern, v.priority, v.capture, v.nest, v.disposition};
  for (uint32_t j = 0; j < 8; ++j) output[j] = values[j];
}

ScopeCompatExplain *scope_compat_explain(const ScopeCompatPack *p, const TSTree *tree,
                                        const uint16_t *source, uint32_t length, uint32_t encoding,
                                        uint32_t ws, uint32_t we, uint32_t match_limit, uint32_t limit) {
  ScopeCompatExplain *e = sc_alloc(1, sizeof *e);
  if (!e) return NULL;
  e->abi_version = SCOPE_COMPAT_ABI_VERSION;
  ScCollection c = sc_collect(p, tree, source, length, encoding, ws, we, match_limit, limit);
  e->status = c.status; e->detail = c.detail; e->detail_value = c.value;
  uint32_t *output = NULL;
  if (c.status == SCOPE_COMPAT_OK && c.count) output = sc_alloc(c.count, 8 * sizeof *output);
  if (c.status == SCOPE_COMPAT_OK && c.count && !output) e->status = SCOPE_COMPAT_NO_MEMORY;
  if (e->status == SCOPE_COMPAT_OK) {
    e->interval_count = c.count; e->intervals = output;
    for (uint32_t i = 0; i < c.count; ++i) {
      explain_record(output + (size_t)i * 8, c.items[i]);
    }
  }
  sc_free(c.items);
  return e;
}

void scope_compat_explain_delete(ScopeCompatExplain *e) {
  if (!e) return;
  sc_free((void *)e->intervals); sc_free(e);
}

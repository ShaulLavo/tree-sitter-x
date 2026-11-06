#include "internal.h"

static void error(ScCollection *c, uint32_t status, uint32_t detail, uint32_t value) {
  c->status = status; c->detail = detail; c->value = value;
}

bool sc_node_span(TSNode node, uint32_t bytes, ScCollection *c) {
  uint32_t start = ts_node_start_byte(node), end = ts_node_end_byte(node);
  if ((start | end) & 1) { error(c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_ODD_OFFSET, (start & 1) ? start : end); return false; }
  if (start > end || end > bytes) { error(c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_TREE_EXCEEDS_SOURCE, end); return false; }
  return true;
}

static bool append(ScCollection *c, ScInterval item, uint32_t ws, uint32_t we, uint32_t limit) {
  if (item.to < ws || item.from > we) return true;
  if (item.from < ws) item.from = ws;
  if (item.to > we) item.to = we;
  if (c->count >= limit) { error(c, SCOPE_COMPAT_BUDGET, SCOPE_COMPAT_DETAIL_INTERVAL_LIMIT, limit); return false; }
  if (c->count == UINT32_MAX || !sc_grow((void **)&c->items, &c->capacity, c->count + 1, sizeof item)) {
    error(c, SCOPE_COMPAT_NO_MEMORY, 0, 0); return false;
  }
  c->items[c->count++] = item;
  return true;
}

static bool range_interval(const ScPredicate *op, const TSQueryMatch *match, ScInterval *item) {
  uint32_t first = UINT32_MAX, last = 0;
  bool has_last = false;
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    TSQueryCapture capture = match->captures[i];
    uint32_t from = ts_node_start_byte(capture.node) / 2, to = ts_node_end_byte(capture.node) / 2;
    if (capture.index == op->first && from < first) first = from;
    if (capture.index == op->second && (!has_last || to > last)) { last = to; has_last = true; }
  }
  if (first == UINT32_MAX || !has_last) return false;
  item->from = first; item->to = last; item->scope = op->scope; item->range = true;
  return true;
}

static bool accept_match(const ScopeCompatPack *p, const TSQueryMatch *match, const uint16_t *source,
                         uint32_t bytes, ScCollection *c) {
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    if (!sc_node_span(match->captures[i].node, bytes, c)) return false;
  }
  ScPattern pattern = p->patterns[match->pattern_index];
  for (uint32_t i = 0; i < pattern.count; ++i) {
    if (!sc_predicate(p, &p->predicates[pattern.start + i], match, source)) return false;
  }
  return true;
}

static bool collect_match(const ScopeCompatPack *p, const TSQueryMatch *match, ScCollection *c,
                          uint32_t ws, uint32_t we, uint32_t limit) {
  ScPattern pattern = p->patterns[match->pattern_index];
  ScInterval item = {.pattern = match->pattern_index, .priority = pattern.priority};
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    TSQueryCapture capture = match->captures[i];
    if (p->capture_scopes[capture.index] == SC_NONE) continue;
    item.from = ts_node_start_byte(capture.node) / 2; item.to = ts_node_end_byte(capture.node) / 2;
    item.scope = p->capture_scopes[capture.index]; item.capture = capture.index; item.node = capture.node;
    if (!append(c, item, ws, we, limit)) return false;
  }
  for (uint32_t i = 0; i < pattern.count; ++i) {
    const ScPredicate *op = &p->predicates[pattern.start + i];
    if (op->kind != SC_RANGE || !range_interval(op, match, &item)) continue;
    item.capture = i;
    if (item.from > item.to) { error(c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_WINDOW, item.to); return false; }
    if (!append(c, item, ws, we, limit)) return false;
  }
  return true;
}

ScCollection sc_collect(const ScopeCompatPack *p, const TSTree *tree, const uint16_t *source,
                         uint32_t length, uint32_t encoding, uint32_t ws, uint32_t we,
                         uint32_t match_limit, uint32_t limit) {
  ScCollection c = {0};
  if (!p || !tree || !source) { error(&c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_NULL_ARGUMENT, 0); return c; }
  if (length > UINT32_MAX / 2) { error(&c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_NONE, length); return c; }
  if ((uintptr_t)source & 1) { error(&c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_ODD_OFFSET, (uint32_t)(uintptr_t)source); return c; }
  if (encoding != SCOPE_COMPAT_ENCODING_UTF16LE) { error(&c, SCOPE_COMPAT_UNSUPPORTED, SCOPE_COMPAT_DETAIL_ENCODING, encoding); return c; }
  if (p->status != SCOPE_COMPAT_OK) { error(&c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_PACK_NOT_LOADED, 0); return c; }
  if (ts_tree_language(tree) != p->language) { error(&c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_LANGUAGE_MISMATCH, 0); return c; }
  if (ws > we || we > length) { error(&c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_WINDOW, we); return c; }
  if (!sc_node_span(ts_tree_root_node(tree), length * 2, &c)) return c;
  TSQueryCursor *cursor = ts_query_cursor_new();
  ts_query_cursor_set_byte_range(cursor, ws * 2, we * 2);
  if (match_limit) ts_query_cursor_set_match_limit(cursor, match_limit);
  ts_query_cursor_exec(cursor, p->query, ts_tree_root_node(tree));
  TSQueryMatch match;
  if (!limit) limit = SC_DEFAULT_LIMIT;
  while (ts_query_cursor_next_match(cursor, &match)) {
    if (match.capture_count > UINT32_MAX - c.captures_seen) { error(&c, SCOPE_COMPAT_BUDGET, SCOPE_COMPAT_DETAIL_INTERVAL_LIMIT, limit); break; }
    c.captures_seen += match.capture_count;
    bool accepted = accept_match(p, &match, source, length * 2, &c);
    if (c.status != SCOPE_COMPAT_OK) break;
    if (accepted && !collect_match(p, &match, &c, ws, we, limit)) break;
  }
  if (c.status == SCOPE_COMPAT_OK && ts_query_cursor_did_exceed_match_limit(cursor)) error(&c, SCOPE_COMPAT_BUDGET, SCOPE_COMPAT_DETAIL_MATCH_LIMIT, match_limit);
  ts_query_cursor_delete(cursor);
  if (c.status == SCOPE_COMPAT_OK) sc_order(&c);
  return c;
}

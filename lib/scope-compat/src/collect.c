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
  item.logical_from = item.from; item.logical_to = item.to;
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

static bool range_interval(const ScRange *op, const TSQueryMatch *match, ScInterval *item) {
  uint32_t first = UINT32_MAX, last = 0;
  bool has_last = false;
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    TSQueryCapture capture = match->captures[i];
    uint32_t from = ts_node_start_byte(capture.node) / 2, to = ts_node_end_byte(capture.node) / 2;
    if (capture.index == op->first && from < first) first = from;
    if (capture.index == op->second && (!has_last || to > last)) { last = to; has_last = true; }
  }
  if (first == UINT32_MAX || !has_last) return false;
  item->from = first; item->to = last; item->scope = op->scope; item->kind = SC_LEGACY_RANGE_INTERVAL;
  return true;
}

static bool one_capture(const TSQueryMatch *match, uint32_t id, TSNode *node) {
  uint32_t count = 0;
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    if (match->captures[i].index != id) continue;
    *node = match->captures[i].node; ++count;
  }
  return count == 1;
}

static bool gap_roles(const ScGap *gap, const TSQueryMatch *match, uint32_t ordinal,
                       ScCollection *c, TSNode *left, TSNode *right) {
  if (one_capture(match, gap->left, left) && one_capture(match, gap->right, right)) return true;
  error(c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS, ordinal);
  return false;
}

#ifdef SCOPE_COMPAT_TESTING
uint32_t sc_gap_source_reads;
#endif

bool sc_gap_matches(const uint16_t *source, uint32_t left_end, uint32_t right_start, ScText literal) {
  if (left_end > right_start || right_start - left_end != literal.length) return false;
  for (uint32_t i = 0; i < literal.length; ++i) {
#ifdef SCOPE_COMPAT_TESTING
    ++sc_gap_source_reads;
#endif
    if (source[left_end + i] != literal.text[i]) return false;
  }
  return true;
}

static bool gap_accepts(const ScopeCompatPack *p, const ScGap *gap, const TSQueryMatch *match,
                         const uint16_t *source) {
  TSNode left, right;
  one_capture(match, gap->left, &left); one_capture(match, gap->right, &right);
  return sc_gap_matches(source, ts_node_end_byte(left) / 2, ts_node_start_byte(right) / 2,
                        p->strings[gap->literal]);
}

static bool descendant_or_same(TSNode node, TSNode container) {
  while (!ts_node_is_null(node)) {
    if (ts_node_eq(node, container)) return true;
    node = ts_node_parent(node);
  }
  return false;
}

bool sc_resolve_edge(ScEdge edge, uint32_t start, uint32_t end, uint32_t *resolved, ScCollection *c) {
  uint32_t base = edge.side == SC_AT_START ? start : end;
  int64_t value = (int64_t)base + edge.delta;
  if (value < start || value > end) {
    error(c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_WINDOW, base); return false;
  }
  *resolved = (uint32_t)value;
  return true;
}

bool sc_span_interval(const ScSpanSpec *spec, const TSQueryMatch *match, uint32_t length,
                       uint32_t ordinal, ScCollection *c, ScInterval *item) {
  TSNode container, left, right;
  if (!one_capture(match, spec->container, &container) || !one_capture(match, spec->left.capture, &left) ||
      !one_capture(match, spec->right.capture, &right)) {
    error(c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS, ordinal); return false;
  }
  if (!descendant_or_same(left, container) || !descendant_or_same(right, container)) {
    error(c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS, ordinal); return false;
  }
  if (!sc_resolve_edge(spec->left, ts_node_start_byte(left) / 2, ts_node_end_byte(left) / 2, &item->from, c) ||
      !sc_resolve_edge(spec->right, ts_node_start_byte(right) / 2, ts_node_end_byte(right) / 2, &item->to, c)) return false;
  uint32_t start = ts_node_start_byte(container) / 2, end = ts_node_end_byte(container) / 2;
  if (item->from < start || item->from > end || item->to < start || item->to > end || item->to > length || item->from > length || item->from > item->to) {
    error(c, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_WINDOW, item->to); return false;
  }
  item->scope = spec->scope; item->kind = SC_EDGE_SPAN_INTERVAL;
  return true;
}

bool sc_accept_match(const ScopeCompatPack *p, const TSQueryMatch *match, const uint16_t *source,
                         uint32_t bytes, ScCollection *c) {
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    if (!sc_node_span(match->captures[i].node, bytes, c)) return false;
  }
  ScPattern pattern = p->patterns[match->pattern_index];
  for (uint32_t i = 0; i < pattern.count; ++i) {
    const ScPredicate *op = &p->predicates[pattern.start + i];
    TSNode left, right;
    if (op->kind == SC_GAP && !gap_roles(&op->data.gap, match, pattern.start + i, c, &left, &right)) return false;
  }
  for (uint32_t i = 0; i < pattern.count; ++i) {
    const ScPredicate *op = &p->predicates[pattern.start + i];
    if (op->kind == SC_GAP && !gap_accepts(p, &op->data.gap, match, source)) return false;
    if (!sc_predicate(p, op, match, source)) return false;
  }
  return true;
}

static bool collect_match(const ScopeCompatPack *p, const TSQueryMatch *match, ScCollection *c,
                          uint32_t length, uint32_t ws, uint32_t we, uint32_t limit) {
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
    if (op->kind != SC_RANGE && op->kind != SC_SPAN) continue;
    if (op->kind == SC_RANGE && !range_interval(&op->data.range, match, &item)) continue;
    if (op->kind == SC_SPAN && !sc_span_interval(&op->data.span, match, length, pattern.start + i, c, &item)) return false;
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
  c.order_policy = p->order_policy;
  TSQueryCursor *cursor = ts_query_cursor_new();
  ts_query_cursor_set_byte_range(cursor, ws * 2, we * 2);
  if (match_limit) ts_query_cursor_set_match_limit(cursor, match_limit);
  ts_query_cursor_exec(cursor, p->query, ts_tree_root_node(tree));
  TSQueryMatch match;
  if (!limit) limit = SC_DEFAULT_LIMIT;
  while (ts_query_cursor_next_match(cursor, &match)) {
    if (match.capture_count > UINT32_MAX - c.captures_seen) { error(&c, SCOPE_COMPAT_BUDGET, SCOPE_COMPAT_DETAIL_INTERVAL_LIMIT, limit); break; }
    c.captures_seen += match.capture_count;
    bool accepted = sc_accept_match(p, &match, source, length * 2, &c);
    if (c.status != SCOPE_COMPAT_OK) break;
    if (accepted && !collect_match(p, &match, &c, length, ws, we, limit)) break;
  }
  if (c.status == SCOPE_COMPAT_OK && ts_query_cursor_did_exceed_match_limit(cursor)) error(&c, SCOPE_COMPAT_BUDGET, SCOPE_COMPAT_DETAIL_MATCH_LIMIT, match_limit);
  ts_query_cursor_delete(cursor);
  if (c.status == SCOPE_COMPAT_OK) sc_order(&c);
  return c;
}

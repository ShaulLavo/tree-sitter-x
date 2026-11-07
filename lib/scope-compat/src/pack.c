#include "internal.h"
#include <string.h>

void sc_pack_error(ScopeCompatPack *p, uint32_t status, uint32_t detail,
                   uint32_t value, uint32_t pattern, const char *name, uint32_t length) {
  p->status = status;
  p->detail = detail;
  p->value = value;
  p->error_pattern = pattern;
  p->error_offset = pattern == SC_NONE ? SC_NONE : ts_query_start_byte_for_pattern(p->query, pattern);
  if (length > SC_NAME_LIMIT) length = SC_NAME_LIMIT;
  if (length) memcpy(p->error_name, name, length);
  p->error_name[length] = 0;
}

static bool name_valid(const char *name, uint32_t length) {
  if (!name || !length || length > SC_NAME_LIMIT) return false;
  for (uint32_t i = 0; i < length; ++i) {
    if ((unsigned char)name[i] <= 32 || name[i] == 127) return false;
  }
  return true;
}

static uint32_t add_scope(ScopeCompatPack *p, const char *name, uint32_t length,
                          const char *suffix, uint32_t suffix_length) {
  if (!name_valid(name, length) || suffix_length > SC_NAME_LIMIT - length) {
    p->status = SCOPE_COMPAT_INVALID;
    p->detail = SCOPE_COMPAT_DETAIL_BAD_SCOPE_NAME;
    return SC_NONE;
  }
  for (uint32_t i = 0; i < p->scope_count; ++i) {
    if (strlen(p->scopes[i]) != length + suffix_length || memcmp(p->scopes[i], name, length)) continue;
    if (!suffix_length || !memcmp(p->scopes[i] + length, suffix, suffix_length)) return i;
  }
  if (p->scope_count == UINT32_MAX || !sc_grow((void **)&p->scopes, &p->scope_capacity,
                                            p->scope_count + 1, sizeof *p->scopes)) { p->status = SCOPE_COMPAT_NO_MEMORY; return SC_NONE; }
  char *copy = sc_alloc(length + suffix_length + 1, 1);
  if (!copy) { p->status = SCOPE_COMPAT_NO_MEMORY; return SC_NONE; }
  memcpy(copy, name, length);
  if (suffix_length) memcpy(copy + length, suffix, suffix_length);
  p->scopes[p->scope_count] = copy;
  return p->scope_count++;
}

static bool same(const char *name, uint32_t length, const char *literal) {
  return length == strlen(literal) && !memcmp(name, literal, length);
}

static bool string_is(const ScopeCompatPack *p, TSQueryPredicateStep step, const char *literal) {
  if (step.type != TSQueryPredicateStepTypeString) return false;
  uint32_t length;
  const char *text = ts_query_string_value_for_id(p->query, step.value_id, &length);
  return same(text, length, literal);
}

static bool priority(const ScopeCompatPack *p, TSQueryPredicateStep step, uint32_t *out) {
  if (step.type != TSQueryPredicateStepTypeString) return false;
  ScText text = p->strings[step.value_id];
  if (!text.length) return false;
  uint32_t value = 0;
  for (uint32_t i = 0; i < text.length; ++i) {
    if (text.text[i] < '0' || text.text[i] > '9') return false;
    value = value * 10 + text.text[i] - '0';
    if (value > 1000) return false;
  }
  *out = value;
  return true;
}

static bool compile_operator(ScopeCompatPack *p, ScPredicate *op, const char *name,
                             uint32_t length, uint32_t pattern) {
  if (same(name, length, "set!")) { op->kind = SC_SET; return true; }
  if (same(name, length, "make-range!")) { op->kind = SC_RANGE; return true; }
  if (same(name, length, "make-span!")) { op->kind = SC_SPAN; return true; }
  if (same(name, length, "source-gap?")) { op->kind = SC_GAP; return true; }
  if (same(name, length, "starts-with?") || same(name, length, "not-starts-with?")) {
    op->kind = SC_PREFIX; op->data.prefix.positive = same(name, length, "starts-with?"); return true;
  }
  if (same(name, length, "text-class?") || same(name, length, "not-text-class?")) {
    op->kind = SC_CLASS; op->data.text_class.positive = same(name, length, "text-class?"); return true;
  }
  if (same(name, length, "any-of?") || same(name, length, "not-any-of?")) {
    op->kind = SC_MEMBERSHIP; op->data.membership.positive = same(name, length, "any-of?"); return true;
  }
  op->kind = SC_EQ;
  op->data.equality.positive = same(name, length, "eq?") || same(name, length, "any-eq?");
  op->data.equality.any = same(name, length, "any-eq?") || same(name, length, "any-not-eq?");
  if (op->data.equality.positive || op->data.equality.any || same(name, length, "not-eq?")) return true;
  sc_pack_error(p, SCOPE_COMPAT_UNSUPPORTED, SCOPE_COMPAT_DETAIL_UNKNOWN_OPERATOR, 0, pattern, name, length);
  return false;
}

static bool class_character(uint16_t c) {
  return c >= 32 && c <= 126 && c != '^' && c != '\\' && c != '[' && c != ']';
}

static void set_range(ScAsciiSet *set, uint16_t first, uint16_t last) {
  for (uint32_t c = first; c <= last; ++c) set->words[c / 64] |= UINT64_C(1) << (c % 64);
}

static bool class_token(ScText text, uint32_t end, uint32_t *at, ScAsciiSet *set) {
  uint16_t first = text.text[(*at)++];
  if (!class_character(first) || (first == '-' && *at != 2)) return false;
  if (first == '-' || *at == end || text.text[*at] != '-') { set_range(set, first, first); return true; }
  if (++*at == end) return false;
  uint16_t last = text.text[(*at)++];
  if (!class_character(last) || last == '-' || last < first) return false;
  set_range(set, first, last);
  return true;
}

static bool compile_ascii_set(ScText text, ScAsciiSet *set) {
  if (text.length < 3 || text.text[0] != '[' || text.text[text.length - 1] != ']') return false;
  uint32_t end = text.length - 1;
  for (uint32_t i = 1; i < end;) {
    if (!class_token(text, end, &i, set)) return false;
  }
  return true;
}

static bool compile_class(ScopeCompatPack *p, ScPredicate *op, const TSQueryPredicateStep *a, uint32_t count) {
  if ((count != 3 && count != 4) || a[0].type != TSQueryPredicateStepTypeCapture) return false;
  for (uint32_t i = 1; i < count; ++i) {
    if (a[i].type != TSQueryPredicateStepTypeString) return false;
  }
  ScClass body = {.capture = a[0].value_id, .positive = op->data.text_class.positive};
  if (!compile_ascii_set(p->strings[a[1].value_id], &body.first) ||
      !compile_ascii_set(p->strings[a[2].value_id], &body.tail)) return false;
  if (count == 3) { op->data.text_class = body; return true; }
  op->kind = SC_CLASS_LAST;
  op->data.text_class_last = (ScClassLast){.body = body};
  return compile_ascii_set(p->strings[a[3].value_id], &op->data.text_class_last.last);
}

static bool compile_edge(const ScopeCompatPack *p, const TSQueryPredicateStep *a, ScEdge *edge) {
  if (a[0].type != TSQueryPredicateStepTypeCapture) return false;
  edge->capture = a[0].value_id;
  if (string_is(p, a[1], "start")) edge->side = SC_AT_START;
  else if (string_is(p, a[1], "end")) edge->side = SC_AT_END;
  else return false;
  const char *deltas[] = {"-2", "-1", "0", "1", "2"};
  for (uint32_t i = 0; i < 5; ++i) {
    if (string_is(p, a[2], deltas[i])) { edge->delta = (int8_t)i - 2; return true; }
  }
  return false;
}

static uint32_t scope_argument(ScopeCompatPack *p, TSQueryPredicateStep a, const char *suffix, uint32_t length) {
  uint32_t size;
  const char *name = ts_query_string_value_for_id(p->query, a.value_id, &size);
  return add_scope(p, name, size, suffix, length);
}

static bool compile_range(ScopeCompatPack *p, ScPredicate *op, const TSQueryPredicateStep *a, uint32_t count,
                           const char *suffix, uint32_t length) {
  if (count != 3 || a[0].type != TSQueryPredicateStepTypeString ||
      a[1].type != TSQueryPredicateStepTypeCapture || a[2].type != TSQueryPredicateStepTypeCapture) return false;
  op->data.range = (ScRange){.scope = scope_argument(p, a[0], suffix, length),
                            .first = a[1].value_id, .second = a[2].value_id};
  return op->data.range.scope != SC_NONE;
}

static bool compile_span(ScopeCompatPack *p, ScPredicate *op, const TSQueryPredicateStep *a, uint32_t count,
                          const char *suffix, uint32_t length) {
  if (count != 8 || a[0].type != TSQueryPredicateStepTypeString || a[1].type != TSQueryPredicateStepTypeCapture) return false;
  ScSpanSpec *span = &op->data.span;
  if (!compile_edge(p, a + 2, &span->left) || !compile_edge(p, a + 5, &span->right)) return false;
  span->container = a[1].value_id;
  span->scope = scope_argument(p, a[0], suffix, length);
  if (span->scope == SC_NONE) return false;
  p->order_policy = SC_CONTAINED_SPAN_ORDER;
  return true;
}

static bool compile_arguments(ScopeCompatPack *p, ScPredicate *op, const TSQueryPredicateStep *a,
                              uint32_t count, uint32_t pattern, const char *suffix, uint32_t length) {
  if (op->kind == SC_GAP) {
    if (count != 3 || a[0].type != TSQueryPredicateStepTypeCapture ||
        a[1].type != TSQueryPredicateStepTypeCapture || a[2].type != TSQueryPredicateStepTypeString) return false;
    op->data.gap = (ScGap){.left=a[0].value_id, .right=a[1].value_id, .literal=a[2].value_id};
    return p->strings[a[2].value_id].length <= 2;
  }
  if (op->kind == SC_RANGE) return compile_range(p, op, a, count, suffix, length);
  if (op->kind == SC_SPAN) return compile_span(p, op, a, count, suffix, length);
  if (op->kind == SC_CLASS) return compile_class(p, op, a, count);
  if (op->kind == SC_SET) {
    if (count != 2 || a[0].type != TSQueryPredicateStepTypeString) return false;
    if (!string_is(p, a[0], "priority")) { p->detail = SCOPE_COMPAT_DETAIL_UNKNOWN_SETTING; return false; }
    if (!priority(p, a[1], &op->data.priority)) { p->detail = SCOPE_COMPAT_DETAIL_BAD_PRIORITY; return false; }
    p->patterns[pattern].priority = op->data.priority;
    return true;
  }
  if (count < 2 || a[0].type != TSQueryPredicateStepTypeCapture) return false;
  if (op->kind == SC_PREFIX) {
    op->data.prefix.capture = a[0].value_id; op->data.prefix.literal = a[1].value_id;
    return count == 2 && a[1].type == TSQueryPredicateStepTypeString;
  }
  if (op->kind == SC_EQ) {
    op->data.equality.capture = a[0].value_id; op->data.equality.arguments = a; op->data.equality.count = count;
    return count == 2 && (a[1].type == TSQueryPredicateStepTypeCapture || a[1].type == TSQueryPredicateStepTypeString);
  }
  op->data.membership.capture = a[0].value_id; op->data.membership.arguments = a; op->data.membership.count = count;
  for (uint32_t i = 1; i < count; ++i) {
    if (a[i].type != TSQueryPredicateStepTypeString) return false;
  }
  return true;
}

static bool compile_step(ScopeCompatPack *p, const TSQueryPredicateStep *steps, uint32_t count,
                         uint32_t pattern, const char *suffix, uint32_t suffix_length) {
  if (!count || steps[0].type != TSQueryPredicateStepTypeString) return false;
  uint32_t length;
  const char *name = ts_query_string_value_for_id(p->query, steps[0].value_id, &length);
  ScPredicate op = {0};
  if (!compile_operator(p, &op, name, length, pattern)) return false;
  if (!compile_arguments(p, &op, steps + 1, count - 1, pattern, suffix, suffix_length)) {
    uint32_t status = p->status == SCOPE_COMPAT_NO_MEMORY ? p->status : SCOPE_COMPAT_INVALID;
    uint32_t detail = p->detail ? p->detail : SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS;
    sc_pack_error(p, status, detail, count, pattern, name, length);
    return false;
  }
  if (p->predicate_count == UINT32_MAX || !sc_grow((void **)&p->predicates, &p->predicate_capacity,
                                                 p->predicate_count + 1, sizeof op)) { p->status = SCOPE_COMPAT_NO_MEMORY; return false; }
  p->predicates[p->predicate_count++] = op;
  ++p->patterns[pattern].count;
  return true;
}

static bool compile_pattern(ScopeCompatPack *p, uint32_t pattern, const char *suffix, uint32_t suffix_length) {
  uint32_t count;
  const TSQueryPredicateStep *steps = ts_query_predicates_for_pattern(p->query, pattern, &count);
  p->patterns[pattern].start = p->predicate_count;
  uint32_t first = 0;
  for (uint32_t i = 0; i < count; ++i) {
    if (steps[i].type != TSQueryPredicateStepTypeDone) continue;
    if (!compile_step(p, steps + first, i - first, pattern, suffix, suffix_length)) return false;
    first = i + 1;
  }
  return true;
}

static bool compile_tables(ScopeCompatPack *p, const char *suffix, uint32_t suffix_length) {
  p->capture_count = ts_query_capture_count(p->query);
  p->capture_scopes = sc_alloc(p->capture_count, sizeof *p->capture_scopes);
  p->string_count = ts_query_string_count(p->query);
  p->strings = sc_alloc(p->string_count, sizeof *p->strings);
  p->patterns = sc_alloc(ts_query_pattern_count(p->query), sizeof *p->patterns);
  if (!p->capture_scopes || !p->strings || !p->patterns) { p->status = SCOPE_COMPAT_NO_MEMORY; return false; }
  for (uint32_t i = 0; i < p->capture_count; ++i) {
    uint32_t length;
    const char *name = ts_query_capture_name_for_id(p->query, i, &length);
    p->capture_scopes[i] = length && name[0] == '_' ? SC_NONE : add_scope(p, name, length, suffix, suffix_length);
    if (p->capture_scopes[i] == SC_NONE && !(length && name[0] == '_')) return false;
  }
  for (uint32_t i = 0; i < p->string_count; ++i) {
    uint32_t length;
    const char *text = ts_query_string_value_for_id(p->query, i, &length);
    uint32_t status = sc_text_decode(text, length, &p->strings[i]);
    if (status != SCOPE_COMPAT_OK) { p->status = status; p->detail = status == SCOPE_COMPAT_INVALID ? SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS : 0; return false; }
  }
  for (uint32_t i = 0; i < ts_query_pattern_count(p->query); ++i) {
    if (!compile_pattern(p, i, suffix, suffix_length)) return false;
  }
  return true;
}

ScopeCompatPack *scope_compat_pack_new(const TSLanguage *language, const char *query, uint32_t query_length,
                                      const char *root, uint32_t root_length, const char *suffix, uint32_t suffix_length) {
  ScopeCompatPack *p = sc_alloc(1, sizeof *p);
  if (!p) return NULL;
  p->status = SCOPE_COMPAT_NO_MEMORY;
  p->error_pattern = p->error_offset = SC_NONE;
  if (!language || !query || !root || !suffix) {
    sc_pack_error(p, SCOPE_COMPAT_INVALID, SCOPE_COMPAT_DETAIL_NULL_ARGUMENT, 0, SC_NONE, "", 0);
    return p;
  }
  if (suffix_length > SC_NAME_LIMIT || (suffix_length && !name_valid(suffix, suffix_length))) {
    p->status = SCOPE_COMPAT_INVALID; p->detail = SCOPE_COMPAT_DETAIL_BAD_SCOPE_NAME; return p;
  }
  p->language = language;
  TSQueryError error;
  uint32_t offset;
  p->query = ts_query_new(language, query, query_length, &offset, &error);
  if (!p->query) {
    p->status = SCOPE_COMPAT_INVALID; p->detail = SCOPE_COMPAT_DETAIL_QUERY_SYNTAX;
    p->value = error; p->error_offset = offset; return p;
  }
  p->status = SCOPE_COMPAT_OK;
  if (add_scope(p, root, root_length, "", 0) == SC_NONE || !compile_tables(p, suffix, suffix_length)) return p;
  p->status = SCOPE_COMPAT_OK;
  return p;
}

void scope_compat_pack_delete(ScopeCompatPack *p) {
  if (!p) return;
  if (p->query) ts_query_delete(p->query);
  for (uint32_t i = 0; i < p->scope_count; ++i) sc_free(p->scopes[i]);
  if (p->strings) {
    for (uint32_t i = 0; i < p->string_count; ++i) sc_free(p->strings[i].text);
  }
  sc_free(p->scopes); sc_free(p->capture_scopes); sc_free(p->strings);
  sc_free(p->patterns); sc_free(p->predicates); sc_free(p);
}

uint32_t scope_compat_pack_status(const ScopeCompatPack *p) { return p ? p->status : SCOPE_COMPAT_INVALID; }
uint32_t scope_compat_pack_detail(const ScopeCompatPack *p) { return p ? p->detail : SCOPE_COMPAT_DETAIL_NULL_ARGUMENT; }
uint32_t scope_compat_pack_error_value(const ScopeCompatPack *p) { return p ? p->value : 0; }
uint32_t scope_compat_pack_error_pattern(const ScopeCompatPack *p) { return p ? p->error_pattern : SC_NONE; }
uint32_t scope_compat_pack_error_offset(const ScopeCompatPack *p) { return p ? p->error_offset : SC_NONE; }
const char *scope_compat_pack_error_name(const ScopeCompatPack *p) { return p ? p->error_name : ""; }
uint32_t scope_compat_pack_pattern_count(const ScopeCompatPack *p) { return p && p->query ? ts_query_pattern_count(p->query) : 0; }
uint32_t scope_compat_pack_pattern_start(const ScopeCompatPack *p, uint32_t pattern) {
  return pattern < scope_compat_pack_pattern_count(p) ? ts_query_start_byte_for_pattern(p->query, pattern) : SC_NONE;
}
uint32_t scope_compat_pack_scope_count(const ScopeCompatPack *p) { return p ? p->scope_count : 0; }
const char *scope_compat_pack_scope_name(const ScopeCompatPack *p, uint32_t id) { return p && id < p->scope_count ? p->scopes[id] : ""; }

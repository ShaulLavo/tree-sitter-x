#include "internal.h"
#include <string.h>

static bool scalar(const char *input, uint32_t length, uint32_t *at, uint32_t *out) {
  uint32_t c = (unsigned char)input[(*at)++];
  if (c < 0x80) { *out = c; return true; }
  if (c < 0xc2 || c > 0xf4) return false;
  uint32_t extra = c < 0xe0 ? 1 : c < 0xf0 ? 2 : 3;
  uint32_t minimum = extra == 1 ? 0x80 : extra == 2 ? 0x800 : 0x10000;
  c &= (1u << (6 - extra)) - 1;
  if (extra > length - *at) return false;
  for (uint32_t i = 0; i < extra; ++i) {
    uint32_t next = (unsigned char)input[(*at)++];
    if ((next & 0xc0) != 0x80) return false;
    c = (c << 6) | (next & 0x3f);
  }
  if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return false;
  *out = c;
  return true;
}

uint32_t sc_text_decode(const char *input, uint32_t length, ScText *out) {
  out->text = sc_alloc(length, sizeof *out->text);
  if (!out->text) return SCOPE_COMPAT_NO_MEMORY;
  for (uint32_t i = 0; i < length;) {
    uint32_t c;
    if (!scalar(input, length, &i, &c)) return SCOPE_COMPAT_INVALID;
    if (c <= 0xffff) { out->text[out->length++] = (uint16_t)c; continue; }
    c -= 0x10000;
    out->text[out->length++] = (uint16_t)(0xd800 + (c >> 10));
    out->text[out->length++] = (uint16_t)(0xdc00 + (c & 0x3ff));
  }
  return SCOPE_COMPAT_OK;
}

static ScText node_text(TSNode node, const uint16_t *source) {
  uint32_t start = ts_node_start_byte(node) / 2;
  return (ScText){.text = (uint16_t *)(source + start), .length = ts_node_end_byte(node) / 2 - start};
}

static bool equal(ScText a, ScText b) {
  return a.length == b.length && (!a.length || !memcmp(a.text, b.text, (size_t)a.length * 2));
}

static bool membership(const ScopeCompatPack *p, const ScMembership *op, ScText text) {
  for (uint32_t i = 1; i < op->count; ++i) {
    if (equal(text, p->strings[op->arguments[i].value_id])) return op->positive;
  }
  return !op->positive;
}

static bool witness(const ScopeCompatPack *p, const ScEquality *op, const TSQueryMatch *match,
                     ScText text, const uint16_t *source) {
  const TSQueryPredicateStep *a = op->arguments;
  if (a[1].type == TSQueryPredicateStepTypeString) return equal(text, p->strings[a[1].value_id]) == op->positive;
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    if (match->captures[i].index != a[1].value_id) continue;
    if (equal(text, node_text(match->captures[i].node, source)) == op->positive) return true;
  }
  return false;
}

static bool equality(const ScopeCompatPack *p, const ScEquality *op, const TSQueryMatch *match,
                      const uint16_t *source) {
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    if (match->captures[i].index != op->capture) continue;
    bool found = witness(p, op, match, node_text(match->captures[i].node, source), source);
    if (found == op->any) return op->any;
  }
  return !op->any;
}

static bool member_match(const ScopeCompatPack *p, const ScMembership *op, const TSQueryMatch *match,
                          const uint16_t *source) {
  bool seen = false;
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    if (match->captures[i].index != op->capture) continue;
    seen = true;
    if (!membership(p, op, node_text(match->captures[i].node, source))) return false;
  }
  return seen || !op->positive;
}

static bool contains(ScAsciiSet set, uint16_t unit) {
  return unit < 128 && (set.words[unit / 64] & (UINT64_C(1) << (unit % 64)));
}

static bool test_class(ScText text, const ScClass *op) {
  if (!text.length || !contains(op->first, text.text[0])) return false;
  for (uint32_t i = 1; i < text.length; ++i) {
    if (!contains(op->tail, text.text[i])) return false;
  }
  return true;
}

static bool test_prefix(ScText text, ScText prefix) {
  return prefix.length <= text.length && (!prefix.length || !memcmp(text.text, prefix.text, (size_t)prefix.length * 2));
}

static bool text_test(const ScopeCompatPack *p, const ScPredicate *op, ScText text) {
  if (op->kind == SC_PREFIX) return test_prefix(text, p->strings[op->data.prefix.literal]) == op->data.prefix.positive;
  if (op->kind == SC_CLASS) return test_class(text, &op->data.text_class) == op->data.text_class.positive;
  const ScClassLast *spec = &op->data.text_class_last;
  bool accepted = test_class(text, &spec->body) && contains(spec->last, text.text[text.length - 1]);
  return accepted == spec->body.positive;
}

bool sc_predicate(const ScopeCompatPack *p, const ScPredicate *op, const TSQueryMatch *match,
                   const uint16_t *source) {
  if (op->kind == SC_EQ) return equality(p, &op->data.equality, match, source);
  if (op->kind == SC_MEMBERSHIP) return member_match(p, &op->data.membership, match, source);
  if (op->kind != SC_PREFIX && op->kind != SC_CLASS && op->kind != SC_CLASS_LAST) return true;
  uint32_t capture = op->kind == SC_PREFIX ? op->data.prefix.capture :
    op->kind == SC_CLASS ? op->data.text_class.capture : op->data.text_class_last.body.capture;
  for (uint32_t i = 0; i < match->capture_count; ++i) {
    if (match->captures[i].index != capture) continue;
    if (!text_test(p, op, node_text(match->captures[i].node, source))) return false;
  }
  return true;
}

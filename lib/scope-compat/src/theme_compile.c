#include "theme_internal.h"
#include <string.h>

void *th_allocate(ScopeCompatTheme *t, uint32_t count, uint32_t width) {
  uint64_t size = (uint64_t)count * width;
  if (size > t->max_owned - t->owned) {
    th_fail(&t->work, SCOPE_COMPAT_BUDGET, SC_THEME_OWNED_BYTES, t->max_owned, TH_NONE);
    return NULL;
  }
  void *result = sc_alloc(count, width);
  if (!result) { th_fail(&t->work, SCOPE_COMPAT_NO_MEMORY, SC_THEME_ALLOCATION, (uint32_t)size, TH_NONE); return NULL; }
  t->owned += (uint32_t)size;
  return result;
}

static bool reserve(ScopeCompatTheme *t, void **buffer, uint32_t *capacity, uint32_t count, uint32_t width, uint32_t maximum) {
  if (count <= *capacity) return true;
  uint32_t next = *capacity ? *capacity * 2 : 8;
  if (next > maximum) next = maximum;
  uint64_t increase = (uint64_t)(next - *capacity) * width;
  if (increase > t->max_owned - t->owned)
    return th_fail(&t->work, SCOPE_COMPAT_BUDGET, SC_THEME_OWNED_BYTES, t->max_owned, TH_NONE);
  if (!th_charge(&t->work, *capacity * width)) return false;
  void *grown = sc_alloc(next, width);
  if (!grown) return th_fail(&t->work, SCOPE_COMPAT_NO_MEMORY, SC_THEME_ALLOCATION, next * width, TH_NONE);
  if (*capacity) memcpy(grown, *buffer, (size_t)*capacity * width);
  sc_free(*buffer); *buffer = grown; *capacity = next; t->owned += (uint32_t)increase;
  return true;
}

static int compare_bytes(const uint8_t *a, uint32_t al, const uint8_t *b, uint32_t bl, ThWork *w) {
  uint32_t length = al < bl ? al : bl;
  for (uint32_t i = 0; i < length; ++i) {
    if (!th_charge(w, 1)) return 0;
    if (a[i] != b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return al < bl ? -1 : al > bl;
}

static int compare_names(const ThPacket *p, uint32_t a, uint32_t b, ThWork *w) {
  if (a == TH_NONE || b == TH_NONE) return a == b ? 0 : a == TH_NONE ? -1 : 1;
  uint32_t al, bl, at = th_name(p, a, &al), bt = th_name(p, b, &bl);
  return compare_bytes(p->data + at, al, p->data + bt, bl, w);
}

static int compare_tokens(const ThPacket *p, uint32_t a, uint32_t b, ThWork *w) {
  static const uint8_t marker[] = ">";
  uint32_t al = 1, bl = 1, at = 0, bt = 0;
  if (a != TH_NONE) at = th_name(p, a, &al);
  if (b != TH_NONE) bt = th_name(p, b, &bl);
  return compare_bytes(a == TH_NONE ? marker : p->data + at, al,
    b == TH_NONE ? marker : p->data + bt, bl, w);
}

static uint32_t parent_length(const ThPacket *p, ThRule r) {
  uint32_t count = r.count;
  for (uint32_t i = 0; i < r.count; ++i) count += th_word(p->data, p->contexts + (r.first + i) * 8 + 4);
  return count;
}

typedef struct { uint32_t index; bool marker; } ThContextCursor;
static uint32_t context_token(const ThPacket *p, ThRule r, ThContextCursor *cursor) {
  uint32_t at = p->contexts + (r.first + cursor->index) * 8;
  if (!cursor->marker && th_word(p->data, at + 4)) { cursor->marker = true; return TH_NONE; }
  cursor->marker = false; ++cursor->index;
  return th_word(p->data, at);
}

static int compare_contexts(const ThPacket *p, ThRule a, ThRule b, ThWork *w) {
  uint32_t al = parent_length(p, a), bl = parent_length(p, b);
  if (!th_charge(w, a.count + b.count)) return 0;
  if (al != bl) return al < bl ? -1 : 1;
  ThContextCursor ac = {0}, bc = {0};
  for (uint32_t i = 0; i < al; ++i) {
    uint32_t av = context_token(p, a, &ac), bv = context_token(p, b, &bc);
    int result = compare_tokens(p, av, bv, w);
    if (result || w->status) return result;
  }
  return 0;
}

static int compare_rules(const ThPacket *p, uint32_t a, uint32_t b, ThWork *w) {
  ThRule ar = th_rule(p, a), br = th_rule(p, b);
  if (!th_charge(w, 1)) return 0;
  int result = compare_names(p, ar.tail, br.tail, w);
  if (result || w->status) return result;
  result = compare_contexts(p, ar, br, w);
  if (result || w->status) return result;
  if (ar.rule != br.rule) return ar.rule < br.rule ? -1 : 1;
  return ar.alternative < br.alternative ? -1 : ar.alternative > br.alternative;
}

static void merge(const ThPacket *p, uint32_t *ids, uint32_t *scratch, uint32_t from, uint32_t middle, uint32_t end, ThWork *w) {
  uint32_t a = from, b = middle;
  for (uint32_t out = from; out < end && !w->status; ++out) {
    bool left = b == end || (a < middle && compare_rules(p, ids[a], ids[b], w) <= 0);
    if (!th_charge(w, 4)) return;
    scratch[out] = left ? ids[a++] : ids[b++];
  }
}

static uint32_t *sorted_rules(ScopeCompatTheme *t, const ThPacket *p) {
  if (!p->count) return NULL;
  uint32_t *ids = th_allocate(t, p->count, 4), *scratch = th_allocate(t, p->count, 4);
  if (!ids || !scratch) { sc_free(ids); sc_free(scratch); return NULL; }
  for (uint32_t i = 0; i < p->count && th_charge(&t->work, 4); ++i) ids[i] = i;
  for (uint32_t width = 1; width < p->count && !t->work.status; width *= 2) {
    for (uint32_t from = 0; from < p->count; from += width * 2) {
      uint32_t middle = from + width < p->count ? from + width : p->count;
      uint32_t end = middle + width < p->count ? middle + width : p->count;
      merge(p, ids, scratch, from, middle, end, &t->work);
    }
    uint32_t *swap = ids; ids = scratch; scratch = swap;
  }
  sc_free(scratch); t->owned -= p->count * 4;
  return ids;
}

static void overwrite(ThCandidate *candidate, ThRule rule, uint32_t depth) {
  ScopeCompatThemeMatchRecord *s = &candidate->style;
  if (rule.present & 1) s->foreground = rule.foreground;
  if (rule.present & 2) s->background = rule.background;
  if (rule.present & 4) s->font_mask = rule.font;
  s->present |= rule.present; s->rule = rule.rule; s->alternative = rule.alternative;
  candidate->depth = depth;
}

static uint32_t add_context(ScopeCompatTheme *t, ThCandidate value) {
  if (t->context_count == t->max_contexts) {
    th_fail(&t->work, SCOPE_COMPAT_BUDGET, SC_THEME_CONTEXT_RULES, t->max_contexts, TH_NONE); return TH_NONE;
  }
  if (!th_charge(&t->work, 1) || !reserve(t, (void **)&t->contexts, &t->context_capacity,
      t->context_count + 1, sizeof *t->contexts, t->max_contexts)) return TH_NONE;
  uint32_t index = t->context_count++;
  t->contexts[index] = value; t->contexts[index].next = TH_NONE;
  return index;
}

static bool clone_contexts(ScopeCompatTheme *t, uint32_t source, uint32_t node) {
  uint32_t last = TH_NONE;
  while (source != TH_NONE) {
    uint32_t next = t->contexts[source].next;
    uint32_t copy = add_context(t, t->contexts[source]);
    if (copy == TH_NONE) return false;
    if (last == TH_NONE) t->nodes[node].contexts = copy;
    else t->contexts[last].next = copy;
    last = copy; source = next;
  }
  return true;
}

static uint32_t add_node(ScopeCompatTheme *t, uint32_t parent, uint32_t text, uint32_t length) {
  if (t->node_count == t->max_nodes) {
    th_fail(&t->work, SCOPE_COMPAT_BUDGET, SC_THEME_TRIE_NODES, t->max_nodes, TH_NONE); return TH_NONE;
  }
  if (!th_charge(&t->work, 1) || !reserve(t, (void **)&t->nodes, &t->node_capacity,
      t->node_count + 1, sizeof *t->nodes, t->max_nodes)) return TH_NONE;
  uint32_t id = t->node_count++;
  t->nodes[id] = (ThNode){.text=text, .length=length, .child=TH_NONE, .sibling=TH_NONE, .contexts=TH_NONE,
    .main={.style={.rule=TH_NONE, .alternative=TH_NONE}, .next=TH_NONE}};
  if (parent == TH_NONE) return id;
  t->nodes[id].main = t->nodes[parent].main;
  t->nodes[id].sibling = t->nodes[parent].child; t->nodes[parent].child = id;
  if (!clone_contexts(t, t->nodes[parent].contexts, id)) return TH_NONE;
  return id;
}

static uint32_t child_node(ScopeCompatTheme *t, uint32_t parent, uint32_t text, uint32_t length) {
  uint32_t child = t->nodes[parent].child;
  while (child != TH_NONE) {
    ThNode n = t->nodes[child];
    if (!th_charge(&t->work, 1)) return TH_NONE;
    if (!compare_bytes(t->packet + text, length, t->packet + n.text, n.length, &t->work)) return child;
    child = n.sibling;
  }
  return add_node(t, parent, text, length);
}

static bool insert_here(ScopeCompatTheme *t, const ThPacket *p, uint32_t node, uint32_t depth, ThRule r) {
  if (!r.count) { overwrite(&t->nodes[node].main, r, depth); return true; }
  uint32_t last = TH_NONE, index = t->nodes[node].contexts;
  while (index != TH_NONE) {
    ThCandidate *candidate = &t->contexts[index];
    ThRule old = {.first=candidate->first, .count=candidate->count};
    if (!th_charge(&t->work, 1)) return false;
    if (!compare_contexts(p, old, r, &t->work)) { overwrite(candidate, r, depth); return !t->work.status; }
    last = index; index = candidate->next;
  }
  ThCandidate value = t->nodes[node].main;
  value.first = r.first; value.count = r.count; overwrite(&value, r, depth);
  index = add_context(t, value);
  if (index == TH_NONE) return false;
  if (last == TH_NONE) t->nodes[node].contexts = index;
  else t->contexts[last].next = index;
  return true;
}

static bool insert_rule(ScopeCompatTheme *t, const ThPacket *p, ThRule r) {
  if (r.tail == TH_NONE) {
    if (r.present & 1) t->defaults.foreground = r.foreground;
    if (r.present & 2) t->defaults.background = r.background;
    if (r.present & 4) t->defaults.font_mask = r.font;
    return true;
  }
  uint32_t length, start = th_name(p, r.tail, &length), component = 0, node = 0, depth = 0;
  for (uint32_t i = 0; i <= length; ++i) {
    if (!th_charge(&t->work, 1)) return false;
    if (i != length && p->data[start + i] != '.') continue;
    node = child_node(t, node, start + component, i - component);
    if (node == TH_NONE || t->work.status) return false;
    component = i + 1; ++depth;
  }
  return insert_here(t, p, node, depth, r);
}

bool th_compile(ScopeCompatTheme *t, const ThPacket *p) {
  uint32_t *ids = sorted_rules(t, p);
  if (t->work.status) { sc_free(ids); return false; }
  if (add_node(t, TH_NONE, 0, 0) == TH_NONE) { sc_free(ids); return false; }
  for (uint32_t i = 0; i < p->count && !t->work.status; ++i) {
    ThRule r = th_rule(p, ids[i]);
    t->work.rule = r.rule; t->work.alternative = r.alternative;
    if (!th_charge(&t->work, 1) || !insert_rule(t, p, r)) break;
  }
  sc_free(ids); t->owned -= p->count * 4;
  if (t->work.status) return false;
  t->work.rule = TH_NONE; t->work.alternative = TH_NONE;
  return true;
}

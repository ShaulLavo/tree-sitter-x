#include "theme_internal.h"

static bool equal_bytes(const uint8_t *a, const uint8_t *b, uint32_t length, ThWork *w) {
  for (uint32_t i = 0; i < length; ++i) {
    if (!th_charge(w, 1) || a[i] != b[i]) return false;
  }
  return true;
}

static bool scope_matches(const ScopeCompatTheme *t, const ThPacket *p, uint32_t name, uint32_t atom, ThWork *w) {
  uint32_t length, at = th_name(p, name, &length);
  uint32_t names = th_word(t->packet, 24), pattern = th_word(t->packet, names + atom * 8);
  uint32_t pattern_length = th_word(t->packet, names + atom * 8 + 4);
  if (length < pattern_length) return false;
  if (!equal_bytes(p->data + at, t->packet + pattern, pattern_length, w)) return false;
  return length == pattern_length || p->data[at + pattern_length] == '.';
}

static bool consume_parent(const ScopeCompatTheme *t, const ThPacket *p, uint32_t atom, bool immediate, uint32_t *parent, ThWork *w) {
  while (*parent != TH_NONE && !w->status) {
    if (!th_charge(w, 1)) return false;
    uint32_t path = p->records + *parent * 8;
    bool matched = *parent && scope_matches(t, p, th_word(p->data, path + 4), atom, w);
    *parent = th_word(p->data, path);
    if (matched || immediate) return matched;
  }
  return false;
}
static bool parents_match(const ScopeCompatTheme *t, const ThPacket *p, ThCandidate candidate, uint32_t parent, ThWork *w) {
  uint32_t contexts = th_word(t->packet, 32);
  for (uint32_t i = 0; i < candidate.count; ++i) {
    uint32_t at = contexts + (candidate.first + i) * 8;
    uint32_t atom = th_word(t->packet, at), immediate = th_word(t->packet, at + 4);
    if (!consume_parent(t, p, atom, immediate != 0, &parent, w) || w->status) return false;
  }
  return true;
}

static uint32_t context_size(const ScopeCompatTheme *t, ThCandidate c, ThWork *w) {
  uint32_t size = c.count, contexts = th_word(t->packet, 32);
  for (uint32_t i = 0; i < c.count; ++i) {
    if (!th_charge(w, 1)) return 0;
    size += th_word(t->packet, contexts + (c.first + i) * 8 + 4);
  }
  return size;
}

static int specificity(const ScopeCompatTheme *t, ThCandidate a, ThCandidate b, ThWork *w) {
  if (!th_charge(w, 1)) return 0;
  if (a.depth != b.depth) return a.depth > b.depth ? 1 : -1;
  uint32_t count = a.count < b.count ? a.count : b.count;
  uint32_t contexts = th_word(t->packet, 32), names = th_word(t->packet, 24);
  for (uint32_t i = 0; i < count; ++i) {
    if (!th_charge(w, 1)) return 0;
    uint32_t aa = th_word(t->packet, contexts + (a.first + i) * 8);
    uint32_t ba = th_word(t->packet, contexts + (b.first + i) * 8);
    uint32_t al = th_word(t->packet, names + aa * 8 + 4), bl = th_word(t->packet, names + ba * 8 + 4);
    if (al != bl) return al > bl ? 1 : -1;
  }
  uint32_t al = context_size(t, a, w), bl = context_size(t, b, w);
  return al > bl ? 1 : al < bl ? -1 : 0;
}

static uint32_t find_child(const ScopeCompatTheme *t, const ThPacket *p, uint32_t parent,
                           uint32_t at, uint32_t length, ThWork *w) {
  uint32_t child = t->nodes[parent].child;
  while (child != TH_NONE && !w->status) {
    ThNode n = t->nodes[child];
    if (!th_charge(w, 1)) return TH_NONE;
    if (n.length == length && equal_bytes(t->packet + n.text, p->data + at, length, w)) return child;
    child = n.sibling;
  }
  return TH_NONE;
}

static uint32_t matching_node(const ScopeCompatTheme *t, const ThPacket *p, uint32_t name, ThWork *w) {
  uint32_t length, at = th_name(p, name, &length), component = 0, node = 0;
  for (uint32_t i = 0; i <= length; ++i) {
    if (!th_charge(w, 1)) return node;
    if (i != length && p->data[at + i] != '.') continue;
    uint32_t child = find_child(t, p, node, at + component, i - component, w);
    if (child == TH_NONE) return node;
    node = child; component = i + 1;
  }
  return node;
}

ScopeCompatThemeMatchRecord th_match(const ScopeCompatTheme *t, const ThPacket *p, uint32_t id, ThWork *w) {
  if (!id) return (ScopeCompatThemeMatchRecord){7, t->defaults.foreground, t->defaults.background, t->defaults.font_mask, TH_NONE, TH_NONE};
  uint32_t path = p->records + id * 8, parent = th_word(p->data, path);
  uint32_t node = matching_node(t, p, th_word(p->data, path + 4), w), index = t->nodes[node].contexts;
  ThCandidate best = {0};
  bool found = false;
  while (index != TH_NONE && !w->status) {
    ThCandidate candidate = t->contexts[index];
    if (!th_charge(w, 1)) break;
    if ((!found || specificity(t, candidate, best, w) > 0) && parents_match(t, p, candidate, parent, w)) {
      best = candidate; found = true;
    }
    index = candidate.next;
  }
  ThCandidate main = t->nodes[node].main;
  if (!found || specificity(t, main, best, w) > 0) best = main;
  return best.style;
}

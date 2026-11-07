#include "theme_internal.h"
#include <string.h>

uint32_t th_word(const uint8_t *data, uint32_t offset) {
  const uint8_t *p = data + offset;
  return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}

bool th_fail(ThWork *w, uint32_t status, uint32_t detail, uint32_t value, uint32_t offset) {
  if (w->status) return false;
  w->status = status; w->detail = detail; w->value = value; w->offset = offset;
  return false;
}

bool th_charge(ThWork *w, uint32_t steps) {
  if (w->status) return false;
  if (steps > w->step_limit - w->steps)
    return th_fail(w, SCOPE_COMPAT_BUDGET, w->step_detail, w->step_limit, TH_NONE);
  w->steps += steps;
  return true;
}

typedef struct { uint32_t start, size; } ThSpan;
static bool span(const uint8_t *data, uint32_t field, uint32_t width, uint32_t bytes,
                 uint32_t header, ThSpan *out, ThWork *w) {
  uint32_t count = th_word(data, field), start = th_word(data, field + 4);
  if (!count && !start) { *out = (ThSpan){0}; return true; }
  if (!count || start < header || start % 4 || start > bytes || count > (bytes - start) / width)
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, start, field + 4);
  *out = (ThSpan){start, count * width};
  return true;
}

static void order_span(ThSpan *a, ThSpan *b) {
  if (a->start <= b->start) return;
  ThSpan temporary = *a; *a = *b; *b = temporary;
}

static bool partition(ThSpan *spans, uint32_t count, uint32_t header, uint32_t bytes, ThWork *w) {
  uint32_t cursor = header;
  for (uint32_t i = 0; i < count; ++i) {
    for (uint32_t j = i + 1; j < count; ++j) {
      order_span(&spans[i], &spans[j]);
    }
  }
  for (uint32_t i = 0; i < count; ++i) {
    if (!spans[i].size) continue;
    if (spans[i].start != cursor) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, spans[i].start, spans[i].start);
    cursor += spans[i].size;
  }
  return cursor == bytes || th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, cursor, cursor);
}

bool th_packet(ThPacket *p, const uint8_t *data, uint32_t bytes, bool theme, ThWork *w) {
  uint32_t header = theme ? sizeof(ThThemeHeader) : sizeof(ThPathHeader);
  if (!data || (uintptr_t)data % 4 || bytes < header)
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, bytes, 0);
  if (th_word(data, 0) != (theme ? 0x31544853u : 0x31504853u) || th_word(data, 4) != 1 || th_word(data, 8) != bytes)
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, th_word(data, 0), 0);
  if (theme && th_word(data, 44)) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, th_word(data, 44), 44);
  ThSpan spans[4] = {{0}};
  if (!span(data, 12, theme ? 36 : 8, bytes, header, &spans[0], w) ||
      !span(data, 20, 8, bytes, header, &spans[1], w) ||
      !span(data, 28, theme ? 8 : 1, bytes, header, &spans[2], w)) return false;
  if (theme && !span(data, 36, 1, bytes, header, &spans[3], w)) return false;
  *p = (ThPacket){.data=data, .bytes=bytes, .count=th_word(data, theme ? 12 : 20),
    .records=th_word(data, theme ? 16 : 24), .name_count=th_word(data, theme ? 20 : 12),
    .names=th_word(data, theme ? 24 : 16), .strings=th_word(data, theme ? 40 : 32),
    .string_bytes=th_word(data, theme ? 36 : 28),
    .contexts=theme ? th_word(data, 32) : 0, .context_count=theme ? th_word(data, 28) : 0};
  if (!partition(spans, theme ? 4 : 3, header, bytes, w)) return false;
  if (bytes > TH_PACKET_LIMIT) return th_fail(w, SCOPE_COMPAT_BUDGET, SC_THEME_PACKET_BYTES, TH_PACKET_LIMIT, TH_NONE);
  return true;
}

uint32_t th_name(const ThPacket *p, uint32_t id, uint32_t *length) {
  *length = th_word(p->data, p->names + id * 8 + 4);
  return th_word(p->data, p->names + id * 8);
}

typedef struct { uint32_t remaining, code, minimum; } ThUtf8;
static bool continuation(ThUtf8 *state, uint32_t byte, uint32_t offset, ThWork *w) {
  if (byte < 0x80 || byte > 0xbf) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_UTF8, byte, offset);
  state->code = state->code * 64 + (byte & 63); --state->remaining;
  uint32_t code = state->code;
  if (!state->remaining && (code < state->minimum || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)))
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_UTF8, code, offset);
  return true;
}
static bool utf8_byte(ThUtf8 *state, uint32_t byte, uint32_t offset, ThWork *w) {
  if (state->remaining) return continuation(state, byte, offset, w);
  if (byte < 0x80) return true;
  if (byte >= 0xc2 && byte <= 0xdf) { *state = (ThUtf8){1, byte & 31, 0x80}; return true; }
  if (byte >= 0xe0 && byte <= 0xef) { *state = (ThUtf8){2, byte & 15, 0x800}; return true; }
  if (byte >= 0xf0 && byte <= 0xf4) { *state = (ThUtf8){3, byte & 7, 0x10000}; return true; }
  return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_UTF8, byte, offset);
}
static bool utf8(const uint8_t *p, uint32_t length, uint32_t start, ThWork *w) {
  ThUtf8 state = {0};
  for (uint32_t i = 0; i < length; ++i) {
    if (!th_charge(w, 1) || !utf8_byte(&state, p[i], start + i, w)) return false;
  }
  return !state.remaining || th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_UTF8, state.remaining, start + length);
}

static bool atom(const uint8_t *p, uint32_t length, uint32_t start, ThWork *w) {
  uint32_t component = 0;
  for (uint32_t i = 0; i < length; ++i) {
    uint8_t c = p[i];
    if (!th_charge(w, 1)) return false;
    if (c == '.' && component) { component = 0; continue; }
    bool allowed = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-';
    if (!allowed) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_SELECTOR_ATOM, c, start + i);
    ++component;
  }
  if (!component || (length == 1 && p[0] == '-')) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_SELECTOR_ATOM, length, start);
  return true;
}

static bool name_span(const ThPacket *p, uint32_t id, uint32_t *start, uint32_t *length, ThWork *w) {
  *start = th_name(p, id, length);
  if (!*length || *start < p->strings || *start - p->strings > p->string_bytes ||
      *length > p->string_bytes - (*start - p->strings))
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, *start, p->names + id * 8);
  if (*length > 256) return th_fail(w, SCOPE_COMPAT_BUDGET, SC_THEME_ATOM_BYTES, 256, TH_NONE);
  return true;
}

static bool disjoint_name(const ThPacket *p, uint32_t id, uint32_t start, uint32_t length, ThWork *w) {
  for (uint32_t j = 0; j < id; ++j) {
    uint32_t previous_length, previous = th_name(p, j, &previous_length);
    if (!th_charge(w, 1)) return false;
    if (start < previous + previous_length && previous < start + length)
      return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, start, p->names + id * 8);
  }
  return true;
}

static bool names(const ThPacket *p, bool theme, ThWork *w) {
  if (p->name_count > TH_ATOM_LIMIT) return th_fail(w, SCOPE_COMPAT_BUDGET, SC_THEME_ATOMS, TH_ATOM_LIMIT, TH_NONE);
  uint32_t total = 0, previous_end = p->strings;
  bool ordered = true;
  for (uint32_t id = 0; id < p->name_count; ++id) {
    uint32_t start, length;
    if (!th_charge(w, 1) || !name_span(p, id, &start, &length, w)) return false;
    if (!utf8(p->data + start, length, start, w)) return false;
    if (theme && !atom(p->data + start, length, start, w)) return false;
    ordered = ordered && start >= previous_end;
    if (!ordered && !disjoint_name(p, id, start, length, w)) return false;
    previous_end = start + length;
    total += length;
  }
  return total == p->string_bytes || th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, total, p->strings);
}

ThRule th_rule(const ThPacket *p, uint32_t id) {
  uint32_t at = p->records + id * 36;
  return (ThRule){th_word(p->data, at), th_word(p->data, at + 4), th_word(p->data, at + 8),
    th_word(p->data, at + 12), th_word(p->data, at + 16), th_word(p->data, at + 20),
    th_word(p->data, at + 24), th_word(p->data, at + 28), th_word(p->data, at + 32)};
}

static bool tail(const ThPacket *p, uint32_t id, ThWork *w) {
  uint32_t length, start = th_name(p, id, &length), component = 0;
  for (uint32_t i = 0; i <= length; ++i) {
    if (!th_charge(w, 1)) return false;
    if (i != length && p->data[start + i] != '.') continue;
    uint32_t size = i - component;
    const uint8_t *text = p->data + start + component;
    if ((size == 14 || size == 9) && !th_charge(w, size)) return false;
    if ((size == 14 && !memcmp(text, "hasOwnProperty", 14)) || (size == 9 && !memcmp(text, "__proto__", 9)))
      return th_fail(w, SCOPE_COMPAT_UNSUPPORTED, SC_THEME_SELECTOR_ATOM, id, start + component);
    component = i + 1;
  }
  return true;
}

static bool rule_valid(const ThPacket *p, uint32_t id, uint32_t *next, ThWork *w) {
  if (!th_charge(w, 36)) return false;
  ThRule r = th_rule(p, id);
  uint32_t at = p->records + id * 36;
  w->rule = r.rule; w->alternative = r.alternative;
  if (r.present > 7 || r.font > 15 || (!(r.present & 1) && r.foreground) ||
      (!(r.present & 2) && r.background) || (!(r.present & 4) && r.font))
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PROPERTY, r.present, at + 20);
  if (r.rule >= p->count || r.alternative >= p->count)
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, r.rule, at + 12);
  if (id && (r.rule < th_rule(p, id - 1).rule || (r.rule == th_rule(p, id - 1).rule && r.alternative != th_rule(p, id - 1).alternative + 1)))
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, r.alternative, at + 16);
  if ((!id || r.rule != th_rule(p, id - 1).rule) && r.alternative)
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PACKET, r.alternative, at + 16);
  if (r.count > 64) return th_fail(w, SCOPE_COMPAT_BUDGET, SC_THEME_CONTEXT_ATOMS, 64, TH_NONE);
  if ((r.count ? r.first != *next : r.first != 0) || r.count > p->context_count - *next || (r.tail == TH_NONE && r.count))
    return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_CONTEXT, r.first, at + 4);
  *next += r.count;
  if (r.tail == TH_NONE) return true;
  if (r.tail >= p->name_count) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_SELECTOR_ATOM, r.tail, at);
  return tail(p, r.tail, w);
}

bool th_validate_theme(const ThPacket *p, ThWork *w) {
  if (p->count > 65536) return th_fail(w, SCOPE_COMPAT_BUDGET, SC_THEME_RULES, 65536, TH_NONE);
  if (p->context_count > 262144) return th_fail(w, SCOPE_COMPAT_BUDGET, SC_THEME_CONTEXT_EDGES, 262144, TH_NONE);
  if (!names(p, true, w)) return false;
  uint32_t next = 0;
  for (uint32_t i = 0; i < p->count; ++i) if (!rule_valid(p, i, &next, w)) return false;
  if (next != p->context_count) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_CONTEXT, next, p->contexts);
  for (uint32_t i = 0; i < p->context_count; ++i) {
    uint32_t at = p->contexts + i * 8;
    if (!th_charge(w, 8)) return false;
    if (th_word(p->data, at) >= p->name_count || th_word(p->data, at + 4) > 1)
      return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_CONTEXT, i, at);
  }
  w->rule = TH_NONE; w->alternative = TH_NONE;
  return true;
}

bool th_validate_paths(const ThPacket *p, ThWork *w) {
  if (p->count > TH_PATH_LIMIT) return th_fail(w, SCOPE_COMPAT_BUDGET, SC_THEME_PATHS, TH_PATH_LIMIT, TH_NONE);
  if (!names(p, false, w)) return false;
  for (uint32_t i = 0; i < p->count; ++i) {
    uint32_t at = p->records + i * 8, parent = th_word(p->data, at), name = th_word(p->data, at + 4);
    if (!th_charge(w, 8)) return false;
    bool valid = i ? parent < i && name < p->name_count : parent == TH_NONE && name == TH_NONE;
    if (!valid) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_PATH, i, at);
  }
  return true;
}

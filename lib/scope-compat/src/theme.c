#include "theme_internal.h"
#include <string.h>

#define TH_HEADER_OFFSETS(type) offsetof(type, abi_version), offsetof(type, status), offsetof(type, detail), offsetof(type, detail_value)
#ifdef __wasm32__
_Static_assert(sizeof(ScopeCompatThemeResult) == 24 && _Alignof(ScopeCompatThemeResult) == 4, "theme result ABI");
_Static_assert(sizeof(ScopeCompatThemeMatch) == 24 && _Alignof(ScopeCompatThemeMatch) == 4, "theme match ABI");
#define TH_OFFSET(type, field, n) _Static_assert(offsetof(type, field) == n * 4, "theme ABI offset")
TH_OFFSET(ScopeCompatThemeResult, abi_version, 0); TH_OFFSET(ScopeCompatThemeResult, status, 1);
TH_OFFSET(ScopeCompatThemeResult, detail, 2); TH_OFFSET(ScopeCompatThemeResult, detail_value, 3);
TH_OFFSET(ScopeCompatThemeResult, path_count, 4); TH_OFFSET(ScopeCompatThemeResult, styles, 5);
TH_OFFSET(ScopeCompatThemeMatch, abi_version, 0); TH_OFFSET(ScopeCompatThemeMatch, status, 1);
TH_OFFSET(ScopeCompatThemeMatch, detail, 2); TH_OFFSET(ScopeCompatThemeMatch, detail_value, 3);
TH_OFFSET(ScopeCompatThemeMatch, count, 4); TH_OFFSET(ScopeCompatThemeMatch, records, 5);
#endif

uint32_t scope_compat_theme_abi_version(void) { return 1; }
const uint32_t *scope_compat_theme_layout(void) {
  static const uint32_t layout[] = {30, sizeof(ScopeCompatThemeResult), _Alignof(ScopeCompatThemeResult),
    TH_HEADER_OFFSETS(ScopeCompatThemeResult), offsetof(ScopeCompatThemeResult, path_count), offsetof(ScopeCompatThemeResult, styles),
    sizeof(ScopeCompatThemeStyle), _Alignof(ScopeCompatThemeStyle), 0, 4, 8,
    sizeof(ScopeCompatThemeMatch), _Alignof(ScopeCompatThemeMatch), TH_HEADER_OFFSETS(ScopeCompatThemeMatch),
    offsetof(ScopeCompatThemeMatch, count), offsetof(ScopeCompatThemeMatch, records),
    sizeof(ScopeCompatThemeMatchRecord), _Alignof(ScopeCompatThemeMatchRecord), 0, 4, 8, 12, 16, 20};
  return layout;
}

static ThWork work(uint32_t steps, uint32_t detail) {
  return (ThWork){.rule=TH_NONE, .alternative=TH_NONE, .offset=TH_NONE, .step_limit=steps, .step_detail=detail};
}

static void clear_graph(ScopeCompatTheme *t) {
  sc_free(t->packet); sc_free(t->nodes); sc_free(t->contexts);
  t->packet = NULL; t->nodes = NULL; t->contexts = NULL;
  t->node_count = 0; t->context_count = 0; t->owned = 0;
}

ScopeCompatTheme *scope_compat_theme_new(const uint8_t *packet, uint32_t bytes,
    uint32_t max_steps, uint32_t max_nodes, uint32_t max_contexts, uint32_t max_owned) {
  ScopeCompatTheme *t = sc_alloc(1, sizeof *t);
  if (!t) return NULL;
  t->work = work(max_steps, SC_THEME_COMPILE_STEPS); t->max_nodes = max_nodes;
  t->max_contexts = max_contexts; t->max_owned = max_owned;
  t->defaults = (ScopeCompatThemeStyle){0x000000ffu, 0xffffffffu, 0};
  ThPacket input = {0};
  if (!th_packet(&input, packet, bytes, true, &t->work) || !th_validate_theme(&input, &t->work)) return t;
  t->packet = th_allocate(t, bytes, 1);
  if (!t->packet) return t;
  if (!th_charge(&t->work, bytes)) { clear_graph(t); return t; }
  memcpy(t->packet, packet, bytes); input.data = t->packet;
  if (!th_compile(t, &input)) clear_graph(t);
  return t;
}

uint32_t scope_compat_theme_status(const ScopeCompatTheme *t) { return t ? t->work.status : SCOPE_COMPAT_NO_MEMORY; }
uint32_t scope_compat_theme_detail(const ScopeCompatTheme *t) { return t ? t->work.detail : SC_THEME_ALLOCATION; }
uint32_t scope_compat_theme_detail_value(const ScopeCompatTheme *t) { return t ? t->work.value : 0; }
uint32_t scope_compat_theme_error_rule(const ScopeCompatTheme *t) { return t ? t->work.rule : TH_NONE; }
uint32_t scope_compat_theme_error_alternative(const ScopeCompatTheme *t) { return t ? t->work.alternative : TH_NONE; }
uint32_t scope_compat_theme_error_offset(const ScopeCompatTheme *t) { return t ? t->work.offset : TH_NONE; }
void scope_compat_theme_delete(ScopeCompatTheme *t) { if (t) { clear_graph(t); sc_free(t); } }

static bool resolve_input(const ScopeCompatTheme *t, const uint8_t *packet, uint32_t bytes, ThPacket *p, ThWork *w) {
  if (!t || t->work.status) return th_fail(w, SCOPE_COMPAT_INVALID, SC_THEME_NOT_COMPILED, 0, TH_NONE);
  return th_packet(p, packet, bytes, false, w) && th_validate_paths(p, w);
}

static void apply(ScopeCompatThemeStyle *s, ScopeCompatThemeMatchRecord m) {
  if (m.present & 1) s->foreground = m.foreground;
  if (m.present & 2) s->background = m.background;
  if (m.present & 4) s->font_mask = m.font_mask;
}

static ScopeCompatThemeStyle *resolve(const ScopeCompatTheme *t, const ThPacket *p, uint32_t max_output, ThWork *w) {
  if (p->count > max_output / 12) {
    th_fail(w, SCOPE_COMPAT_BUDGET, SC_THEME_OUTPUT_BYTES, max_output, TH_NONE); return NULL;
  }
  if (!p->count) return NULL;
  ScopeCompatThemeStyle *styles = sc_alloc(p->count, sizeof *styles);
  if (!styles) { th_fail(w, SCOPE_COMPAT_NO_MEMORY, SC_THEME_ALLOCATION, p->count * 12, TH_NONE); return NULL; }
  for (uint32_t i = 0; i < p->count && !w->status; ++i) {
    if (!th_charge(w, 1)) break;
    styles[i] = i ? styles[th_word(p->data, p->records + i * 8)] : t->defaults;
    apply(&styles[i], th_match(t, p, i, w));
  }
  if (w->status) { sc_free(styles); return NULL; }
  return styles;
}

ScopeCompatThemeResult *scope_compat_theme_resolve(const ScopeCompatTheme *t, const uint8_t *packet,
    uint32_t bytes, uint32_t max_steps, uint32_t max_output) {
  ScopeCompatThemeResult *r = sc_alloc(1, sizeof *r);
  if (!r) return NULL;
  ThWork w = work(max_steps, SC_THEME_RESOLVE_STEPS);
  ThPacket p = {0}; r->abi_version = 1;
  if (resolve_input(t, packet, bytes, &p, &w)) r->styles = resolve(t, &p, max_output, &w);
  r->status = w.status; r->detail = w.detail; r->detail_value = w.value;
  if (!w.status) r->path_count = p.count;
  return r;
}

void scope_compat_theme_result_delete(ScopeCompatThemeResult *r) {
  if (!r) return;
  sc_free((void *)r->styles); sc_free(r);
}

ScopeCompatThemeMatch *scope_compat_theme_match(const ScopeCompatTheme *t, const uint8_t *packet,
    uint32_t bytes, uint32_t id, uint32_t max_steps) {
  ScopeCompatThemeMatch *r = sc_alloc(1, sizeof *r);
  if (!r) return NULL;
  ThWork w = work(max_steps, SC_THEME_RESOLVE_STEPS);
  ThPacket p = {0}; r->abi_version = 1;
  bool valid = resolve_input(t, packet, bytes, &p, &w);
  if (valid && id >= p.count) valid = th_fail(&w, SCOPE_COMPAT_INVALID, SC_THEME_PATH, id, TH_NONE);
  ScopeCompatThemeMatchRecord value = {0};
  if (valid && th_charge(&w, 1)) value = th_match(t, &p, id, &w);
  ScopeCompatThemeMatchRecord *record = NULL;
  if (!w.status) record = sc_alloc(1, sizeof *record);
  if (!w.status && !record) th_fail(&w, SCOPE_COMPAT_NO_MEMORY, SC_THEME_ALLOCATION, sizeof *record, TH_NONE);
  if (!w.status) { *record = value; r->records = record; r->count = 1; }
  r->status = w.status; r->detail = w.detail; r->detail_value = w.value;
  return r;
}

void scope_compat_theme_match_delete(ScopeCompatThemeMatch *r) {
  if (!r) return;
  sc_free((void *)r->records); sc_free(r);
}

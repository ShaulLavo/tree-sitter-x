#include "scope_compat_theme.h"
#include "../src/alloc.h"
#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

typedef struct { uint32_t words[4096]; uint32_t bytes; } Packet;
static Packet theme_packet(void) {
  Packet p = {.words={0x31544853u,1,48,0,0,0,0,0,0,0,0,0}, .bytes=48};
  return p;
}
static Packet paths_packet(void) {
  Packet p = {.words={0x31504853u,1,36,0,0,0,0,0,0}, .bytes=36};
  return p;
}
static uint32_t append(Packet *p, const void *source, uint32_t bytes) {
  uint32_t at = p->bytes;
  assert(bytes <= sizeof p->words - at);
  memcpy((uint8_t *)p->words + at, source, bytes);
  p->bytes += bytes; p->words[2] = p->bytes;
  return at;
}
static void names(Packet *p, bool theme, const char *const *names, uint32_t count) {
  uint32_t descriptors[64] = {0};
  uint32_t field = theme ? 5 : 3;
  p->words[field] = count;
  if (!count) return;
  p->words[field + 1] = append(p, descriptors, count * 8);
  p->words[theme ? 10 : 8] = p->bytes;
  for (uint32_t i = 0; i < count; ++i) {
    uint32_t size = (uint32_t)strlen(names[i]), at = append(p, names[i], size);
    p->words[p->words[field + 1] / 4 + i * 2] = at;
    p->words[p->words[field + 1] / 4 + i * 2 + 1] = size;
    p->words[theme ? 9 : 7] += size;
  }
}
static ScopeCompatTheme *compile(const Packet *p) {
  return scope_compat_theme_new((const uint8_t *)p->words, p->bytes, 8388608, 65536, 262144, 33554432);
}
static void error(const Packet *p, uint32_t status, uint32_t detail) {
  ScopeCompatTheme *t = compile(p);
  assert(t && scope_compat_theme_status(t) == status && scope_compat_theme_detail(t) == detail);
  scope_compat_theme_delete(t);
  assert(scope_compat_live_allocations() == 0);
}
static void empty_and_limits(void) {
  Packet p = theme_packet(), paths = paths_packet();
  ScopeCompatTheme *t = compile(&p);
  assert(t && scope_compat_theme_status(t) == 0);
  ScopeCompatThemeResult *r = scope_compat_theme_resolve(t, (uint8_t *)paths.words, paths.bytes, 0, 0);
  assert(r && r->status == 0 && !r->path_count && !r->styles);
  scope_compat_theme_result_delete(r); scope_compat_theme_delete(t);
  t = scope_compat_theme_new((uint8_t *)p.words, p.bytes, 0, 65536, 262144, 33554432);
  assert(t && scope_compat_theme_status(t) == 2 && scope_compat_theme_detail(t) == SC_THEME_COMPILE_STEPS);
  scope_compat_theme_delete(t);
  t = scope_compat_theme_new((uint8_t *)p.words, p.bytes, 1000, 0, 262144, 33554432);
  assert(t && scope_compat_theme_status(t) == 2 && scope_compat_theme_detail(t) == SC_THEME_TRIE_NODES);
  scope_compat_theme_delete(t);
  t = scope_compat_theme_new((uint8_t *)p.words, p.bytes, 1000, 65536, 262144, 47);
  assert(t && scope_compat_theme_status(t) == 2 && scope_compat_theme_detail(t) == SC_THEME_OWNED_BYTES);
  scope_compat_theme_delete(t);
  assert(scope_compat_live_allocations() == 0);
}

static Packet rules_packet(void) {
  Packet p = theme_packet();
  uint32_t rules[] = {
    UINT32_MAX,0,0,0,0,7,0x102030ff,0x405060ff,4,
    0,0,0,1,0,1,0x12345678,0,0,
    1,0,0,2,0,4,0,0,0,
    1,0,1,3,0,1,0x223344ff,0,0,
  };
  uint32_t contexts[] = {2,1};
  const char *const atoms[] = {"variable", "variable.other", "meta.function"};
  p.words[3] = 4; p.words[4] = append(&p, rules, sizeof rules);
  p.words[7] = 1; p.words[8] = append(&p, contexts, sizeof contexts);
  names(&p, true, atoms, 3);
  return p;
}
static Packet reference_paths(void) {
  Packet p = paths_packet();
  const uint32_t pairs[] = {UINT32_MAX,UINT32_MAX,0,0,1,1,0,1};
  const char *const atoms[] = {"meta.function.ts", "variable.other.ts"};
  p.words[5] = 4; p.words[6] = append(&p, pairs, sizeof pairs);
  names(&p, false, atoms, 2);
  return p;
}

static void exact_specification(void) {
  Packet p = rules_packet(), paths = reference_paths();
  ScopeCompatTheme *t = compile(&p);
  assert(t && scope_compat_theme_status(t) == 0);
  memset(p.words, 0, p.bytes);
  ScopeCompatThemeResult *r = scope_compat_theme_resolve(t, (uint8_t *)paths.words, paths.bytes, 1048576, 48);
  assert(r && r->status == 0 && r->path_count == 4);
  assert(r->styles[0].foreground == 0x102030ff && r->styles[0].background == 0x405060ff && r->styles[0].font_mask == 4);
  assert(r->styles[2].foreground == 0x223344ff && r->styles[2].font_mask == 0);
  assert(r->styles[3].foreground == 0x12345678 && r->styles[3].font_mask == 0);
  scope_compat_theme_result_delete(r);
  ScopeCompatThemeMatch *m = scope_compat_theme_match(t, (uint8_t *)paths.words, paths.bytes, 2, 1048576);
  assert(m && !m->status && m->count == 1 && m->records[0].present == 5);
  assert(m->records[0].font_mask == 0 && m->records[0].rule == 3 && m->records[0].alternative == 0);
  scope_compat_theme_match_delete(m);
  r = scope_compat_theme_resolve(t, (uint8_t *)paths.words, paths.bytes, 1048576, 47);
  assert(r && r->status == 2 && r->detail == SC_THEME_OUTPUT_BYTES && r->detail_value == 47 && !r->styles && !r->path_count);
  scope_compat_theme_result_delete(r);
  r = scope_compat_theme_resolve(t, (uint8_t *)paths.words, paths.bytes, 0, 48);
  assert(r && r->status == 2 && r->detail == SC_THEME_RESOLVE_STEPS && !r->styles);
  scope_compat_theme_result_delete(r); scope_compat_theme_delete(t);
  assert(scope_compat_live_allocations() == 0);
}

static void malformed_packets(void) {
  Packet p = theme_packet(); p.words[1] = 2; error(&p,3,SC_THEME_PACKET);
  p = rules_packet(); p.words[4] += 4; error(&p,3,SC_THEME_PACKET);
  p = rules_packet(); p.words[11] = 1; error(&p,3,SC_THEME_PACKET);
  p = rules_packet(); p.words[p.words[4]/4 + 5] = 8; error(&p,3,SC_THEME_PROPERTY);
  p = rules_packet(); p.words[p.words[4]/4 + 5] = 8;
  p.words[p.words[4]/4 + 6] = 0; p.words[p.words[4]/4 + 7] = 0; p.words[p.words[4]/4 + 8] = 0;
  error(&p,3,SC_THEME_PROPERTY);
  p = rules_packet(); p.words[p.words[4]/4 + 9] = 99; error(&p,3,SC_THEME_SELECTOR_ATOM);
  p = rules_packet(); p.words[p.words[8]/4 + 1] = 2; error(&p,3,SC_THEME_CONTEXT);
  p = rules_packet(); p.words[p.words[6]/4 + 2] = p.words[p.words[6]/4]; error(&p,3,SC_THEME_PACKET);
  p = rules_packet(); ((uint8_t *)p.words)[p.words[10]] = 0xff; error(&p,3,SC_THEME_UTF8);
  p = rules_packet(); p.words[p.words[4]/4 + 4] = 1; error(&p,3,SC_THEME_PACKET);
  Packet paths = reference_paths(); ScopeCompatTheme *t = compile(&(Packet){.words={0x31544853u,1,48},.bytes=48});
  paths.words[paths.words[6]/4 + 4] = 2;
  ScopeCompatThemeResult *r = scope_compat_theme_resolve(t,(uint8_t *)paths.words,paths.bytes,1048576,1024);
  assert(r && r->status == 3 && r->detail == SC_THEME_PATH && !r->path_count && !r->styles);
  scope_compat_theme_result_delete(r); scope_compat_theme_delete(t);
  assert(scope_compat_live_allocations() == 0);
}

static Packet clone_packet(void) {
  Packet p = theme_packet();
  const uint32_t rules[] = {0,0,1,0,0,1,0x123456ff,0,0, 1,0,0,1,0,1,0x654321ff,0,0};
  const uint32_t contexts[] = {2,0};
  const char *const atoms[] = {"a","a.b.c","meta"};
  p.words[3] = 2; p.words[4] = append(&p,rules,sizeof rules);
  p.words[7] = 1; p.words[8] = append(&p,contexts,sizeof contexts);
  names(&p,true,atoms,3); return p;
}
static void construction_bounds(void) {
  Packet p = clone_packet();
  ScopeCompatTheme *t = scope_compat_theme_new((uint8_t *)p.words,p.bytes,8388608,4,3,33554432);
  assert(t && !scope_compat_theme_status(t)); scope_compat_theme_delete(t);
  t = scope_compat_theme_new((uint8_t *)p.words,p.bytes,8388608,4,2,33554432);
  assert(t && scope_compat_theme_status(t) == 2 && scope_compat_theme_detail(t) == SC_THEME_CONTEXT_RULES);
  assert(scope_compat_theme_detail_value(t) == 2 && scope_compat_theme_error_rule(t) == 1);
  scope_compat_theme_delete(t);
  t = scope_compat_theme_new((uint8_t *)p.words,p.bytes,8388608,3,3,33554432);
  assert(t && scope_compat_theme_status(t) == 2 && scope_compat_theme_detail(t) == SC_THEME_TRIE_NODES);
  scope_compat_theme_delete(t);
  uint32_t low = 0, high = 8388608;
  while (low + 1 < high) {
    uint32_t middle = low + (high-low)/2;
    t = scope_compat_theme_new((uint8_t *)p.words,p.bytes,middle,4,3,33554432);
    assert(t);
    if (!scope_compat_theme_status(t)) high = middle;
    else { assert(scope_compat_theme_detail(t) == SC_THEME_COMPILE_STEPS); low = middle; }
    scope_compat_theme_delete(t);
  }
  t = scope_compat_theme_new((uint8_t *)p.words,p.bytes,high,4,3,33554432);
  assert(t && !scope_compat_theme_status(t)); scope_compat_theme_delete(t);
  t = scope_compat_theme_new((uint8_t *)p.words,p.bytes,high-1,4,3,33554432);
  assert(t && scope_compat_theme_status(t) == 2 && scope_compat_theme_detail_value(t) == high-1);
  scope_compat_theme_delete(t); assert(scope_compat_live_allocations() == 0);
}

static void bounded_packet_mutations(void) {
  Packet original = clone_packet();
  for (uint32_t i = 0; i < original.bytes; ++i) {
    Packet p = original; ((uint8_t *)p.words)[i] ^= 0x80;
    ScopeCompatTheme *t = scope_compat_theme_new((uint8_t *)p.words,p.bytes,4096,16,16,65536);
    assert(t && scope_compat_theme_status(t) <= 4);
    scope_compat_theme_delete(t); assert(scope_compat_live_allocations() == 0);
  }
  Packet p = rules_packet(); ((uint8_t *)p.words)[p.words[10]] = 0xff;
  ScopeCompatTheme *t = compile(&p);
  assert(scope_compat_theme_detail(t) == SC_THEME_UTF8 && scope_compat_theme_detail_value(t) == 0xff);
  assert(scope_compat_theme_error_offset(t) == p.words[10] && scope_compat_theme_error_rule(t) == UINT32_MAX);
  scope_compat_theme_delete(t); assert(scope_compat_live_allocations() == 0);
}

static void allocation_failures(void) {
  Packet p = rules_packet(), paths = reference_paths();
  bool success = false;
  for (uint32_t i = 0; i < 64 && !success; ++i) {
    scope_compat_test_fail_after(i);
    ScopeCompatTheme *t = compile(&p);
    success = t && scope_compat_theme_status(t) == 0;
    assert(success || scope_compat_theme_status(t) == 4);
    if (!t) assert(scope_compat_theme_detail(t) == SC_THEME_ALLOCATION && scope_compat_theme_error_offset(t) == UINT32_MAX);
    scope_compat_theme_delete(t); assert(scope_compat_live_allocations() == 0);
  }
  assert(success); scope_compat_test_fail_after(UINT32_MAX);
  ScopeCompatTheme *t = compile(&p); uint32_t before = scope_compat_live_allocations();
  for (uint32_t i = 0; i < 3; ++i) {
    scope_compat_test_fail_after(i);
    ScopeCompatThemeResult *r = scope_compat_theme_resolve(t,(uint8_t *)paths.words,paths.bytes,1048576,1024);
    assert((i == 2 && r && !r->status) || !r || (r->status == 4 && !r->styles && !r->path_count));
    scope_compat_theme_result_delete(r); assert(scope_compat_live_allocations() == before);
    scope_compat_test_fail_after(i);
    ScopeCompatThemeMatch *m = scope_compat_theme_match(t,(uint8_t *)paths.words,paths.bytes,2,1048576);
    assert((i == 2 && m && !m->status) || !m || (m->status == 4 && !m->records && !m->count));
    scope_compat_theme_match_delete(m); assert(scope_compat_live_allocations() == before);
  }
  scope_compat_test_fail_after(UINT32_MAX); scope_compat_theme_delete(t);
  assert(scope_compat_live_allocations() == 0);
}

void sc_theme_tests(void) {
  empty_and_limits(); exact_specification(); malformed_packets(); construction_bounds(); bounded_packet_mutations(); allocation_failures();
  puts("scope-compat theme packet controls passed");
}
#ifdef SC_THEME_STANDALONE
uint32_t scope_compat_live_allocations(void) { return sc_live(); }
int main(void) { sc_theme_tests(); return 0; }
#endif

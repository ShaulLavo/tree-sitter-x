#ifndef SC_THEME_INTERNAL_H_
#define SC_THEME_INTERNAL_H_
#include "scope_compat_theme.h"
#include "alloc.h"
#include <stdbool.h>
#include <stddef.h>

#define TH_NONE UINT32_MAX
#define TH_PACKET_LIMIT (16u * 1024u * 1024u)
#define TH_ATOM_LIMIT 65536u
#define TH_PATH_LIMIT 262144u
typedef struct { uint32_t status, detail, value, rule, alternative, offset, steps, step_limit, step_detail; } ThWork;
typedef struct { const uint8_t *data; uint32_t bytes, count, records, names, name_count, strings, string_bytes, contexts, context_count; } ThPacket;
typedef struct { uint32_t tail, first, count, rule, alternative, present, foreground, background, font; } ThRule;
typedef struct { ScopeCompatThemeMatchRecord style; uint32_t depth, first, count, next; } ThCandidate;
typedef struct { uint32_t text, length, child, sibling, contexts; ThCandidate main; } ThNode;
struct ScopeCompatTheme {
  ThWork work;
  uint8_t *packet;
  ThNode *nodes;
  ThCandidate *contexts;
  uint32_t node_count, node_capacity, context_count, context_capacity;
  uint32_t owned, max_owned, max_nodes, max_contexts;
  ScopeCompatThemeStyle defaults;
};
_Static_assert(sizeof(ScopeCompatTheme) <= 128, "theme diagnostic header cap");
_Static_assert(sizeof(ThRule) == 36, "theme wire rule");
_Static_assert(sizeof(ScopeCompatThemeStyle) == 12, "theme style ABI");
_Static_assert(sizeof(ScopeCompatThemeMatchRecord) == 24, "theme match record ABI");

uint32_t th_word(const uint8_t *data, uint32_t offset);
bool th_fail(ThWork *work, uint32_t status, uint32_t detail, uint32_t value, uint32_t offset);
bool th_charge(ThWork *work, uint32_t steps);
bool th_packet(ThPacket *packet, const uint8_t *data, uint32_t bytes, bool theme, ThWork *work);
bool th_validate_theme(const ThPacket *packet, ThWork *work);
bool th_validate_paths(const ThPacket *packet, ThWork *work);
ThRule th_rule(const ThPacket *packet, uint32_t id);
uint32_t th_name(const ThPacket *packet, uint32_t id, uint32_t *length);
void *th_allocate(ScopeCompatTheme *theme, uint32_t count, uint32_t width);
bool th_compile(ScopeCompatTheme *theme, const ThPacket *packet);
ScopeCompatThemeMatchRecord th_match(const ScopeCompatTheme *theme, const ThPacket *paths, uint32_t id, ThWork *work);
#endif

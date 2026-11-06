#ifndef SC_INTERNAL_H_
#define SC_INTERNAL_H_
#include "scope_compat.h"
#include "alloc.h"

#define SC_NONE SCOPE_COMPAT_NONE
#define SC_DEFAULT_LIMIT (1u << 22)
#define SC_NAME_LIMIT 256u

typedef struct { uint16_t *text; uint32_t length; } ScText;
typedef enum { SC_EQ, SC_SET, SC_RANGE } ScOperator;
typedef struct {
  ScOperator kind;
  bool positive, any, membership;
  uint32_t first, second, scope;
  const TSQueryPredicateStep *arguments;
  uint32_t count;
} ScPredicate;
typedef struct { uint32_t start, count, priority; } ScPattern;

struct ScopeCompatPack {
  const TSLanguage *language;
  TSQuery *query;
  uint32_t status, detail, value, error_pattern, error_offset;
  char error_name[SC_NAME_LIMIT + 1];
  char **scopes;
  uint32_t scope_count, scope_capacity, capture_count;
  uint32_t *capture_scopes;
  ScText *strings;
  uint32_t string_count;
  ScPattern *patterns;
  ScPredicate *predicates;
  uint32_t predicate_count, predicate_capacity;
};

typedef struct {
  uint32_t from, to, scope, pattern, priority, capture, nest, disposition;
  bool range;
  TSNode node;
} ScInterval;
typedef struct {
  uint32_t status, detail, value;
  uint32_t captures_seen;
  ScInterval *items;
  uint32_t count, capacity;
} ScCollection;

void sc_pack_error(ScopeCompatPack *, uint32_t, uint32_t, uint32_t, uint32_t, const char *, uint32_t);
uint32_t sc_text_decode(const char *, uint32_t, ScText *);
bool sc_predicate(const ScopeCompatPack *, const ScPredicate *, const TSQueryMatch *, const uint16_t *);
bool sc_node_span(TSNode, uint32_t, ScCollection *);
ScCollection sc_collect(const ScopeCompatPack *, const TSTree *, const uint16_t *, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
void sc_order(ScCollection *);
void sc_compose(ScopeCompatResult *, ScCollection *, const uint16_t *, uint32_t, uint32_t);
#endif

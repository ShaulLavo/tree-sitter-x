#ifndef SC_INTERNAL_H_
#define SC_INTERNAL_H_
#include "scope_compat.h"
#include "alloc.h"

#define SC_NONE SCOPE_COMPAT_NONE
#define SC_DEFAULT_LIMIT (1u << 22)
#define SC_NAME_LIMIT 256u

typedef struct { uint16_t *text; uint32_t length; } ScText;
typedef struct {
  bool positive, any;
  uint32_t capture;
  const TSQueryPredicateStep *arguments;
  uint32_t count;
} ScEquality;
typedef struct {
  bool positive;
  uint32_t capture, count;
  const TSQueryPredicateStep *arguments;
} ScMembership;
typedef struct { uint64_t words[2]; } ScAsciiSet;
typedef struct { uint32_t capture; bool positive; ScAsciiSet first, tail; } ScClass;
typedef struct { ScClass body; ScAsciiSet last; } ScClassLast;
typedef struct { uint32_t capture, literal; bool positive; } ScPrefix;
typedef enum { SC_AT_START, SC_AT_END } ScEdgeSide;
typedef struct { uint32_t capture; ScEdgeSide side; int8_t delta; } ScEdge;
typedef struct { uint32_t scope, container; ScEdge left, right; } ScSpanSpec;
typedef struct { uint32_t scope, first, second; } ScRange;
typedef enum { SC_EQ, SC_MEMBERSHIP, SC_SET, SC_RANGE, SC_PREFIX, SC_CLASS, SC_CLASS_LAST, SC_SPAN } ScOperator;
typedef struct {
  ScOperator kind;
  union {
    ScEquality equality;
    ScMembership membership;
    uint32_t priority;
    ScRange range;
    ScPrefix prefix;
    ScClass text_class;
    ScClassLast text_class_last;
    ScSpanSpec span;
  } data;
} ScPredicate;
typedef struct { uint32_t start, count, priority; } ScPattern;
typedef enum { SC_LEGACY_ORDER, SC_CONTAINED_SPAN_ORDER } ScOrderPolicy;

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
  ScOrderPolicy order_policy;
};

typedef enum { SC_NODE_INTERVAL, SC_LEGACY_RANGE_INTERVAL, SC_EDGE_SPAN_INTERVAL } ScIntervalKind;
typedef struct {
  uint32_t from, to, scope, pattern, priority, capture, nest, disposition;
  uint32_t logical_from, logical_to;
  ScIntervalKind kind;
  TSNode node;
} ScInterval;
typedef struct {
  uint32_t status, detail, value;
  uint32_t captures_seen;
  ScInterval *items;
  uint32_t count, capacity;
  ScOrderPolicy order_policy;
} ScCollection;

void sc_pack_error(ScopeCompatPack *, uint32_t, uint32_t, uint32_t, uint32_t, const char *, uint32_t);
uint32_t sc_text_decode(const char *, uint32_t, ScText *);
bool sc_predicate(const ScopeCompatPack *, const ScPredicate *, const TSQueryMatch *, const uint16_t *);
bool sc_node_span(TSNode, uint32_t, ScCollection *);
bool sc_resolve_edge(ScEdge, uint32_t, uint32_t, uint32_t *, ScCollection *);
bool sc_span_interval(const ScSpanSpec *, const TSQueryMatch *, uint32_t, uint32_t, ScCollection *, ScInterval *);
ScCollection sc_collect(const ScopeCompatPack *, const TSTree *, const uint16_t *, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
void sc_order(ScCollection *);
void sc_compose(ScopeCompatResult *, ScCollection *, const uint16_t *, uint32_t, uint32_t);
#endif

#include "internal.h"
#include <stdlib.h>
#include <string.h>

static int compare_u32(uint32_t a, uint32_t b) { return (a > b) - (a < b); }
static int node_span_order(TSNode a, TSNode b) {
  int order = compare_u32(ts_node_start_byte(a), ts_node_start_byte(b));
  if (!order) order = compare_u32(ts_node_end_byte(b), ts_node_end_byte(a));
  return order;
}

static int interval_order(const void *left, const void *right) {
  const ScInterval *a = left, *b = right;
  int order = compare_u32(a->from, b->from);
  if (!order) order = compare_u32(b->to, a->to);
  if (!order) order = compare_u32(a->range, b->range);
  if (!order && !a->range && !b->range) order = node_span_order(a->node, b->node);
  if (!order) order = compare_u32(a->nest, b->nest);
  if (!order) order = compare_u32(a->pattern, b->pattern);
  if (!order) order = compare_u32(a->capture, b->capture);
  return order;
}

static uint32_t nesting(TSNode node) {
  uint32_t count = 0, from = ts_node_start_byte(node), to = ts_node_end_byte(node);
  TSNode parent = ts_node_parent(node);
  while (!ts_node_is_null(parent) && ts_node_start_byte(parent) == from && ts_node_end_byte(parent) == to) {
    ++count; parent = ts_node_parent(parent);
  }
  return count;
}

static void disposition(ScCollection *c, uint32_t index, uint32_t first, uint32_t end) {
  ScInterval *a = &c->items[index];
  if (a->from == a->to) { a->disposition = 1; return; }
  for (uint32_t j = first; j < end; ++j) {
    const ScInterval *b = &c->items[j];
    if (a->range || b->range || a->pattern == b->pattern || !ts_node_eq(a->node, b->node)) continue;
    if (b->priority > a->priority || (b->priority == a->priority && b->pattern < a->pattern)) { a->disposition = 2; return; }
  }
  for (uint32_t j = first; j < index; ++j) {
    if (!c->items[j].disposition && c->items[j].scope == a->scope) { a->disposition = 3; return; }
  }
}

static void order_group(ScCollection *c, uint32_t first, uint32_t end) {
  if (end - first > 1) {
    for (uint32_t i = first; i < end; ++i) c->items[i].nest = c->items[i].range ? 0 : nesting(c->items[i].node);
    qsort(c->items + first, end - first, sizeof *c->items, interval_order);
  }
  for (uint32_t i = first; i < end; ++i) disposition(c, i, first, end);
}

void sc_order(ScCollection *c) {
  if (c->count) qsort(c->items, c->count, sizeof *c->items, interval_order);
  uint32_t first = 0;
  while (first < c->count) {
    uint32_t end = first + 1;
    while (end < c->count && c->items[end].from == c->items[first].from && c->items[end].to == c->items[first].to) ++end;
    order_group(c, first, end);
    first = end;
  }
}

typedef struct { uint32_t position, interval; bool start; } Event;
typedef struct {
  uint32_t *paths, count, capacity;
  uint32_t *slots, slot_capacity;
} Paths;

static uint32_t hash(uint32_t parent, uint32_t scope) { return (parent * 0x9e3779b1u) ^ (scope * 0x85ebca6bu); }

static void insert_slot(Paths *p, uint32_t id) {
  uint32_t slot = hash(p->paths[id * 2], p->paths[id * 2 + 1]) & (p->slot_capacity - 1);
  while (p->slots[slot]) slot = (slot + 1) & (p->slot_capacity - 1);
  p->slots[slot] = id;
}

static bool grow_slots(Paths *p) {
  if (p->slot_capacity && p->count < p->slot_capacity / 2) return true;
  if (p->slot_capacity > UINT32_MAX / 2) return false;
  uint32_t capacity = p->slot_capacity ? p->slot_capacity * 2 : 16;
  uint32_t *slots = sc_alloc(capacity, sizeof *slots);
  if (!slots) return false;
  sc_free(p->slots); p->slots = slots; p->slot_capacity = capacity;
  for (uint32_t i = 1; i < p->count; ++i) insert_slot(p, i);
  return true;
}

static uint32_t intern(Paths *p, uint32_t parent, uint32_t scope) {
  if (!grow_slots(p)) return SC_NONE;
  uint32_t slot = hash(parent, scope) & (p->slot_capacity - 1);
  while (p->slots[slot]) {
    uint32_t id = p->slots[slot];
    if (p->paths[id * 2] == parent && p->paths[id * 2 + 1] == scope) return id;
    slot = (slot + 1) & (p->slot_capacity - 1);
  }
  if (p->count >= UINT32_MAX / 2 || !sc_grow((void **)&p->paths, &p->capacity, (p->count + 1) * 2, sizeof *p->paths)) return SC_NONE;
  uint32_t id = p->count++;
  p->paths[id * 2] = parent; p->paths[id * 2 + 1] = scope;
  p->slots[slot] = id;
  return id;
}

static int event_order(const void *left, const void *right) {
  const Event *a = left, *b = right;
  int order = compare_u32(a->position, b->position);
  if (!order) order = compare_u32(a->start, b->start);
  if (!order) order = compare_u32(a->interval, b->interval);
  return order;
}

static bool event_push(Event **events, uint32_t *count, uint32_t *capacity, Event event) {
  if (*count == UINT32_MAX || !sc_grow((void **)events, capacity, *count + 1, sizeof event)) return false;
  (*events)[(*count)++] = event;
  return true;
}

static bool events_build(Event **events, uint32_t *count, uint32_t *capacity,
                          const ScCollection *c, const uint16_t *source, uint32_t length, uint32_t ws, uint32_t we) {
  if (!event_push(events, count, capacity, (Event){ws, SC_NONE, false}) ||
      !event_push(events, count, capacity, (Event){we, SC_NONE, false})) return false;
  for (uint32_t i = 0; i < c->count; ++i) {
    if (c->items[i].disposition) continue;
    if (!event_push(events, count, capacity, (Event){c->items[i].from, i, true}) ||
        !event_push(events, count, capacity, (Event){c->items[i].to, i, false})) return false;
  }
  for (uint32_t i = ws; i < we; ++i) {
    if (source[i] != '\n' && !(source[i] == '\r' && i + 1 < length && source[i + 1] == '\n')) continue;
    if (!event_push(events, count, capacity, (Event){i, SC_NONE, false}) ||
        !event_push(events, count, capacity, (Event){i + 1, SC_NONE, false})) return false;
  }
  return true;
}

static void active_event(const Event event, uint32_t *active, uint32_t *count) {
  if (event.interval == SC_NONE) return;
  uint32_t at = 0;
  while (at < *count && active[at] < event.interval) ++at;
  if (event.start) {
    memmove(active + at + 1, active + at, (size_t)(*count - at) * sizeof *active);
    active[at] = event.interval; ++*count; return;
  }
  memmove(active + at, active + at + 1, (size_t)(*count - at - 1) * sizeof *active);
  --*count;
}

static uint32_t path_for(Paths *paths, const ScCollection *c, const uint32_t *active,
                          uint32_t count, bool terminator) {
  if (terminator) return 0;
  uint32_t path = intern(paths, 0, 0);
  for (uint32_t i = 0; i < count && path != SC_NONE; ++i) path = intern(paths, path, c->items[active[i]].scope);
  return path;
}

static bool segment_push(ScopeCompatResult *r, uint32_t **segments, uint32_t *capacity,
                          uint32_t from, uint32_t to, uint32_t path, uint32_t limit) {
  uint32_t count = r->segment_count;
  if (count && (*segments)[count * 3 - 1] == path) { (*segments)[count * 3 - 2] = to; return true; }
  if (count >= limit) { r->status = SCOPE_COMPAT_BUDGET; r->detail = SCOPE_COMPAT_DETAIL_SEGMENT_LIMIT; r->detail_value = limit; return false; }
  if (count >= UINT32_MAX / 3 || !sc_grow((void **)segments, capacity, (count + 1) * 3, sizeof **segments)) return false;
  (*segments)[count * 3] = from; (*segments)[count * 3 + 1] = to; (*segments)[count * 3 + 2] = path;
  ++r->segment_count;
  return true;
}

void sc_compose(ScopeCompatResult *r, ScCollection *c, const uint16_t *source, uint32_t length, uint32_t limit) {
  Event *events = NULL;
  uint32_t event_count = 0, event_capacity = 0, segment_capacity = 0, active_count = 0;
  uint32_t *segments = NULL, *active = sc_alloc(c->count, sizeof *active);
  Paths paths = {0};
  r->status = SCOPE_COMPAT_NO_MEMORY;
  if (!active || !sc_grow((void **)&paths.paths, &paths.capacity, 2, sizeof *paths.paths)) goto done;
  paths.paths[0] = paths.paths[1] = SC_NONE; paths.count = 1;
  if (!events_build(&events, &event_count, &event_capacity, c, source, length, r->window_start, r->window_end)) goto done;
  qsort(events, event_count, sizeof *events, event_order);
  for (uint32_t i = 0; i < event_count; ++i) {
    active_event(events[i], active, &active_count);
    uint32_t from = events[i].position, to = i + 1 < event_count ? events[i + 1].position : from;
    if (from == to) continue;
    bool terminator = source[from] == '\n' || (source[from] == '\r' && from + 1 < length && source[from + 1] == '\n');
    uint32_t path = path_for(&paths, c, active, active_count, terminator);
    if (path == SC_NONE || !segment_push(r, &segments, &segment_capacity, from, to, path, limit ? limit : SC_DEFAULT_LIMIT)) goto done;
  }
  r->status = SCOPE_COMPAT_OK; r->segments = segments; r->paths = paths.paths; r->path_count = paths.count;
  segments = NULL; paths.paths = NULL;
done:
  sc_free(segments); sc_free(paths.paths); sc_free(paths.slots); sc_free(events); sc_free(active);
}

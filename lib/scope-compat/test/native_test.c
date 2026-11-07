#include "scope_compat.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <limits.h>
#include <string.h>
#include "../src/internal.h"

extern const TSLanguage *tree_sitter_json(void);
extern void sc_theme_tests(void);

typedef struct {
  TSParser *parser;
  TSTree *tree;
  ScopeCompatPack *pack;
  uint16_t *source;
  uint32_t length;
} Fixture;

static Fixture fixture(const char *query, const char *source) {
  Fixture f = {.length=(uint32_t)strlen(source)};
  f.source = calloc(f.length + 1, sizeof *f.source);
  assert(f.source);
  for (uint32_t i=0; i<f.length; ++i) f.source[i] = (unsigned char)source[i];
  f.parser = ts_parser_new();
  assert(ts_parser_set_language(f.parser, tree_sitter_json()));
  f.tree = ts_parser_parse_string_encoding(f.parser, NULL, (const char *)f.source, f.length * 2, TSInputEncodingUTF16LE);
  assert(f.tree);
  f.pack = scope_compat_pack_new(tree_sitter_json(), query, (uint32_t)strlen(query), "source.json", 11, ".json", 5);
  assert(f.pack && scope_compat_pack_status(f.pack) == SCOPE_COMPAT_OK);
  return f;
}

static void dispose(Fixture *f) {
  scope_compat_pack_delete(f->pack);
  ts_tree_delete(f->tree); ts_parser_delete(f->parser); free(f->source);
}

static ScopeCompatResult *run(Fixture *f) {
  return scope_compat_run(f->pack, f->tree, f->source, f->length, 1, 0, f->length, 0, 0, 0);
}

static void schema(const ScopeCompatResult *r, uint32_t start, uint32_t end, uint32_t scopes) {
  assert(r && r->abi_version == 1 && r->window_start == start && r->window_end == end);
  if (r->status != SCOPE_COMPAT_OK) {
    assert(!r->segment_count && !r->segments && !r->path_count && !r->paths);
    assert(!r->captures_seen && !r->intervals_kept && !r->dropped_empty && !r->dropped_exclusive && !r->dropped_duplicate);
    return;
  }
  assert(r->path_count && r->paths && r->paths[0] == SC_NONE && r->paths[1] == SC_NONE);
  uint32_t position = start;
  for (uint32_t i=0; i<r->path_count; ++i) {
    if (!i) continue;
    assert(r->paths[i*2] < i && r->paths[i*2+1] < scopes);
  }
  for (uint32_t i=0; i<r->segment_count; ++i) {
    assert(r->segments[i*3] == position && r->segments[i*3+1] > position);
    assert(r->segments[i*3+1] <= end && r->segments[i*3+2] < r->path_count);
    position = r->segments[i*3+1];
  }
  assert(position == end);
}

static void smoke(void) {
  const uint16_t text[] = {'[', '1', ',', '2', ']'};
  TSParser *parser = ts_parser_new();
  assert(ts_parser_set_language(parser, tree_sitter_json()));
  TSTree *tree = ts_parser_parse_string_encoding(parser, NULL, (const char *)text, sizeof text, TSInputEncodingUTF16LE);
  const char *query = "(number) @constant.numeric";
  ScopeCompatPack *pack = scope_compat_pack_new(tree_sitter_json(), query, (uint32_t)strlen(query), "source.json", 11, ".json", 5);
  assert(pack && scope_compat_pack_status(pack) == SCOPE_COMPAT_OK);
  ScopeCompatResult *result = scope_compat_run(pack, tree, text, 5, SCOPE_COMPAT_ENCODING_UTF16LE, 0, 5, 0, 0, 0);
  assert(result && result->status == SCOPE_COMPAT_OK);
  assert(result->segment_count == 5 && result->path_count == 3);
  scope_compat_result_delete(result);
  scope_compat_pack_delete(pack);
  ts_tree_delete(tree);
  ts_parser_delete(parser);
  assert(scope_compat_live_allocations() == 0);
}

static void query_capabilities(void) {
  const char *query = "((number) @_n @number (#text-class? @_n \"[0-9]\" \"[0-9]\") "
    "(#not-text-class? @_n \"[a-z]\" \"[a-z]\") (#starts-with? @_n \"1\") "
    "(#not-starts-with? @_n \"2\") "
    "(#make-span! \"edge\" @_n @_n \"start\" \"0\" @_n \"start\" \"1\"))";
  Fixture f = fixture(query, "123");
  ScopeCompatResult *r = run(&f);
  assert(r->status == SCOPE_COMPAT_OK && r->intervals_kept == 2);
  assert(r->segments[0] == 0 && r->segments[1] == 1);
  scope_compat_result_delete(r); dispose(&f);
  assert(scope_compat_live_allocations() == 0);
}

static void composition(void) {
  const uint16_t text[] = {'a','b','c','d','\r','\n','e','\r'};
  ScInterval items[] = {
    {.from=0, .to=4, .scope=1, .kind=SC_LEGACY_RANGE_INTERVAL},
    {.from=2, .to=7, .scope=2, .kind=SC_LEGACY_RANGE_INTERVAL},
    {.from=2, .to=7, .scope=2, .kind=SC_LEGACY_RANGE_INTERVAL},
    {.from=3, .to=3, .scope=3, .kind=SC_LEGACY_RANGE_INTERVAL},
  };
  ScCollection c = {.items=items, .count=4};
  sc_order(&c);
  ScopeCompatResult r = {.window_end=8};
  sc_compose(&r, &c, text, 8, 0);
  assert(r.status == SCOPE_COMPAT_OK && r.segment_count == 5);
  const uint32_t expected[] = {0,2,2, 2,4,3, 4,6,0, 6,7,4, 7,8,1};
  /* CRLF coalesces into one empty-path segment; the last CR remains text. */
  assert(r.segment_count == 5);
  assert(!memcmp(r.segments, expected, sizeof expected));
  assert(r.paths[0] == SC_NONE && r.paths[1] == SC_NONE);
  sc_free((void *)r.paths); sc_free((void *)r.segments);
  assert(scope_compat_live_allocations() == 0);
}

static void rejection(void) {
  const char *queries[] = {
    "((number) @n (#match? @n \"x\"))",
    "((number) @n (#set! local \"x\"))",
    "((number) @n (#set! priority \"1001\"))",
    "((number) @n (#eq? \"x\" @n))",
    "(not_a_json_node) @n",
  };
  const uint32_t details[] = {SCOPE_COMPAT_DETAIL_UNKNOWN_OPERATOR, SCOPE_COMPAT_DETAIL_UNKNOWN_SETTING,
    SCOPE_COMPAT_DETAIL_BAD_PRIORITY, SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS, SCOPE_COMPAT_DETAIL_QUERY_SYNTAX};
  for (uint32_t i=0; i<5; ++i) {
    ScopeCompatPack *p = scope_compat_pack_new(tree_sitter_json(), queries[i], (uint32_t)strlen(queries[i]), "source.json", 11, ".json", 5);
    assert(p && scope_compat_pack_status(p) != SCOPE_COMPAT_OK);
    assert(scope_compat_pack_detail(p) == details[i]);
    scope_compat_pack_delete(p);
    assert(scope_compat_live_allocations() == 0);
  }
  const char *operators[] = {"match?", "not-match?", "any-match?", "any-not-match?", "is?", "is-not?",
    "offset!", "select-adjacent!", "strip!", "unknown!"};
  for (uint32_t i=0; i<sizeof operators/sizeof *operators; ++i) {
    char query[128];
    int size = snprintf(query, sizeof query, "((number) @n (#%s @n \"x\"))", operators[i]);
    assert(size > 0 && size < (int)sizeof query);
    ScopeCompatPack *p = scope_compat_pack_new(tree_sitter_json(),query,(uint32_t)size,"source.json",11,".json",5);
    assert(p && scope_compat_pack_status(p) == SCOPE_COMPAT_UNSUPPORTED);
    assert(scope_compat_pack_detail(p) == SCOPE_COMPAT_DETAIL_UNKNOWN_OPERATOR);
    assert(scope_compat_pack_error_pattern(p) == 0 && scope_compat_pack_error_offset(p) == 0);
    assert(!strcmp(scope_compat_pack_error_name(p),operators[i]));
    scope_compat_pack_delete(p);
    assert(scope_compat_live_allocations() == 0);
  }
}

static ScPredicate truth_predicate(const TSQueryPredicateStep *args, uint32_t column) {
  ScPredicate op = {0};
  if (column >= 4) {
    op.kind = SC_MEMBERSHIP;
    op.data.membership = (ScMembership){.positive=!(column & 1), .capture=0, .arguments=args, .count=2};
    return op;
  }
  op.kind = SC_EQ;
  op.data.equality = (ScEquality){.positive=!(column & 1), .any=column==2 || column==3, .capture=0, .arguments=args, .count=2};
  return op;
}

static void predicates(void) {
  const char *invalid[] = {"\x80", "\xc0\x80", "\xed\xa0\x80", "\xf4\x90\x80\x80"};
  for (uint32_t i=0; i<4; ++i) {
    ScText decoded = {0};
    assert(sc_text_decode(invalid[i],(uint32_t)strlen(invalid[i]),&decoded) == SCOPE_COMPAT_INVALID);
    sc_free(decoded.text);
  }
  Fixture f = fixture("(number) @_helper", "[1,2,3]");
  TSNode array = ts_node_named_child(ts_tree_root_node(f.tree), 0);
  TSNode nodes[] = {ts_node_named_child(array, 0), ts_node_named_child(array, 1), ts_node_named_child(array, 2)};
  uint16_t one[] = {'1'};
  ScText strings[] = {{one, 1}};
  ScopeCompatPack pack = {.strings=strings};
  TSQueryPredicateStep args[] = {{TSQueryPredicateStepTypeCapture, 0}, {TSQueryPredicateStepTypeString, 0}};
  ScPredicate op = {.kind=SC_EQ, .data.equality={.arguments=args, .count=2, .capture=0}};
  const uint32_t sets[][3] = {{0,0,0},{0,0,0},{1,0,0},{0,1,0},{1,2,0}};
  const uint32_t counts[] = {0,1,1,2,2};
  const bool expected[][6] = {{true,true,false,false,false,true}, {true,false,true,false,true,false},
    {false,true,false,true,false,true}, {false,false,true,true,false,false}, {false,true,false,true,false,true}};
  for (uint32_t row=0; row<5; ++row) {
    TSQueryCapture captures[3];
    for (uint32_t i=0; i<counts[row]; ++i) captures[i] = (TSQueryCapture){nodes[sets[row][i]], 0};
    TSQueryMatch match = {.capture_count=(uint16_t)counts[row], .captures=captures};
    for (uint32_t col=0; col<6; ++col) {
      op = truth_predicate(args, col);
      assert(sc_predicate(&pack, &op, &match, f.source) == expected[row][col]);
    }
  }
  /* A/B are sets of witnesses, not positional pairs. */
  const uint32_t a[][2] = {{0,0},{1,0},{0,1},{1,0},{0,1},{1,0}};
  const uint32_t b[][2] = {{0,0},{0,0},{1,0},{0,1},{0,0},{1,0}};
  const uint32_t ac[] = {0,1,2,1,2,1}, bc[] = {0,0,1,2,0,1};
  const bool pairs[][4] = {{true,true,false,false},{false,false,false,false},{false,false,true,true},
    {true,true,true,true},{false,false,false,false},{true,false,true,false}};
  args[1] = (TSQueryPredicateStep){TSQueryPredicateStepTypeCapture, 1};
  for (uint32_t row=0; row<6; ++row) {
    TSQueryCapture captures[4];
    for (uint32_t i=0; i<ac[row]; ++i) captures[i] = (TSQueryCapture){nodes[a[row][i]], 0};
    for (uint32_t i=0; i<bc[row]; ++i) captures[ac[row]+i] = (TSQueryCapture){nodes[b[row][i]], 1};
    TSQueryMatch match = {.capture_count=(uint16_t)(ac[row]+bc[row]), .captures=captures};
    for (uint32_t col=0; col<4; ++col) {
      op.kind = SC_EQ;
      op.data.equality = (ScEquality){.positive=!(col & 1), .any=col>=2, .capture=0, .arguments=args, .count=2};
      assert(sc_predicate(&pack, &op, &match, f.source) == pairs[row][col]);
    }
  }
  dispose(&f);
  assert(scope_compat_live_allocations() == 0);
}

static void ownership_query(const char *query) {
  Fixture f = fixture(query, "[1,2]");
  uint32_t baseline = scope_compat_live_allocations();
  ScopeCompatResult *retained = run(&f);
  assert(retained && retained->status == SCOPE_COMPAT_OK);
  assert(scope_compat_live_allocations() > baseline);
  scope_compat_result_delete(retained);
  assert(scope_compat_live_allocations() == baseline);
  for (uint32_t i=0; i<100; ++i) {
    ScopeCompatResult *r = run(&f);
    schema(r, 0, f.length, scope_compat_pack_scope_count(f.pack));
    assert(r->status == SCOPE_COMPAT_OK);
    scope_compat_result_delete(r);
    assert(scope_compat_live_allocations() == baseline);
  }
  bool success = false;
  for (uint32_t i=0; i<200 && !success; ++i) {
    scope_compat_test_fail_after(i);
    ScopeCompatResult *r = run(&f);
    scope_compat_test_fail_after(UINT32_MAX);
    if (r) { schema(r, 0, f.length, scope_compat_pack_scope_count(f.pack)); success = r->status == SCOPE_COMPAT_OK; assert(success || r->status == SCOPE_COMPAT_NO_MEMORY); }
    scope_compat_result_delete(r);
    assert(scope_compat_live_allocations() == baseline);
  }
  assert(success);
  success = false;
  for (uint32_t i=0; i<200 && !success; ++i) {
    scope_compat_test_fail_after(i);
    ScopeCompatExplain *e = scope_compat_explain(f.pack, f.tree, f.source, f.length, 1, 0, f.length, 0, 0);
    scope_compat_test_fail_after(UINT32_MAX);
    if (e) { success = e->status == SCOPE_COMPAT_OK; assert(success || e->status == SCOPE_COMPAT_NO_MEMORY); assert(success || (!e->interval_count && !e->intervals)); }
    scope_compat_explain_delete(e);
    assert(scope_compat_live_allocations() == baseline);
  }
  assert(success);
  retained = run(&f);
  dispose(&f);
  schema(retained, 0, 5, 3);
  scope_compat_result_delete(retained);
  assert(scope_compat_live_allocations() == 0);
  success = false;
  for (uint32_t i=0; i<200 && !success; ++i) {
    scope_compat_test_fail_after(i);
    ScopeCompatPack *p = scope_compat_pack_new(tree_sitter_json(), query, (uint32_t)strlen(query), "source.json", 11, ".json", 5);
    scope_compat_test_fail_after(UINT32_MAX);
    if (p) { success = scope_compat_pack_status(p) == SCOPE_COMPAT_OK; assert(success || scope_compat_pack_status(p) == SCOPE_COMPAT_NO_MEMORY); }
    scope_compat_pack_delete(p);
    assert(scope_compat_live_allocations() == 0);
  }
  assert(success);
}

static void ownership_and_failures(void) {
  ownership_query("(number) @constant.numeric ((array (number) @_first (number) @_last) (#make-range! \"meta.range\" @_first @_last))");
  ownership_query("((number) @_n @constant.numeric (#text-class? @_n \"[0-9]\" \"[0-9]\" \"[0-9]\") "
    "(#starts-with? @_n \"\") (#not-starts-with? @_n \"z\") (#not-text-class? @_n \"[a-z]\" \"[a-z]\") "
    "(#make-span! \"meta.range\" @_n @_n \"start\" \"0\" @_n \"end\" \"0\"))");
}

static void boundaries(void) {
  Fixture f = fixture("(number) @n", "[1,2]");
  ScopeCompatResult *r = scope_compat_run(f.pack, f.tree, f.source, 1, 1, 0, 1, 0, 0, 0);
  assert(r->status == SCOPE_COMPAT_INVALID && r->detail == SCOPE_COMPAT_DETAIL_TREE_EXCEEDS_SOURCE);
  schema(r,0,1,2); scope_compat_result_delete(r);
  r = scope_compat_run(f.pack, f.tree, f.source, UINT32_MAX, 1, 0, 1, 0, 0, 0);
  assert(r->status == SCOPE_COMPAT_INVALID); schema(r,0,1,2); scope_compat_result_delete(r);
  r = scope_compat_run(f.pack, f.tree, f.source, f.length, 0, 0, f.length, 0, 0, 0);
  assert(r->status == SCOPE_COMPAT_UNSUPPORTED && r->detail == SCOPE_COMPAT_DETAIL_ENCODING);
  schema(r,0,f.length,2); scope_compat_result_delete(r);
  r = scope_compat_run(NULL, f.tree, f.source, f.length, 1, 0, f.length, 0, 0, 0);
  assert(r->status == SCOPE_COMPAT_INVALID && r->detail == SCOPE_COMPAT_DETAIL_NULL_ARGUMENT);
  schema(r,0,f.length,2); scope_compat_result_delete(r);
  r = scope_compat_run(f.pack, f.tree, f.source, f.length, 1, 0, f.length, 0, 1, 0);
  assert(r->status == SCOPE_COMPAT_BUDGET && r->detail == SCOPE_COMPAT_DETAIL_INTERVAL_LIMIT);
  schema(r,0,f.length,2); scope_compat_result_delete(r);
  r = scope_compat_run(f.pack, f.tree, f.source, f.length, 1, 0, f.length, 0, 0, 1);
  assert(r->status == SCOPE_COMPAT_BUDGET && r->detail == SCOPE_COMPAT_DETAIL_SEGMENT_LIMIT);
  schema(r,0,f.length,2); scope_compat_result_delete(r);
  r = scope_compat_run(f.pack, f.tree, f.source, f.length, 1, 1, 4, 0, 0, 0);
  assert(r->status == SCOPE_COMPAT_OK); schema(r,1,4,2); scope_compat_result_delete(r);
  dispose(&f);
  f = fixture("(array (number)* @n (number)* @m)", "[1,2,3,4,5,6,7,8,9]");
  r = scope_compat_run(f.pack,f.tree,f.source,f.length,1,0,f.length,1,0,0);
  assert(r->status == SCOPE_COMPAT_BUDGET && r->detail == SCOPE_COMPAT_DETAIL_MATCH_LIMIT);
  schema(r,0,f.length,3); scope_compat_result_delete(r); dispose(&f);
  assert(scope_compat_live_allocations() == 0);
}

static void exact_nodes(void) {
  Fixture f = fixture("(number) @first ((number) @winner (#set! priority \"10\"))", "1");
  ScopeCompatResult *r = run(&f);
  assert(r->status == SCOPE_COMPAT_OK && r->dropped_exclusive == 1);
  assert(r->paths[r->segments[2] * 2 + 1] == 2);
  scope_compat_result_delete(r); dispose(&f);
  f = fixture("(number) @first (number) @second", "1");
  r = run(&f);
  assert(r->status == SCOPE_COMPAT_OK && r->dropped_exclusive == 1 && r->paths[r->segments[2]*2+1] == 1);
  scope_compat_result_delete(r); dispose(&f);
  f = fixture("(number) @first @second", "1");
  r = run(&f);
  const uint32_t stacked[] = {SC_NONE,SC_NONE, 0,0, 1,1, 2,2};
  assert(r->status == SCOPE_COMPAT_OK && r->path_count == 4 && r->segments[2] == 3);
  assert(!memcmp(r->paths, stacked, sizeof stacked));
  scope_compat_result_delete(r); dispose(&f);
  /* Equal-span ancestors precede children despite opposite pattern order. */
  f = fixture("(number) @child (document) @parent", "1");
  r = run(&f);
  const uint32_t ancestors[] = {SC_NONE,SC_NONE, 0,0, 1,2, 2,1};
  assert(r->status == SCOPE_COMPAT_OK && r->path_count == 4);
  assert(!memcmp(r->paths, ancestors, sizeof ancestors));
  ScopeCompatResult *second = run(&f);
  uint8_t *unrelated = scope_compat_bytes_new(777);
  ScopeCompatResult *third = run(&f);
  assert(second->segment_count == r->segment_count && third->path_count == r->path_count);
  assert(!memcmp(second->segments, r->segments, (size_t)r->segment_count*12));
  assert(!memcmp(third->paths, r->paths, (size_t)r->path_count*8));
  scope_compat_bytes_delete(unrelated);
  scope_compat_result_delete(r); scope_compat_result_delete(second); scope_compat_result_delete(third); dispose(&f);
  f = fixture("((array (number) @_last (number) @_first) (#make-range! \"meta\" @_first @_last))", "[1,2]");
  r = run(&f);
  assert(r->status == SCOPE_COMPAT_INVALID); schema(r,0,f.length,2);
  scope_compat_result_delete(r); dispose(&f);
  assert(scope_compat_live_allocations() == 0);
}

static void text_cases(void) {
  const char *sources[] = {"", "\n", "\r\n", "\r", "\r\r", "1\r\n2\n3\r", "[", "@@@"};
  for (uint32_t i=0; i<sizeof sources/sizeof *sources; ++i) {
    Fixture f = fixture("(document) @meta (ERROR) @invalid", sources[i]);
    ScopeCompatResult *r = run(&f);
    assert(r->status == SCOPE_COMPAT_OK); schema(r,0,f.length,scope_compat_pack_scope_count(f.pack));
    scope_compat_result_delete(r); dispose(&f);
  }
  /* A subwindow cutting a CRLF must still suppress its CR. */
  Fixture f = fixture("(document) @meta", "1\r\n");
  ScopeCompatResult *r = scope_compat_run(f.pack,f.tree,f.source,f.length,1,0,2,0,0,0);
  assert(r->status == SCOPE_COMPAT_OK && r->segment_count == 2 && r->segments[5] == 0);
  scope_compat_result_delete(r); dispose(&f);
  const uint16_t unicode[] = {0xfeff,'[','"',0xd83d,0xde00,'"',',','"',0xd800,'"',']'};
  f = fixture("(string) @string", "           ");
  memcpy(f.source, unicode, sizeof unicode);
  ts_tree_delete(f.tree);
  f.tree = ts_parser_parse_string_encoding(f.parser,NULL,(const char *)f.source,sizeof unicode,TSInputEncodingUTF16LE);
  r = run(&f);
  assert(r->status == SCOPE_COMPAT_OK); schema(r,0,f.length,2);
  scope_compat_result_delete(r); dispose(&f);
  f = fixture("((string (string_content) @_text) @string (#eq? @_text \"\xf0\x9f\x98\x80\"))", "    ");
  const uint16_t astral[] = {'"',0xd83d,0xde00,'"'};
  memcpy(f.source,astral,sizeof astral); ts_tree_delete(f.tree);
  f.tree = ts_parser_parse_string_encoding(f.parser,NULL,(const char *)f.source,sizeof astral,TSInputEncodingUTF16LE);
  r = run(&f);
  assert(r->status == SCOPE_COMPAT_OK && r->intervals_kept == 1);
  scope_compat_result_delete(r); dispose(&f);
  /* Query without a byte window to obtain the real zero-width token at EOF. */
  f = fixture("(MISSING) @missing", "{\"a\":1");
  TSQueryCursor *cursor = ts_query_cursor_new();
  ts_query_cursor_exec(cursor,f.pack->query,ts_tree_root_node(f.tree));
  TSQueryMatch match;
  assert(ts_query_cursor_next_match(cursor,&match) && match.capture_count == 1);
  TSNode missing = match.captures[0].node;
  assert(ts_node_is_missing(missing) && ts_node_start_byte(missing) == ts_node_end_byte(missing));
  ScInterval interval = {.from=ts_node_start_byte(missing)/2, .to=ts_node_end_byte(missing)/2, .scope=1, .node=missing};
  ScCollection collection = {.items=&interval, .count=1};
  sc_order(&collection);
  assert(interval.disposition == 1);
  ts_query_cursor_delete(cursor); dispose(&f);
  assert(scope_compat_live_allocations() == 0);
}

static void edge_arithmetic(void) {
  ScCollection c = {0};
  uint32_t out = 777, top = UINT32_MAX / 2;
  assert(sc_resolve_edge((ScEdge){.side=SC_AT_START, .delta=2}, top - 2, top, &out, &c) && out == top);
  assert(sc_resolve_edge((ScEdge){.side=SC_AT_END, .delta=-2}, top - 2, top, &out, &c) && out == top - 2);
  assert(!sc_resolve_edge((ScEdge){.side=SC_AT_START, .delta=-1}, 0, 2, &out, &c));
  assert(c.status == SCOPE_COMPAT_INVALID && c.detail == SCOPE_COMPAT_DETAIL_WINDOW && c.value == 0);
  assert(!sc_resolve_edge((ScEdge){.side=SC_AT_END, .delta=1}, top - 2, top, &out, &c));
  assert(c.value == top);
  assert(sc_resolve_edge((ScEdge){.side=SC_AT_START}, top, top, &out, &c) && out == top);
  assert(!sc_resolve_edge((ScEdge){.side=SC_AT_START, .delta=1}, top, top, &out, &c));
}

static void zero_width_resolver(void) {
  char source[256];
  memset(source, '[', 96);
  memcpy(source + 96, "{\"a\":1", 6);
  memset(source + 102, ']', 96); source[198] = 0;
  Fixture f = fixture("((MISSING) @_n (#text-class? @_n \"[a]\" \"[a]\") "
    "(#not-text-class? @_n \"[a]\" \"[a]\") (#starts-with? @_n \"\") "
    "(#not-starts-with? @_n \"x\"))", source);
  TSQueryCursor *cursor = ts_query_cursor_new();
  ts_query_cursor_exec(cursor, f.pack->query, ts_tree_root_node(f.tree));
  TSQueryMatch found;
  assert(ts_query_cursor_next_match(cursor, &found) && found.capture_count == 1);
  TSNode missing = found.captures[0].node, parent = missing;
  uint32_t depth = 0;
  while (!ts_node_is_null(parent)) { ++depth; parent = ts_node_parent(parent); }
  assert(ts_node_is_missing(missing) && ts_node_start_byte(missing) == ts_node_end_byte(missing));
  assert(depth > 64);
  const bool expected[] = {false, true, true, true};
  for (uint32_t i = 0; i < 4; ++i) assert(sc_predicate(f.pack, &f.pack->predicates[i], &found, f.source) == expected[i]);
  TSQueryCapture captures[] = {{ts_tree_root_node(f.tree), 0}, {missing, 1}};
  TSQueryMatch match = {.captures=captures, .capture_count=2};
  ScSpanSpec spec = {.container=0, .left={.capture=1}, .right={.capture=1, .side=SC_AT_END}};
  ScCollection c = {0}; ScInterval item = {0};
  assert(sc_node_span(missing, f.length * 2, &c));
  assert(sc_span_interval(&spec, &match, f.length, 41, &c, &item));
  assert(item.from == item.to && item.kind == SC_EDGE_SPAN_INTERVAL);
  spec.left.delta = 1;
  assert(!sc_span_interval(&spec, &match, f.length, 41, &c, &item) && c.detail == SCOPE_COMPAT_DETAIL_WINDOW);
  spec.left.delta = 0;
  captures[0].node = missing;
  assert(sc_span_interval(&spec, &match, f.length, 41, &c, &item));
  captures[1].index = 0;
  assert(!sc_span_interval(&spec, &match, f.length, 41, &c, &item) && c.detail == SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS && c.value == 41);
  printf("scope-compat real zero-width resolver ancestor depth: %u; core fallback allocation not instrumented here\n", depth);
  ts_query_cursor_delete(cursor); dispose(&f);
  assert(scope_compat_live_allocations() == 0);
}

static void ancestry_and_validation(void) {
  Fixture f = fixture("(number) @_n", "1"), other = fixture("(number) @_n", "1");
  TSNode root = ts_tree_root_node(f.tree), number = ts_node_named_child(root, 0);
  TSQueryCapture captures[] = {{number, 0}, {ts_node_named_child(ts_tree_root_node(other.tree), 0), 1}};
  TSQueryMatch match = {.captures=captures, .capture_count=2};
  ScSpanSpec spec = {.container=0, .left={.capture=1}, .right={.capture=1, .side=SC_AT_END}};
  ScCollection c = {0}; ScInterval item = {0};
  assert(ts_node_start_byte(captures[0].node) == ts_node_start_byte(captures[1].node));
  assert(ts_node_end_byte(captures[0].node) == ts_node_end_byte(captures[1].node));
  assert(!sc_span_interval(&spec, &match, f.length, 19, &c, &item));
  assert(c.detail == SCOPE_COMPAT_DETAIL_BAD_ARGUMENTS && c.value == 19);
  captures[0].node = root; captures[1].node = number;
  assert(sc_span_interval(&spec, &match, f.length, 19, &c, &item));
  TSNode odd = number; odd.context[0] = 1;
  assert(!sc_node_span(odd, 2, &c) && c.detail == SCOPE_COMPAT_DETAIL_ODD_OFFSET && c.value == 1);
  dispose(&other); dispose(&f);
  f = fixture("((number) @_n (#starts-with? @_n \"never\") (#make-span! \"x\" @_n @_n \"start\" \"0\" @_n \"end\" \"0\"))", "12");
  ScopeCompatResult *r = scope_compat_run(f.pack, f.tree, f.source, 1, 1, 0, 1, 0, 0, 0);
  assert(r->status == SCOPE_COMPAT_INVALID && r->detail == SCOPE_COMPAT_DETAIL_TREE_EXCEEDS_SOURCE);
  schema(r, 0, 1, scope_compat_pack_scope_count(f.pack)); scope_compat_result_delete(r); dispose(&f);
  assert(scope_compat_live_allocations() == 0);
}

static uint32_t leak_core(void) {
  uint32_t offset;
  TSQueryError error;
  TSQuery *query = ts_query_new(tree_sitter_json(), "(number) @n", 11, &offset, &error);
  assert(query);
  return ts_query_pattern_count(query);
}

int main(int argc, char **argv) {
  if (argc == 2 && !strcmp(argv[1], "--asan-control")) {
    volatile unsigned char *bytes = malloc(8);
    assert(bytes);
    bytes[8] = 1;
    free((void *)bytes);
    return 0;
  }
  if (argc == 2 && !strcmp(argv[1], "--ubsan-control")) {
    volatile int maximum = INT_MAX;
    printf("deliberate signed overflow: %d\n", maximum + 1);
    return 0;
  }
  if (argc == 2 && !strcmp(argv[1], "--leak-core")) {
    printf("deliberately retained core query: %u patterns\n", leak_core());
    return 0;
  }
  smoke();
  query_capabilities();
  sc_theme_tests();
  composition();
  rejection();
  predicates();
  boundaries();
  ownership_and_failures();
  exact_nodes();
  text_cases();
  edge_arithmetic();
  zero_width_resolver();
  ancestry_and_validation();
  puts("scope-compat native controls passed");
  return 0;
}

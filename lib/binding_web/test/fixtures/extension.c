// A loadExtension fixture: walks a tree through the C API, and takes the address of
// an imported libc function, which the loader resolves through GOT.func.
#include <stdlib.h>
#include <string.h>
#include <tree_sitter/api.h>

static void (*release)(void *) = free;

__attribute__((export_name("count_named")))
uint32_t count_named(const TSTree *tree) {
  TSTreeCursor cursor = ts_tree_cursor_new(ts_tree_root_node(tree));
  uint32_t count = 0;
  for (;;) {
    if (ts_node_is_named(ts_tree_cursor_current_node(&cursor))) count++;
    if (ts_tree_cursor_goto_first_child(&cursor)) continue;
    while (!ts_tree_cursor_goto_next_sibling(&cursor)) {
      if (!ts_tree_cursor_goto_parent(&cursor)) {
        ts_tree_cursor_delete(&cursor);
        return count;
      }
    }
  }
}

__attribute__((export_name("root_type_length")))
uint32_t root_type_length(const TSTree *tree) {
  char *copy = strdup(ts_node_type(ts_tree_root_node(tree)));
  uint32_t length = strlen(copy);
  release(copy);
  return length;
}

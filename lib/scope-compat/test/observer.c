#include <tree_sitter/api.h>
#include <stdlib.h>

/* Test fixture only: route core allocation calls through the observed runtime imports. */
static void *observed_malloc(size_t size) { return malloc(size); }
static void *observed_calloc(size_t count, size_t size) { return calloc(count, size); }
static void *observed_realloc(void *pointer, size_t size) { return realloc(pointer, size); }
static void observed_free(void *pointer) { free(pointer); }

__attribute__((export_name("scope_test_install")))
void scope_test_install(void) {
  ts_set_allocator(observed_malloc, observed_calloc, observed_realloc, observed_free);
}

__attribute__((export_name("scope_test_reset")))
void scope_test_reset(void) { ts_set_allocator(NULL, NULL, NULL, NULL); }

__attribute__((export_name("scope_test_grow_heap")))
size_t scope_test_grow_heap(void) { return __builtin_wasm_memory_grow(0, 1); }

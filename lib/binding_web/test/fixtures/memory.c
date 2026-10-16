#include <stdint.h>

__attribute__((import_module("env"), import_name("tree_sitter_log_callback")))
extern void log_message(int is_lex, const char *message);

__attribute__((constructor)) static void initialize(void) {
  __builtin_wasm_memory_grow(0, 1);
  log_message(0, "initialized hé 😀");
}

__attribute__((export_name("grow")))
uint32_t grow(uint32_t pages) {
  return __builtin_wasm_memory_grow(0, pages);
}

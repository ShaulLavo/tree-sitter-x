#include <stdint.h>

__attribute__((import_module("env"), import_name("tree_sitter_parse_callback")))
extern void parse_input(char *input, uint32_t index, uint32_t row, uint32_t column, uint32_t *length);

static uint32_t initialized_length = UINT32_MAX;
static char input[2];

__attribute__((constructor)) static void initialize(void) {
  __builtin_wasm_memory_grow(0, 1);
  parse_input(input, 0, 0, 0, &initialized_length);
}

__attribute__((export_name("initialized_length")))
uint32_t get_initialized_length(void) { return initialized_length; }

__attribute__((export_name("grow")))
uint32_t grow(uint32_t pages) {
  return __builtin_wasm_memory_grow(0, pages);
}

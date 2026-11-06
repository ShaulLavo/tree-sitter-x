#include "alloc.h"
#include <stdlib.h>
#include <string.h>

static uint32_t live_blocks;
#ifdef SCOPE_COMPAT_TESTING
static uint32_t fail_index = UINT32_MAX;
void scope_compat_test_fail_after(uint32_t index) { fail_index = index; }
static bool fail(void) {
  if (fail_index == UINT32_MAX) return false;
  if (fail_index == 0) return true;
  --fail_index;
  return false;
}
#else
static bool fail(void) { return false; }
#endif

void *sc_alloc(size_t count, size_t width) {
  if (width == 0 || count > SIZE_MAX / width || fail()) return NULL;
  void *pointer = calloc(count ? count : 1, width);
  if (pointer) ++live_blocks;
  return pointer;
}

void sc_free(void *pointer) {
  if (!pointer) return;
  --live_blocks;
  free(pointer);
}

bool sc_grow(void **pointer, uint32_t *capacity, uint32_t count, size_t width) {
  if (count <= *capacity) return true;
  uint32_t next = *capacity ? *capacity : 8;
  while (next < count && next <= UINT32_MAX / 2) next *= 2;
  if (next < count) next = count;
  if (width == 0 || next > SIZE_MAX / width || fail()) return false;
  void *grown = realloc(*pointer, (size_t)next * width);
  if (!grown) return false;
  if (!*pointer) ++live_blocks;
  *pointer = grown;
  *capacity = next;
  return true;
}

uint32_t sc_live(void) { return live_blocks; }

#ifndef SC_ALLOC_H_
#define SC_ALLOC_H_
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
void *sc_alloc(size_t count, size_t width);
void sc_free(void *pointer);
bool sc_grow(void **pointer, uint32_t *capacity, uint32_t count, size_t width);
uint32_t sc_live(void);
#endif

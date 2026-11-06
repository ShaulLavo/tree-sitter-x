#include "../lib/src/array.h"

#include <assert.h>

int main(void) {
  Array(int) empty = array_new();
  Array(int) target = array_new();

  array_assign(&target, &empty);
  assert(target.contents == NULL && target.size == 0 && target.capacity == 0);

  array_push(&target, 42);
  int *contents = target.contents;
  uint32_t capacity = target.capacity;
  array_assign(&target, &empty);
  assert(target.contents == contents && target.size == 0 && target.capacity == capacity);

  array_push(&target, 17);
  assert(target.contents == contents && target.size == 1 && target.contents[0] == 17);
  array_assign(&empty, &target);
  assert(empty.size == 1 && empty.contents[0] == 17);
  array_delete(&empty);
  array_delete(&target);
  return 0;
}

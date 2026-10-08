#define _GNU_SOURCE
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>

#define SIZE 65536

static atomic_int stop;
static unsigned long flip_addr;
static int flip_fd;

static void *change_maps(void *unused) {
  (void)unused;
  while (!atomic_load(&stop)) {
    void *p = mmap(NULL, SIZE, PROT_READ | PROT_WRITE,
                   MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (p == MAP_FAILED) abort();
    if (munmap(p, SIZE)) abort();
  }
  return NULL;
}

// A 32-bit guest keeps its whole address space reserved on a 64-bit host, so
// the race there mostly pairs guest permissions with a stale host path.
static void *flip_mapping(void *unused) {
  void *at = (void *)flip_addr;
  (void)unused;
  while (!atomic_load(&stop)) {
    if (mmap(at, SIZE, PROT_READ, MAP_PRIVATE | MAP_FIXED, flip_fd, 0) != at) {
      abort();
    }
    if (mmap(at, SIZE, PROT_READ | PROT_WRITE,
             MAP_PRIVATE | MAP_ANONYMOUS | MAP_FIXED, -1, 0) != at) {
      abort();
    }
  }
  return NULL;
}

// One snapshot names the backing file exactly when the flipped range is
// read-only; anything else mixes two snapshots.
static int torn(const char *line) {
  unsigned long start, end;
  char perms[5];
  int path = -1;
  sscanf(line, "%lx-%lx %4s %*s %*s %*s %n", &start, &end, perms, &path);
  if (path < 0) abort();
  if (flip_addr < start || flip_addr >= end) return 0;
  return (perms[1] == 'w') == (line[path] == '/');
}

int main(void) {
  pthread_t threads[5];
  char line[4096], first_torn[4096] = "";
  int torn_lines = 0;
  FILE *backing = tmpfile();
  if (!backing) abort();
  flip_fd = fileno(backing);
  if (ftruncate(flip_fd, SIZE)) abort();
  void *p = mmap(NULL, SIZE, PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (p == MAP_FAILED) abort();
  flip_addr = (unsigned long)p;
  for (int i = 0; i < 4; i++) {
    if (pthread_create(&threads[i], NULL, change_maps, NULL)) abort();
  }
  if (pthread_create(&threads[4], NULL, flip_mapping, NULL)) abort();
  for (int i = 0; i < 1000; i++) {
    FILE *f = fopen("/proc/self/maps", "r");
    if (!f) abort();
    while (fgets(line, sizeof line, f)) {
      if (torn(line) && !torn_lines++) strcpy(first_torn, line);
    }
    if (ferror(f)) abort();
    if (fclose(f)) abort();
  }
  atomic_store(&stop, 1);
  for (int i = 0; i < 5; i++) {
    if (pthread_join(threads[i], NULL)) abort();
  }
  if (torn_lines) {
    printf("%d mapping lines mixed two snapshots, first: %s", torn_lines,
           first_torn);
    return 1;
  }
  puts("1000 concurrent mapping snapshots passed");
  return 0;
}

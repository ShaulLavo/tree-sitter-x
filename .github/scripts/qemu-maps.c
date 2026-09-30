#define _GNU_SOURCE
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>

static atomic_int stop;

static void *change_maps(void *unused) {
(void)unused;
while (!atomic_load(&stop)) {
void *p = mmap(NULL, 65536, PROT_READ | PROT_WRITE,
   MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
if (p == MAP_FAILED) abort();
if (munmap(p, 65536)) abort();
}
return NULL;
}

int main(void) {
pthread_t threads[4];
char buf[4096];
for (int i = 0; i < 4; i++) {
if (pthread_create(&threads[i], NULL, change_maps, NULL)) abort();
}
for (int i = 0; i < 1000; i++) {
FILE *f = fopen("/proc/self/maps", "r");
if (!f) abort();
while (fread(buf, 1, sizeof buf, f)) {}
if (ferror(f)) abort();
if (fclose(f)) abort();
}
atomic_store(&stop, 1);
for (int i = 0; i < 4; i++) {
if (pthread_join(threads[i], NULL)) abort();
}
puts("1000 concurrent mapping snapshots passed");
return 0;
}

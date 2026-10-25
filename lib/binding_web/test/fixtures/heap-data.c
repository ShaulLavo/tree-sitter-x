static char data[4 * 1024 * 1024];

__attribute__((export_name("data_address")))
char *data_address(void) { return data; }

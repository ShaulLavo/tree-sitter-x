#include "array.h"
#include "point.h"

#include <tree_sitter/api.h>

// Minimal stdio replacement for the WASI browser runtime. The runtime has no
// filesystem or stdio streams (wasi-module.ts returns ERRNO_BADF for all fd_*
// calls), so replacing musl's full printf/stdio saves ~25 KB of Wasm code and
// eliminates WASI fd_* imports while preserving full C99 snprintf/vsnprintf
// semantics for ts_subtree_string and ts_parser_set_logger.
#if defined(__wasi__)
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef struct {
  bool left_justify;
  bool zero_pad;
  bool show_sign;
  bool space_sign;
  bool alt_form;
  size_t width;
  int precision;
  int length; // -2=hh, -1=h, 0=default, 1=l/z/t, 2=ll/j
} TsFmtSpec;

static void ts_fmt_putc(char *buf, size_t size, size_t *pos, char c) {
  if (buf && size > 1 && *pos < size - 1) {
    buf[*pos] = c;
  }
  (*pos)++;
}

static void ts_fmt_pad(char *buf, size_t size, size_t *pos, char c, size_t count) {
  for (size_t i = 0; i < count; i++) {
    ts_fmt_putc(buf, size, pos, c);
  }
}

static size_t ts_fmt_uint(uint64_t value, unsigned base, bool uppercase, char *out) {
  static const char lower[] = "0123456789abcdef";
  static const char upper[] = "0123456789ABCDEF";
  const char *digits = uppercase ? upper : lower;
  char rev[32];
  size_t len = 0;
  if (value == 0) {
    out[0] = '0';
    return 1;
  }
  while (value > 0) {
    rev[len++] = digits[value % base];
    value /= base;
  }
  for (size_t i = 0; i < len; i++) {
    out[i] = rev[len - 1 - i];
  }
  return len;
}

static const char *ts_fmt_parse_spec(const char *p, va_list *args, TsFmtSpec *spec) {
  *spec = (TsFmtSpec){.precision = -1};
  for (; *p; p++) {
    if (*p == '-') spec->left_justify = true;
    else if (*p == '0') spec->zero_pad = true;
    else if (*p == '+') spec->show_sign = true;
    else if (*p == ' ') spec->space_sign = true;
    else if (*p == '#') spec->alt_form = true;
    else break;
  }

  if (*p == '*') {
    int w = va_arg(*args, int);
    spec->left_justify |= w < 0;
    spec->width = w < 0 ? (size_t)(-(unsigned)w) : (size_t)w;
    p++;
  } else {
    while (*p >= '0' && *p <= '9') {
      spec->width = spec->width * 10 + (size_t)(*p++ - '0');
    }
  }

  if (*p == '.') {
    p++;
    if (*p == '*') {
      int prec = va_arg(*args, int);
      spec->precision = prec < 0 ? -1 : prec;
      p++;
    } else {
      spec->precision = 0;
      while (*p >= '0' && *p <= '9') {
        spec->precision = spec->precision * 10 + (*p++ - '0');
      }
    }
  }

  if (*p == 'h') {
    p++;
    spec->length = (*p == 'h') ? (p++, -2) : -1;
  } else if (*p == 'l') {
    p++;
    spec->length = (*p == 'l') ? (p++, 2) : 1;
  } else if (*p == 'z' || *p == 't') {
    spec->length = 1;
    p++;
  } else if (*p == 'j') {
    spec->length = 2;
    p++;
  }
  return p;
}

static void ts_fmt_string(
  char *buf, size_t size, size_t *pos, const TsFmtSpec *spec, const char *str
) {
  if (!str) str = "(null)";
  size_t len = 0;
  if (spec->precision >= 0) {
    while (len < (size_t)spec->precision && str[len]) len++;
  } else {
    len = strlen(str);
  }
  size_t pad = spec->width > len ? spec->width - len : 0;
  if (!spec->left_justify) ts_fmt_pad(buf, size, pos, ' ', pad);
  for (size_t i = 0; i < len; i++) ts_fmt_putc(buf, size, pos, str[i]);
  if (spec->left_justify) ts_fmt_pad(buf, size, pos, ' ', pad);
}

static int64_t ts_fmt_read_signed(va_list *args, int length) {
  if (length == 2) return va_arg(*args, long long);
  if (length == 1) return va_arg(*args, long);
  if (length == -1) return (short)va_arg(*args, int);
  if (length == -2) return (signed char)va_arg(*args, int);
  return va_arg(*args, int);
}

static uint64_t ts_fmt_read_unsigned(va_list *args, int length) {
  if (length == 2) return va_arg(*args, unsigned long long);
  if (length == 1) return va_arg(*args, unsigned long);
  if (length == -1) return (unsigned short)va_arg(*args, unsigned int);
  if (length == -2) return (unsigned char)va_arg(*args, unsigned int);
  return va_arg(*args, unsigned int);
}

static void ts_fmt_integer(
  char *buf, size_t size, size_t *pos, const TsFmtSpec *spec, char conv, va_list *args
) {
  char prefix[2];
  size_t prefix_len = 0;
  uint64_t uval = 0;
  unsigned base = 10;
  bool uppercase = (conv == 'X');

  if (conv == 'd' || conv == 'i') {
    int64_t sval = ts_fmt_read_signed(args, spec->length);
    if (sval < 0) {
      prefix[prefix_len++] = '-';
      uval = -(uint64_t)sval;
    } else {
      if (spec->show_sign) prefix[prefix_len++] = '+';
      else if (spec->space_sign) prefix[prefix_len++] = ' ';
      uval = (uint64_t)sval;
    }
  } else if (conv == 'p') {
    uval = (uintptr_t)va_arg(*args, void *);
    base = 16;
    prefix[prefix_len++] = '0';
    prefix[prefix_len++] = 'x';
  } else {
    if (conv == 'o') base = 8;
    else if (conv == 'x' || conv == 'X') base = 16;
    uval = ts_fmt_read_unsigned(args, spec->length);
    if (spec->alt_form && uval != 0 && base != 10) {
      prefix[prefix_len++] = '0';
      if (base == 16) prefix[prefix_len++] = uppercase ? 'X' : 'x';
    }
  }

  char digits[32];
  size_t digit_len = (uval == 0 && spec->precision == 0)
    ? 0
    : ts_fmt_uint(uval, base, uppercase, digits);
  size_t prec_zeros = (spec->precision > 0 && (size_t)spec->precision > digit_len)
    ? (size_t)spec->precision - digit_len
    : 0;
  size_t total_len = prefix_len + prec_zeros + digit_len;
  size_t pad = spec->width > total_len ? spec->width - total_len : 0;
  bool use_zero = spec->zero_pad && !spec->left_justify && spec->precision < 0;

  if (!spec->left_justify && !use_zero) ts_fmt_pad(buf, size, pos, ' ', pad);
  for (size_t i = 0; i < prefix_len; i++) ts_fmt_putc(buf, size, pos, prefix[i]);
  if (use_zero) ts_fmt_pad(buf, size, pos, '0', pad);
  ts_fmt_pad(buf, size, pos, '0', prec_zeros);
  for (size_t i = 0; i < digit_len; i++) ts_fmt_putc(buf, size, pos, digits[i]);
  if (spec->left_justify) ts_fmt_pad(buf, size, pos, ' ', pad);
}

int vsnprintf(char *restrict buffer, size_t buffsz, const char *restrict format, va_list args) {
  if (!format) return -1;
  va_list ap;
  va_copy(ap, args);
  size_t pos = 0;
  for (const char *p = format; *p; p++) {
    if (*p != '%') {
      ts_fmt_putc(buffer, buffsz, &pos, *p);
      continue;
    }
    p++;
    if (*p == '%') {
      ts_fmt_putc(buffer, buffsz, &pos, '%');
      continue;
    }
    if (!*p) break;

    TsFmtSpec spec;
    p = ts_fmt_parse_spec(p, &ap, &spec);
    if (!*p) break;

    if (*p == 's') {
      ts_fmt_string(buffer, buffsz, &pos, &spec, va_arg(ap, const char *));
    } else if (*p == 'c') {
      char ch = (char)va_arg(ap, int);
      size_t pad = spec.width > 1 ? spec.width - 1 : 0;
      if (!spec.left_justify) ts_fmt_pad(buffer, buffsz, &pos, ' ', pad);
      ts_fmt_putc(buffer, buffsz, &pos, ch);
      if (spec.left_justify) ts_fmt_pad(buffer, buffsz, &pos, ' ', pad);
    } else if (
      *p == 'd' || *p == 'i' || *p == 'u' || *p == 'o' || *p == 'x' || *p == 'X' || *p == 'p'
    ) {
      ts_fmt_integer(buffer, buffsz, &pos, &spec, *p, &ap);
    } else {
      ts_fmt_putc(buffer, buffsz, &pos, '%');
      ts_fmt_putc(buffer, buffsz, &pos, *p);
    }
  }
  va_end(ap);

  if (buffer && buffsz > 0) {
    buffer[pos < buffsz ? pos : buffsz - 1] = '\0';
  }
  return (int)pos;
}

int snprintf(char *restrict buffer, size_t buffsz, const char *restrict format, ...) {
  va_list args;
  va_start(args, format);
  int result = vsnprintf(buffer, buffsz, format, args);
  va_end(args);
  return result;
}

int vfprintf(FILE *restrict stream, const char *restrict format, va_list args) {
  (void)stream;
  (void)format;
  (void)args;
  return 0;
}

int fprintf(FILE *restrict stream, const char *restrict format, ...) {
  (void)stream;
  (void)format;
  return 0;
}

FILE *fdopen(int fd, const char *mode) {
  (void)fd;
  (void)mode;
  return NULL;
}

int fclose(FILE *stream) {
  (void)stream;
  return 0;
}

int fputc(int c, FILE *stream) {
  (void)stream;
  return c;
}

int fputs(const char *restrict str, FILE *restrict stream) {
  (void)str;
  (void)stream;
  return 0;
}

size_t fwrite(const void *restrict buffer, size_t size, size_t nmemb, FILE *restrict stream) {
  (void)buffer;
  (void)size;
  (void)stream;
  return nmemb;
}
#endif

// Callbacks into JS. Built with the WASI SDK, they are explicit imports from `env`.
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define JS_IMPORT(name)
#else
#define JS_IMPORT(name) __attribute__((import_module("env"), import_name(name)))
#endif

/*****************************/
/* Section - Data marshaling */
/*****************************/

static const uint32_t INPUT_BUFFER_SIZE = 10 * 1024;

const void *TRANSFER_BUFFER[12] = {
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
};

static const int SIZE_OF_CURSOR = 4;
static const int SIZE_OF_NODE = 5;
static const int SIZE_OF_POINT = 2;
static const int SIZE_OF_RANGE = 2 + (2 * SIZE_OF_POINT);
static const int SIZE_OF_CAPTURE = 1 + SIZE_OF_NODE;

void *ts_init() {
  TRANSFER_BUFFER[0] = (const void *)TREE_SITTER_LANGUAGE_VERSION;
  TRANSFER_BUFFER[1] = (const void *)TREE_SITTER_MIN_COMPATIBLE_LANGUAGE_VERSION;
  return (void*)TRANSFER_BUFFER;
}

static uint32_t code_unit_to_byte(uint32_t unit) {
  return unit << 1;
}

static uint32_t byte_to_code_unit(uint32_t byte) {
  return byte >> 1;
}

static inline void marshal_node(const void **buffer, TSNode node) {
  buffer[0] = node.id;
  buffer[1] = (const void *)byte_to_code_unit(node.context[0]);
  buffer[2] = (const void *)node.context[1];
  buffer[3] = (const void *)byte_to_code_unit(node.context[2]);
  buffer[4] = (const void *)node.context[3];
}

static inline TSNode unmarshal_node_at(const TSTree *tree, uint32_t index) {
  TSNode node;
  const void **buffer = TRANSFER_BUFFER + index * SIZE_OF_NODE;
  node.id = buffer[0];
  node.context[0] = code_unit_to_byte((uint32_t)buffer[1]);
  node.context[1] = (uint32_t)buffer[2];
  node.context[2] = code_unit_to_byte((uint32_t)buffer[3]);
  node.context[3] = (uint32_t)buffer[4];
  node.tree = tree;
  return node;
}

static inline TSNode unmarshal_node(const TSTree *tree) {
  return unmarshal_node_at(tree, 0);
}

static inline void marshal_cursor(const TSTreeCursor *cursor) {
  TRANSFER_BUFFER[0] = cursor->id;
  TRANSFER_BUFFER[1] = (const void *)cursor->context[0];
  TRANSFER_BUFFER[2] = (const void *)cursor->context[1];
  TRANSFER_BUFFER[3] = (const void *)cursor->context[2];
}

static inline TSTreeCursor unmarshal_cursor(const void **buffer, const TSTree *tree) {
  TSTreeCursor cursor;
  cursor.id = buffer[0];
  cursor.context[0] = (uint32_t)buffer[1];
  cursor.context[1] = (uint32_t)buffer[2];
  cursor.context[2] = (uint32_t)buffer[3];
  cursor.tree = tree;
  return cursor;
}

static void marshal_point(TSPoint point) {
  TRANSFER_BUFFER[0] = (const void *)point.row;
  TRANSFER_BUFFER[1] = (const void *)byte_to_code_unit(point.column);
}

static TSPoint unmarshal_point(const void **address) {
  TSPoint point;
  point.row = (uint32_t)address[0];
  point.column = code_unit_to_byte((uint32_t)address[1]);
  return point;
}

static void marshal_range(TSRange *range) {
  range->start_byte = byte_to_code_unit(range->start_byte);
  range->end_byte = byte_to_code_unit(range->end_byte);
  range->start_point.column = byte_to_code_unit(range->start_point.column);
  range->end_point.column = byte_to_code_unit(range->end_point.column);
}

static void unmarshal_range(TSRange *range) {
  range->start_byte = code_unit_to_byte(range->start_byte);
  range->end_byte = code_unit_to_byte(range->end_byte);
  range->start_point.column = code_unit_to_byte(range->start_point.column);
  range->end_point.column = code_unit_to_byte(range->end_point.column);
}

static TSInputEdit unmarshal_edit() {
  TSInputEdit edit;
  const void **address = TRANSFER_BUFFER;
  edit.start_point = unmarshal_point(address); address += SIZE_OF_POINT;
  edit.old_end_point = unmarshal_point(address); address += SIZE_OF_POINT;
  edit.new_end_point = unmarshal_point(address); address += SIZE_OF_POINT;
  edit.start_byte = code_unit_to_byte((uint32_t)*address); address += 1;
  edit.old_end_byte = code_unit_to_byte((uint32_t)*address); address += 1;
  edit.new_end_byte = code_unit_to_byte((uint32_t)*address); address += 1;
  return edit;
}

static void marshal_language_metadata(const TSLanguageMetadata *metadata) {
  if (metadata == NULL) {
    TRANSFER_BUFFER[0] = 0;
    return;
  }
  TRANSFER_BUFFER[0] = (const void*)3;
  TRANSFER_BUFFER[1] = (const void*)(uint32_t)metadata->major_version;
  TRANSFER_BUFFER[2] = (const void*)(uint32_t)metadata->minor_version;
  TRANSFER_BUFFER[3] = (const void*)(uint32_t)metadata->patch_version;
}

/********************/
/* Section - Parser */
/********************/

JS_IMPORT("tree_sitter_parse_callback") extern void tree_sitter_parse_callback(
  char *input_buffer,
  uint32_t index,
  uint32_t row,
  uint32_t column,
  uint32_t *length_read
);

JS_IMPORT("tree_sitter_log_callback") extern void tree_sitter_log_callback(
  bool is_lex_message,
  const char *message
);

JS_IMPORT("tree_sitter_progress_callback") extern bool tree_sitter_progress_callback(
  uint32_t current_offset,
  bool has_error
);

JS_IMPORT("tree_sitter_query_progress_callback") extern bool tree_sitter_query_progress_callback(
  uint32_t current_offset
);

static const char *call_parse_callback(
  void *payload,
  uint32_t byte,
  TSPoint position,
  uint32_t *bytes_read
) {
  char *buffer = (char *)payload;
  tree_sitter_parse_callback(
    buffer,
    byte_to_code_unit(byte),
    position.row,
    byte_to_code_unit(position.column),
    bytes_read
  );
  *bytes_read = code_unit_to_byte(*bytes_read);
  if (*bytes_read >= INPUT_BUFFER_SIZE) {
    *bytes_read = INPUT_BUFFER_SIZE - 2;
  }
  return buffer;
}

static void call_log_callback(
  void *payload,
  TSLogType log_type,
  const char *message
) {
  tree_sitter_log_callback(log_type == TSLogTypeLex, message);
}

static bool progress_callback(
  TSParseState *state
) {
  return tree_sitter_progress_callback(state->current_byte_offset, state->has_error);
}

static bool query_progress_callback(
  TSQueryCursorState *state
) {
  return tree_sitter_query_progress_callback(state->current_byte_offset);
}

void ts_parser_new_wasm() {
  TSParser *parser = ts_parser_new();
  char *input_buffer = calloc(INPUT_BUFFER_SIZE, sizeof(char));
  TRANSFER_BUFFER[0] = parser;
  TRANSFER_BUFFER[1] = input_buffer;
}

void ts_parser_enable_logger_wasm(TSParser *self, bool should_log) {
  TSLogger logger = {self, should_log ? call_log_callback : NULL};
  ts_parser_set_logger(self, logger);
}

// The caller owns ranges, including when native validation rejects them.
static bool set_included_ranges(TSParser *self, TSRange *ranges, uint32_t range_count) {
  for (unsigned i = 0; i < range_count; i++) {
    unmarshal_range(&ranges[i]);
  }
  return ts_parser_set_included_ranges(self, ranges, range_count);
}

// -1 is distinct from an aligned tree pointer or NULL.
intptr_t ts_parser_parse_wasm(
  TSParser *self,
  char *input_buffer,
  const TSTree *old_tree,
  TSRange *ranges,
  uint32_t range_count
) {
  bool has_progress = TRANSFER_BUFFER[0] != NULL;
  TSInput input = {
    input_buffer,
    call_parse_callback,
    TSInputEncodingUTF16LE,
    NULL,
  };
  if (!set_included_ranges(self, ranges, range_count)) return -1;

  TSParseOptions options = {
    .payload = NULL,
    .progress_callback = has_progress ? progress_callback : NULL,
  };

  return (intptr_t)ts_parser_parse_with_options(self, old_tree, input, options);
}

typedef struct {
  const char *text;
  uint32_t length;
} TextInput;

static const char *read_text_input(
  void *payload,
  uint32_t byte,
  TSPoint position,
  uint32_t *bytes_read
) {
  (void)position;
  const TextInput *input = payload;
  if (byte >= input->length) {
    *bytes_read = 0;
    return "";
  }
  *bytes_read = input->length - byte;
  return input->text + byte;
}

// Parses UTF-16 text already in the module's memory, with no call back into JS
// for input. `length` is in bytes.
intptr_t ts_parser_parse_utf16_wasm(
  TSParser *self,
  const char *text,
  uint32_t length,
  const TSTree *old_tree,
  TSRange *ranges,
  uint32_t range_count
) {
  bool has_progress = TRANSFER_BUFFER[0] != NULL;
  TextInput text_input = {text, length};
  TSInput input = {&text_input, read_text_input, TSInputEncodingUTF16LE, NULL};
  if (!set_included_ranges(self, ranges, range_count)) return -1;

  TSParseOptions options = {
    .payload = NULL,
    .progress_callback = has_progress ? progress_callback : NULL,
  };

  return (intptr_t)ts_parser_parse_with_options(self, old_tree, input, options);
}

void ts_parser_included_ranges_wasm(TSParser *self) {
  uint32_t range_count = 0;
  const TSRange *ranges = ts_parser_included_ranges(self, &range_count);
  TSRange *copied_ranges = malloc(sizeof(TSRange) * range_count);
  memcpy(copied_ranges, ranges, sizeof(TSRange) * range_count);
  for (unsigned i = 0; i < range_count; i++) {
    marshal_range(&copied_ranges[i]);
  }
  TRANSFER_BUFFER[0] = range_count ? (const void *)range_count : NULL;
  TRANSFER_BUFFER[1] = copied_ranges;
}

/**********************/
/* Section - Language */
/**********************/

int ts_language_type_is_named_wasm(const TSLanguage *self, TSSymbol typeId) {
  const TSSymbolType symbolType = ts_language_symbol_type(self, typeId);
  return symbolType == TSSymbolTypeRegular;
}

int ts_language_type_is_visible_wasm(const TSLanguage *self, TSSymbol typeId) {
  const TSSymbolType symbolType = ts_language_symbol_type(self, typeId);
  return symbolType <= TSSymbolTypeAnonymous;
}

void ts_language_metadata_wasm(const TSLanguage *self) {
  const TSLanguageMetadata *metadata = ts_language_metadata(self);
  marshal_language_metadata(metadata);
}

void ts_language_supertypes_wasm(const TSLanguage *self) {
  uint32_t length;
  const TSSymbol *supertypes = ts_language_supertypes(self, &length);
  TRANSFER_BUFFER[0] = (const void *)length;
  TRANSFER_BUFFER[1] = supertypes;
}

void ts_language_subtypes_wasm(const TSLanguage *self, TSSymbol supertype) {
  uint32_t length;
  const TSSymbol *subtypes = ts_language_subtypes(self, supertype, &length);
  TRANSFER_BUFFER[0] = (const void *)length;
  TRANSFER_BUFFER[1] = subtypes;
}

/******************/
/* Section - Tree */
/******************/

void ts_tree_root_node_wasm(const TSTree *tree) {
  marshal_node(TRANSFER_BUFFER, ts_tree_root_node(tree));
}

void ts_tree_root_node_with_offset_wasm(const TSTree *tree) {
  // read int and point from transfer buffer
  const void **address = TRANSFER_BUFFER + SIZE_OF_NODE;
  uint32_t offset = code_unit_to_byte((uint32_t)address[0]);
  TSPoint extent = unmarshal_point(address + 1);
  TSNode node = ts_tree_root_node_with_offset(tree, offset, extent);
  marshal_node(TRANSFER_BUFFER, node);
}

void ts_tree_edit_wasm(TSTree *tree) {
  TSInputEdit edit = unmarshal_edit();
  ts_tree_edit(tree, &edit);
}

void ts_tree_included_ranges_wasm(const TSTree *tree) {
  uint32_t range_count;
  TSRange *ranges = ts_tree_included_ranges(tree, &range_count);
  for (unsigned i = 0; i < range_count; i++) {
    marshal_range(&ranges[i]);
  }
  TRANSFER_BUFFER[0] = (range_count ? (const void *)range_count : NULL);
  TRANSFER_BUFFER[1] = (const void *)ranges;
}

void ts_tree_get_changed_ranges_wasm(TSTree *tree, TSTree *other) {
  unsigned range_count;
  TSRange *ranges = ts_tree_get_changed_ranges(tree, other, &range_count);
  for (unsigned i = 0; i < range_count; i++) {
    marshal_range(&ranges[i]);
  }
  TRANSFER_BUFFER[0] = (const void *)range_count;
  TRANSFER_BUFFER[1] = (const void *)ranges;
}

/************************/
/* Section - TreeCursor */
/************************/

void ts_tree_cursor_new_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  TSTreeCursor cursor = ts_tree_cursor_new(node);
  marshal_cursor(&cursor);
}

void ts_tree_cursor_copy_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSTreeCursor copy = ts_tree_cursor_copy(&cursor);
  marshal_cursor(&copy);
}

void ts_tree_cursor_delete_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  ts_tree_cursor_delete(&cursor);
}

void ts_tree_cursor_reset_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  TSTreeCursor cursor = unmarshal_cursor(&TRANSFER_BUFFER[SIZE_OF_NODE], tree);
  ts_tree_cursor_reset(&cursor, node);
  marshal_cursor(&cursor);
}

void ts_tree_cursor_reset_to_wasm(const TSTree *_dst, const TSTree *_src) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, _dst);
  TSTreeCursor src = unmarshal_cursor(&TRANSFER_BUFFER[SIZE_OF_CURSOR], _src);
  ts_tree_cursor_reset_to(&cursor, &src);
  marshal_cursor(&cursor);
}

bool ts_tree_cursor_goto_first_child_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  bool result = ts_tree_cursor_goto_first_child(&cursor);
  marshal_cursor(&cursor);
  return result;
}

bool ts_tree_cursor_goto_last_child_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  bool result = ts_tree_cursor_goto_last_child(&cursor);
  marshal_cursor(&cursor);
  return result;
}

bool ts_tree_cursor_goto_first_child_for_index_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  const void **address = TRANSFER_BUFFER + SIZE_OF_CURSOR;
  uint32_t index = code_unit_to_byte((uint32_t)address[0]);
  bool result = ts_tree_cursor_goto_first_child_for_byte(&cursor, index) >= 0;
  marshal_cursor(&cursor);
  return result;
}

bool ts_tree_cursor_goto_first_child_for_position_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  const void **address = TRANSFER_BUFFER + SIZE_OF_CURSOR;
  TSPoint point = unmarshal_point(address);
  bool result = ts_tree_cursor_goto_first_child_for_point(&cursor, point) >= 0;
  marshal_cursor(&cursor);
  return result;
}

bool ts_tree_cursor_goto_next_sibling_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  bool result = ts_tree_cursor_goto_next_sibling(&cursor);
  marshal_cursor(&cursor);
  return result;
}

bool ts_tree_cursor_goto_previous_sibling_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  bool result = ts_tree_cursor_goto_previous_sibling(&cursor);
  marshal_cursor(&cursor);
  return result;
}

void ts_tree_cursor_goto_descendant_wasm(const TSTree *tree, uint32_t goal_descendant_index) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  ts_tree_cursor_goto_descendant(&cursor, goal_descendant_index);
  marshal_cursor(&cursor);
}

bool ts_tree_cursor_goto_parent_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  bool result = ts_tree_cursor_goto_parent(&cursor);
  marshal_cursor(&cursor);
  return result;
}

uint16_t ts_tree_cursor_current_node_type_id_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  return ts_node_symbol(node);
}

uint16_t ts_tree_cursor_current_node_state_id_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  return ts_node_parse_state(node);
}

bool ts_tree_cursor_current_node_is_named_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  return ts_node_is_named(node);
}

bool ts_tree_cursor_current_node_is_missing_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  return ts_node_is_missing(node);
}

uint32_t ts_tree_cursor_current_node_id_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  return (uint32_t)node.id;
}

void ts_tree_cursor_start_position_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  marshal_point(ts_node_start_point(node));
}

void ts_tree_cursor_end_position_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  marshal_point(ts_node_end_point(node));
}

uint32_t ts_tree_cursor_start_index_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  return byte_to_code_unit(ts_node_start_byte(node));
}

uint32_t ts_tree_cursor_end_index_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  TSNode node = ts_tree_cursor_current_node(&cursor);
  return byte_to_code_unit(ts_node_end_byte(node));
}

uint32_t ts_tree_cursor_current_field_id_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  return ts_tree_cursor_current_field_id(&cursor);
}

uint32_t ts_tree_cursor_current_depth_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  return ts_tree_cursor_current_depth(&cursor);
}

uint32_t ts_tree_cursor_current_descendant_index_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  return ts_tree_cursor_current_descendant_index(&cursor);
}

void ts_tree_cursor_current_node_wasm(const TSTree *tree) {
  TSTreeCursor cursor = unmarshal_cursor(TRANSFER_BUFFER, tree);
  marshal_node(TRANSFER_BUFFER, ts_tree_cursor_current_node(&cursor));
}

/******************/
/* Section - Node */
/******************/

static TSTreeCursor scratch_cursor = {0};
static TSQueryCursor *scratch_query_cursor = NULL;

uint16_t ts_node_symbol_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_symbol(node);
}

const char *ts_node_field_name_for_child_wasm(const TSTree *tree, uint32_t index) {
  TSNode node = unmarshal_node(tree);
  return ts_node_field_name_for_child(node, index);
}

const char *ts_node_field_name_for_named_child_wasm(const TSTree *tree, uint32_t index) {
  TSNode node = unmarshal_node(tree);
  return ts_node_field_name_for_named_child(node, index);
}

void ts_node_children_by_field_id_wasm(const TSTree *tree, uint32_t field_id) {
  TSNode node = unmarshal_node(tree);
  TSTreeCursor cursor = ts_tree_cursor_new(node);

  bool done = field_id == 0;
  if (!done) {
    ts_tree_cursor_reset(&cursor, node);
    ts_tree_cursor_goto_first_child(&cursor);
  }

  Array(const void*) result = array_new();

  while (!done) {
    while (ts_tree_cursor_current_field_id(&cursor) != field_id) {
      if (!ts_tree_cursor_goto_next_sibling(&cursor)) {
        done = true;
        break;
      }
    }
    if (done) {
      break;
    }
    TSNode result_node = ts_tree_cursor_current_node(&cursor);
    if (!ts_tree_cursor_goto_next_sibling(&cursor)) {
      done = true;
    }
    array_grow_by(&result, SIZE_OF_NODE);
    marshal_node(result.contents + result.size - SIZE_OF_NODE, result_node);
  }
  ts_tree_cursor_delete(&cursor);

  TRANSFER_BUFFER[0] = (const void*)(result.size / SIZE_OF_NODE);
  TRANSFER_BUFFER[1] = (const void*)result.contents;
}

void ts_node_first_child_for_byte_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  const void** address = TRANSFER_BUFFER + SIZE_OF_NODE;
  uint32_t byte = code_unit_to_byte((uint32_t)address[0]);
  marshal_node(TRANSFER_BUFFER, ts_node_first_child_for_byte(node, byte));
}

void ts_node_first_named_child_for_byte_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  const void** address = TRANSFER_BUFFER + SIZE_OF_NODE;
  uint32_t byte = code_unit_to_byte((uint32_t)address[0]);
  marshal_node(TRANSFER_BUFFER, ts_node_first_named_child_for_byte(node, byte));
}

uint16_t ts_node_grammar_symbol_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_grammar_symbol(node);
}

uint32_t ts_node_child_count_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_child_count(node);
}

uint32_t ts_node_named_child_count_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_named_child_count(node);
}

void ts_node_child_wasm(const TSTree *tree, uint32_t index) {
  TSNode node = unmarshal_node(tree);
  marshal_node(TRANSFER_BUFFER, ts_node_child(node, index));
}

void ts_node_named_child_wasm(const TSTree *tree, uint32_t index) {
  TSNode node = unmarshal_node(tree);
  marshal_node(TRANSFER_BUFFER, ts_node_named_child(node, index));
}

void ts_node_child_by_field_id_wasm(const TSTree *tree, uint32_t field_id) {
  TSNode node = unmarshal_node(tree);
  marshal_node(TRANSFER_BUFFER, ts_node_child_by_field_id(node, field_id));
}

void ts_node_next_sibling_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  marshal_node(TRANSFER_BUFFER, ts_node_next_sibling(node));
}

void ts_node_prev_sibling_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  marshal_node(TRANSFER_BUFFER, ts_node_prev_sibling(node));
}

void ts_node_next_named_sibling_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  marshal_node(TRANSFER_BUFFER, ts_node_next_named_sibling(node));
}

void ts_node_prev_named_sibling_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  marshal_node(TRANSFER_BUFFER, ts_node_prev_named_sibling(node));
}

uint32_t ts_node_descendant_count_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_descendant_count(node);
}

void ts_node_parent_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  marshal_node(TRANSFER_BUFFER, ts_node_parent(node));
}

void ts_node_child_with_descendant_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  TSNode descendant = unmarshal_node_at(tree, 1);
  marshal_node(TRANSFER_BUFFER, ts_node_child_with_descendant(node, descendant));
}

void ts_node_descendant_for_index_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  const void **address = TRANSFER_BUFFER + SIZE_OF_NODE;
  uint32_t start = code_unit_to_byte((uint32_t)address[0]);
  uint32_t end = code_unit_to_byte((uint32_t)address[1]);
  marshal_node(TRANSFER_BUFFER, ts_node_descendant_for_byte_range(node, start, end));
}

void ts_node_named_descendant_for_index_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  const void **address = TRANSFER_BUFFER + SIZE_OF_NODE;
  uint32_t start = code_unit_to_byte((uint32_t)address[0]);
  uint32_t end = code_unit_to_byte((uint32_t)address[1]);
  marshal_node(TRANSFER_BUFFER, ts_node_named_descendant_for_byte_range(node, start, end));
}

void ts_node_descendant_for_position_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  const void **address = TRANSFER_BUFFER + SIZE_OF_NODE;
  TSPoint start = unmarshal_point(address); address += SIZE_OF_POINT;
  TSPoint end = unmarshal_point(address);
  marshal_node(TRANSFER_BUFFER, ts_node_descendant_for_point_range(node, start, end));
}

void ts_node_named_descendant_for_position_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  const void **address = TRANSFER_BUFFER + SIZE_OF_NODE;
  TSPoint start = unmarshal_point(address); address += SIZE_OF_POINT;
  TSPoint end = unmarshal_point(address);
  marshal_node(TRANSFER_BUFFER, ts_node_named_descendant_for_point_range(node, start, end));
}

void ts_node_start_point_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  marshal_point(ts_node_start_point(node));
}

void ts_node_end_point_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  marshal_point(ts_node_end_point(node));
}

uint32_t ts_node_start_index_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return byte_to_code_unit(ts_node_start_byte(node));
}

uint32_t ts_node_end_index_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return byte_to_code_unit(ts_node_end_byte(node));
}

char *ts_node_to_string_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_string(node);
}

void ts_node_children_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  uint32_t count = ts_node_child_count(node);
  const void **result = NULL;
  if (count > 0) {
    result = (const void**)calloc(sizeof(void *), SIZE_OF_NODE * count);
    const void **address = result;
    ts_tree_cursor_reset(&scratch_cursor, node);
    ts_tree_cursor_goto_first_child(&scratch_cursor);
    marshal_node(address, ts_tree_cursor_current_node(&scratch_cursor));
    for (uint32_t i = 1; i < count; i++) {
      address += SIZE_OF_NODE;
      ts_tree_cursor_goto_next_sibling(&scratch_cursor);
      TSNode child = ts_tree_cursor_current_node(&scratch_cursor);
      marshal_node(address, child);
    }
  }
  TRANSFER_BUFFER[0] = (const void *)count;
  TRANSFER_BUFFER[1] = (const void *)result;
}

void ts_node_named_children_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  uint32_t count = ts_node_named_child_count(node);
  const void **result = NULL;
  if (count > 0) {
    result = (const void**)calloc(sizeof(void *), SIZE_OF_NODE * count);
    const void **address = result;
    ts_tree_cursor_reset(&scratch_cursor, node);
    ts_tree_cursor_goto_first_child(&scratch_cursor);
    uint32_t i = 0;
    for (;;) {
      TSNode child = ts_tree_cursor_current_node(&scratch_cursor);
      if (ts_node_is_named(child)) {
        marshal_node(address, child);
        address += SIZE_OF_NODE;
        i++;
        if (i == count) {
          break;
        }
      }
      if (!ts_tree_cursor_goto_next_sibling(&scratch_cursor)) {
        break;
      }
    }
  }
  TRANSFER_BUFFER[0] = (const void *)count;
  TRANSFER_BUFFER[1] = (const void *)result;
}

bool symbols_contain(const uint32_t *set, uint32_t length, uint32_t value) {
  for (unsigned i = 0; i < length; i++) {
    if (set[i] == value) {
      return true;
    }
    if (set[i] > value) {
      break;
    }
  }
  return false;
}

void ts_node_descendants_of_type_wasm(
  const TSTree *tree,
  const uint32_t *symbols,
  uint32_t symbol_count,
  uint32_t start_row,
  uint32_t start_column,
  uint32_t end_row,
  uint32_t end_column
) {
  TSNode node = unmarshal_node(tree);
  TSPoint start_point = {start_row, code_unit_to_byte(start_column)};
  TSPoint end_point = {end_row, code_unit_to_byte(end_column)};
  if (end_point.row == 0 && end_point.column == 0) {
    end_point = (TSPoint) {UINT32_MAX, UINT32_MAX};
  }

  Array(const void *) result = array_new();

  // Walk the tree depth first looking for matching nodes.
  ts_tree_cursor_reset(&scratch_cursor, node);
  bool already_visited_children = false;
  while (true) {
    TSNode descendant = ts_tree_cursor_current_node(&scratch_cursor);

    if (!already_visited_children) {
      // If this node is before the selected range, then avoid
      // descending into it.
      if (point_lte(ts_node_end_point(descendant), start_point)) {
        if (ts_tree_cursor_goto_next_sibling(&scratch_cursor)) {
          already_visited_children = false;
        } else {
          if (!ts_tree_cursor_goto_parent(&scratch_cursor)) {
            break;
          }
          already_visited_children = true;
        }
        continue;
      }

      // If this node is after the selected range, then stop walking.
      if (point_lte(end_point, ts_node_start_point(descendant))) {
        break;
      }

      // Add the node to the result if its type matches one of the given
      // node types.
      if (symbols_contain(symbols, symbol_count, ts_node_symbol(descendant))) {
        array_grow_by(&result, SIZE_OF_NODE);
        marshal_node(result.contents + result.size - SIZE_OF_NODE, descendant);
      }

      // Continue walking.
      if (ts_tree_cursor_goto_first_child(&scratch_cursor)) {
        already_visited_children = false;
      } else if (ts_tree_cursor_goto_next_sibling(&scratch_cursor)) {
        already_visited_children = false;
      } else {
        if (!ts_tree_cursor_goto_parent(&scratch_cursor)) {
          break;
        }
        already_visited_children = true;
      }
    } else {
      if (ts_tree_cursor_goto_next_sibling(&scratch_cursor)) {
        already_visited_children = false;
      } else {
        if (!ts_tree_cursor_goto_parent(&scratch_cursor)) {
          break;
        }
      }
    }
  }

  TRANSFER_BUFFER[0] = (const void *)(result.size / SIZE_OF_NODE);
  TRANSFER_BUFFER[1] = (const void *)result.contents;
}

int ts_node_is_named_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_is_named(node);
}

int ts_node_has_changes_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_has_changes(node);
}

int ts_node_has_error_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_has_error(node);
}

int ts_node_is_error_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_is_error(node);
}

int ts_node_is_missing_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_is_missing(node);
}

int ts_node_is_extra_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_is_extra(node);
}

uint16_t ts_node_parse_state_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_parse_state(node);
}

uint16_t ts_node_next_parse_state_wasm(const TSTree *tree) {
  TSNode node = unmarshal_node(tree);
  return ts_node_next_parse_state(node);
}

/******************/
/* Section - Query */
/******************/

static const TSQueryCursorOptions QUERY_CURSOR_PROGRESS_OPTIONS = {
  .payload = NULL,
  .progress_callback = query_progress_callback,
};

static void exec_query_cursor(
  const TSQuery *self,
  const TSTree *tree,
  uint32_t start_row,
  uint32_t start_column,
  uint32_t end_row,
  uint32_t end_column,
  uint32_t start_index,
  uint32_t end_index,
  uint32_t start_containing_row,
  uint32_t start_containing_column,
  uint32_t end_containing_row,
  uint32_t end_containing_column,
  uint32_t start_containing_index,
  uint32_t end_containing_index,
  uint32_t match_limit,
  uint32_t max_start_depth
) {
  if (!scratch_query_cursor) {
    scratch_query_cursor = ts_query_cursor_new();
  }

  TSNode node = unmarshal_node(tree);
  bool has_progress = TRANSFER_BUFFER[SIZE_OF_NODE] != NULL;
  TSPoint start_point = {start_row, code_unit_to_byte(start_column)};
  TSPoint end_point = {end_row, code_unit_to_byte(end_column)};
  TSPoint start_containing_point = {start_containing_row, code_unit_to_byte(start_containing_column)};
  TSPoint end_containing_point = {end_containing_row, code_unit_to_byte(end_containing_column)};
  ts_query_cursor_set_point_range(scratch_query_cursor, start_point, end_point);
  ts_query_cursor_set_byte_range(
    scratch_query_cursor,
    code_unit_to_byte(start_index),
    code_unit_to_byte(end_index)
  );
  ts_query_cursor_set_containing_point_range(
    scratch_query_cursor,
    start_containing_point,
    end_containing_point
  );
  ts_query_cursor_set_containing_byte_range(
    scratch_query_cursor,
    code_unit_to_byte(start_containing_index),
    code_unit_to_byte(end_containing_index)
  );
  ts_query_cursor_set_match_limit(scratch_query_cursor, match_limit);
  ts_query_cursor_set_max_start_depth(scratch_query_cursor, max_start_depth);

  ts_query_cursor_exec_with_options(
    scratch_query_cursor,
    self,
    node,
    has_progress ? &QUERY_CURSOR_PROGRESS_OPTIONS : NULL
  );
}

void ts_query_matches_wasm(
  const TSQuery *self,
  const TSTree *tree,
  uint32_t start_row,
  uint32_t start_column,
  uint32_t end_row,
  uint32_t end_column,
  uint32_t start_index,
  uint32_t end_index,
  uint32_t start_containing_row,
  uint32_t start_containing_column,
  uint32_t end_containing_row,
  uint32_t end_containing_column,
  uint32_t start_containing_index,
  uint32_t end_containing_index,
  uint32_t match_limit,
  uint32_t max_start_depth
) {
  exec_query_cursor(
    self, tree,
    start_row, start_column, end_row, end_column, start_index, end_index,
    start_containing_row, start_containing_column, end_containing_row, end_containing_column,
    start_containing_index, end_containing_index, match_limit, max_start_depth
  );

  uint32_t index = 0;
  uint32_t match_count = 0;
  Array(const void *) result = array_new();

  TSQueryMatch match;
  while (ts_query_cursor_next_match(scratch_query_cursor, &match)) {
    match_count++;
    array_grow_by(&result, 2 + (SIZE_OF_CAPTURE * match.capture_count));
    result.contents[index++] = (const void *)(uint32_t)match.pattern_index;
    result.contents[index++] = (const void *)(uint32_t)match.capture_count;
    for (unsigned i = 0; i < match.capture_count; i++) {
      const TSQueryCapture *capture = &match.captures[i];
      result.contents[index++] = (const void *)capture->index;
      marshal_node(result.contents + index, capture->node);
      index += SIZE_OF_NODE;
    }
  }

  bool did_exceed_match_limit =
    ts_query_cursor_did_exceed_match_limit(scratch_query_cursor);
  TRANSFER_BUFFER[0] = (const void *)(match_count);
  TRANSFER_BUFFER[1] = (const void *)result.contents;
  TRANSFER_BUFFER[2] = (const void *)(did_exceed_match_limit);
}

static const int SIZE_OF_CAPTURE_RANGE = 6;

void ts_query_capture_ranges_wasm(
  const TSQuery *self,
  const TSTree *tree,
  uint32_t start_row,
  uint32_t start_column,
  uint32_t end_row,
  uint32_t end_column,
  uint32_t start_index,
  uint32_t end_index,
  uint32_t start_containing_row,
  uint32_t start_containing_column,
  uint32_t end_containing_row,
  uint32_t end_containing_column,
  uint32_t start_containing_index,
  uint32_t end_containing_index,
  uint32_t match_limit,
  uint32_t max_start_depth
) {
  exec_query_cursor(
    self, tree,
    start_row, start_column, end_row, end_column, start_index, end_index,
    start_containing_row, start_containing_column, end_containing_row, end_containing_column,
    start_containing_index, end_containing_index, match_limit, max_start_depth
  );

  uint32_t index = 0;
  uint32_t match_count = 0;
  Array(const void *) result = array_new();

  TSQueryMatch match;
  while (ts_query_cursor_next_match(scratch_query_cursor, &match)) {
    match_count++;
    array_grow_by(&result, 2 + (SIZE_OF_CAPTURE_RANGE * match.capture_count));
    result.contents[index++] = (const void *)(uint32_t)match.pattern_index;
    result.contents[index++] = (const void *)(uint32_t)match.capture_count;
    for (unsigned i = 0; i < match.capture_count; i++) {
      const TSQueryCapture *capture = &match.captures[i];
      TSNode captured = capture->node;
      TSPoint start_point = ts_node_start_point(captured);
      result.contents[index++] = (const void *)capture->index;
      result.contents[index++] = captured.id;
      result.contents[index++] = (const void *)byte_to_code_unit(ts_node_start_byte(captured));
      result.contents[index++] = (const void *)byte_to_code_unit(ts_node_end_byte(captured));
      result.contents[index++] = (const void *)start_point.row;
      result.contents[index++] = (const void *)byte_to_code_unit(start_point.column);
    }
  }

  bool did_exceed_match_limit =
    ts_query_cursor_did_exceed_match_limit(scratch_query_cursor);
  TRANSFER_BUFFER[0] = (const void *)(match_count);
  TRANSFER_BUFFER[1] = (const void *)result.contents;
  TRANSFER_BUFFER[2] = (const void *)(did_exceed_match_limit);
}

void ts_query_captures_wasm(
  const TSQuery *self,
  const TSTree *tree,
  uint32_t start_row,
  uint32_t start_column,
  uint32_t end_row,
  uint32_t end_column,
  uint32_t start_index,
  uint32_t end_index,
  uint32_t start_containing_row,
  uint32_t start_containing_column,
  uint32_t end_containing_row,
  uint32_t end_containing_column,
  uint32_t start_containing_index,
  uint32_t end_containing_index,
  uint32_t match_limit,
  uint32_t max_start_depth
) {
  exec_query_cursor(
    self, tree,
    start_row, start_column, end_row, end_column, start_index, end_index,
    start_containing_row, start_containing_column, end_containing_row, end_containing_column,
    start_containing_index, end_containing_index, match_limit, max_start_depth
  );

  unsigned index = 0;
  unsigned capture_count = 0;
  Array(const void *) result = array_new();

  TSQueryMatch match;
  uint32_t capture_index;
  while (ts_query_cursor_next_capture(
    scratch_query_cursor,
    &match,
    &capture_index
  )) {
    capture_count++;

    array_grow_by(&result, 3 + (SIZE_OF_CAPTURE * match.capture_count));
    result.contents[index++] = (const void *)(uint32_t)match.pattern_index;
    result.contents[index++] = (const void *)(uint32_t)match.capture_count;
    result.contents[index++] = (const void *)capture_index;
    for (unsigned i = 0; i < match.capture_count; i++) {
      const TSQueryCapture *capture = &match.captures[i];
      result.contents[index++] = (const void *)capture->index;
      marshal_node(result.contents + index, capture->node);
      index += SIZE_OF_NODE;
    }
  }

  bool did_exceed_match_limit =
    ts_query_cursor_did_exceed_match_limit(scratch_query_cursor);
  TRANSFER_BUFFER[0] = (const void *)(capture_count);
  TRANSFER_BUFFER[1] = (const void *)result.contents;
  TRANSFER_BUFFER[2] = (const void *)(did_exceed_match_limit);
}

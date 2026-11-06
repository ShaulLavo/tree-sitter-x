#ifndef TREE_SITTER_HIGHLIGHT_H_
#define TREE_SITTER_HIGHLIGHT_H_

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include "tree_sitter/api.h"

typedef enum {
  TSHighlightOk,
  TSHighlightUnknownScope,
  TSHighlightTimeout,
  TSHighlightInvalidLanguage,
  TSHighlightInvalidUtf8,
  TSHighlightInvalidRegex,
  TSHighlightInvalidQuery,
} TSHighlightError;

typedef struct TSHighlighter TSHighlighter;
typedef struct TSHighlightBuffer TSHighlightBuffer;

// Construct a `TSHighlighter` by providing a list of strings containing
// the HTML attributes that should be applied for each highlight value.
TSHighlighter *ts_highlighter_new(
  const char **highlight_names,
  const char **attribute_strings,
  uint32_t highlight_count
);

// Delete a syntax highlighter.
void ts_highlighter_delete(TSHighlighter *);

// Add a `TSLanguage` to a highlighter. The language is associated with a
// scope name, which can be used later to select a language for syntax
// highlighting. Along with the language, you must provide a JSON string
// containing the compiled PropertySheet to use for syntax highlighting
// with that language. You can also optionally provide an 'injection regex',
// which is used to detect when this language has been embedded in a document
// written in a different language.
TSHighlightError ts_highlighter_add_language(
  TSHighlighter *self,
  const char *language_name,
  const char *scope_name,
  const char *injection_regex,
  const TSLanguage *language,
  const char *highlight_query,
  const char *injection_query,
  const char *locals_query,
  uint32_t highlight_query_len,
  uint32_t injection_query_len,
  uint32_t locals_query_len
);

// Highlight submitted bytes, detecting a UTF-16 BOM, otherwise using UTF-8.
// The source is read only during the call. Lengths count bytes; odd UTF-16
// tails and unpaired surrogates render as U+FFFD. Output is UTF-8 HTML;
// line offsets index that HTML. BOM characters remain in the output.
TSHighlightError ts_highlighter_highlight(
  const TSHighlighter *self,
  const char *scope_name,
  const char *source_code,
  uint32_t source_code_len,
  TSHighlightBuffer *output,
  const size_t *cancellation_flag
);

// Explicit UTF-16 byte order, without BOM detection. The same byte-length,
// source lifetime, malformed-input and UTF-8 output rules apply.
TSHighlightError ts_highlighter_highlight_utf16_le(
  const TSHighlighter *self,
  const char *scope_name,
  const char *source_code,
  uint32_t source_code_len,
  TSHighlightBuffer *output,
  const size_t *cancellation_flag
);

TSHighlightError ts_highlighter_highlight_utf16_be(
  const TSHighlighter *self,
  const char *scope_name,
  const char *source_code,
  uint32_t source_code_len,
  TSHighlightBuffer *output,
  const size_t *cancellation_flag
);

// TSHighlightBuffer: This struct stores the HTML output of syntax
// highlighting. It can be reused for multiple highlighting calls.
TSHighlightBuffer *ts_highlight_buffer_new();

// Delete a highlight buffer.
void ts_highlight_buffer_delete(TSHighlightBuffer *);

// Access the HTML content of a highlight buffer.
const uint8_t *ts_highlight_buffer_content(const TSHighlightBuffer *);
const uint32_t *ts_highlight_buffer_line_offsets(const TSHighlightBuffer *);
uint32_t ts_highlight_buffer_len(const TSHighlightBuffer *);
uint32_t ts_highlight_buffer_line_count(const TSHighlightBuffer *);

#ifdef __cplusplus
}
#endif

#endif  // TREE_SITTER_HIGHLIGHT_H_

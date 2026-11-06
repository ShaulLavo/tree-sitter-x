use std::{
    ffi::CString,
    fs,
    os::raw::c_char,
    ptr, slice,
    sync::{
        LazyLock,
        atomic::{AtomicUsize, Ordering},
    },
};

use tree_sitter_highlight::{
    Error, Highlight, HighlightConfiguration, HighlightEvent, Highlighter, HtmlRenderer, c,
};

use super::helpers::fixtures::{get_highlight_config, get_language, get_language_queries_path};

static JS_HIGHLIGHT: LazyLock<HighlightConfiguration> =
    LazyLock::new(|| get_highlight_config("javascript", Some("injections.scm"), &HIGHLIGHT_NAMES));

static JSDOC_HIGHLIGHT: LazyLock<HighlightConfiguration> =
    LazyLock::new(|| get_highlight_config("jsdoc", None, &HIGHLIGHT_NAMES));

static HTML_HIGHLIGHT: LazyLock<HighlightConfiguration> =
    LazyLock::new(|| get_highlight_config("html", Some("injections.scm"), &HIGHLIGHT_NAMES));

static EJS_HIGHLIGHT: LazyLock<HighlightConfiguration> = LazyLock::new(|| {
    get_highlight_config(
        "embedded-template",
        Some("injections-ejs.scm"),
        &HIGHLIGHT_NAMES,
    )
});

static RUST_HIGHLIGHT: LazyLock<HighlightConfiguration> =
    LazyLock::new(|| get_highlight_config("rust", Some("injections.scm"), &HIGHLIGHT_NAMES));

static HIGHLIGHT_NAMES: LazyLock<Vec<String>> = LazyLock::new(|| {
    [
        "attribute",
        "boolean",
        "carriage-return",
        "comment",
        "constant",
        "constant.builtin",
        "constructor",
        "embedded",
        "function",
        "function.builtin",
        "keyword",
        "module",
        "number",
        "operator",
        "property",
        "property.builtin",
        "punctuation",
        "punctuation.bracket",
        "punctuation.delimiter",
        "punctuation.special",
        "string",
        "string.special",
        "tag",
        "type",
        "type.builtin",
        "variable",
        "variable.builtin",
        "variable.parameter",
    ]
    .iter()
    .copied()
    .map(String::from)
    .collect()
});

static HTML_ATTRS: LazyLock<Vec<String>> = LazyLock::new(|| {
    HIGHLIGHT_NAMES
        .iter()
        .map(|s| format!("class={s}"))
        .collect()
});

#[test]
fn test_highlighting_javascript() {
    let source = "const a = function(b) { return b + c; }";
    assert_eq!(
        &to_token_vector(source, &JS_HIGHLIGHT).unwrap(),
        &[vec![
            ("const", vec!["keyword"]),
            (" ", vec![]),
            ("a", vec!["function"]),
            (" ", vec![]),
            ("=", vec!["operator"]),
            (" ", vec![]),
            ("function", vec!["keyword"]),
            ("(", vec!["punctuation.bracket"]),
            ("b", vec!["variable"]),
            (")", vec!["punctuation.bracket"]),
            (" ", vec![]),
            ("{", vec!["punctuation.bracket"]),
            (" ", vec![]),
            ("return", vec!["keyword"]),
            (" ", vec![]),
            ("b", vec!["variable"]),
            (" ", vec![]),
            ("+", vec!["operator"]),
            (" ", vec![]),
            ("c", vec!["variable"]),
            (";", vec!["punctuation.delimiter"]),
            (" ", vec![]),
            ("}", vec!["punctuation.bracket"]),
        ]]
    );
}

#[test]
fn test_highlighting_injected_html_in_javascript() {
    let source = ["const s = html `<div>${a < b}</div>`;"].join("\n");

    assert_eq!(
        &to_token_vector(&source, &JS_HIGHLIGHT).unwrap(),
        &[vec![
            ("const", vec!["keyword"]),
            (" ", vec![]),
            ("s", vec!["variable"]),
            (" ", vec![]),
            ("=", vec!["operator"]),
            (" ", vec![]),
            ("html", vec!["function"]),
            (" ", vec![]),
            ("`", vec!["string"]),
            ("<", vec!["string", "punctuation.bracket"]),
            ("div", vec!["string", "tag"]),
            (">", vec!["string", "punctuation.bracket"]),
            ("${", vec!["string", "embedded", "punctuation.special"]),
            ("a", vec!["string", "embedded", "variable"]),
            (" ", vec!["string", "embedded"]),
            ("<", vec!["string", "embedded", "operator"]),
            (" ", vec!["string", "embedded"]),
            ("b", vec!["string", "embedded", "variable"]),
            ("}", vec!["string", "embedded", "punctuation.special"]),
            ("</", vec!["string", "punctuation.bracket"]),
            ("div", vec!["string", "tag"]),
            (">", vec!["string", "punctuation.bracket"]),
            ("`", vec!["string"]),
            (";", vec!["punctuation.delimiter"]),
        ]]
    );
}

#[test]
fn test_highlighting_injected_javascript_in_html_mini() {
    let source = "<script>const x = new Thing();</script>";

    assert_eq!(
        &to_token_vector(source, &HTML_HIGHLIGHT).unwrap(),
        &[vec![
            ("<", vec!["punctuation.bracket"]),
            ("script", vec!["tag"]),
            (">", vec!["punctuation.bracket"]),
            ("const", vec!["keyword"]),
            (" ", vec![]),
            ("x", vec!["variable"]),
            (" ", vec![]),
            ("=", vec!["operator"]),
            (" ", vec![]),
            ("new", vec!["keyword"]),
            (" ", vec![]),
            ("Thing", vec!["constructor"]),
            ("(", vec!["punctuation.bracket"]),
            (")", vec!["punctuation.bracket"]),
            (";", vec!["punctuation.delimiter"]),
            ("</", vec!["punctuation.bracket"]),
            ("script", vec!["tag"]),
            (">", vec!["punctuation.bracket"]),
        ],]
    );
}

#[test]
fn test_highlighting_injected_javascript_in_html() {
    let source = [
        "<body>",
        "  <script>",
        "    const x = new Thing();",
        "  </script>",
        "</body>",
    ]
    .join("\n");

    assert_eq!(
        &to_token_vector(&source, &HTML_HIGHLIGHT).unwrap(),
        &[
            vec![
                ("<", vec!["punctuation.bracket"]),
                ("body", vec!["tag"]),
                (">", vec!["punctuation.bracket"]),
            ],
            vec![
                ("  ", vec![]),
                ("<", vec!["punctuation.bracket"]),
                ("script", vec!["tag"]),
                (">", vec!["punctuation.bracket"]),
            ],
            vec![
                ("    ", vec![]),
                ("const", vec!["keyword"]),
                (" ", vec![]),
                ("x", vec!["variable"]),
                (" ", vec![]),
                ("=", vec!["operator"]),
                (" ", vec![]),
                ("new", vec!["keyword"]),
                (" ", vec![]),
                ("Thing", vec!["constructor"]),
                ("(", vec!["punctuation.bracket"]),
                (")", vec!["punctuation.bracket"]),
                (";", vec!["punctuation.delimiter"]),
            ],
            vec![
                ("  ", vec![]),
                ("</", vec!["punctuation.bracket"]),
                ("script", vec!["tag"]),
                (">", vec!["punctuation.bracket"]),
            ],
            vec![
                ("</", vec!["punctuation.bracket"]),
                ("body", vec!["tag"]),
                (">", vec!["punctuation.bracket"]),
            ],
        ]
    );
}

#[test]
fn test_highlighting_multiline_nodes_to_html() {
    let source = [
        "const SOMETHING = `",
        "  one ${",
        "    two()",
        "  } three",
        "`",
        "",
    ]
    .join("\n");

    assert_eq!(
        &to_html(&source, &JS_HIGHLIGHT).unwrap(),
        &[
            "<span class=keyword>const</span> <span class=constant>SOMETHING</span> <span class=operator>=</span> <span class=string>`</span>\n".to_string(),
            "<span class=string>  one <span class=embedded><span class=punctuation.special>${</span></span></span>\n".to_string(),
            "<span class=string><span class=embedded>    <span class=function>two</span><span class=punctuation.bracket>(</span><span class=punctuation.bracket>)</span></span></span>\n".to_string(),
            "<span class=string><span class=embedded>  <span class=punctuation.special>}</span></span> three</span>\n".to_string(),
            "<span class=string>`</span>\n".to_string(),
        ]
    );
}

#[test]
fn test_highlighting_with_local_variable_tracking() {
    let source = [
        "module.exports = function a(b) {",
        "  const module = c;",
        "  console.log(module, b);",
        "}",
    ]
    .join("\n");

    assert_eq!(
        &to_token_vector(&source, &JS_HIGHLIGHT).unwrap(),
        &[
            vec![
                ("module", vec!["variable.builtin"]),
                (".", vec!["punctuation.delimiter"]),
                ("exports", vec!["function"]),
                (" ", vec![]),
                ("=", vec!["operator"]),
                (" ", vec![]),
                ("function", vec!["keyword"]),
                (" ", vec![]),
                ("a", vec!["function"]),
                ("(", vec!["punctuation.bracket"]),
                ("b", vec!["variable"]),
                (")", vec!["punctuation.bracket"]),
                (" ", vec![]),
                ("{", vec!["punctuation.bracket"])
            ],
            vec![
                ("  ", vec![]),
                ("const", vec!["keyword"]),
                (" ", vec![]),
                ("module", vec!["variable"]),
                (" ", vec![]),
                ("=", vec!["operator"]),
                (" ", vec![]),
                ("c", vec!["variable"]),
                (";", vec!["punctuation.delimiter"])
            ],
            vec![
                ("  ", vec![]),
                ("console", vec!["variable.builtin"]),
                (".", vec!["punctuation.delimiter"]),
                ("log", vec!["function"]),
                ("(", vec!["punctuation.bracket"]),
                // Not a builtin, because `module` was defined as a variable above.
                ("module", vec!["variable"]),
                (",", vec!["punctuation.delimiter"]),
                (" ", vec![]),
                // A parameter, because `b` was defined as a parameter above.
                ("b", vec!["variable"]),
                (")", vec!["punctuation.bracket"]),
                (";", vec!["punctuation.delimiter"]),
            ],
            vec![("}", vec!["punctuation.bracket"])]
        ],
    );
}

#[test]
fn test_highlighting_empty_lines() {
    let source = [
        "class A {",
        "",
        "  b(c) {",
        "",
        "    d(e)",
        "",
        "  }",
        "",
        "}",
    ]
    .join("\n");

    assert_eq!(
        &to_html(&source, &JS_HIGHLIGHT).unwrap(),
        &[
            "<span class=keyword>class</span> <span class=constructor>A</span> <span class=punctuation.bracket>{</span>\n".to_string(),
            "\n".to_string(),
            "  <span class=function>b</span><span class=punctuation.bracket>(</span><span class=variable>c</span><span class=punctuation.bracket>)</span> <span class=punctuation.bracket>{</span>\n".to_string(),
            "\n".to_string(),
            "    <span class=function>d</span><span class=punctuation.bracket>(</span><span class=variable>e</span><span class=punctuation.bracket>)</span>\n".to_string(),
            "\n".to_string(),
            "  <span class=punctuation.bracket>}</span>\n".to_string(),
            "\n".to_string(),
            "<span class=punctuation.bracket>}</span>\n".to_string(),
        ]
    );
}

#[test]
fn test_highlighting_carriage_returns() {
    let source = "a = \"a\rb\"\r\nb\r";

    assert_eq!(
        &to_html(source, &JS_HIGHLIGHT).unwrap(),
        &[
            "<span class=variable>a</span> <span class=operator>=</span> <span class=string>&quot;a<span class=carriage-return></span><span class=variable>b</span>&quot;</span>\n",
            "<span class=variable>b</span><span class=carriage-return></span>\n",
        ],
    );
}

#[test]
fn test_highlighting_ejs_with_html_and_javascript() {
    let source = ["<div><% foo() %></div><script> bar() </script>"].join("\n");

    assert_eq!(
        &to_token_vector(&source, &EJS_HIGHLIGHT).unwrap(),
        &[[
            ("<", vec!["punctuation.bracket"]),
            ("div", vec!["tag"]),
            (">", vec!["punctuation.bracket"]),
            ("<%", vec!["keyword"]),
            (" ", vec![]),
            ("foo", vec!["function"]),
            ("(", vec!["punctuation.bracket"]),
            (")", vec!["punctuation.bracket"]),
            (" ", vec![]),
            ("%>", vec!["keyword"]),
            ("</", vec!["punctuation.bracket"]),
            ("div", vec!["tag"]),
            (">", vec!["punctuation.bracket"]),
            ("<", vec!["punctuation.bracket"]),
            ("script", vec!["tag"]),
            (">", vec!["punctuation.bracket"]),
            (" ", vec![]),
            ("bar", vec!["function"]),
            ("(", vec!["punctuation.bracket"]),
            (")", vec!["punctuation.bracket"]),
            (" ", vec![]),
            ("</", vec!["punctuation.bracket"]),
            ("script", vec!["tag"]),
            (">", vec!["punctuation.bracket"]),
        ]],
    );
}

#[test]
fn test_highlighting_javascript_with_jsdoc() {
    // Regression test: the middle comment has no highlights. This should not prevent
    // later injections from highlighting properly.
    let source = ["a /* @see a */ b; /* nothing */ c; /* @see b */"].join("\n");

    assert_eq!(
        &to_token_vector(&source, &JS_HIGHLIGHT).unwrap(),
        &[[
            ("a", vec!["variable"]),
            (" ", vec![]),
            ("/* ", vec!["comment"]),
            ("@see", vec!["comment", "keyword"]),
            (" a */", vec!["comment"]),
            (" ", vec![]),
            ("b", vec!["variable"]),
            (";", vec!["punctuation.delimiter"]),
            (" ", vec![]),
            ("/* nothing */", vec!["comment"]),
            (" ", vec![]),
            ("c", vec!["variable"]),
            (";", vec!["punctuation.delimiter"]),
            (" ", vec![]),
            ("/* ", vec!["comment"]),
            ("@see", vec!["comment", "keyword"]),
            (" b */", vec!["comment"])
        ]],
    );
}

#[test]
fn test_highlighting_with_content_children_included() {
    let source = ["assert!(", "    a.b.c() < D::e::<F>()", ");"].join("\n");

    assert_eq!(
        &to_token_vector(&source, &RUST_HIGHLIGHT).unwrap(),
        &[
            vec![
                ("assert", vec!["function"]),
                ("!", vec!["function"]),
                ("(", vec!["punctuation.bracket"]),
            ],
            vec![
                ("    a", vec![]),
                (".", vec!["punctuation.delimiter"]),
                ("b", vec!["property"]),
                (".", vec!["punctuation.delimiter"]),
                ("c", vec!["function"]),
                ("(", vec!["punctuation.bracket"]),
                (")", vec!["punctuation.bracket"]),
                (" < ", vec![]),
                ("D", vec!["type"]),
                ("::", vec!["punctuation.delimiter"]),
                ("e", vec!["function"]),
                ("::", vec!["punctuation.delimiter"]),
                ("<", vec!["punctuation.bracket"]),
                ("F", vec!["type"]),
                (">", vec!["punctuation.bracket"]),
                ("(", vec!["punctuation.bracket"]),
                (")", vec!["punctuation.bracket"]),
            ],
            vec![
                (")", vec!["punctuation.bracket"]),
                (";", vec!["punctuation.delimiter"]),
            ]
        ],
    );
}

#[test]
fn test_highlighting_cancellation() {
    // An HTML document with a large injected JavaScript document:
    let mut source = "<script>\n".to_string();
    for _ in 0..500 {
        source += "function a() { console.log('hi'); }\n";
    }
    source += "</script>\n";

    // Cancel the highlighting before parsing the injected document.
    let cancellation_flag = AtomicUsize::new(0);
    let injection_callback = |name: &str| {
        cancellation_flag.store(1, Ordering::SeqCst);
        test_language_for_injection_string(name)
    };

    // The initial `highlight` call, which eagerly parses the outer document, should not fail.
    let mut highlighter = Highlighter::new();
    let mut events = highlighter
        .highlight(
            &HTML_HIGHLIGHT,
            source.as_bytes(),
            None,
            Some(&cancellation_flag),
            injection_callback,
        )
        .unwrap();

    // Iterating the scopes should not panic. It should return an error once the
    // cancellation is detected.
    let found_cancellation_error = events.any(|event| match event {
        Ok(_) => false,
        Err(Error::Cancelled) => true,
        Err(Error::InvalidLanguage(_) | Error::Unknown) => {
            unreachable!("Unexpected error type while iterating events")
        }
    });

    assert!(
        found_cancellation_error,
        "Expected a cancellation error while iterating events"
    );
}

#[test]
fn test_highlighting_via_c_api() {
    let highlights = [
        "class=tag\0",
        "class=function\0",
        "class=string\0",
        "class=keyword\0",
    ];
    let highlight_names = highlights
        .iter()
        .map(|h| h["class=".len()..].as_ptr().cast::<c_char>())
        .collect::<Vec<_>>();
    let highlight_attrs = highlights
        .iter()
        .map(|h| h.as_bytes().as_ptr().cast::<c_char>())
        .collect::<Vec<_>>();
    let highlighter = unsafe {
        c::ts_highlighter_new(
            std::ptr::addr_of!(highlight_names[0]),
            std::ptr::addr_of!(highlight_attrs[0]),
            highlights.len() as u32,
        )
    };

    let source_code = c_string("<script>\nconst a = b('c');\nc.d();\n</script>");

    let js_scope = c_string("source.js");
    let js_injection_regex = c_string("^javascript");
    let language = get_language("javascript");
    let lang_name = c_string("javascript");
    let queries = get_language_queries_path("javascript");
    let highlights_query = fs::read_to_string(queries.join("highlights.scm")).unwrap();
    let injections_query = fs::read_to_string(queries.join("injections.scm")).unwrap();
    let locals_query = fs::read_to_string(queries.join("locals.scm")).unwrap();
    unsafe {
        c::ts_highlighter_add_language(
            highlighter,
            lang_name.as_ptr(),
            js_scope.as_ptr(),
            js_injection_regex.as_ptr(),
            language,
            highlights_query.as_ptr().cast::<c_char>(),
            injections_query.as_ptr().cast::<c_char>(),
            locals_query.as_ptr().cast::<c_char>(),
            highlights_query.len() as u32,
            injections_query.len() as u32,
            locals_query.len() as u32,
        );
    }

    let html_scope = c_string("text.html.basic");
    let html_injection_regex = c_string("^html");
    let language = get_language("html");
    let lang_name = c_string("html");
    let queries = get_language_queries_path("html");
    let highlights_query = fs::read_to_string(queries.join("highlights.scm")).unwrap();
    let injections_query = fs::read_to_string(queries.join("injections.scm")).unwrap();
    unsafe {
        c::ts_highlighter_add_language(
            highlighter,
            lang_name.as_ptr(),
            html_scope.as_ptr(),
            html_injection_regex.as_ptr(),
            language,
            highlights_query.as_ptr().cast::<c_char>(),
            injections_query.as_ptr().cast::<c_char>(),
            ptr::null(),
            highlights_query.len() as u32,
            injections_query.len() as u32,
            0,
        );
    }

    let buffer = c::ts_highlight_buffer_new();

    unsafe {
        c::ts_highlighter_highlight(
            highlighter,
            html_scope.as_ptr(),
            source_code.as_ptr(),
            source_code.as_bytes().len() as u32,
            buffer,
            ptr::null_mut(),
        );
    }

    let output_bytes = unsafe { c::ts_highlight_buffer_content(buffer) };
    let output_line_offsets = unsafe { c::ts_highlight_buffer_line_offsets(buffer) };
    let output_len = unsafe { c::ts_highlight_buffer_len(buffer) };
    let output_line_count = unsafe { c::ts_highlight_buffer_line_count(buffer) };

    let output_bytes = unsafe { slice::from_raw_parts(output_bytes, output_len as usize) };
    let output_line_offsets =
        unsafe { slice::from_raw_parts(output_line_offsets, output_line_count as usize) };

    let mut lines = Vec::with_capacity(output_line_count as usize);
    for i in 0..(output_line_count as usize) {
        let line_start = output_line_offsets[i] as usize;
        let line_end = output_line_offsets
            .get(i + 1)
            .map_or(output_bytes.len(), |x| *x as usize);
        lines.push(str::from_utf8(&output_bytes[line_start..line_end]).unwrap());
    }

    assert_eq!(
        lines,
        vec![
            "&lt;<span class=tag>script</span>&gt;\n",
            "<span class=keyword>const</span> a = <span class=function>b</span>(<span class=string>&#39;c&#39;</span>);\n",
            "c.<span class=function>d</span>();\n",
            "&lt;/<span class=tag>script</span>&gt;\n",
        ]
    );

    unsafe {
        c::ts_highlighter_delete(highlighter);
        c::ts_highlight_buffer_delete(buffer);
    }
}

#[test]
fn test_highlighting_with_all_captures_applied() {
    let source = "fn main(a: u32, b: u32) -> { let c = a + b; }";
    let language = get_language("rust");
    let highlights_query = indoc::indoc! {"
        [
          \"fn\"
          \"let\"
        ] @keyword
        (identifier) @variable
        (function_item name: (identifier) @function)
        (parameter pattern: (identifier) @variable.parameter)
        (primitive_type) @type.builtin
        \"=\" @operator
        [ \"->\" \":\" \";\" ] @punctuation.delimiter
        [ \"{\" \"}\" \"(\" \")\" ] @punctuation.bracket
    "};
    let mut rust_highlight_reverse =
        HighlightConfiguration::new(language, "rust", highlights_query, "", "").unwrap();
    rust_highlight_reverse.configure(&HIGHLIGHT_NAMES);

    assert_eq!(
        &to_token_vector(source, &rust_highlight_reverse).unwrap(),
        &[[
            ("fn", vec!["keyword"]),
            (" ", vec![]),
            ("main", vec!["function"]),
            ("(", vec!["punctuation.bracket"]),
            ("a", vec!["variable.parameter"]),
            (":", vec!["punctuation.delimiter"]),
            (" ", vec![]),
            ("u32", vec!["type.builtin"]),
            (", ", vec![]),
            ("b", vec!["variable.parameter"]),
            (":", vec!["punctuation.delimiter"]),
            (" ", vec![]),
            ("u32", vec!["type.builtin"]),
            (")", vec!["punctuation.bracket"]),
            (" ", vec![]),
            ("->", vec!["punctuation.delimiter"]),
            (" ", vec![]),
            ("{", vec!["punctuation.bracket"]),
            (" ", vec![]),
            ("let", vec!["keyword"]),
            (" ", vec![]),
            ("c", vec!["variable"]),
            (" ", vec![]),
            ("=", vec!["operator"]),
            (" ", vec![]),
            ("a", vec!["variable"]),
            (" + ", vec![]),
            ("b", vec!["variable"]),
            (";", vec!["punctuation.delimiter"]),
            (" ", vec![]),
            ("}", vec!["punctuation.bracket"])
        ]],
    );
}

#[test]
fn test_decode_utf8_lossy() {
    use tree_sitter::LossyUtf8;

    let parts = LossyUtf8::new(b"hi").collect::<Vec<_>>();
    assert_eq!(parts, vec!["hi"]);

    let parts = LossyUtf8::new(b"hi\xc0\xc1bye").collect::<Vec<_>>();
    assert_eq!(parts, vec!["hi", "\u{fffd}", "\u{fffd}", "bye"]);

    let parts = LossyUtf8::new(b"\xc0\xc1bye").collect::<Vec<_>>();
    assert_eq!(parts, vec!["\u{fffd}", "\u{fffd}", "bye"]);

    let parts = LossyUtf8::new(b"hello\xc0\xc1").collect::<Vec<_>>();
    assert_eq!(parts, vec!["hello", "\u{fffd}", "\u{fffd}"]);
}

fn c_string(s: &str) -> CString {
    CString::new(s.as_bytes().to_vec()).unwrap()
}

fn test_language_for_injection_string<'a>(string: &str) -> Option<&'a HighlightConfiguration> {
    match string {
        "javascript" => Some(&JS_HIGHLIGHT),
        "html" => Some(&HTML_HIGHLIGHT),
        "rust" => Some(&RUST_HIGHLIGHT),
        "jsdoc" => Some(&JSDOC_HIGHLIGHT),
        _ => None,
    }
}

fn to_html<'a>(
    src: &'a str,
    language_config: &'a HighlightConfiguration,
) -> Result<Vec<String>, Error> {
    let src = src.as_bytes();
    let mut renderer = HtmlRenderer::new();
    let mut highlighter = Highlighter::new();
    let events = highlighter.highlight(
        language_config,
        src,
        None,
        None,
        &test_language_for_injection_string,
    )?;

    renderer.set_carriage_return_highlight(
        HIGHLIGHT_NAMES
            .iter()
            .position(|s| s == "carriage-return")
            .map(Highlight),
    );
    renderer
        .render(events, src, &|highlight, output| {
            output.extend(HTML_ATTRS[highlight.0].as_bytes());
        })
        .unwrap();
    Ok(renderer
        .lines()
        .map(std::string::ToString::to_string)
        .collect())
}

#[expect(
    clippy::type_complexity,
    reason = "return type represents structured highlight tokens"
)]
fn to_token_vector<'a>(
    src: &'a str,
    language_config: &'a HighlightConfiguration,
) -> Result<Vec<Vec<(&'a str, Vec<&'static str>)>>, Error> {
    let src = src.as_bytes();
    let mut highlighter = Highlighter::new();
    let mut lines = Vec::new();
    let mut highlights = Vec::new();
    let mut line = Vec::new();
    let events = highlighter.highlight(
        language_config,
        src,
        None,
        None,
        &test_language_for_injection_string,
    )?;
    for event in events {
        match event? {
            HighlightEvent::HighlightStart(s) => highlights.push(HIGHLIGHT_NAMES[s.0].as_str()),
            HighlightEvent::HighlightEnd => {
                highlights.pop();
            }
            HighlightEvent::Source { start, end } => {
                let s = str::from_utf8(&src[start..end]).unwrap();
                for (i, l) in s.split('\n').enumerate() {
                    let l = l.trim_end_matches('\r');
                    if i > 0 {
                        lines.push(std::mem::take(&mut line));
                    }
                    if !l.is_empty() {
                        line.push((l, highlights.clone()));
                    }
                }
            }
        }
    }
    if !line.is_empty() {
        lines.push(line);
    }
    Ok(lines)
}

const ENCODING_PROGRAM: &str = "const café = \"naïve 😀\";\ncafé;\nÜber;\nhtml`<b>e\u{301}</b>`;";
const ENCODING_HIGHLIGHTS: &str = r#"
(identifier) @variable
(string) @string
(template_string) @string
(variable_declarator name: (identifier) @constant)
((identifier) @function.builtin (#eq? @function.builtin "Über"))
((string_fragment) @string.special (#match? @string.special "😀$"))
"#;
const ENCODING_INJECTIONS: &str = r"
(call_expression function: (identifier) @injection.language
 arguments: (template_string (string_fragment) @injection.content))
";
const ENCODING_LOCALS: &str = r"
(variable_declarator name: (identifier) @local.definition)
(identifier) @local.reference
";
static ENCODING_JS: LazyLock<HighlightConfiguration> = LazyLock::new(|| {
    let mut config = HighlightConfiguration::new(
        get_language("javascript"),
        "javascript",
        ENCODING_HIGHLIGHTS,
        ENCODING_INJECTIONS,
        ENCODING_LOCALS,
    )
    .unwrap();
    config.configure(&HIGHLIGHT_NAMES);
    config
});

#[derive(Clone, Copy, Debug)]
enum TestEncoding {
    Utf8,
    Le,
    Be,
}
impl TestEncoding {
    const fn input(self) -> Option<u32> {
        match self {
            Self::Utf8 => None,
            Self::Le => Some(tree_sitter::ffi::TSInputEncodingUTF16LE),
            Self::Be => Some(tree_sitter::ffi::TSInputEncodingUTF16BE),
        }
    }
    fn encode(self, text: &str) -> Vec<u8> {
        match self {
            Self::Utf8 => text.as_bytes().to_vec(),
            Self::Le => text.encode_utf16().flat_map(u16::to_le_bytes).collect(),
            Self::Be => text.encode_utf16().flat_map(u16::to_be_bytes).collect(),
        }
    }
    fn decode(self, bytes: &[u8]) -> String {
        if matches!(self, Self::Utf8) {
            return String::from_utf8_lossy(bytes).into_owned();
        }
        let units = bytes.as_chunks::<2>().0.iter().map(|p| match self {
            Self::Le => u16::from_le_bytes([p[0], p[1]]),
            _ => u16::from_be_bytes([p[0], p[1]]),
        });
        let mut text: String = char::decode_utf16(units)
            .map(|c| c.unwrap_or(char::REPLACEMENT_CHARACTER))
            .collect();
        if !bytes.len().is_multiple_of(2) {
            text.push(char::REPLACEMENT_CHARACTER);
        }
        text
    }
}

type EncodedTokens = Vec<(String, Vec<String>)>;
fn encoded_tokens(
    highlighter: &mut Highlighter,
    bytes: &[u8],
    encoding: TestEncoding,
) -> EncodedTokens {
    let events = highlighter
        .highlight(
            &ENCODING_JS,
            bytes,
            encoding.input(),
            None,
            test_language_for_injection_string,
        )
        .unwrap();
    let mut stack = Vec::new();
    let mut tokens = Vec::new();
    for event in events {
        match event.unwrap() {
            HighlightEvent::HighlightStart(h) => stack.push(HIGHLIGHT_NAMES[h.0].clone()),
            HighlightEvent::HighlightEnd => {
                stack.pop();
            }
            HighlightEvent::Source { start, end } => {
                tokens.push((encoding.decode(&bytes[start..end]), stack.clone()));
            }
        }
    }
    tokens
}

#[test]
fn test_highlighting_encoding_utf8_semantic_control() {
    let tokens = encoded_tokens(
        &mut Highlighter::new(),
        ENCODING_PROGRAM.as_bytes(),
        TestEncoding::Utf8,
    );
    assert_eq!(tokens, expected_encoding_tokens());
    assert!(tokens.contains(&("café".into(), vec!["constant".into()])));
    assert!(tokens.contains(&("Über".into(), vec!["function.builtin".into()])));
    assert!(tokens.contains(&(
        "naïve 😀".into(),
        vec!["string".into(), "string.special".into()]
    )));
    assert!(tokens.contains(&("b".into(), vec!["string".into(), "tag".into()])));
}

#[test]
fn test_highlighting_encodings_match_utf8_tokens() {
    let expected = expected_encoding_tokens();
    for encoding in [TestEncoding::Le, TestEncoding::Be] {
        assert_eq!(
            encoded_tokens(
                &mut Highlighter::new(),
                &encoding.encode(ENCODING_PROGRAM),
                encoding
            ),
            expected,
            "{encoding:?}"
        );
    }
}

fn encoding_events(bytes: &[u8], encoding: TestEncoding) -> Vec<HighlightEvent> {
    Highlighter::new()
        .highlight(
            &ENCODING_JS,
            bytes,
            encoding.input(),
            None,
            test_language_for_injection_string,
        )
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap()
}
fn encoding_event_key(event: &HighlightEvent) -> (u8, usize, usize) {
    match *event {
        HighlightEvent::Source { start, end } => (0, start, end),
        HighlightEvent::HighlightStart(highlight) => (1, highlight.0, 0),
        HighlightEvent::HighlightEnd => (2, 0, 0),
    }
}
fn assert_source_partition(events: &[HighlightEvent], len: usize) {
    let mut offset = 0;
    for event in events {
        if let HighlightEvent::Source { start, end } = *event {
            assert_eq!(start, offset);
            assert_eq!(start % 2, 0);
            assert!(end == len || end % 2 == 0);
            offset = end;
        }
    }
    assert_eq!(offset, len);
}
#[test]
fn test_highlighting_encodings_preserve_source_offsets() {
    for program in [
        ENCODING_PROGRAM.to_owned(),
        format!("\u{feff}{ENCODING_PROGRAM}"),
    ] {
        let expected: Vec<_> = encoding_events(program.as_bytes(), TestEncoding::Utf8)
            .into_iter()
            .map(|e| match e {
                HighlightEvent::Source { start, end } => HighlightEvent::Source {
                    start: program[..start].encode_utf16().count() * 2,
                    end: program[..end].encode_utf16().count() * 2,
                },
                e => e,
            })
            .collect();
        for encoding in [TestEncoding::Le, TestEncoding::Be] {
            let bytes = encoding.encode(&program);
            let events = encoding_events(&bytes, encoding);
            assert_source_partition(&events, bytes.len());
            assert_eq!(
                events.iter().map(encoding_event_key).collect::<Vec<_>>(),
                expected.iter().map(encoding_event_key).collect::<Vec<_>>(),
                "{encoding:?}"
            );
        }
    }
}

struct CountingAllocator;
thread_local! {
    static COUNTING: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
    static COUNTED_BYTES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}
fn count_allocation(size: usize) {
    if COUNTING.try_with(std::cell::Cell::get).unwrap_or(false) {
        let _ = COUNTED_BYTES.try_with(|count| count.set(count.get() + size));
    }
}
unsafe impl std::alloc::GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: std::alloc::Layout) -> *mut u8 {
        count_allocation(layout.size());
        unsafe { std::alloc::System.alloc(layout) }
    }
    unsafe fn alloc_zeroed(&self, layout: std::alloc::Layout) -> *mut u8 {
        count_allocation(layout.size());
        unsafe { std::alloc::System.alloc_zeroed(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: std::alloc::Layout) {
        unsafe { std::alloc::System.dealloc(ptr, layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: std::alloc::Layout, size: usize) -> *mut u8 {
        count_allocation(size);
        unsafe { std::alloc::System.realloc(ptr, layout, size) }
    }
}
#[global_allocator]
static ENCODING_ALLOCATOR: CountingAllocator = CountingAllocator;
struct CountingGuard(bool);
impl Drop for CountingGuard {
    fn drop(&mut self) {
        COUNTING.set(self.0);
    }
}
fn rust_bytes_allocated_during<T>(f: impl FnOnce() -> T) -> (T, usize) {
    COUNTED_BYTES.set(0);
    let guard = CountingGuard(COUNTING.replace(true));
    let result = f();
    drop(guard);
    (result, COUNTED_BYTES.get())
}
fn allocation_control(encoding: TestEncoding) {
    LazyLock::force(&HTML_HIGHLIGHT);
    LazyLock::force(&JS_HIGHLIGHT);
    let source = format!(
        "<!--{}-->{}",
        "x".repeat(128 * 1024),
        "<script>let a = 1;</script>".repeat(16)
    );
    let bytes = encoding.encode(&source);
    let mut highlighter = Highlighter::new();
    let mut callbacks = 0;
    let ((), allocated) = rust_bytes_allocated_during(|| {
        let events = highlighter
            .highlight(
                &HTML_HIGHLIGHT,
                &bytes,
                encoding.input(),
                None,
                |language| {
                    assert_eq!(language, "javascript");
                    callbacks += 1;
                    Some(&*JS_HIGHLIGHT)
                },
            )
            .unwrap();
        for event in events {
            event.unwrap();
        }
    });
    eprintln!(
        "{encoding:?}: allocated {allocated}, source {}, callbacks {callbacks}",
        bytes.len()
    );
    assert!(allocated < bytes.len() / 4);
    assert_eq!(callbacks, 16);
}
#[test]
fn test_highlighting_encoding_utf8_allocation_control() {
    allocation_control(TestEncoding::Utf8);
}
#[test]
fn test_highlighting_encodings_do_not_copy_source_per_layer_le() {
    allocation_control(TestEncoding::Le);
}
#[test]
fn test_highlighting_encodings_do_not_copy_source_per_layer_be() {
    allocation_control(TestEncoding::Be);
}

#[test]
fn test_highlighter_reuse_after_cancelled_utf16_highlight() {
    let source = "<script>let a = 1;</script>".repeat(500);
    let bytes = TestEncoding::Be.encode(&source);
    let mut highlighter = Highlighter::new();
    let cancellation = AtomicUsize::new(0);
    let cancelled = highlighter
        .highlight(
            &HTML_HIGHLIGHT,
            &bytes,
            TestEncoding::Be.input(),
            Some(&cancellation),
            |_| {
                cancellation.store(1, Ordering::SeqCst);
                Some(&*JS_HIGHLIGHT)
            },
        )
        .unwrap()
        .any(|e| matches!(e, Err(Error::Cancelled)));
    assert!(cancelled);
    drop(bytes);
    let bytes = TestEncoding::Le.encode(ENCODING_PROGRAM);
    let mut events = highlighter
        .highlight(
            &ENCODING_JS,
            &bytes,
            TestEncoding::Le.input(),
            None,
            test_language_for_injection_string,
        )
        .unwrap();
    events.next().unwrap().unwrap();
    events.next().unwrap().unwrap();
    drop(events);
    assert_eq!(
        encoded_tokens(&mut highlighter, &bytes, TestEncoding::Le),
        encoded_tokens(
            &mut Highlighter::new(),
            ENCODING_PROGRAM.as_bytes(),
            TestEncoding::Utf8
        )
    );
}

fn c_encoding_output(bytes: &[u8], encoding: TestEncoding, auto: bool) -> (Vec<u8>, Vec<u32>) {
    let names: Vec<_> = HIGHLIGHT_NAMES.iter().map(|n| c_string(n)).collect();
    let attrs: Vec<_> = HTML_ATTRS.iter().map(|n| c_string(n)).collect();
    let name_ptrs: Vec<_> = names.iter().map(|n| n.as_ptr()).collect();
    let attr_ptrs: Vec<_> = attrs.iter().map(|n| n.as_ptr()).collect();
    let highlighter = unsafe {
        c::ts_highlighter_new(name_ptrs.as_ptr(), attr_ptrs.as_ptr(), names.len() as u32)
    };
    add_encoding_c_language(
        highlighter,
        "javascript",
        ENCODING_HIGHLIGHTS,
        ENCODING_INJECTIONS,
        ENCODING_LOCALS,
    );
    let path = get_language_queries_path("html");
    add_encoding_c_language(
        highlighter,
        "html",
        &fs::read_to_string(path.join("highlights.scm")).unwrap(),
        "",
        "",
    );
    let buffer = c::ts_highlight_buffer_new();
    let entry = match (auto, encoding) {
        (false, TestEncoding::Le) => c::ts_highlighter_highlight_utf16_le,
        (false, TestEncoding::Be) => c::ts_highlighter_highlight_utf16_be,
        _ => c::ts_highlighter_highlight,
    };
    let error = unsafe {
        entry(
            highlighter,
            c_string("javascript").as_ptr(),
            bytes.as_ptr().cast(),
            bytes.len() as u32,
            buffer,
            ptr::null(),
        )
    };
    let output = unsafe {
        slice::from_raw_parts(
            c::ts_highlight_buffer_content(buffer),
            c::ts_highlight_buffer_len(buffer) as usize,
        )
        .to_vec()
    };
    let offsets = unsafe {
        slice::from_raw_parts(
            c::ts_highlight_buffer_line_offsets(buffer),
            c::ts_highlight_buffer_line_count(buffer) as usize,
        )
        .to_vec()
    };
    unsafe {
        c::ts_highlight_buffer_delete(buffer);
        c::ts_highlighter_delete(highlighter);
    }
    assert!(matches!(error, c::ErrorCode::Ok));
    (output, offsets)
}
fn add_encoding_c_language(
    highlighter: *mut c::TSHighlighter,
    name: &str,
    highlights: &str,
    injections: &str,
    locals: &str,
) {
    let error = unsafe {
        c::ts_highlighter_add_language(
            highlighter,
            c_string(name).as_ptr(),
            c_string(name).as_ptr(),
            c_string(&format!("^{name}$")).as_ptr(),
            get_language(name),
            highlights.as_ptr().cast(),
            injections.as_ptr().cast(),
            locals.as_ptr().cast(),
            highlights.len() as u32,
            injections.len() as u32,
            locals.len() as u32,
        )
    };
    assert!(matches!(error, c::ErrorCode::Ok));
}
#[test]
fn test_highlighting_via_c_api_utf16() {
    for program in [
        ENCODING_PROGRAM.to_owned(),
        format!("\u{feff}{ENCODING_PROGRAM}"),
    ] {
        let expected = c_encoding_output(program.as_bytes(), TestEncoding::Utf8, true);
        assert!(!expected.0.contains(&0));
        let html = str::from_utf8(&expected.0).unwrap();
        assert!(html.contains("<span class=tag>b</span>"));
        assert!(html.contains("class=function.builtin>Über"));
        for encoding in [TestEncoding::Le, TestEncoding::Be] {
            assert_eq!(
                c_encoding_output(
                    &encoding.encode(&program),
                    encoding,
                    program.starts_with('\u{feff}')
                ),
                expected
            );
        }
    }
}

fn expected_encoding_tokens() -> EncodedTokens {
    [
        ("const ", vec![]),
        ("café", vec!["constant"]),
        (" = ", vec![]),
        ("\"", vec!["string"]),
        ("naïve 😀", vec!["string", "string.special"]),
        ("\"", vec!["string"]),
        (";\n", vec![]),
        ("café", vec!["constant"]),
        (";\n", vec![]),
        ("Über", vec!["function.builtin"]),
        (";\n", vec![]),
        ("html", vec!["variable"]),
        ("`", vec!["string"]),
        ("<", vec!["string", "punctuation.bracket"]),
        ("b", vec!["string", "tag"]),
        (">", vec!["string", "punctuation.bracket"]),
        ("e\u{301}", vec!["string"]),
        ("</", vec!["string", "punctuation.bracket"]),
        ("b", vec!["string", "tag"]),
        (">", vec!["string", "punctuation.bracket"]),
        ("`", vec!["string"]),
        (";", vec![]),
    ]
    .into_iter()
    .map(|(text, names)| {
        (
            text.to_owned(),
            names.into_iter().map(str::to_owned).collect(),
        )
    })
    .collect()
}

fn encoded_html(
    bytes: &[u8],
    encoding: TestEncoding,
    config: &HighlightConfiguration,
) -> (Vec<u8>, Vec<u32>, Vec<String>) {
    let mut highlighter = Highlighter::new();
    let events = highlighter
        .highlight(
            config,
            bytes,
            encoding.input(),
            None,
            test_language_for_injection_string,
        )
        .unwrap();
    let mut renderer = HtmlRenderer::new();
    renderer.set_carriage_return_highlight(
        HIGHLIGHT_NAMES
            .iter()
            .position(|s| s == "carriage-return")
            .map(Highlight),
    );
    renderer
        .render_with_encoding(events, bytes, encoding.input(), &|h, out| {
            out.extend(HTML_ATTRS[h.0].as_bytes());
        })
        .unwrap();
    let lines = renderer.lines().map(str::to_owned).collect();
    assert!(!renderer.html.contains(&0));
    (renderer.html, renderer.line_offsets, lines)
}
fn assert_html_encodings(program: &str, config: &HighlightConfiguration) {
    let expected = encoded_html(program.as_bytes(), TestEncoding::Utf8, config);
    for encoding in [TestEncoding::Le, TestEncoding::Be] {
        assert_eq!(
            encoded_html(&encoding.encode(program), encoding, config),
            expected,
            "{encoding:?}"
        );
    }
}
#[test]
fn test_highlighting_encodings_render_identical_html() {
    assert_html_encodings(ENCODING_PROGRAM, &ENCODING_JS);
    assert_html_encodings(&ENCODING_PROGRAM.replace('\n', "\r\n"), &ENCODING_JS);
    assert_html_encodings(&ENCODING_PROGRAM.replace("café;", "café;\r"), &ENCODING_JS);
    assert_html_encodings("const s = html `<div>${a < b}</div>`;", &JS_HIGHLIGHT);
    assert_html_encodings(
        "<body>\n<script>const x = new Thing();</script>\n</body>",
        &HTML_HIGHLIGHT,
    );
    assert_html_encodings("const s = \"<>&'\\\"😀\";", &ENCODING_JS);
}

#[test]
fn test_highlighting_encoding_split_cr_highlight_lf() {
    let mut expected = None;
    for encoding in [TestEncoding::Utf8, TestEncoding::Le, TestEncoding::Be] {
        let bytes = encoding.encode("a\r\nb");
        let width = if matches!(encoding, TestEncoding::Utf8) {
            1
        } else {
            2
        };
        let events = [
            HighlightEvent::Source {
                start: 0,
                end: 2 * width,
            },
            HighlightEvent::HighlightStart(Highlight(0)),
            HighlightEvent::HighlightEnd,
            HighlightEvent::Source {
                start: 2 * width,
                end: bytes.len(),
            },
        ];
        let mut renderer = HtmlRenderer::new();
        renderer.set_carriage_return_highlight(Some(Highlight(1)));
        renderer
            .render_with_encoding(
                events.into_iter().map(Ok),
                &bytes,
                encoding.input(),
                &|_, out| out.extend(b"class=test"),
            )
            .unwrap();
        let result = (renderer.html, renderer.line_offsets);
        assert_eq!(result.0, b"a<span class=test></span>\nb\n");
        if let Some(expected) = &expected {
            assert_eq!(&result, expected);
        }
        expected = Some(result);
    }
}

fn assert_malformed_encoding(bytes: &[u8], encoding: TestEncoding, decoded: &str) {
    let events = encoding_events(bytes, encoding);
    assert_source_partition(&events, bytes.len());
    let mut original = String::new();
    for event in events {
        if let HighlightEvent::Source { start, end } = event {
            original.push_str(&encoding.decode(&bytes[start..end]));
        }
    }
    assert_eq!(original, decoded);
    // Malformed code points need not parse like a valid U+FFFD identifier.
    let config =
        HighlightConfiguration::new(get_language("javascript"), "javascript", "", "", "").unwrap();
    assert_eq!(
        encoded_html(bytes, encoding, &config),
        encoded_html(decoded.as_bytes(), TestEncoding::Utf8, &config)
    );
}
#[test]
fn test_highlighting_encoding_edge_inputs() {
    assert_html_encodings("", &ENCODING_JS);
    assert_html_encodings("\u{feff}", &ENCODING_JS);
    for encoding in [TestEncoding::Le, TestEncoding::Be] {
        let mut odd = encoding.encode(ENCODING_PROGRAM);
        odd.push(0x61);
        assert_malformed_encoding(&odd, encoding, &format!("{ENCODING_PROGRAM}�"));
        let mut lone = encoding.encode("const s = \"");
        let surrogate = match encoding {
            TestEncoding::Le => [0x00, 0xd8],
            _ => [0xd8, 0x00],
        };
        lone.extend(surrogate);
        lone.extend(encoding.encode("\";"));
        assert_malformed_encoding(&lone, encoding, "const s = \"�\";");
        let mut reversed = encoding.encode("const s = \"");
        let trail = match encoding {
            TestEncoding::Le => [0x00, 0xdc],
            _ => [0xdc, 0x00],
        };
        reversed.extend(trail);
        reversed.extend(surrogate);
        reversed.extend(encoding.encode("\";"));
        assert_malformed_encoding(&reversed, encoding, "const s = \"��\";");
        let mut final_lead = encoding.encode("const s = ");
        final_lead.extend(surrogate);
        assert_malformed_encoding(&final_lead, encoding, "const s = �");
    }
}

fn cli_encoding_output(program: &str, encoding: TestEncoding, html: bool, auto: bool) -> Vec<u8> {
    use crate::highlight::{HighlightOptions, HtmlOutput, HtmlStyling, Theme, highlight_source};
    let theme = Theme::default();
    let mut config = HighlightConfiguration::new(
        get_language("javascript"),
        "javascript",
        ENCODING_HIGHLIGHTS,
        ENCODING_INJECTIONS,
        ENCODING_LOCALS,
    )
    .unwrap();
    config.configure(&theme.highlight_names);
    let opts = HighlightOptions {
        theme,
        check: false,
        captures_path: None,
        html: html.then_some((HtmlOutput::Document, HtmlStyling::Classes)),
        quiet: false,
        print_time: false,
        cancellation_flag: std::sync::Arc::new(AtomicUsize::new(0)),
        encoding: if auto { None } else { encoding.input() },
    };
    let mut out = Vec::new();
    highlight_source(
        super::helpers::fixtures::test_loader(),
        &encoding.encode(program),
        "test",
        &config,
        false,
        &opts,
        &mut out,
    )
    .unwrap();
    assert!(!out.contains(&0));
    str::from_utf8(&out).unwrap();
    out
}
#[test]
fn test_highlighting_cli_output_matches_across_encodings() {
    for html in [false, true] {
        for program in [
            ENCODING_PROGRAM.to_owned(),
            format!("\u{feff}{ENCODING_PROGRAM}"),
        ] {
            assert_cli_encoding_output(&program, html);
        }
    }
}
fn assert_cli_encoding_output(program: &str, html: bool) {
    let expected = cli_encoding_output(program, TestEncoding::Utf8, html, false);
    assert!(str::from_utf8(&expected).unwrap().contains("café"));
    for encoding in [TestEncoding::Le, TestEncoding::Be] {
        assert_eq!(
            cli_encoding_output(program, encoding, html, false),
            expected
        );
        if program.starts_with('\u{feff}') {
            assert_eq!(cli_encoding_output(program, encoding, html, true), expected);
        }
    }
}

#[test]
fn test_highlighting_allocation_guard_restores_after_panic() {
    let result =
        std::panic::catch_unwind(|| rust_bytes_allocated_during(|| panic!("counting guard")));
    assert!(result.is_err());
    assert!(!COUNTING.get());
}

#[test]
fn test_highlighting_encoding_predicate_buffers_are_query_requested() {
    let mut config = HighlightConfiguration::new(
        get_language("javascript"),
        "javascript",
        r#"((string_fragment) @string.special (#match? @string.special "^é+😀$"))"#,
        "",
        "",
    )
    .unwrap();
    config.configure(&HIGHLIGHT_NAMES);
    let text = format!("\"{}😀\"", "é".repeat(4096));
    for encoding in [TestEncoding::Utf8, TestEncoding::Le, TestEncoding::Be] {
        let bytes = encoding.encode(&text);
        let mut highlighter = Highlighter::new();
        let (starts, allocated) = rust_bytes_allocated_during(|| {
            highlighter
                .highlight(&config, &bytes, encoding.input(), None, |_| None)
                .unwrap()
                .map(count_highlight_start)
                .sum::<usize>()
        });
        assert_eq!(starts, 1);
        eprintln!("{encoding:?} long predicate: {allocated} bytes");
        if matches!(encoding, TestEncoding::Utf8) {
            assert!(allocated < 4096 * 2, "UTF-8 predicate borrows the raw node");
        } else {
            assert!(
                allocated >= 4096 * 2,
                "UTF-16 predicate materializes only the requested node"
            );
        }
    }
}

#[test]
fn test_highlighting_encoding_malformed_predicate_is_lossy() {
    let mut config = HighlightConfiguration::new(
        get_language("javascript"),
        "javascript",
        r#"((string_fragment) @string.special (#eq? @string.special "�"))"#,
        "",
        "",
    )
    .unwrap();
    config.configure(&HIGHLIGHT_NAMES);
    for encoding in [TestEncoding::Le, TestEncoding::Be] {
        let mut bytes = encoding.encode("\"");
        bytes.extend(match encoding {
            TestEncoding::Le => [0x00, 0xd8],
            _ => [0xd8, 0x00],
        });
        bytes.extend(encoding.encode("\""));
        let mut highlighter = Highlighter::new();
        let events = highlighter
            .highlight(&config, &bytes, encoding.input(), None, |_| None)
            .unwrap();
        assert_eq!(
            events
                .filter(|event| matches!(event, Ok(HighlightEvent::HighlightStart(_))))
                .count(),
            1
        );
    }
}

fn count_highlight_start(event: Result<HighlightEvent, Error>) -> usize {
    usize::from(matches!(event.unwrap(), HighlightEvent::HighlightStart(_)))
}

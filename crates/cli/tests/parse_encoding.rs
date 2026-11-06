use std::{env, fs, path::Path, process::Command};

const SOURCE: &str = "{\"ké\": [1, \"😀\"]}";

fn cli() -> Command {
    let binary = env!("CARGO_BIN_EXE_tree-sitter");
    if let Ok(runner) = env::var("QEMU_RUNNER") {
        let mut parts = runner.split_whitespace();
        let mut command = Command::new(parts.next().unwrap());
        command.args(parts).arg(binary);
        return command;
    }
    Command::new(binary)
}

fn parse(grammar: &Path, input: &Path, cache: &Path, encoding: Option<&str>) -> (bool, String) {
    let mut command = cli();
    command
        .args(["parse", "--no-ranges", "--grammar-path"])
        .arg(grammar)
        .arg(input)
        .env("TREE_SITTER_LIBDIR", cache.join("lib"))
        .env("XDG_CACHE_HOME", cache);
    if let Some(encoding) = encoding {
        command.args(["--encoding", encoding]);
    }
    if env::var_os("QEMU_RUNNER").is_some() && cfg!(target_arch = "powerpc64") {
        command.env("CC", "powerpc64-linux-gnu-gcc");
    }
    if env::var_os("QEMU_RUNNER").is_some() && cfg!(target_arch = "arm") {
        command.env("CC", "arm-linux-gnueabihf-gcc");
    }
    let output = command.output().unwrap();
    let mut text = String::from_utf8(output.stdout).unwrap();
    if !output.status.success() {
        text.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    (output.status.success(), text)
}

fn utf16_bytes(source: &str, bom: bool, big_endian: bool) -> Vec<u8> {
    let text = if bom {
        format!("\u{feff}{source}")
    } else {
        source.to_owned()
    };
    text.encode_utf16()
        .flat_map(|unit| {
            if big_endian {
                unit.to_be_bytes()
            } else {
                unit.to_le_bytes()
            }
        })
        .collect()
}

fn check_case(
    grammar: &Path,
    input: &Path,
    cache: &Path,
    encoding: &str,
    bom: bool,
    explicit: bool,
    expected: &str,
) -> Option<String> {
    let bytes = utf16_bytes(SOURCE, bom, encoding == "utf16-be");
    fs::write(input, bytes).unwrap();
    let (success, actual) = parse(grammar, input, cache, explicit.then_some(encoding));
    if success && actual == expected {
        return None;
    }
    Some(format!(
        "{encoding}, BOM {bom}, explicit {explicit}: {actual}"
    ))
}

#[test]
fn parse_utf16_byte_orders() {
    let temp = tempfile::tempdir().unwrap();
    let grammar = temp.path().join("json");
    let src = grammar.join("src");
    fs::create_dir_all(src.join("tree_sitter")).unwrap();
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/grammars/json");
    for file in [
        "tree-sitter.json",
        "src/grammar.json",
        "src/parser.c",
        "src/tree_sitter/parser.h",
    ] {
        fs::copy(fixture.join(file), grammar.join(file)).unwrap();
    }

    let input = temp.path().join("input.json");
    fs::write(&input, SOURCE).unwrap();
    let (success, expected) = parse(&grammar, &input, temp.path(), None);
    assert!(success, "{expected}");
    assert_eq!(
        expected.split_whitespace().collect::<Vec<_>>().join(" "),
        "(document (object (pair key: (string (string_content)) value: (array (number) (string (string_content))))))"
    );

    let mut failures = Vec::new();
    for encoding in ["utf16-le", "utf16-be"] {
        for (bom, explicit) in [(false, true), (true, true), (true, false)] {
            failures.extend(check_case(
                &grammar,
                &input,
                temp.path(),
                encoding,
                bom,
                explicit,
                &expected,
            ));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

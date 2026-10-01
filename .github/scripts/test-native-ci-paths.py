import pathlib
import subprocess
import unittest


SCRIPT = pathlib.Path(__file__).with_name("native-ci-paths.sh")


class NativeCIPathsTest(unittest.TestCase):
    def classify(self, paths):
        changed = b"".join(path.encode() + b"\0" for path in paths)
        result = subprocess.run(
            ["bash", str(SCRIPT)], input=changed, capture_output=True, check=True
        )
        return result.stdout.decode().strip()

    def test_unrelated_paths(self):
        paths = [
            "test/highlight-compat/src/comparator.ts",
            "test/highlight-compat/package-lock.json",
            "test/highlight-compat/README.md",
            ".github/workflows/highlight-compat.yml",
            "docs/plans/textmate-scope-compatibility.md",
            "docs/src/cli/build.md",
            "docs/src/assets/css/playground.css",
            "docs/src/assets/schemas/grammar.schema.json",
            "docs/theme/favicon.png",
            "README.md",
            "CONTRIBUTING.md",
            "CHANGELOG.md",
            "LICENSE",
            "FUNDING.json",
            ".github/FUNDING.yml",
            ".github/ISSUE_TEMPLATE/bug_report.yml",
            ".github/pull_request_template.md",
        ]
        for path in paths:
            with self.subTest(path=path):
                self.assertEqual(self.classify([path]), "false")
        self.assertEqual(self.classify(paths), "false")
        self.assertEqual(self.classify([]), "false")

    def test_native_inputs(self):
        paths = [
            "lib/src/parser.c",
            "lib/binding_rust/README.md",
            "lib/binding_web/package-lock.json",
            "crates/cli/src/main.rs",
            "crates/highlight/README.md",
            "crates/xtask/src/test.rs",
            "cli/src/main.rs",
            "xtask/src/test.rs",
            "test/fixtures/fixtures.json",
            "test/fixtures/rust_wasm_web/Cargo.toml",
            "test/new-native-fixture.txt",
            "Cargo.toml",
            "Cargo.lock",
            ".cargo/config.toml",
            "Makefile",
            "CMakeLists.txt",
            "build.zig",
            "build.zig.zon",
            ".taplo.toml",
            ".editorconfig",
            ".gitattributes",
            ".gitignore",
            ".github/actions/cache/action.yml",
            ".github/scripts/qemu-maps.c",
            ".github/scripts/native-ci-paths.sh",
            ".github/workflows/ci.yml",
            ".github/workflows/build.yml",
            ".github/workflows/sanitize.yml",
            ".github/workflows/wasm_stdlib.yml",
            ".github/workflows/package.yml",
            "docs/src/assets/js/playground.js",
            "docs/book.toml",
            "docs/new-config.toml",
            "future-build-input",
        ]
        for path in paths:
            with self.subTest(path=path):
                self.assertEqual(self.classify([path]), "true")
                self.assertEqual(
                    self.classify(["README.md", path, "docs/src/index.md"]), "true"
                )

    def test_nul_delimited_paths(self):
        self.assertEqual(self.classify(["docs/line\nlib/src/parser.c.md"]), "false")
        self.assertEqual(self.classify(["lib/file with spaces\nand tabs\t.c"]), "true")


if __name__ == "__main__":
    unittest.main()

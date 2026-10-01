import os
import pathlib
import re
import subprocess
import textwrap
import unittest


SCRIPT = pathlib.Path(__file__).with_name("native-ci-paths.sh")
WORKFLOW = SCRIPT.parents[1] / "workflows" / "ci.yml"


def workflow_script(job):
    source = WORKFLOW.read_text().split(f"  {job}:\n", 1)[1]
    source = re.split(r"^  \S+:\n", source, maxsplit=1, flags=re.MULTILINE)[0]
    return textwrap.dedent(source.rsplit("        run: |\n", 1)[1])


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

    def test_toml_precedes_directory_exemptions(self):
        paths = [
            "test/highlight-compat/config.toml",
            "test/highlight-compat/nested/config.toml",
            "docs/book.toml",
            "docs/nested/config.toml",
            ".github/ISSUE_TEMPLATE/config.toml",
        ]
        for path in paths:
            with self.subTest(path=path):
                self.assertEqual(self.classify([path]), "true")

    def test_nul_delimited_paths(self):
        self.assertEqual(self.classify(["docs/line\nlib/src/parser.c.md"]), "false")
        self.assertEqual(self.classify(["lib/file with spaces\nand tabs\t.c"]), "true")


class NativeCIWorkflowTest(unittest.TestCase):
    def aggregate(self, native, **overrides):
        result = "success" if native == "true" else "skipped"
        env = dict(
            os.environ,
            CHANGES="success",
            NATIVE=native,
            CHECKS=result,
            SANITIZE=result,
            BUILD=result,
            WASM_STDLIB=result,
        )
        env.update(overrides)
        return subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", workflow_script("native-ci")],
            env=env,
            capture_output=True,
        ).returncode

    def test_aggregate_accepts_success_and_intentional_skip(self):
        self.assertEqual(self.aggregate("true"), 0)
        self.assertEqual(self.aggregate("false"), 0)

    def test_aggregate_rejects_missing_or_invalid_output(self):
        for native in ["", "invalid", "TRUE", " true ", "true\n", "False"]:
            with self.subTest(native=native):
                self.assertNotEqual(self.aggregate(native), 0)

    def test_aggregate_rejects_dependency_failures(self):
        cases = [
            (job, status)
            for job in ["CHANGES", "CHECKS", "SANITIZE", "BUILD", "WASM_STDLIB"]
            for status in ["failure", "cancelled"]
        ]
        for job, status in cases:
            with self.subTest(job=job, status=status):
                self.assertNotEqual(self.aggregate("true", **{job: status}), 0)
                self.assertNotEqual(self.aggregate("false", **{job: status}), 0)
        for job in ["CHECKS", "SANITIZE", "BUILD", "WASM_STDLIB"]:
            with self.subTest(job=job):
                self.assertNotEqual(self.aggregate("true", **{job: "skipped"}), 0)

    def test_workflow_declares_manual_dispatch(self):
        self.assertRegex(WORKFLOW.read_text(), r"(?m)^  workflow_dispatch:")

    def test_push_and_dispatch_bypass_pr_diff(self):
        for event in ["push", "workflow_dispatch"]:
            env = dict(
                os.environ,
                EVENT_NAME=event,
                BASE_SHA="",
                HEAD_SHA="",
                GITHUB_OUTPUT="/dev/stdout",
                GITHUB_STEP_SUMMARY="/dev/null",
            )
            result = subprocess.run(
                ["bash", "-e", "-o", "pipefail", "-c", workflow_script("changes")],
                cwd=SCRIPT.parents[2],
                env=env,
                capture_output=True,
            )
            with self.subTest(event=event):
                self.assertEqual(result.returncode, 0, result.stderr.decode())
                self.assertEqual(result.stdout, b"native=true\n")


if __name__ == "__main__":
    unittest.main()

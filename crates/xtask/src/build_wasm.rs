use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

use anyhow::{Result, anyhow};
use etcetera::BaseStrategy as _;
use notify::{
    EventKind, RecursiveMode,
    event::{AccessKind, AccessMode},
};
use notify_debouncer_full::new_debouncer;
use tree_sitter_loader::{IoError, LoaderError, WasmToolError};

use crate::{BuildWasm, bail_on_err, watch_wasm};

const WASI_SDK_VERSION: &str = include_str!("../../loader/wasi-sdk-version").trim_ascii();
const WASI_LIBC_REVISION: &str = "161b3195fc2558d2b1ba3eb9ffae3b2b47407623";
const BINARYEN_VERSION: &str = include_str!("../../loader/binaryen-version").trim_ascii();

const WASI_LIBC_FILES: &[&str] = &[
    "ctype/alpha.h",
    "ctype/casemap.h",
    "ctype/isblank.c",
    "ctype/iswalnum.c",
    "ctype/iswalpha.c",
    "ctype/iswblank.c",
    "ctype/iswdigit.c",
    "ctype/iswlower.c",
    "ctype/iswpunct.c",
    "ctype/iswspace.c",
    "ctype/iswupper.c",
    "ctype/iswxdigit.c",
    "ctype/punct.h",
    "ctype/towctrans.c",
    "string/memchr.c",
    "string/memcmp.c",
    "string/memcpy.c",
    "string/memmove.c",
    "string/memset.c",
    "string/strchr.c",
    "string/strchrnul.c",
    "string/strcmp.c",
    "string/strlen.c",
    "string/stpncpy.c",
    "string/strncat.c",
    "string/strncmp.c",
    "string/strncpy.c",
    "string/wcschr.c",
    "string/wcslen.c",
];

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const ARCH_OS: Result<&str, LoaderError> = Ok("arm64-macos");
#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
const ARCH_OS: Result<&str, LoaderError> = Ok("x86_64-macos");
#[cfg(all(
    target_os = "macos",
    not(any(target_arch = "aarch64", target_arch = "x86_64"))
))]
const ARCH_OS: Result<&str, LoaderError> = Err(LoaderError::WasiSDKPlatform);

#[cfg(all(target_os = "windows", target_arch = "aarch64"))]
const ARCH_OS: Result<&str, LoaderError> = Ok("arm64-windows");
#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
const ARCH_OS: Result<&str, LoaderError> = Ok("x86_64-windows");
#[cfg(all(
    target_os = "windows",
    not(any(target_arch = "aarch64", target_arch = "x86_64"))
))]
const ARCH_OS: Result<&str, LoaderError> = Err(LoaderError::WasiSDKPlatform);

#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
const ARCH_OS: Result<&str, LoaderError> = Ok("arm64-linux");
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
const ARCH_OS: Result<&str, LoaderError> = Ok("x86_64-linux");
#[cfg(all(
    target_os = "linux",
    not(any(target_arch = "aarch64", target_arch = "x86_64"))
))]
const ARCH_OS: Result<&str, LoaderError> = Err(LoaderError::WasiSDKPlatform);

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
const ARCH_OS: Result<&str, LoaderError> = Err(LoaderError::WasiSDKPlatform);

/// Builds `lib/binding_web/lib/web-tree-sitter.wasm` with the WASI SDK: the runtime, the binding
/// glue and the libc grammars and extensions may import. `src/wasi-module.ts` instantiates it and
/// links language modules into its memory and function table; there is no Emscripten runtime.
pub fn run_wasm(args: &BuildWasm) -> Result<()> {
    let clang = ensure_wasi_sdk_exists()?;
    let wasm_opt = if args.debug {
        None
    } else {
        Some(ensure_binaryen_exists()?)
    };
    let build = || build_wasm(&clang, wasm_opt.as_deref(), args);
    if args.watch {
        watch_wasm!(build);
    } else {
        build()?;
    }
    Ok(())
}

/// Names the runtime exports: libc for grammars (`wasm-stdlib/imports.txt`) and for published
/// grammars and extensions beyond it (`extra-exports.txt`), the binding glue (`exports.txt`),
/// and the public C API from `api.h`, so extensions can work on trees directly.
fn runtime_exports() -> Result<Vec<String>> {
    let mut names = Vec::new();
    for list in [
        "lib/src/wasm-stdlib/imports.txt",
        "lib/binding_web/lib/extra-exports.txt",
        "lib/binding_web/lib/exports.txt",
    ] {
        for line in fs::read_to_string(list)?.lines() {
            let name = line.trim().trim_matches(|c| c == '"' || c == ',');
            if !name.is_empty() {
                names.push(name.to_string());
            }
        }
    }
    let api = fs::read_to_string("lib/include/tree_sitter/api.h")?;
    let function = regex::Regex::new(r"\b(ts_[a-z0-9_]+)\(")?;
    let mut api_names = function
        .captures_iter(&api)
        .map(|captures| captures[1].to_string())
        .filter(|name| !name.contains("wasm"))
        .collect::<Vec<_>>();
    api_names.sort();
    api_names.dedup();
    names.extend(api_names);
    Ok(names)
}

fn build_wasm(clang: &Path, wasm_opt: Option<&Path>, args: &BuildWasm) -> Result<()> {
    let output = "lib/binding_web/lib/web-tree-sitter.wasm";
    let optimization = if args.debug { "-O0" } else { "-O3" };
    let mut command = Command::new(clang);
    command.args([
        "--target=wasm32-wasip1",
        "-mexec-model=reactor",
        optimization,
        "-std=c11",
        "-fno-exceptions",
        "-D_POSIX_C_SOURCE=200809L",
        "-Ilib/src",
        "-Ilib/include",
        "lib/binding_web/lib/tree-sitter.c",
        "lib/src/lib.c",
        "-Wl,--export-memory",
        "-Wl,--export-table",
        "-Wl,--growable-table",
        // Grammars and extensions run on this stack. 64 KB, the default, overflowed on deeply
        // nested markdown; placed first, an overflow traps instead of writing over data.
        "-Wl,-z,stack-size=1048576",
        "-Wl,--stack-first",
        "-Wl,--export=__stack_pointer",
        "-o",
        output,
    ]);
    if args.debug {
        command.arg("-g");
    } else {
        command.args(["-flto", "-DNDEBUG", "-Wl,--strip-debug"]);
    }
    if args.verbose {
        command.arg("-v");
    }
    for name in runtime_exports()? {
        command.arg(format!("-Wl,--export={name}"));
    }
    bail_on_err(
        &command.spawn()?.wait_with_output()?,
        "Failed to compile the Tree-sitter Wasm library",
    )?;

    if let Some(wasm_opt) = wasm_opt {
        let mut command = Command::new(wasm_opt);
        command.args([
            "-O3",
            "--enable-bulk-memory",
            "--enable-mutable-globals",
            "--enable-sign-ext",
            "--enable-nontrapping-float-to-int",
            output,
            "-o",
            output,
        ]);
        bail_on_err(
            &command.spawn()?.wait_with_output()?,
            "Failed to optimize the Tree-sitter Wasm library",
        )?;
    }
    Ok(())
}

/// This ensures that wasi-sdk is available, downloading and extracting it if necessary,
/// and returns the path to the `clang` executable.
///
/// If `TREE_SITTER_WASI_SDK_PATH` is set, it will use that path to look for the clang executable.
///
/// Note that this is just a minimally modified version of
/// `tree_sitter_loader::ensure_wasi_sdk_exists`. In the loader, this functionality is implemented
/// as a private method of `Loader`. Rather than add this to the public API, we just
/// re-implement it. Any fixes and/or modifications made to the loader's copy should be reflected
/// here.
pub fn ensure_wasi_sdk_exists() -> Result<PathBuf> {
    let possible_executables = if cfg!(windows) {
        vec![
            "clang.exe",
            "wasm32-unknown-wasi-clang.exe",
            "wasm32-wasi-clang.exe",
        ]
    } else {
        vec!["clang", "wasm32-unknown-wasi-clang", "wasm32-wasi-clang"]
    };

    if let Some(path) = get_existing_tool(
        "clang",
        "wasi-sdk",
        WASI_SDK_VERSION,
        &possible_executables,
        "TREE_SITTER_WASI_SDK_PATH",
    )? {
        return Ok(path);
    }

    let arch_os = ARCH_OS?;
    let sdk_filename = format!("wasi-sdk-{WASI_SDK_VERSION}-{arch_os}.tar.gz");
    let wasi_sdk_major_version = WASI_SDK_VERSION
        .trim_end_matches(char::is_numeric) // trim minor version...
        .trim_end_matches('.'); // ...and '.' separator
    let sdk_url = format!(
        "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-{wasi_sdk_major_version}/{sdk_filename}",
    );
    download_tool(
        "clang",
        "wasi-sdk",
        WASI_SDK_VERSION,
        &sdk_filename,
        &sdk_url,
        &possible_executables,
    )
}

/// This ensures that binaryen is available, downloading and extracting it if necessary,
/// and returns the path to the `wasm-opt` executable.
///
/// If `TREE_SITTER_BINARYEN_PATH` is set, it will use that path to look for the wasm-opt executable.
///
/// Note that this is just a minimally modified version of
/// `tree_sitter_loader::ensure_binaryen_exists`. In the loader, this functionality is implemented
/// as a private method of `Loader`. Rather than add this to the public API, we just
/// re-implement it. Any fixes and/or modifications made to the loader's copy should be reflected
/// here.
pub fn ensure_binaryen_exists() -> Result<PathBuf> {
    let possible_executables = if cfg!(windows) {
        vec![
            "wasm-opt.exe",
            "wasm32-unknown-wasm-opt.exe",
            "wasm32-wasm-opt.exe",
        ]
    } else {
        vec!["wasm-opt", "wasm32-unknown-wasm-opt", "wasm32-wasm-opt"]
    };
    if let Some(path) = get_existing_tool(
        "wasm-opt",
        "binaryen",
        BINARYEN_VERSION,
        &possible_executables,
        "TREE_SITTER_BINARYEN_PATH",
    )? {
        return Ok(path);
    }

    let arch_os = ARCH_OS?.replace("arm64-linux", "aarch64-linux");
    let binaryen_filename = format!("binaryen-version_{BINARYEN_VERSION}-{arch_os}.tar.gz");
    let binaryen_url = format!(
        "https://github.com/WebAssembly/binaryen/releases/download/version_{BINARYEN_VERSION}/{binaryen_filename}"
    );
    download_tool(
        "wasm-opt",
        "binaryen",
        BINARYEN_VERSION,
        &binaryen_filename,
        &binaryen_url,
        &possible_executables,
    )
}

fn get_existing_tool(
    tool_name: &'static str,
    toolchain: &'static str,
    version: &str,
    possible_exes: &[&'static str],
    env_var: &str,
) -> Result<Option<PathBuf>> {
    if let Ok(tool_path) = std::env::var(env_var) {
        let tool_dir = PathBuf::from(tool_path);

        for exe in possible_exes {
            let tool_exe = tool_dir.join("bin").join(exe);
            if tool_exe.exists() {
                return Ok(Some(tool_exe));
            }
        }

        Err(LoaderError::WasmTool(WasmToolError {
            exe: tool_name,
            toolchain,
            tool_dir: tool_dir.to_string_lossy().to_string(),
            possible_executables: possible_exes.to_vec(),
            download: false,
        }))?;
    }

    let cache_dir = etcetera::choose_base_strategy()?
        .cache_dir()
        .join("tree-sitter");
    fs::create_dir_all(&cache_dir).map_err(|error| {
        LoaderError::IO(IoError {
            error,
            path: Some(cache_dir.clone()),
        })
    })?;

    let toolchain_dir = cache_dir.join(toolchain);
    let version_file = toolchain_dir.join(".version");

    // If a cached toolchain exists but the version doesn't match, remove it
    if toolchain_dir.exists() {
        let cached_version =
            fs::read_to_string(&version_file).unwrap_or_else(|_| "unknown".to_string());
        if cached_version.trim() != version {
            eprintln!(
                "Cached {toolchain} version ({}) doesn't match expected version ({version}), re-downloading",
                cached_version.trim(),
            );
            fs::remove_dir_all(&toolchain_dir).ok();
            return Ok(None);
        }
    }

    let tool_dir = toolchain_dir.join("bin");

    for exe in possible_exes {
        let tool_exe = tool_dir.join(exe);
        if tool_exe.exists() {
            return Ok(Some(tool_exe));
        }
    }

    Ok(None)
}

fn download_tool(
    tool_name: &'static str,
    toolchain: &'static str,
    version: &str,
    filename: &str,
    url: &str,
    possible_exes: &[&'static str],
) -> Result<PathBuf> {
    let cache_dir = etcetera::choose_base_strategy()?
        .cache_dir()
        .join("tree-sitter");
    let tool_dir = cache_dir.join(toolchain);

    fs::create_dir_all(&tool_dir).map_err(|error| {
        LoaderError::IO(IoError {
            error,
            path: Some(tool_dir.clone()),
        })
    })?;

    eprintln!("Downloading {tool_name} from {url}...");
    let temp_tar_path = cache_dir.join(filename);

    let status = Command::new("curl")
        .arg("-f")
        .arg("-L")
        .arg("-o")
        .arg(&temp_tar_path)
        .arg(url)
        .status()
        .map_err(|e| {
            LoaderError::Curl(
                url.to_string(),
                IoError {
                    error: e,
                    path: None,
                },
            )
        })?;

    if !status.success() {
        Err(LoaderError::WasmToolDownload {
            tool: tool_name,
            url: url.to_string(),
        })?;
    }

    eprintln!("Extracting {tool_name} to {}...", tool_dir.display());
    extract_tar_gz_with_strip(&temp_tar_path, &tool_dir)?;

    fs::write(tool_dir.join(".version"), version).ok();

    fs::remove_file(temp_tar_path).ok();
    for exe in possible_exes {
        let tool_exe = tool_dir.join("bin").join(exe);
        if tool_exe.exists() {
            return Ok(tool_exe);
        }
    }

    Err(LoaderError::WasmTool(WasmToolError {
        exe: tool_name,
        toolchain,
        tool_dir: tool_dir.to_string_lossy().to_string(),
        possible_executables: possible_exes.to_vec(),
        download: true,
    }))?
}

/// Extracts a tar.gz archive with `tar`, stripping the first path component.
fn extract_tar_gz_with_strip(archive_path: &Path, destination: &Path) -> Result<()> {
    let status = Command::new("tar")
        .arg("-xzf")
        .arg(archive_path)
        .arg("--strip-components=1")
        .arg("-C")
        .arg(destination)
        .status()
        .map_err(|e| {
            LoaderError::Tar(IoError {
                error: e,
                path: Some(archive_path.to_path_buf()),
            })
        })?;

    if !status.success() {
        Err(LoaderError::Extraction(
            archive_path.to_string_lossy().to_string(),
            destination.to_string_lossy().to_string(),
        ))?;
    }

    Ok(())
}

pub fn vendor_wasm_stdlib() -> Result<()> {
    let source_dir = ensure_wasi_libc_source_exists()?;
    let source_dir = source_dir.join("libc-top-half/musl");
    let destination = Path::new("lib/src/wasm-stdlib/libc");

    for directory in ["ctype", "string"] {
        let directory = destination.join(directory);
        if directory.exists() {
            fs::remove_dir_all(&directory)?;
        }
        fs::create_dir_all(directory)?;
    }

    fs::copy(source_dir.join("COPYRIGHT"), destination.join("LICENSE"))?;
    let source_dir = source_dir.join("src");
    for relative_path in WASI_LIBC_FILES {
        let relative_path = Path::new(relative_path);
        fs::copy(
            source_dir.join(relative_path),
            destination.join(relative_path),
        )?;
    }

    println!(
        "Vendored {} wasi-libc files from {WASI_LIBC_REVISION}",
        WASI_LIBC_FILES.len()
    );
    Ok(())
}

fn ensure_wasi_libc_source_exists() -> Result<PathBuf> {
    let cache_dir = etcetera::choose_base_strategy()?
        .cache_dir()
        .join("tree-sitter")
        .join("wasi-libc");
    fs::create_dir_all(&cache_dir)?;

    let source_dir = cache_dir.join(WASI_LIBC_REVISION);
    if source_dir.join("libc-top-half/musl/COPYRIGHT").is_file() {
        return Ok(source_dir);
    }

    let archive_name = format!("wasi-libc-{WASI_LIBC_REVISION}.tar.gz");
    let archive_path = cache_dir.join(&archive_name);
    let url =
        format!("https://github.com/WebAssembly/wasi-libc/archive/{WASI_LIBC_REVISION}.tar.gz");
    eprintln!("Downloading wasi-libc from {url}...");
    let status = Command::new("curl")
        .args(["-f", "-L", "-o"])
        .arg(&archive_path)
        .arg(&url)
        .status()
        .map_err(|error| LoaderError::Curl(url.clone(), IoError { error, path: None }))?;
    if !status.success() {
        return Err(LoaderError::WasmToolDownload {
            tool: "wasi-libc",
            url,
        }
        .into());
    }

    let temporary_dir = cache_dir.join(format!(".{WASI_LIBC_REVISION}.tmp"));
    if temporary_dir.exists() {
        fs::remove_dir_all(&temporary_dir)?;
    }
    fs::create_dir_all(&temporary_dir)?;
    extract_tar_gz_with_strip(&archive_path, &temporary_dir)?;
    fs::rename(&temporary_dir, &source_dir)?;
    fs::remove_file(archive_path)?;
    Ok(source_dir)
}

pub fn run_wasm_stdlib() -> Result<()> {
    let export_flags = include_str!("../../../lib/src/wasm-stdlib/imports.txt")
        .lines()
        .map(|line| format!("-Wl,--export={}", &line[1..line.len() - 2]))
        .collect::<Vec<String>>();

    let clang_exe = ensure_wasi_sdk_exists()?;

    let compile_output = Command::new(&clang_exe)
        .args([
            "-o",
            "stdlib.wasm",
            "-Os",
            "-fPIC",
            "-nostdlib",
            "-Wl,--no-entry",
            "-Wl,--stack-first",
            "-Wl,-z",
            "-Wl,stack-size=65536",
            "-Wl,--import-undefined",
            "-Wl,--import-memory",
            "-Wl,--import-table",
            "-Wl,--strip-debug",
            "-Wl,--export=__wasm_call_ctors",
            "-Wl,--export=__stack_pointer",
            "-Wl,--export=reset_heap",
        ])
        .args(&export_flags)
        .arg("-Icrates/language/wasm/include")
        .arg("lib/src/wasm-stdlib/libc.c")
        .arg("lib/src/wasm-stdlib/stdio.c")
        .arg("lib/src/wasm-stdlib/external_scanner_allocator.c")
        .output()?;

    bail_on_err(
        &compile_output,
        "Failed to compile the Tree-sitter Wasm stdlib",
    )?;

    let wasm_opt_exe = ensure_binaryen_exists()?;

    let opt_output = Command::new(&wasm_opt_exe)
        .args(["stdlib.wasm", "-Os", "-o", "stdlib.wasm"])
        .output()?;

    bail_on_err(
        &opt_output,
        "Failed to optimize the Tree-sitter Wasm stdlib",
    )?;

    let xxd = Command::new("xxd")
        .args(["-C", "-i", "stdlib.wasm"])
        .output()?;

    bail_on_err(
        &xxd,
        "Failed to run xxd on the compiled Tree-sitter Wasm stdlib",
    )?;

    fs::write("lib/src/wasm-stdlib/external_scanner_stdlib.h", xxd.stdout)?;

    fs::rename("stdlib.wasm", "target/stdlib.wasm")?;

    Ok(())
}

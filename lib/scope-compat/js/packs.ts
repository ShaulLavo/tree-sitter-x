export interface BuiltinPackMetadata {
  readonly languageId: string;
  readonly rootScope: string;
  readonly scopeSuffix: string;
  readonly queryPaths: readonly string[];
}

export const BUILTIN_PACKS: Readonly<Record<string, BuiltinPackMetadata>> = Object.freeze({
  json: Object.freeze({
    languageId: 'json',
    rootScope: 'source.json',
    scopeSuffix: '.json',
    queryPaths: Object.freeze(['packs/json/json.scm']),
  }),
  javascript: Object.freeze({
    languageId: 'javascript',
    rootScope: 'source.js',
    scopeSuffix: '.js',
    queryPaths: Object.freeze(['packs/shared/javascript-common.scm', 'packs/javascript/javascript.scm']),
  }),
  jsx: Object.freeze({
    languageId: 'jsx',
    rootScope: 'source.js.jsx',
    scopeSuffix: '.js.jsx',
    queryPaths: Object.freeze(['packs/shared/javascript-common.scm', 'packs/jsx/jsx.scm']),
  }),
  typescript: Object.freeze({
    languageId: 'typescript',
    rootScope: 'source.ts',
    scopeSuffix: '.ts',
    queryPaths: Object.freeze(['packs/shared/typescript-common.scm', 'packs/typescript/typescript.scm']),
  }),
  tsx: Object.freeze({
    languageId: 'tsx',
    rootScope: 'source.tsx',
    scopeSuffix: '.tsx',
    queryPaths: Object.freeze(['packs/shared/typescript-common.scm', 'packs/tsx/tsx.scm']),
  }),
  css: Object.freeze({
    languageId: 'css',
    rootScope: 'source.css',
    scopeSuffix: '.css',
    queryPaths: Object.freeze(['packs/css/css.scm']),
  }),
  html: Object.freeze({
    languageId: 'html',
    rootScope: 'text.html.basic',
    scopeSuffix: '.html',
    queryPaths: Object.freeze(['packs/html/html.scm']),
  }),
  shellscript: Object.freeze({
    languageId: 'shellscript',
    rootScope: 'source.shell',
    scopeSuffix: '.shell',
    queryPaths: Object.freeze(['packs/shellscript/shellscript.scm']),
  }),
  rust: Object.freeze({
    languageId: 'rust',
    rootScope: 'source.rust',
    scopeSuffix: '.rust',
    queryPaths: Object.freeze(['packs/rust/rust.scm']),
  }),
  python: Object.freeze({
    languageId: 'python',
    rootScope: 'source.python',
    scopeSuffix: '.python',
    queryPaths: Object.freeze(['packs/python/python.scm']),
  }),
  go: Object.freeze({
    languageId: 'go',
    rootScope: 'source.go',
    scopeSuffix: '.go',
    queryPaths: Object.freeze(['packs/go/go.scm']),
  }),
  yaml: Object.freeze({
    languageId: 'yaml',
    rootScope: 'source.yaml',
    scopeSuffix: '.yaml',
    queryPaths: Object.freeze(['packs/yaml/yaml.scm']),
  }),
  toml: Object.freeze({
    languageId: 'toml',
    rootScope: 'source.toml',
    scopeSuffix: '.toml',
    queryPaths: Object.freeze(['packs/toml/toml.scm']),
  }),
});

export const LANGUAGE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  bash: 'shellscript',
  sh: 'shellscript',
  shell: 'shellscript',
  zsh: 'shellscript',
  rs: 'rust',
  py: 'python',
  yml: 'yaml',
});

export function resolveLanguageAlias(languageId: string): string {
  const normalized = languageId.trim().toLowerCase();
  return Object.hasOwn(LANGUAGE_ALIASES, normalized) ? LANGUAGE_ALIASES[normalized] : normalized;
}

export function getBuiltinPack(languageId: string): BuiltinPackMetadata | undefined {
  const canonical = resolveLanguageAlias(languageId);
  return Object.hasOwn(BUILTIN_PACKS, canonical) ? BUILTIN_PACKS[canonical] : undefined;
}

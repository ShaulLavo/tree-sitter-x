export {
  FONT_STYLE_BOLD,
  FONT_STYLE_ITALIC,
  FONT_STYLE_STRIKETHROUGH,
  FONT_STYLE_UNDERLINE,
  ScopeCompatError,
} from './types.ts';
export type {
  CompileThemeOptions,
  FallbackHighlightOptions,
  HighlightOptions,
  PackDefinition,
  ResolveThemeOptions,
  ScopeCompatErrorReason,
  ScopeLimits,
  ScopeResult,
  ScopeWindow,
  SessionChange,
  SessionInvalidation,
  StyledResult,
  TextEdit,
  TreeSitterBinding,
  TreeSitterCapture,
  TreeSitterCaptureRange,
  TreeSitterLanguage,
  TreeSitterNode,
  TreeSitterQuery,
  TreeSitterQueryOptions,
  TreeSitterRange,
  TreeSitterTextBuffer,
  TreeSitterTree,
  VscodeThemeInput,
  VscodeTokenColor,
  VscodeTokenSettings,
} from './types.ts';
export { ScopeCompat, ScopePack } from './runtime.ts';
export { ScopeTheme, buildThemePacket, parseColorRgba } from './theme.ts';
export type { CompiledThemePacket } from './theme.ts';
export { ScopeHighlightSession } from './session.ts';
export {
  ZED_PLUS_CAPTURE_MAP,
  highlightTreeWithFallback,
  resolveZedPlusScopes,
} from './fallback.ts';
export {
  BUILTIN_PACKS,
  LANGUAGE_ALIASES,
  getBuiltinPack,
  resolveLanguageAlias,
} from './packs.ts';
export type { BuiltinPackMetadata } from './packs.ts';

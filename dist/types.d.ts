export declare const FONT_STYLE_ITALIC = 1;
export declare const FONT_STYLE_BOLD = 2;
export declare const FONT_STYLE_UNDERLINE = 4;
export declare const FONT_STYLE_STRIKETHROUGH = 8;
export interface TreeSitterLanguage {
    readonly abiVersion?: number;
}
export interface TreeSitterTextBuffer {
    readonly length: number;
    readonly read: unknown;
}
export interface TreeSitterNode {
    readonly type: string;
    readonly startIndex: number;
    readonly endIndex: number;
    readonly hasError: boolean;
    readonly namedChildCount: number;
    namedChild(index: number): TreeSitterNode | null;
}
export interface TreeSitterTree {
    readonly language: TreeSitterLanguage;
    readonly rootNode: TreeSitterNode;
}
export interface TreeSitterRange {
    readonly startIndex: number;
    readonly endIndex: number;
}
export interface TreeSitterCapture {
    readonly name: string;
    readonly patternIndex: number;
    readonly node: {
        readonly startIndex: number;
        readonly endIndex: number;
    };
}
export interface TreeSitterCaptureRange {
    readonly name: string;
    readonly patternIndex: number;
    readonly startIndex: number;
    readonly endIndex: number;
}
export interface TreeSitterQueryOptions {
    readonly startIndex?: number;
    readonly endIndex?: number;
    readonly matchLimit?: number;
}
export interface TreeSitterQuery {
    readonly captureNames: readonly string[];
    captures(node: TreeSitterNode, options?: TreeSitterQueryOptions): readonly TreeSitterCapture[];
    captureRanges?(node: TreeSitterNode, options?: TreeSitterQueryOptions): readonly TreeSitterCaptureRange[];
    didExceedMatchLimit(): boolean;
    delete(): void;
}
export interface TreeSitterBinding {
    loadExtension(module: WebAssembly.Module): Promise<Record<string, unknown>>;
    heap(): Uint8Array;
}
export interface ScopeWindow {
    readonly start: number;
    readonly end: number;
}
export interface ScopeLimits {
    readonly matchLimit?: number;
    readonly maxIntervals?: number;
    readonly maxSegments?: number;
}
export interface HighlightOptions {
    readonly window?: ScopeWindow;
    readonly limits?: ScopeLimits;
}
export interface PackDefinition {
    readonly languageId: string;
    readonly rootScope: string;
    readonly scopeSuffix: string;
    readonly query: string;
    readonly localInvalidation?: boolean;
}
export interface ScopeResult {
    readonly sourceLength: number;
    readonly window: ScopeWindow;
    readonly segments: Uint32Array;
    readonly paths: readonly (readonly number[])[];
    readonly scopes: readonly string[];
}
export interface StyledResult {
    readonly sourceLength: number;
    readonly window: ScopeWindow;
    readonly segments: Uint32Array;
    readonly foregroundRgba: Uint32Array;
    readonly backgroundRgba: Uint32Array;
    readonly fontMask: Uint8Array;
    readonly defaultForegroundRgba: number;
    readonly defaultBackgroundRgba: number;
}
export interface VscodeTokenSettings {
    readonly foreground?: string;
    readonly background?: string;
    readonly fontStyle?: string;
}
export interface VscodeTokenColor {
    readonly name?: string;
    readonly scope?: string | readonly string[];
    readonly settings?: VscodeTokenSettings;
}
export interface VscodeThemeInput {
    readonly name?: string;
    readonly type?: 'dark' | 'light' | string;
    readonly colors?: Readonly<Record<string, unknown>>;
    readonly tokenColors?: readonly VscodeTokenColor[];
    readonly settings?: readonly VscodeTokenColor[];
    readonly fg?: string;
    readonly bg?: string;
}
export interface CompileThemeOptions {
    readonly maxPacketBytes?: number;
    readonly maxSteps?: number;
    readonly maxTrieNodes?: number;
    readonly maxContextRules?: number;
    readonly maxOwnedBytes?: number;
}
export interface ResolveThemeOptions {
    readonly maxPacketBytes?: number;
    readonly maxSteps?: number;
    readonly maxOutputBytes?: number;
}
export interface TextEdit {
    readonly from: number;
    readonly to: number;
    readonly insertLength: number;
}
export interface SessionChange {
    readonly edits: readonly TextEdit[];
    readonly changedRanges: readonly TreeSitterRange[];
    readonly source?: string;
}
export interface SessionInvalidation {
    readonly mode: 'local-range' | 'full-document';
    readonly oldRange: {
        readonly from: number;
        readonly to: number;
    };
    readonly newRange: {
        readonly from: number;
        readonly to: number;
    };
    readonly sourceLength: number;
}
export interface FallbackHighlightOptions {
    readonly rootScope: string;
    readonly scopeSuffix?: string;
    readonly window?: ScopeWindow;
    readonly matchLimit?: number;
}
export type ScopeCompatErrorReason = 'unsupported' | 'budget' | 'invalid' | 'no-memory';
export declare class ScopeCompatError extends Error {
    readonly status: number;
    readonly detail: number;
    readonly value: number;
    readonly reason: ScopeCompatErrorReason;
    constructor(message: string, status: number, detail: number, value?: number);
}

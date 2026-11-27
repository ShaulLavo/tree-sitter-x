import type { ScopeWindow } from './types.ts';
export declare const NONE = 4294967295;
export declare const DEFAULT_THEME_PACKET_BYTES: number;
export declare const DEFAULT_THEME_COMPILE_STEPS = 4000000;
export declare const DEFAULT_THEME_TRIE_NODES = 131072;
export declare const DEFAULT_THEME_CONTEXT_RULES = 262144;
export declare const DEFAULT_THEME_OWNED_BYTES: number;
export declare const DEFAULT_THEME_RESOLVE_STEPS = 4000000;
export declare const DEFAULT_THEME_OUTPUT_BYTES: number;
export interface NativeThemeRule {
    readonly tail: number;
    readonly contexts: readonly {
        readonly atom: number;
        readonly immediate: boolean;
    }[];
    readonly rule: number;
    readonly alternative: number;
    readonly present: number;
    readonly foreground: number;
    readonly background: number;
    readonly fontMask: number;
}
export interface EncodedPathPacket {
    readonly bytes: Uint8Array;
    readonly pathIds: Uint32Array;
    readonly count: number;
}
export interface DecodedScopePass {
    readonly segments: Uint32Array;
    readonly paths: readonly (readonly number[])[];
}
export interface DecodedThemeStyles {
    readonly foregrounds: Uint32Array;
    readonly backgrounds: Uint32Array;
    readonly fontMasks: Uint8Array;
}
export declare function u32(value: number): number;
export declare function address(value: unknown): number;
export declare function checkSpan(heap: Uint8Array, pointer: number, count: number, width: number, alignment?: number): number;
export declare function checkSourceSpan(heap: Uint8Array, pointer: number, length: number): void;
export declare function readU32Words(heap: Uint8Array, pointer: number, count: number): Uint32Array;
export declare function readCString(heap: Uint8Array, pointer: number, maximum?: number, diagnostic?: boolean): string;
export declare function validateScopeLayout(heap: Uint8Array, pointer: number): void;
export declare function validateThemeLayout(heap: Uint8Array, pointer: number): void;
export declare function decodeScopeResult(heap: Uint8Array, pointer: number, window: ScopeWindow, scopeCount: number): DecodedScopePass;
export declare function encodeThemePacket(atoms: readonly string[], rules: readonly NativeThemeRule[], maxBytes: number): Uint8Array;
export declare function encodePathPacket(paths: readonly (readonly number[])[], scopes: readonly string[], maxBytes: number): EncodedPathPacket;
export declare function decodeThemeResult(heap: Uint8Array, pointer: number, expectedCount: number): DecodedThemeStyles;

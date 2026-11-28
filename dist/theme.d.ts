import type { ResolveThemeOptions, ScopeResult, StyledResult, VscodeThemeInput } from './types.js';
export interface CompiledThemePacket {
    readonly packet: Uint8Array;
    readonly defaultForegroundRgba: number;
    readonly defaultBackgroundRgba: number;
}
export declare function parseColorRgba(value: string): number;
export declare function buildThemePacket(input: VscodeThemeInput | readonly VscodeThemeInput[], maxPacketBytes?: number): CompiledThemePacket;
export interface ThemeHost {
    heap(): Uint8Array;
    call(name: string, args?: readonly number[]): unknown;
    number(name: string, args?: readonly number[]): number;
    withBytes<T>(bytes: Uint8Array, action: (pointer: number, length: number) => T): T;
}
export declare class ScopeTheme {
    #private;
    readonly defaultForegroundRgba: number;
    readonly defaultBackgroundRgba: number;
    constructor(host: ThemeHost, pointer: number, defaultForegroundRgba: number, defaultBackgroundRgba: number);
    get disposed(): boolean;
    resolve(result: ScopeResult, options?: ResolveThemeOptions): StyledResult;
    dispose(): void;
}

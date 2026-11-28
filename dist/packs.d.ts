export interface BuiltinPackMetadata {
    readonly languageId: string;
    readonly rootScope: string;
    readonly scopeSuffix: string;
    readonly queryPaths: readonly string[];
    readonly localInvalidation: boolean;
}
export declare const BUILTIN_PACKS: Readonly<Record<string, BuiltinPackMetadata>>;
export declare const LANGUAGE_ALIASES: Readonly<Record<string, string>>;
export declare function resolveLanguageAlias(languageId: string): string;
export declare function getBuiltinPack(languageId: string): BuiltinPackMetadata | undefined;

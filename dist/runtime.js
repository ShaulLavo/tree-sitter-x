import { DEFAULT_THEME_COMPILE_STEPS, DEFAULT_THEME_CONTEXT_RULES, DEFAULT_THEME_OWNED_BYTES, DEFAULT_THEME_PACKET_BYTES, DEFAULT_THEME_TRIE_NODES, address, checkSourceSpan, checkSpan, decodeScopeResult, readCString, u32, validateScopeLayout, validateThemeLayout, } from "./abi.js";
import { ScopeHighlightSession } from "./session.js";
import { ScopeTheme, buildThemePacket } from "./theme.js";
import { ScopeCompatError } from "./types.js";
const encoder = new TextEncoder();
function internalAddress(target, label) {
    const pointer = address(target[0]);
    if (!pointer)
        throw new Error(`Deleted ${label}`);
    return pointer;
}
function internalProperty(target, key) {
    return target[key];
}
export class ScopePack {
    #compat;
    #pointer;
    language;
    languageId;
    rootScope;
    scopeSuffix;
    localInvalidation;
    scopes;
    patternCount;
    constructor(compat, pointer, language, definition, scopes, patternCount) {
        this.#compat = compat;
        this.#pointer = pointer;
        this.language = language;
        this.languageId = definition.languageId;
        this.rootScope = definition.rootScope;
        this.scopeSuffix = definition.scopeSuffix;
        this.localInvalidation = Boolean(definition.localInvalidation);
        this.scopes = Object.freeze(Array.from(scopes));
        this.patternCount = patternCount;
    }
    get disposed() {
        return this.#pointer === 0;
    }
    /** @internal */
    ownedBy(compat) {
        return this.#compat === compat;
    }
    /** @internal */
    pointer() {
        if (!this.#pointer)
            throw new Error('Deleted ScopePack');
        return this.#pointer;
    }
    dispose() {
        if (!this.#pointer)
            return;
        const pointer = this.#pointer;
        this.#pointer = 0;
        this.#compat.call('scope_compat_pack_delete', [pointer]);
    }
}
export class ScopeCompat {
    #binding;
    #exports;
    constructor(binding, exports) {
        this.#binding = binding;
        this.#exports = exports;
    }
    static async load(binding, wasm) {
        const module = wasm instanceof WebAssembly.Module ? wasm : await WebAssembly.compile(wasm);
        const exports = await binding.loadExtension(module);
        const compat = new ScopeCompat(binding, exports);
        if (compat.number('scope_compat_abi_version') !== 1) {
            throw new Error('Unsupported scope-compat ABI version');
        }
        validateScopeLayout(compat.heap(), compat.number('scope_compat_layout'));
        if (compat.number('scope_compat_theme_abi_version') !== 1) {
            throw new Error('Unsupported scope-compat theme ABI version');
        }
        validateThemeLayout(compat.heap(), compat.number('scope_compat_theme_layout'));
        return compat;
    }
    heap() {
        const raw = this.#binding.heap();
        if (!(raw instanceof Uint8Array))
            throw new TypeError('Invalid web-tree-sitter heap');
        return raw;
    }
    call(name, args = []) {
        for (const arg of args)
            u32(arg);
        const fn = this.#exports[name];
        if (typeof fn !== 'function')
            throw new TypeError(`Missing scope-compat export: ${name}`);
        return Reflect.apply(fn, this.#exports, args);
    }
    number(name, args = []) {
        return address(this.call(name, args));
    }
    liveAllocations() {
        return this.number('scope_compat_live_allocations');
    }
    withBytes(bytes, action) {
        const pointer = this.number('scope_compat_bytes_new', [bytes.length]);
        if (!pointer)
            throw new ScopeCompatError('Native scratch allocation failed', 4, 0);
        try {
            const heap = this.heap();
            checkSpan(heap, pointer, bytes.length, 1, 1);
            heap.set(bytes, pointer);
            return action(pointer, bytes.length);
        }
        finally {
            this.call('scope_compat_bytes_delete', [pointer]);
        }
    }
    withString(text, action) {
        return this.withBytes(encoder.encode(text), action);
    }
    compilePack(language, definition) {
        const langPtr = internalAddress(language, 'Tree-sitter Language');
        const pointer = this.withString(definition.query, (qPtr, qLen) => this.withString(definition.rootScope, (rPtr, rLen) => this.withString(definition.scopeSuffix, (sPtr, sLen) => this.number('scope_compat_pack_new', [langPtr, qPtr, qLen, rPtr, rLen, sPtr, sLen]))));
        if (!pointer)
            throw new ScopeCompatError('Native pack allocation failed', 4, 0);
        let kept = false;
        try {
            this.assertPackCompiled(pointer, definition.languageId);
            const scopeCount = this.number('scope_compat_pack_scope_count', [pointer]);
            const scopes = Array.from({ length: scopeCount }, (_, id) => readCString(this.heap(), this.number('scope_compat_pack_scope_name', [pointer, id]), 256, false));
            const patternCount = this.number('scope_compat_pack_pattern_count', [pointer]);
            const pack = new ScopePack(this, pointer, language, definition, scopes, patternCount);
            kept = true;
            return pack;
        }
        finally {
            if (!kept)
                this.call('scope_compat_pack_delete', [pointer]);
        }
    }
    assertPackCompiled(pointer, languageId) {
        const status = this.number('scope_compat_pack_status', [pointer]);
        if (status === 0)
            return;
        const detail = this.number('scope_compat_pack_detail', [pointer]);
        const value = this.number('scope_compat_pack_error_value', [pointer]);
        const pattern = this.number('scope_compat_pack_error_pattern', [pointer]);
        const offset = this.number('scope_compat_pack_error_offset', [pointer]);
        const namePtr = this.number('scope_compat_pack_error_name', [pointer]);
        const operator = readCString(this.heap(), namePtr, 256, true);
        throw new ScopeCompatError(`Pack compile failed (${languageId}, ${operator || 'query'}): status ${status}, detail ${detail}, value ${value}, pattern ${pattern}, offset ${offset}`, status, detail, value);
    }
    assertThemeCompiled(handle) {
        const status = this.number('scope_compat_theme_status', [handle]);
        if (status === 0)
            return;
        const detail = this.number('scope_compat_theme_detail', [handle]);
        const value = this.number('scope_compat_theme_detail_value', [handle]);
        throw new ScopeCompatError(`Theme compile failed (status ${status}, detail ${detail}, value ${value})`, status, detail, value);
    }
    compileTheme(input, options) {
        const maxPacketBytes = options?.maxPacketBytes ?? DEFAULT_THEME_PACKET_BYTES;
        const maxSteps = options?.maxSteps ?? DEFAULT_THEME_COMPILE_STEPS;
        const maxTrieNodes = options?.maxTrieNodes ?? DEFAULT_THEME_TRIE_NODES;
        const maxContextRules = options?.maxContextRules ?? DEFAULT_THEME_CONTEXT_RULES;
        const maxOwnedBytes = options?.maxOwnedBytes ?? DEFAULT_THEME_OWNED_BYTES;
        const built = buildThemePacket(input, maxPacketBytes);
        return this.withBytes(built.packet, (ptr, len) => {
            const handle = this.number('scope_compat_theme_new', [
                ptr, len, maxSteps, maxTrieNodes, maxContextRules, maxOwnedBytes,
            ]);
            if (!handle)
                throw new ScopeCompatError('Native theme allocation failed', 4, 120);
            let kept = false;
            try {
                this.assertThemeCompiled(handle);
                const theme = new ScopeTheme(this, handle, built.defaultForegroundRgba, built.defaultBackgroundRgba);
                kept = true;
                return theme;
            }
            finally {
                if (!kept)
                    this.call('scope_compat_theme_delete', [handle]);
            }
        });
    }
    highlightTree(pack, tree, buffer, options) {
        if (!pack.ownedBy(this))
            throw new Error('ScopePack belongs to a different ScopeCompat instance');
        const packPtr = pack.pointer();
        const treePtr = internalAddress(tree, 'Tree');
        const bufferPtr = internalAddress(buffer, 'TextBuffer');
        if (tree.language !== pack.language)
            throw new Error('Tree language does not match ScopePack language');
        if (internalProperty(tree, 'textCallback') !== buffer.read)
            throw new Error('Tree was not parsed from this TextBuffer');
        const sourceLength = u32(buffer.length);
        checkSourceSpan(this.heap(), bufferPtr, sourceLength);
        const window = options?.window
            ? Object.freeze({ start: u32(options.window.start), end: u32(options.window.end) })
            : Object.freeze({ start: 0, end: sourceLength });
        if (window.start > window.end || window.end > sourceLength) {
            throw new RangeError(`Invalid highlight window [${window.start}, ${window.end}) for length ${sourceLength}`);
        }
        const limits = options?.limits;
        const resultPtr = this.number('scope_compat_run', [
            packPtr,
            treePtr,
            bufferPtr,
            sourceLength,
            1,
            window.start,
            window.end,
            limits?.matchLimit ?? 0,
            limits?.maxIntervals ?? 0,
            limits?.maxSegments ?? 0,
        ]);
        if (!resultPtr)
            throw new ScopeCompatError('Native scope result allocation failed', 4, 0);
        try {
            const decoded = decodeScopeResult(this.heap(), resultPtr, window, pack.scopes.length);
            return Object.freeze({
                sourceLength,
                window,
                segments: decoded.segments,
                paths: decoded.paths,
                scopes: pack.scopes,
            });
        }
        finally {
            this.call('scope_compat_result_delete', [resultPtr]);
        }
    }
    createSession(pack, languageId = pack.languageId) {
        if (!pack.ownedBy(this))
            throw new Error('ScopePack belongs to a different ScopeCompat instance');
        return new ScopeHighlightSession(this, pack, languageId);
    }
}

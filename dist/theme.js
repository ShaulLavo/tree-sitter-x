import { DEFAULT_THEME_OUTPUT_BYTES, DEFAULT_THEME_PACKET_BYTES, DEFAULT_THEME_RESOLVE_STEPS, NONE, decodeThemeResult, encodePathPacket, encodeThemePacket, } from "./abi.js";
import { ScopeCompatError } from "./types.js";
const FALLBACK_COLORS = Object.freeze({
    dark: Object.freeze({ foreground: '#bbbbbb', background: '#1e1e1e' }),
    light: Object.freeze({ foreground: '#333333', background: '#fffffe' }),
});
const FONT_BITS = new Map([
    ['italic', 1],
    ['bold', 2],
    ['underline', 4],
    ['strikethrough', 8],
    ['normal', 0],
    ['regular', 0],
    ['none', 0],
]);
export function parseColorRgba(value) {
    const trimmed = value.trim();
    if (!/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(trimmed)) {
        throw new ScopeCompatError(`Invalid hex color: ${value}`, 3, 104);
    }
    const raw = trimmed.slice(1);
    const expanded = raw.length <= 4 ? Array.from(raw, ch => ch + ch).join('') : raw;
    const rgba = expanded.length === 6 ? `${expanded}ff` : expanded;
    return parseInt(rgba, 16) >>> 0;
}
function parseFontStyle(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return 0;
    let mask = 0;
    for (const word of trimmed.split(/\s+/)) {
        const bit = FONT_BITS.get(word.toLowerCase());
        if (bit === undefined) {
            throw new ScopeCompatError(`Unsupported fontStyle token: ${word}`, 1, 104);
        }
        mask |= bit;
    }
    return mask;
}
function parseSelector(selector) {
    if (!selector)
        return { tail: '', contexts: [] };
    if (/[\t\r\n]|[*|&():/]/.test(selector))
        return undefined;
    const parts = selector.split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return { tail: '', contexts: [] };
    if (parts.includes('-'))
        return undefined;
    const tail = parts.pop();
    if (!tail || tail === '>' || parts[0] === '>')
        return undefined;
    const contexts = [];
    let immediate = false;
    parts.reverse();
    for (const part of parts) {
        if (part === '>') {
            if (immediate)
                return undefined;
            immediate = true;
            continue;
        }
        contexts.push({ atom: part, immediate });
        immediate = false;
    }
    const validAtom = (value) => /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(value);
    if (!validAtom(tail) || contexts.some(edge => !validAtom(edge.atom)))
        return undefined;
    if (tail.split('.').some(part => part === 'hasOwnProperty' || part === '__proto__'))
        return undefined;
    return { tail, contexts };
}
function extractSelectors(scope) {
    if (scope === undefined || scope === '')
        return [''];
    if (typeof scope === 'string') {
        const stripped = scope.replace(/^,+/, '').replace(/,+$/, '');
        return stripped.split(',').map(item => item.trim());
    }
    const result = [];
    for (const item of scope) {
        if (typeof item === 'string')
            result.push(item.trim());
    }
    return result;
}
function internAtom(atoms, value) {
    const existing = atoms.get(value);
    if (existing !== undefined)
        return existing;
    const id = atoms.size;
    atoms.set(value, id);
    return id;
}
function isConcreteColor(value) {
    if (typeof value !== 'string')
        return false;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.toLowerCase() !== 'inherit';
}
function appendTokenRule(atoms, rules, ruleIndex, entry, defaults) {
    const settings = entry.settings;
    if (!settings)
        return;
    const hasFg = isConcreteColor(settings.foreground);
    const hasBg = isConcreteColor(settings.background);
    const hasFont = typeof settings.fontStyle === 'string';
    if (!hasFg && !hasBg && !hasFont)
        return;
    const fg = hasFg ? parseColorRgba(settings.foreground) : 0;
    const bg = hasBg ? parseColorRgba(settings.background) : 0;
    const fontMask = hasFont ? parseFontStyle(settings.fontStyle) : 0;
    const present = (hasFg ? 1 : 0) | (hasBg ? 2 : 0) | (hasFont ? 4 : 0);
    const selectors = extractSelectors(entry.scope);
    let alternative = 0;
    for (const selector of selectors) {
        const parsed = parseSelector(selector);
        if (!parsed)
            continue;
        const isGlobal = !parsed.tail && parsed.contexts.length === 0;
        if (isGlobal && hasFg)
            defaults.foreground = fg;
        if (isGlobal && hasBg)
            defaults.background = bg;
        rules.push({
            tail: parsed.tail ? internAtom(atoms, parsed.tail) : NONE,
            contexts: parsed.contexts.map(edge => ({ atom: internAtom(atoms, edge.atom), immediate: edge.immediate })),
            rule: ruleIndex,
            alternative: alternative++,
            present,
            foreground: fg,
            background: bg,
            fontMask,
        });
    }
}
function mergeThemeLayers(layers) {
    let themeType = 'dark';
    let editorFg;
    let editorBg;
    let fg;
    let bg;
    const tokenColors = [];
    for (const layer of layers) {
        if (layer.type === 'light' || layer.type === 'dark')
            themeType = layer.type;
        if (typeof layer.fg === 'string')
            fg = layer.fg;
        if (typeof layer.bg === 'string')
            bg = layer.bg;
        const colors = layer.colors;
        if (colors && typeof colors['editor.foreground'] === 'string')
            editorFg = colors['editor.foreground'];
        if (colors && typeof colors['editor.background'] === 'string')
            editorBg = colors['editor.background'];
        const entries = layer.settings ?? layer.tokenColors;
        if (entries) {
            for (const entry of entries)
                tokenColors.push(entry);
        }
    }
    const fallback = FALLBACK_COLORS[themeType];
    return {
        defaultForeground: editorFg ?? fg ?? fallback.foreground,
        defaultBackground: editorBg ?? bg ?? fallback.background,
        tokenColors,
    };
}
export function buildThemePacket(input, maxPacketBytes = DEFAULT_THEME_PACKET_BYTES) {
    const layers = Array.isArray(input) ? input : [input];
    if (layers.length === 0)
        throw new ScopeCompatError('At least one theme layer is required', 3, 100);
    const merged = mergeThemeLayers(layers);
    const defaults = {
        foreground: parseColorRgba(merged.defaultForeground),
        background: parseColorRgba(merged.defaultBackground),
    };
    const atoms = new Map();
    const rules = [{
            tail: NONE,
            contexts: [],
            rule: 0,
            alternative: 0,
            present: 3,
            foreground: defaults.foreground,
            background: defaults.background,
            fontMask: 0,
        }];
    let ruleIndex = 1;
    for (const entry of merged.tokenColors) {
        const before = rules.length;
        appendTokenRule(atoms, rules, ruleIndex, entry, defaults);
        if (rules.length > before)
            ruleIndex++;
    }
    return {
        packet: encodeThemePacket(Array.from(atoms.keys()), rules, maxPacketBytes),
        defaultForegroundRgba: defaults.foreground,
        defaultBackgroundRgba: defaults.background,
    };
}
function buildCompactStyledResult(result, pathIds, foregrounds, backgrounds, fontMasks, defaultForegroundRgba, defaultBackgroundRgba) {
    const styleKeyToId = new Map();
    const styleFg = [];
    const styleBg = [];
    const styleFont = [];
    const pathToStyle = new Uint32Array(pathIds.length);
    for (let i = 0; i < pathIds.length; i++) {
        const nativeId = pathIds[i];
        const fg = foregrounds[nativeId] ?? 0;
        const bg = backgrounds[nativeId] ?? 0;
        const font = fontMasks[nativeId] ?? 0;
        const key = `${fg}:${bg}:${font}`;
        let styleId = styleKeyToId.get(key);
        if (styleId === undefined) {
            styleId = styleFg.length;
            styleKeyToId.set(key, styleId);
            styleFg.push(fg);
            styleBg.push(bg);
            styleFont.push(font);
        }
        pathToStyle[i] = styleId;
    }
    const src = result.segments;
    const out = new Uint32Array(src.length);
    let write = 0;
    for (let i = 0; i < src.length; i += 3) {
        const from = src[i];
        const to = src[i + 1];
        const styleId = pathToStyle[src[i + 2]];
        if (write > 0 && out[write - 2] === from && out[write - 1] === styleId) {
            out[write - 2] = to;
            continue;
        }
        out[write++] = from;
        out[write++] = to;
        out[write++] = styleId;
    }
    return Object.freeze({
        sourceLength: result.sourceLength,
        window: result.window,
        segments: write === out.length ? out : out.subarray(0, write).slice(),
        foregroundRgba: Uint32Array.from(styleFg),
        backgroundRgba: Uint32Array.from(styleBg),
        fontMask: Uint8Array.from(styleFont),
        defaultForegroundRgba,
        defaultBackgroundRgba,
    });
}
export class ScopeTheme {
    #host;
    #pointer;
    defaultForegroundRgba;
    defaultBackgroundRgba;
    #cache = new WeakMap();
    constructor(host, pointer, defaultForegroundRgba, defaultBackgroundRgba) {
        this.#host = host;
        this.#pointer = pointer;
        this.defaultForegroundRgba = defaultForegroundRgba;
        this.defaultBackgroundRgba = defaultBackgroundRgba;
    }
    get disposed() {
        return this.#pointer === 0;
    }
    resolve(result, options) {
        if (!this.#pointer)
            throw new Error('Deleted ScopeTheme');
        const useCache = !options;
        if (useCache) {
            const cached = this.#cache.get(result);
            if (cached)
                return cached;
        }
        const maxPacketBytes = options?.maxPacketBytes ?? DEFAULT_THEME_PACKET_BYTES;
        const maxSteps = options?.maxSteps ?? DEFAULT_THEME_RESOLVE_STEPS;
        const maxOutputBytes = options?.maxOutputBytes ?? DEFAULT_THEME_OUTPUT_BYTES;
        const encoded = encodePathPacket(result.paths, result.scopes, maxPacketBytes);
        const decoded = this.#host.withBytes(encoded.bytes, (ptr, len) => {
            const resPtr = this.#host.number('scope_compat_theme_resolve', [
                this.#pointer, ptr, len, maxSteps, maxOutputBytes,
            ]);
            if (!resPtr)
                throw new ScopeCompatError('Native theme resolve allocation failed', 4, 120);
            try {
                return decodeThemeResult(this.#host.heap(), resPtr, encoded.count);
            }
            finally {
                this.#host.call('scope_compat_theme_result_delete', [resPtr]);
            }
        });
        const styled = buildCompactStyledResult(result, encoded.pathIds, decoded.foregrounds, decoded.backgrounds, decoded.fontMasks, this.defaultForegroundRgba, this.defaultBackgroundRgba);
        if (useCache)
            this.#cache.set(result, styled);
        return styled;
    }
    dispose() {
        if (!this.#pointer)
            return;
        const pointer = this.#pointer;
        this.#pointer = 0;
        this.#host.call('scope_compat_theme_delete', [pointer]);
    }
}

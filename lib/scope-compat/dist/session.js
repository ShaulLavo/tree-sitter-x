const JS_TS_LANGUAGES = new Set(['javascript', 'jsx', 'typescript', 'tsx']);
const JS_TS_EXPANDABLE = new Set([
    'program', 'statement_block', 'class_body', 'interface_body', 'object_type', 'enum_body', 'switch_body',
]);
const JS_TS_TRANSPARENT = new Set([
    'export_statement', 'function_declaration', 'generator_function_declaration', 'method_definition',
    'class_declaration', 'abstract_class_declaration', 'interface_declaration', 'enum_declaration',
    'module', 'internal_module', 'if_statement', 'else_clause', 'for_statement', 'for_in_statement',
    'while_statement', 'do_statement', 'try_statement', 'catch_clause', 'finally_clause',
    'switch_statement', 'switch_case', 'switch_default',
]);
const JSON_EXPANDABLE = new Set(['document', 'object', 'array']);
const MAX_LOCAL_RATIO = 0.8;
const MAX_DESCENT_DEPTH = 32;
function isExpandable(isJson, type) {
    return isJson ? JSON_EXPANDABLE.has(type) : JS_TS_EXPANDABLE.has(type);
}
function canDescend(isJson, parentType, childType) {
    if (isJson)
        return parentType === 'document' && (childType === 'object' || childType === 'array');
    return JS_TS_EXPANDABLE.has(childType) || JS_TS_TRANSPARENT.has(childType);
}
function lowerBoundChild(parent, count, offset) {
    let lo = 0;
    let hi = count;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        const child = parent.namedChild(mid);
        if (child && child.endIndex < offset)
            lo = mid + 1;
        else
            hi = mid;
    }
    return lo;
}
function containingNamedChild(parent, span) {
    const count = parent.namedChildCount;
    if (count <= 0)
        return undefined;
    const index = lowerBoundChild(parent, count, span.from);
    if (index >= count)
        return undefined;
    const child = parent.namedChild(index);
    return child && child.startIndex <= span.from && child.endIndex >= span.to ? child : undefined;
}
function deepestSafeContainer(root, languageId, span) {
    const isJson = languageId === 'json';
    if (!isJson && !JS_TS_LANGUAGES.has(languageId))
        return undefined;
    let node = root;
    let best = isExpandable(isJson, node.type) ? node : undefined;
    for (let depth = 0; depth < MAX_DESCENT_DEPTH; depth++) {
        const next = containingNamedChild(node, span);
        if (!next || !canDescend(isJson, node.type, next.type))
            break;
        node = next;
        if (isExpandable(isJson, node.type))
            best = node;
    }
    return best;
}
function isLeadingAttachment(type) {
    return type === 'decorator' || type === 'comment';
}
function widenSiblingBounds(container, count, span) {
    let lo = Math.min(lowerBoundChild(container, count, span.from), count - 1);
    while (lo > 0 && (container.namedChild(lo - 1)?.endIndex ?? -1) >= span.from)
        lo--;
    let hi = lo;
    while (hi + 1 < count && (container.namedChild(hi + 1)?.startIndex ?? Number.MAX_SAFE_INTEGER) <= span.to)
        hi++;
    lo = Math.max(0, lo - 1);
    while (lo > 0 && isLeadingAttachment(container.namedChild(lo)?.type ?? ''))
        lo--;
    hi = Math.min(count - 1, hi + 1);
    while (hi + 1 < count && isLeadingAttachment(container.namedChild(hi)?.type ?? ''))
        hi++;
    while (hi + 1 < count && container.namedChild(hi + 1)?.type === 'comment')
        hi++;
    return { lo, hi };
}
function isSplitUnit(source, offset) {
    const prev = source.charCodeAt(offset - 1);
    const curr = source.charCodeAt(offset);
    if (prev === 13 && curr === 10)
        return true;
    return prev >= 0xd800 && prev <= 0xdbff && curr >= 0xdc00 && curr <= 0xdfff;
}
function editHull(edits, oldLength, newLength) {
    const ordered = edits.toSorted((a, b) => a.from - b.from || a.to - b.to);
    let newFrom = newLength;
    let newTo = 0;
    let delta = 0;
    let prevTo = 0;
    for (const edit of ordered) {
        if (edit.from < prevTo || edit.to < edit.from || edit.to > oldLength || edit.insertLength < 0)
            return undefined;
        const start = edit.from + delta;
        const end = start + edit.insertLength;
        if (start < newFrom)
            newFrom = start;
        if (end > newTo)
            newTo = end;
        delta += edit.insertLength - (edit.to - edit.from);
        prevTo = edit.to;
    }
    if (oldLength + delta !== newLength)
        return undefined;
    return { from: newFrom, to: newTo, delta };
}
function computeLocalWindow(tree, languageId, oldLength, newLength, change) {
    if (!change.edits.length || !Array.isArray(change.changedRanges) || newLength === 0)
        return undefined;
    const edits = editHull(change.edits, oldLength, newLength);
    if (!edits)
        return undefined;
    let newFrom = edits.from;
    let newTo = edits.to;
    const delta = edits.delta;
    for (const range of change.changedRanges) {
        const start = Math.max(0, Math.min(newLength, range.startIndex));
        const end = Math.max(start, Math.min(newLength, range.endIndex));
        if (start < newFrom)
            newFrom = start;
        if (end > newTo)
            newTo = end;
    }
    const hull = { from: Math.max(0, newFrom - 1), to: Math.min(newLength, newTo + 1) };
    const root = tree.rootNode;
    const container = deepestSafeContainer(root, languageId, hull);
    if (!container || container.namedChildCount <= 0)
        return undefined;
    const count = container.namedChildCount;
    const { lo, hi } = widenSiblingBounds(container, count, hull);
    const isRoot = container === root;
    const leftChild = container.namedChild(lo);
    const rightChild = container.namedChild(hi);
    let from = lo > 0 && leftChild ? Math.min(hull.from, leftChild.startIndex) : (isRoot ? 0 : Math.min(hull.from, container.startIndex));
    let to = hi + 1 < count && rightChild ? Math.max(hull.to, rightChild.endIndex) : (isRoot ? newLength : Math.max(hull.to, container.endIndex));
    if (change.source && change.source.length === newLength) {
        if (from > 0 && isSplitUnit(change.source, from))
            from--;
        if (to > 0 && to < newLength && isSplitUnit(change.source, to))
            to++;
    }
    const oldFrom = from;
    const oldTo = to - delta;
    if (oldFrom < 0 || oldTo < oldFrom || oldTo > oldLength)
        return undefined;
    if (from === 0 && to === newLength)
        return undefined;
    if (to - from >= Math.floor(newLength * MAX_LOCAL_RATIO))
        return undefined;
    return { oldRange: { from: oldFrom, to: oldTo }, newRange: { from, to } };
}
function internResultPath(path, paths, byKey) {
    const key = path.join(',');
    const known = byKey.get(key);
    if (known !== undefined)
        return known;
    const id = paths.length;
    paths.push(path);
    byKey.set(key, id);
    return id;
}
function appendSegment(out, from, to, pathId) {
    if (to <= from)
        return;
    const len = out.length;
    if (len > 0 && out[len - 2] === from && out[len - 1] === pathId) {
        out[len - 2] = to;
        return;
    }
    out.push(from, to, pathId);
}
function spliceScopeResult(previous, local, oldRange, newRange, newLength) {
    const paths = [Object.freeze([])];
    const byKey = new Map([['', 0]]);
    const oldMap = new Int32Array(previous.paths.length).fill(-1);
    const localMap = new Int32Array(local.paths.length).fill(-1);
    const mapOld = (id) => {
        let mapped = oldMap[id];
        if (mapped < 0) {
            mapped = internResultPath(previous.paths[id], paths, byKey);
            oldMap[id] = mapped;
        }
        return mapped;
    };
    const mapLocal = (id) => {
        let mapped = localMap[id];
        if (mapped < 0) {
            mapped = internResultPath(local.paths[id], paths, byKey);
            localMap[id] = mapped;
        }
        return mapped;
    };
    const out = [];
    const prevSeg = previous.segments;
    for (let i = 0; i < prevSeg.length; i += 3) {
        const from = prevSeg[i];
        if (from >= oldRange.from)
            break;
        appendSegment(out, from, Math.min(prevSeg[i + 1], oldRange.from), mapOld(prevSeg[i + 2]));
    }
    const locSeg = local.segments;
    for (let i = 0; i < locSeg.length; i += 3) {
        appendSegment(out, locSeg[i], locSeg[i + 1], mapLocal(locSeg[i + 2]));
    }
    const shift = newRange.to - oldRange.to;
    for (let i = 0; i < prevSeg.length; i += 3) {
        const to = prevSeg[i + 1];
        if (to <= oldRange.to)
            continue;
        const from = Math.max(prevSeg[i], oldRange.to);
        appendSegment(out, from + shift, to + shift, mapOld(prevSeg[i + 2]));
    }
    return Object.freeze({
        sourceLength: newLength,
        window: Object.freeze({ start: 0, end: newLength }),
        segments: Uint32Array.from(out),
        paths: Object.freeze(paths),
        scopes: previous.scopes,
    });
}
export class ScopeHighlightSession {
    #compat;
    #pack;
    #languageId;
    #current;
    #hadError = false;
    #lastInvalidation;
    constructor(compat, pack, languageId) {
        this.#compat = compat;
        this.#pack = pack;
        this.#languageId = languageId;
    }
    get current() {
        return this.#current;
    }
    get lastInvalidation() {
        return this.#lastInvalidation;
    }
    update(tree, buffer, change, limits) {
        const hasError = Boolean(tree.rootNode.hasError);
        const previous = this.#current;
        const newLength = buffer.length;
        const local = this.#pack.localInvalidation && previous && change && !this.#hadError && !hasError
            ? computeLocalWindow(tree, this.#languageId, previous.sourceLength, newLength, change)
            : undefined;
        if (local && previous) {
            const partial = this.#compat.highlightTree(this.#pack, tree, buffer, limits ? { window: { start: local.newRange.from, end: local.newRange.to }, limits } : { window: { start: local.newRange.from, end: local.newRange.to } });
            this.#current = spliceScopeResult(previous, partial, local.oldRange, local.newRange, newLength);
            this.#hadError = false;
            this.#lastInvalidation = Object.freeze({
                mode: 'local-range',
                oldRange: Object.freeze({ ...local.oldRange }),
                newRange: Object.freeze({ ...local.newRange }),
                sourceLength: newLength,
            });
            return this.#current;
        }
        const full = this.#compat.highlightTree(this.#pack, tree, buffer, limits ? { limits } : undefined);
        this.#current = full;
        this.#hadError = hasError;
        this.#lastInvalidation = Object.freeze({
            mode: 'full-document',
            oldRange: Object.freeze({ from: 0, to: previous?.sourceLength ?? 0 }),
            newRange: Object.freeze({ from: 0, to: newLength }),
            sourceLength: newLength,
        });
        return full;
    }
    resolveTheme(theme, options) {
        if (!this.#current)
            throw new Error('Session has no highlighted snapshot; call update() first');
        return theme.resolve(this.#current, options);
    }
    reset() {
        this.#current = undefined;
        this.#hadError = false;
        this.#lastInvalidation = undefined;
    }
}

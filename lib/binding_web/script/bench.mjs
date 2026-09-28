// Compares this build (web-tree-sitter.js, from `npm run build`) with the published
// Emscripten build on load, full parses, one-character edits and highlight queries.
// node script/bench.mjs <grammar.wasm> <document> [highlights.scm] [--rounds N]
import { readFileSync } from 'fs';
import { performance } from 'perf_hooks';

const args = process.argv.slice(2);
const roundsFlag = args.indexOf('--rounds');
const ROUNDS = roundsFlag >= 0 ? Number(args.splice(roundsFlag, 2)[1]) : 4;
const [grammarPath, documentPath, queryPath] = args;
const EDITS = 300;
const grammar = readFileSync(grammarPath);
const original = readFileSync(documentPath, 'utf8');
const querySource = queryPath ? readFileSync(queryPath, 'utf8') : null;

const median = (xs) => xs.slice().sort((a, b) => a - b)[xs.length >> 1];
const p95 = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];

function point(text, index) {
  let row = 0;
  let lineStart = 0;
  for (let at = text.indexOf('\n'); at !== -1 && at < index; at = text.indexOf('\n', at + 1)) {
    row++;
    lineStart = at + 1;
  }
  return { row, column: index - lineStart };
}

// The same seeded edits for every build: an 'x' typed after a space.
function edits() {
  let seed = 7;
  let text = original;
  const out = [];
  while (out.length < EDITS) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const at = text.indexOf(' ', seed % text.length) + 1;
    if (at < 1) continue;
    const position = point(text, at);
    text = text.slice(0, at) + 'x' + text.slice(at);
    out.push({ at, position, text });
  }
  return out;
}

async function load(label, specifier) {
  const started = performance.now();
  const api = await import(specifier);
  await api.Parser.init();
  const language = await api.Language.load(grammar);
  return { label, api, language, loadMs: performance.now() - started };
}

function run(build, useBuffer, E) {
  const { api, language } = build;
  const parser = new api.Parser();
  parser.setLanguage(language);
  const buffer = useBuffer ? new api.TextBuffer(original) : null;
  const input = (text) => (buffer ?? text);

  let started = performance.now();
  let tree = parser.parse(input(original));
  const fullMs = performance.now() - started;

  const times = [];
  for (const { at, position, text } of E) {
    started = performance.now();
    buffer?.edit(at, at, 'x');
    const edit = { startIndex: at, oldEndIndex: at, newEndIndex: at + 1, startPosition: position, oldEndPosition: position, newEndPosition: { row: position.row, column: position.column + 1 } };
    tree.edit(api.Edit ? new api.Edit(edit) : edit);
    const next = parser.parse(input(text), tree);
    times.push(performance.now() - started);
    tree.delete();
    tree = next;
  }

  let queryMs = null;
  if (querySource) {
    const query = new api.Query(language, querySource);
    const runs = [];
    for (let i = 0; i < 9; i++) {
      started = performance.now();
      query.captures(tree.rootNode);
      runs.push(performance.now() - started);
    }
    queryMs = median(runs);
    query.delete();
  }
  tree.delete();
  buffer?.delete();
  parser.delete();
  return { fullMs, editMedian: median(times), editP95: p95(times), queryMs };
}

const E = edits();
const builds = [
  await load('upstream (Emscripten)', 'web-tree-sitter-upstream'),
  await load('x (WASI)', new URL('../web-tree-sitter.js', import.meta.url).href),
];
const variants = [[builds[0], false, 'upstream, string'], [builds[1], false, 'x, string'], [builds[1], true, 'x, TextBuffer']];
const results = new Map(variants.map(([, , label]) => [label, []]));
for (let round = 0; round < ROUNDS; round++) {
  const order = round % 2 ? variants.slice().reverse() : variants;
  for (const [build, useBuffer, label] of order) results.get(label).push(run(build, useBuffer, E));
}
console.log(JSON.stringify({ document: documentPath.split('/').pop(), chars: original.length, rounds: ROUNDS, edits: EDITS, load: Object.fromEntries(builds.map((b) => [b.label, +b.loadMs.toFixed(1)])) }));
for (const [label, rows] of results) {
  const m = (key) => +median(rows.map((r) => r[key])).toFixed(3);
  console.log(JSON.stringify({ variant: label, fullMs: m('fullMs'), editMedianMs: m('editMedian'), editP95Ms: m('editP95'), queryMs: querySource ? m('queryMs') : null }));
}

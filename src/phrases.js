// Plain - phrases.
//
// A "phrase" is a sentence shape the language knows, for example:
//
//     make $name be a box at $x , $y sized $w by $h
//
// Words and punctuation in the spec must be typed literally. Pieces marked
// with $ are expressions. Pieces marked with # are plain names (not looked
// up - used for "make <name> be ..."). A spec ending in "..." takes a block
// of code that runs later, closed with `end`.
//
// The core language, the game engine and the website engine all register
// their sentences here, so they all read the same way.

export function parseSpec(spec, allowLeadingArg = false) {
  const words = String(spec).trim().split(/\s+/);
  const parts = [];
  let block = false;

  for (const w of words) {
    if (w === '...') { block = true; continue; }
    // "$*things" swallows a comma separated list: 1, 2, 3
    if (w.startsWith('$*')) { parts.push({ type: 'args', name: w.slice(2) }); continue; }
    if (w.startsWith('$')) { parts.push({ type: 'arg', name: w.slice(1) }); continue; }
    if (w.startsWith('#')) { parts.push({ type: 'name', name: w.slice(1) }); continue; }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(w)) { parts.push({ type: 'word', value: w.toLowerCase() }); continue; }
    parts.push({ type: 'sym', value: w });
  }

  if (allowLeadingArg) {
    // An infix sentence reads "<value> touches <value>": the first slot is
    // whatever was already parsed to the left of it.
    if (parts.length < 2 || parts[0].type !== 'arg' || parts[1].type !== 'word') {
      throw new Error(`An infix phrase must be "$left word ...": "${spec}"`);
    }
    return { parts, block, spec, infix: true };
  }
  if (!parts.length || parts[0].type !== 'word') {
    throw new Error(`Phrase spec must start with a word: "${spec}"`);
  }
  return { parts, block, spec };
}

export class PhraseTable {
  constructor() {
    /** @type {Map<string, Array>} keyed by the first word */
    this.byFirstWord = new Map();
  }

  add(spec, id, infix = false) {
    const pattern = parseSpec(spec, infix);
    pattern.id = id;
    const key = infix ? pattern.parts[1].value : pattern.parts[0].value;
    const list = this.byFirstWord.get(key) || [];
    list.push(pattern);
    // Try the most specific sentence first, so "make x be a box at ..." is
    // preferred over a shorter pattern that happens to also match.
    list.sort((a, b) => literalCount(b) - literalCount(a) || b.parts.length - a.parts.length);
    this.byFirstWord.set(key, list);
    return pattern;
  }

  candidates(word) {
    return this.byFirstWord.get(String(word).toLowerCase()) || [];
  }

  has(word) {
    return this.byFirstWord.has(String(word).toLowerCase());
  }

  // Every literal word used by any registered sentence. The parser uses this
  // to give better "did you mean" style errors.
  allSpecs() {
    const out = [];
    for (const list of this.byFirstWord.values()) for (const p of list) out.push(p.spec);
    return out.sort();
  }
}

function literalCount(pattern) {
  return pattern.parts.filter(p => p.type === 'word' || p.type === 'sym').length;
}

// The literal words/symbols that follow argument slot `from`, used as "stop
// words" so an expression does not swallow the rest of the sentence.
export function stopsAfter(pattern, from) {
  const stops = new Set();
  for (let i = from; i < pattern.parts.length; i++) {
    const p = pattern.parts[i];
    if (p.type === 'word') stops.add(p.value);
    else if (p.type === 'sym') stops.add(p.value);
  }
  return stops;
}

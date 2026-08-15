// Plain -> JavaScript.

import { Emitter } from './emitter.js';

const RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally',
  'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null',
  'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var',
  'void', 'while', 'with', 'yield', 'let', 'static', 'await', 'arguments'
]);

export class JavaScriptEmitter extends Emitter {
  get name() { return 'JavaScript'; }
  get extension() { return '.js'; }
  get indentText() { return '  '; }
  get reserved() { return RESERVED; }

  declare(name, value) { return `let ${name} = ${value}`; }
  forEachHeader(name, iterable) { return `for (const ${name} of ${iterable}) {`; }
  helperCall(name, args) { return `plain.${name}(${args.join(', ')})`; }
  actionReference(name) { return name; }

  emitConstructor(node) {
    const base = node.base;
    this.write('');
    this.open(`constructor(values = {}) {`);
    if (base) this.writeLine('super(values)');
    for (const field of node.fields) {
      this.writeLine(`this.${this.fieldName(field.name)} = ${field.value ? this.expression(field.value) : 'null'}`);
    }
    this.writeLine('Object.assign(this, values)');
    this.close();
  }

  preamble() {
    return ["'use strict';"];
  }

  helperSource() { return HELPERS; }
}

// Each helper is one small function, and only the ones a program uses are
// written out.
const HELPERS = {
  __open: { code: 'const plain = {' },

  text: {
    code: `  // Values written the way Plain writes them.
  text(value, depth = 0) {
    if (value === null || value === undefined) return 'nothing';
    if (typeof value === 'number') return plain.number_text(value);
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    if (typeof value === 'string') return depth === 0 ? value : JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(item => plain.text(item, depth + 1)).join(', ') + ']';
    if (typeof value === 'function') return '<action>';
    const own = Object.entries(value).map(([key, item]) => key + ': ' + plain.text(item, depth + 1));
    // One of your own kinds reads as "a Dog (name: ...)"; a plain thing as "{...}".
    const kind = value.constructor && value.constructor !== Object ? value.constructor.name : null;
    return kind ? 'a ' + kind + ' (' + own.join(', ') + ')' : '{' + own.join(', ') + '}';
  },`,
    needs: ['number_text']
  },

  number_text: {
    code: `  number_text(value) {
    if (!Number.isFinite(value)) return String(value);
    return Number.isInteger(value) ? String(value) : String(parseFloat(value.toPrecision(12)));
  },`
  },

  number: {
    code: `  number(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === null || value === undefined) return 0;
    const asNumber = Number(value);
    return Number.isNaN(asNumber) ? 0 : asNumber;
  },`
  },

  truthy: {
    code: `  truthy(value) {
    if (value === null || value === undefined || value === false) return false;
    if (value === 0 || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  },`
  },

  same: {
    code: `  same(a, b) {
    if (a === b) return true;
    if (a === null || a === undefined) return b === null || b === undefined;
    if (typeof a === 'number' || typeof b === 'number') return plain.number(a) === plain.number(b);
    if (typeof a === 'boolean' || typeof b === 'boolean') return plain.truthy(a) === plain.truthy(b);
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, at) => plain.same(item, b[at]));
    return false;
  },`,
    needs: ['number', 'truthy']
  },

  add: {
    code: `  add(a, b) {
    if (typeof a === 'string' || typeof b === 'string') return plain.text(a) + plain.text(b);
    return plain.number(a) + plain.number(b);
  },`,
    needs: ['text', 'number']
  },

  join2: {
    code: `  join2(a, b) { return plain.text(a) + plain.text(b); },`,
    needs: ['text']
  },

  divide: {
    code: `  divide(a, b) {
    if (plain.number(b) === 0) throw new Error('I cannot divide by zero');
    return plain.number(a) / plain.number(b);
  },`,
    needs: ['number']
  },

  remainder: {
    code: `  remainder(a, b) {
    if (plain.number(b) === 0) throw new Error('I cannot divide by zero');
    return plain.number(a) % plain.number(b);
  },`,
    needs: ['number']
  },

  has: {
    code: `  has(container, value) {
    if (Array.isArray(container)) return container.some(item => plain.same(item, value));
    if (typeof container === 'string') return container.includes(plain.text(value));
    return false;
  },`,
    needs: ['same', 'text']
  },

  items: {
    code: `  items(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [...value];
    if (value && typeof value === 'object') return Object.keys(value);
    return [];
  },`
  },

  range: {
    code: `  // Plain counts up or down depending on the two numbers.
  range(from, to, step) {
    const out = [];
    let move = Math.abs(plain.number(step)) || 1;
    if (to < from) move = -move;
    for (let at = plain.number(from); move > 0 ? at <= to : at >= to; at += move) out.push(at);
    return out;
  },`,
    needs: ['number']
  },

  item: {
    code: `  // Lists count from 1 in Plain.
  item(list, index) {
    const at = plain.number(index);
    if (typeof list === 'string') return list[at - 1] ?? null;
    if (!Array.isArray(list)) return null;
    return list[at < 0 ? list.length + at : at - 1] ?? null;
  },`,
    needs: ['number']
  },

  setItem: {
    code: `  setItem(list, index, value) {
    const at = plain.number(index);
    if (Array.isArray(list)) list[at < 0 ? list.length + at : at - 1] = value;
    return list;
  },`,
    needs: ['number']
  },

  first: { code: `  first(list) { return plain.item(list, 1); },`, needs: ['item'] },
  last: { code: `  last(list) { return plain.item(list, plain.length(list)); },`, needs: ['item', 'length'] },

  length: {
    code: `  length(value) {
    if (Array.isArray(value) || typeof value === 'string') return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return 0;
  },`
  },

  total: { code: `  total(list) { return plain.items(list).reduce((sum, item) => sum + plain.number(item), 0); },`, needs: ['items', 'number'] },
  average: { code: `  average(list) { const all = plain.items(list); return all.length ? plain.total(all) / all.length : 0; },`, needs: ['items', 'total'] },
  highest: { code: `  highest(list) { return plain.items(list).reduce((best, item) => (best === null || plain.number(item) > plain.number(best) ? item : best), null); },`, needs: ['items', 'number'] },
  lowest: { code: `  lowest(list) { return plain.items(list).reduce((best, item) => (best === null || plain.number(item) < plain.number(best) ? item : best), null); },`, needs: ['items', 'number'] },

  sorted: {
    code: `  sorted(list) {
    return plain.items(list).slice().sort((a, b) => {
      const x = Number(a), y = Number(b);
      if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
      return String(plain.text(a)).localeCompare(String(plain.text(b)));
    });
  },`,
    needs: ['items', 'text']
  },

  reversed: { code: `  reversed(list) { return plain.items(list).slice().reverse(); },`, needs: ['items'] },
  shuffled: { code: `  shuffled(list) { const mixed = plain.items(list).slice(); for (let at = mixed.length - 1; at > 0; at--) { const other = Math.floor(Math.random() * (at + 1)); const held = mixed[at]; mixed[at] = mixed[other]; mixed[other] = held; } return mixed; },`, needs: ['items'] },
  copy: { code: `  copy(value) { return Array.isArray(value) ? value.slice() : (value && typeof value === 'object' ? { ...value } : value); },` },
  joinWith: { code: `  joinWith(list, separator) { return plain.items(list).map(item => plain.text(item)).join(plain.text(separator)); },`, needs: ['items', 'text'] },
  position: {
    code: `  position(list, value) {
    if (typeof list === 'string') return list.indexOf(plain.text(value)) + 1;
    return plain.items(list).findIndex(item => plain.same(item, value)) + 1;
  },`,
    needs: ['items', 'same', 'text']
  },

  addTo: {
    code: `  // "add x to name" grows a list, adds to a number, or joins text.
  addTo(current, value) {
    if (Array.isArray(current)) { current.push(value); return current; }
    if (typeof current === 'string') return current + plain.text(value);
    return plain.number(current) + plain.number(value);
  },`,
    needs: ['text', 'number']
  },

  removeValue: {
    code: `  removeValue(list, value) {
    if (!Array.isArray(list)) return list;
    const at = list.findIndex(item => plain.same(item, value));
    if (at >= 0) list.splice(at, 1);
    return list;
  },`,
    needs: ['same']
  },

  removeAt: {
    code: `  removeAt(list, index) {
    const at = plain.number(index);
    if (Array.isArray(list) && at >= 1 && at <= list.length) list.splice(at - 1, 1);
    return list;
  },`,
    needs: ['number']
  },

  emptied: { code: `  emptied(value) { if (Array.isArray(value)) { value.length = 0; return value; } return null; },` },

  keys: { code: `  keys(thing) { return thing && typeof thing === 'object' ? Object.keys(thing) : []; },` },
  values: { code: `  values(thing) { return thing && typeof thing === 'object' ? Object.values(thing) : []; },` },
  value: {
    code: `  value(thing, key) {
    if (!thing || typeof thing !== 'object') return null;
    const found = Object.keys(thing).find(name => name.toLowerCase() === plain.text(key).toLowerCase());
    return found === undefined ? null : thing[found];
  },`,
    needs: ['text']
  },
  setValue: {
    code: `  setValue(thing, key, value) {
    const found = Object.keys(thing).find(name => name.toLowerCase() === plain.text(key).toLowerCase());
    thing[found ?? plain.text(key)] = value;
  },`,
    needs: ['text']
  },
  hasKey: {
    code: `  hasKey(thing, key) {
    if (!thing || typeof thing !== 'object') return false;
    return Object.keys(thing).some(name => name.toLowerCase() === plain.text(key).toLowerCase());
  },`,
    needs: ['text']
  },

  upper: { code: `  upper(text) { return plain.text(text).toUpperCase(); },`, needs: ['text'] },
  lower: { code: `  lower(text) { return plain.text(text).toLowerCase(); },`, needs: ['text'] },
  trimmed: { code: `  trimmed(text) { return plain.text(text).trim(); },`, needs: ['text'] },
  split: { code: `  split(text, separator) { return plain.text(text).split(plain.text(separator)); },`, needs: ['text'] },
  part: { code: `  part(text, start, finish) { return plain.text(text).slice(Math.max(0, plain.number(start) - 1), plain.number(finish)); },`, needs: ['text', 'number'] },
  replace: { code: `  replace(text, find, replacement) { return plain.text(text).split(plain.text(find)).join(plain.text(replacement)); },`, needs: ['text'] },
  startsWith: { code: `  startsWith(text, prefix) { return plain.text(text).startsWith(plain.text(prefix)); },`, needs: ['text'] },
  endsWith: { code: `  endsWith(text, suffix) { return plain.text(text).endsWith(plain.text(suffix)); },`, needs: ['text'] },

  round: { code: `  round(value) { return Math.round(plain.number(value)); },`, needs: ['number'] },
  roundTo: { code: `  roundTo(value, places) { const scale = 10 ** Math.floor(plain.number(places)); return Math.round(plain.number(value) * scale) / scale; },`, needs: ['number'] },
  floor: { code: `  floor(value) { return Math.floor(plain.number(value)); },`, needs: ['number'] },
  ceiling: { code: `  ceiling(value) { return Math.ceil(plain.number(value)); },`, needs: ['number'] },
  absolute: { code: `  absolute(value) { return Math.abs(plain.number(value)); },`, needs: ['number'] },
  squareRoot: { code: `  squareRoot(value) { return Math.sqrt(Math.max(0, plain.number(value))); },`, needs: ['number'] },
  sine: { code: `  sine(value) { return Math.sin(plain.number(value)); },`, needs: ['number'] },
  cosine: { code: `  cosine(value) { return Math.cos(plain.number(value)); },`, needs: ['number'] },
  smaller: { code: `  smaller(a, b) { return Math.min(plain.number(a), plain.number(b)); },`, needs: ['number'] },
  bigger: { code: `  bigger(a, b) { return Math.max(plain.number(a), plain.number(b)); },`, needs: ['number'] },
  pi: { code: `  pi() { return Math.PI; },` },
  e: { code: `  e() { return Math.E; },` },
  exponent: { code: `  exponent(value) { return Math.exp(plain.number(value)); },`, needs: ['number'] },
  logarithm: { code: `  logarithm(value) { return Math.log(Math.max(1e-300, plain.number(value))); },`, needs: ['number'] },
  tangent: { code: `  tangent(value) { return Math.tan(plain.number(value)); },`, needs: ['number'] },

  randomBetween: {
    code: `  randomBetween(low, high) {
    const from = Math.ceil(plain.number(low)), to = Math.floor(plain.number(high));
    return from + Math.floor(Math.random() * (to - from + 1));
  },`,
    needs: ['number']
  },
  randomNumber: { code: `  randomNumber() { return Math.random(); },` },
  randomItem: { code: `  randomItem(list) { const all = plain.items(list); return all.length ? all[Math.floor(Math.random() * all.length)] : null; },`, needs: ['items'] },

  whole: { code: `  whole(value) { const n = plain.number(value); return Number.isFinite(n) ? Math.trunc(n) : 0; },`, needs: ['number'] },

  pattern: { code: `  pattern(text, everywhere) { return new RegExp(plain.text(text), everywhere ? 'g' : ''); },`, needs: ['text'] },
  matches: { code: `  matches(text, mark) { return plain.pattern(mark, false).test(plain.text(text)); },`, needs: ['pattern', 'text'] },
  firstMatch: { code: `  firstMatch(text, mark) { const found = plain.text(text).match(plain.pattern(mark, false)); return found ? found[0] : ''; },`, needs: ['pattern', 'text'] },
  allMatches: { code: `  allMatches(text, mark) { return plain.text(text).match(plain.pattern(mark, true)) || []; },`, needs: ['pattern', 'text'] },
  replacePattern: { code: `  replacePattern(text, mark, instead) { return plain.text(text).replace(plain.pattern(mark, true), plain.text(instead)); },`, needs: ['pattern', 'text'] },

  timeNow: { code: `  timeNow() { return Date.now(); },` },
  today: { code: `  today() { return new Date().toISOString().slice(0, 10); },` },
  kindOf: {
    code: `  kindOf(value) {
    if (value === null || value === undefined) return 'nothing';
    if (Array.isArray(value)) return 'a list';
    if (typeof value === 'number') return 'a number';
    if (typeof value === 'string') return 'text';
    if (typeof value === 'boolean') return 'a yes/no';
    if (typeof value === 'function') return 'an action';
    return 'a thing';
  },`
  },

  changedBy: { code: `  changedBy(list, action) { return plain.items(list).map(item => action(item)); },`, needs: ['items'] },
  keptWhere: { code: `  keptWhere(list, action) { return plain.items(list).filter(item => plain.truthy(action(item))); },`, needs: ['items', 'truthy'] },
  addedUpBy: { code: `  addedUpBy(list, action) { return plain.items(list).reduce((sum, item) => sum + plain.number(action(item)), 0); },`, needs: ['items', 'number'] },

  ask: {
    code: `  // Reads one line, the way "ask ... into ..." does in Plain.
  ask(question) {
    process.stdout.write(plain.text(question));
    const fs = require('node:fs');
    const buffer = Buffer.alloc(1);
    let answer = '';
    while (true) {
      let read = 0;
      try { read = fs.readSync(0, buffer, 0, 1, null); } catch { break; }
      if (read === 0) break;
      const letter = buffer.toString('utf8', 0, 1);
      if (letter === '\\n') break;
      if (letter !== '\\r') answer += letter;
    }
    const asNumber = Number(answer);
    return answer.trim() !== '' && !Number.isNaN(asNumber) ? asNumber : answer;
  },`,
    needs: ['text']
  },

  __close: { code: '};' }
};

// The helper object always needs its opening and closing lines.
const REAL_HELPERS = Object.keys(HELPERS).filter(name => !name.startsWith('__'));

JavaScriptEmitter.prototype.emitHelpers = function emitHelpers() {
  const wanted = new Set();
  const add = (name) => {
    if (wanted.has(name) || !HELPERS[name]) return;
    wanted.add(name);
    for (const needed of HELPERS[name].needs || []) add(needed);
  };
  for (const name of this.used) add(name);
  if (!wanted.size) return '';
  const body = REAL_HELPERS.filter(name => wanted.has(name)).map(name => HELPERS[name].code.trimEnd());
  return [HELPERS.__open.code, ...body, HELPERS.__close.code].join('\n');
};

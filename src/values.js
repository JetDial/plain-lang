// Plain - values.
// Plain has six kinds of value: number, text, yes/no, list, thing, nothing.
// Everything here is shared by the interpreter, the game engine and the
// website engine so they all agree on what a value looks like when shown.

export const NOTHING = null;

export function isList(v) { return Array.isArray(v); }
export function isText(v) { return typeof v === 'string'; }
export function isNumber(v) { return typeof v === 'number'; }
export function isThing(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

export function typeName(v) {
  if (v === null || v === undefined) return 'nothing';
  if (Array.isArray(v)) return 'a list';
  switch (typeof v) {
    case 'number': return 'a number';
    case 'string': return 'text';
    case 'boolean': return 'a yes/no';
    case 'function': return 'an action';
    default: return 'a thing';
  }
}

export function truthy(v) {
  if (v === null || v === undefined || v === false) return false;
  if (v === 0) return false;
  if (v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function formatNumber(n) {
  if (!Number.isFinite(n)) return n > 0 ? 'infinity' : (Number.isNaN(n) ? 'not a number' : '-infinity');
  if (Number.isInteger(n)) return String(n);
  // Hide floating point noise: 0.1 + 0.2 should read as 0.3.
  return String(parseFloat(n.toPrecision(12)));
}

export function toText(v, depth = 0) {
  if (v === null || v === undefined) return 'nothing';
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'string') return depth === 0 ? v : `"${v}"`;
  if (Array.isArray(v)) return '[' + v.map(x => toText(x, depth + 1)).join(', ') + ']';
  if (typeof v === 'function') return '<action>';
  if (typeof v.toPlainText === 'function') return v.toPlainText();
  const entries = Object.entries(v).filter(([k]) => !k.startsWith('_'));
  return '{' + entries.map(([k, val]) => `${k}: ${toText(val, depth + 1)}`).join(', ') + '}';
}

export function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  if (v === null || v === undefined) return 0;
  return NaN;
}

export function equals(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === 'number' || typeof b === 'number') {
    const x = toNumber(a), y = toNumber(b);
    if (!Number.isNaN(x) && !Number.isNaN(y)) return x === y;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => equals(v, b[i]));
  }
  return false;
}

export function contains(container, value) {
  if (Array.isArray(container)) return container.some(v => equals(v, value));
  if (typeof container === 'string') return container.includes(String(toText(value)));
  if (isThing(container)) return Object.prototype.hasOwnProperty.call(container, String(value));
  return false;
}

export function lengthOf(v) {
  if (Array.isArray(v) || typeof v === 'string') return v.length;
  if (isThing(v)) return Object.keys(v).length;
  return 0;
}

// Lists count from 1 in Plain, because that is how people count.
export function itemAt(list, index) {
  if (typeof list === 'string') return list[index - 1] ?? null;
  if (!Array.isArray(list)) return null;
  const i = index < 0 ? list.length + index : index - 1;
  return list[i] ?? null;
}

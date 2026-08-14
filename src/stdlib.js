// Plain - the core library.
// These are the sentences every Plain program can use, no matter where it
// runs. Keep them short, keep them readable out loud.

import {
  toText, toNumber, truthy, equals, itemAt, lengthOf, typeName, isThing
} from './values.js';

export function installCore(rt) {
  if (rt.libraries.has('core')) return rt;
  rt.libraries.add('core');

  // ------------------------------------------------------------ list values

  rt.defineValue('item $index of $list', (a, ctx) => {
    const index = Math.floor(toNumber(a.index));
    if (Number.isNaN(index)) ctx.fail('"item" needs a number');
    return itemAt(a.list, index);
  }, 'core:item');

  rt.defineValue('first of $list', a => itemAt(a.list, 1));
  rt.defineValue('last of $list', a => itemAt(a.list, lengthOf(a.list)));
  rt.defineValue('length of $thing', a => lengthOf(a.thing));
  rt.defineValue('size of $thing', a => lengthOf(a.thing));
  rt.defineValue('number of items in $list', a => lengthOf(a.list));

  rt.defineValue('total of $list', a => list(a.list).reduce((sum, v) => sum + toNumber(v), 0));
  rt.defineValue('highest of $list', a => list(a.list).reduce((best, v) => (best === null || toNumber(v) > toNumber(best) ? v : best), null));
  rt.defineValue('lowest of $list', a => list(a.list).reduce((best, v) => (best === null || toNumber(v) < toNumber(best) ? v : best), null));
  rt.defineValue('average of $list', a => {
    const items = list(a.list);
    return items.length ? items.reduce((s, v) => s + toNumber(v), 0) / items.length : 0;
  });

  rt.defineValue('sorted $list', a => list(a.list).slice().sort(compareValues));
  rt.defineValue('reversed $list', a => list(a.list).slice().reverse());
  rt.defineValue('join $list with $separator', a => list(a.list).map(v => toText(v)).join(toText(a.separator)));

  rt.defineValue('copy of $thing', a => (Array.isArray(a.thing) ? a.thing.slice() : isThing(a.thing) ? { ...a.thing } : a.thing));
  rt.defineValue('keys of $thing', a => (isThing(a.thing) ? Object.keys(a.thing) : []));
  rt.defineValue('position of $value in $list', a => {
    if (typeof a.list === 'string') return a.list.indexOf(toText(a.value)) + 1;
    return list(a.list).findIndex(v => equals(v, a.value)) + 1;
  });

  // ------------------------------------------------------------ text values

  rt.defineValue('text of $value', a => toText(a.value));
  rt.defineValue('number of $value', a => {
    const n = toNumber(a.value);
    return Number.isNaN(n) ? 0 : n;
  });
  rt.defineValue('uppercase of $text', a => toText(a.text).toUpperCase());
  rt.defineValue('lowercase of $text', a => toText(a.text).toLowerCase());
  rt.defineValue('trimmed $text', a => toText(a.text).trim());
  rt.defineValue('parts of $text split by $separator', a => toText(a.text).split(toText(a.separator)));
  rt.defineValue('part of $text from $start to $finish', a => {
    const text = toText(a.text);
    const start = Math.max(1, Math.floor(toNumber(a.start)));
    const finish = Math.floor(toNumber(a.finish));
    return text.slice(start - 1, finish);
  });
  rt.defineValue('does $text start with $prefix', a => toText(a.text).startsWith(toText(a.prefix)));
  rt.defineValue('does $text end with $suffix', a => toText(a.text).endsWith(toText(a.suffix)));
  rt.defineValue('replace $find with $replacement in $text', a =>
    toText(a.text).split(toText(a.find)).join(toText(a.replacement)));

  // ------------------------------------------------------------ number bits

  rt.defineValue('round $number', a => Math.round(toNumber(a.number)));
  rt.defineValue('round $number to $places places', a => {
    const factor = 10 ** Math.floor(toNumber(a.places));
    return Math.round(toNumber(a.number) * factor) / factor;
  });
  rt.defineValue('floor of $number', a => Math.floor(toNumber(a.number)));
  rt.defineValue('ceiling of $number', a => Math.ceil(toNumber(a.number)));
  rt.defineValue('absolute of $number', a => Math.abs(toNumber(a.number)));
  rt.defineValue('square root of $number', a => Math.sqrt(Math.max(0, toNumber(a.number))));
  rt.defineValue('sine of $number', a => Math.sin(toNumber(a.number)));
  rt.defineValue('cosine of $number', a => Math.cos(toNumber(a.number)));
  rt.defineValue('smaller of $a and $b', a => Math.min(toNumber(a.a), toNumber(a.b)));
  rt.defineValue('bigger of $a and $b', a => Math.max(toNumber(a.a), toNumber(a.b)));
  rt.defineValue('pi', () => Math.PI);

  rt.defineValue('random $low to $high', a => {
    const low = Math.ceil(toNumber(a.low));
    const high = Math.floor(toNumber(a.high));
    return low + Math.floor(Math.random() * (high - low + 1));
  });
  rt.defineValue('random number', () => Math.random());
  rt.defineValue('random item of $list', a => {
    const items = list(a.list);
    return items.length ? items[Math.floor(Math.random() * items.length)] : null;
  });

  rt.defineValue('time now', () => Date.now());
  rt.defineValue('today', () => new Date().toISOString().slice(0, 10));

  // -------------------------------------------------------- kind checking

  rt.defineValue('kind of $value', a => typeName(a.value));

  // -------------------------------------------------------- doing sentences

  rt.define('add $value to #name', (a, ctx) => {
    if (!ctx.exists(a.name)) ctx.fail(`I do not know a name called "${a.name}"`, `make ${a.name} be 0`);
    const current = ctx.lookup(a.name);
    if (Array.isArray(current)) { current.push(a.value); return; }
    if (typeof current === 'string') { ctx.assign(a.name, current + toText(a.value)); return; }
    ctx.assign(a.name, toNumber(current) + toNumber(a.value));
  });

  rt.define('take $value from #name', (a, ctx) => {
    if (!ctx.exists(a.name)) ctx.fail(`I do not know a name called "${a.name}"`, `make ${a.name} be 0`);
    ctx.assign(a.name, toNumber(ctx.lookup(a.name)) - toNumber(a.value));
  });

  rt.define('remove item $index from #name', (a, ctx) => {
    const current = ctx.lookup(a.name);
    if (!Array.isArray(current)) ctx.fail(`"${a.name}" is not a list`);
    const index = Math.floor(toNumber(a.index));
    if (index >= 1 && index <= current.length) current.splice(index - 1, 1);
  });

  rt.define('remove $value from #name', (a, ctx) => {
    const current = ctx.lookup(a.name);
    if (!Array.isArray(current)) ctx.fail(`"${a.name}" is not a list`);
    const at = current.findIndex(v => equals(v, a.value));
    if (at >= 0) current.splice(at, 1);
  });

  rt.define('put $value into #name', (a, ctx) => {
    if (ctx.exists(a.name)) ctx.assign(a.name, a.value);
    else ctx.define(a.name, a.value);
  });

  rt.define('empty #name', (a, ctx) => {
    const current = ctx.lookup(a.name);
    if (Array.isArray(current)) current.length = 0;
    else ctx.assign(a.name, null);
  });

  rt.define('ask $question into #name', (a, ctx) => {
    const answer = readLine(toText(a.question), ctx);
    const asNumber = Number(answer);
    const value = answer.trim() !== '' && !Number.isNaN(asNumber) ? asNumber : answer;
    if (ctx.exists(a.name)) ctx.assign(a.name, value);
    else ctx.define(a.name, value);
  });

  rt.define('show $value and stop', (a, ctx) => {
    ctx.output(toText(a.value));
    throw new StopProgram();
  });

  rt.define('stop the program', () => { throw new StopProgram(); });

  return rt;
}

export class StopProgram extends Error {
  constructor() { super('stopped'); this.name = 'StopProgram'; }
}

function list(value) {
  return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
}

function compareValues(a, b) {
  const na = toNumber(a), nb = toNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(toText(a)).localeCompare(String(toText(b)));
}

// Reading a line works in a terminal (Node) and in a browser page.
function readLine(question, ctx) {
  if (typeof globalThis.prompt === 'function') {
    return String(globalThis.prompt(question) ?? '');
  }
  if (typeof process !== 'undefined' && process.stdin) {
    // Written straight out so the answer appears on the same line.
    if (process.stdout && process.stdout.write) process.stdout.write(question);
    else ctx.output(question);
    try {
      const fs = globalThis.__plainFS;
      if (!fs) return '';
      const buffer = Buffer.alloc(1);
      let answer = '';
      while (true) {
        let read = 0;
        try { read = fs.readSync(0, buffer, 0, 1, null); } catch { break; }
        if (read === 0) break;
        const char = buffer.toString('utf8', 0, 1);
        if (char === '\n') break;
        if (char !== '\r') answer += char;
      }
      return answer;
    } catch {
      return '';
    }
  }
  return '';
}

export { truthy };

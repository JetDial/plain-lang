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

  // A list of things rather than a list of numbers: put them in order of one
  // of the things they each have. Anything missing that value goes last,
  // because there is nowhere sensible to put it.
  rt.defineValue('sorted $list by $key', a => {
    const key = toText(a.key);
    const pick = item => (isThing(item) ? item[key] : undefined);
    return list(a.list).slice().sort((one, other) => {
      const left = pick(one), right = pick(other);
      if (left === undefined || left === null) return right === undefined || right === null ? 0 : 1;
      if (right === undefined || right === null) return -1;
      return compareValues(left, right);
    });
  });
  rt.defineValue('reversed $list', a => list(a.list).slice().reverse());

  // Shuffling, which every game with cards, questions, spawn points or
  // turns needs and none of them should have to write. Each item is swapped
  // with one somewhere at or before it, which is the only shuffle that
  // treats every order as equally likely - the obvious version, swapping
  // each with any other, quietly does not.
  rt.defineValue('shuffled $list', a => {
    const out = list(a.list).slice();
    for (let at = out.length - 1; at > 0; at--) {
      const other = Math.floor(Math.random() * (at + 1));
      const held = out[at];
      out[at] = out[other];
      out[other] = held;
    }
    return out;
  });
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
  // ------------------------------------------------------ patterns in text

  rt.defineInfix('$text matches $pattern', (a, ctx) =>
    pattern(a.pattern, ctx).test(toText(a.text)));

  rt.defineValue('first match of $pattern in $text', (a, ctx) => {
    const found = toText(a.text).match(pattern(a.pattern, ctx));
    return found ? found[0] : '';
  });

  rt.defineValue('parts of $text matching $pattern', (a, ctx) =>
    toText(a.text).match(pattern(a.pattern, ctx, true)) || []);

  rt.defineValue('replace pattern $pattern with $replacement in $text', (a, ctx) =>
    toText(a.text).replace(pattern(a.pattern, ctx, true), toText(a.replacement)));

  // ------------------------------------------------------------- the bits

  rt.defineValue('bitwise and of $a and $b', a => toInt(a.a) & toInt(a.b));
  rt.defineValue('bitwise or of $a and $b', a => toInt(a.a) | toInt(a.b));
  rt.defineValue('bitwise xor of $a and $b', a => toInt(a.a) ^ toInt(a.b));
  rt.defineValue('bitwise not of $a', a => ~toInt(a.a));
  rt.defineValue('shift $a left by $b', a => toInt(a.a) << toInt(a.b));
  rt.defineValue('shift $a right by $b', a => toInt(a.a) >> toInt(a.b));

  rt.defineValue('does $text start with $prefix', a => toText(a.text).startsWith(toText(a.prefix)));
  rt.defineValue('does $text end with $suffix', a => toText(a.text).endsWith(toText(a.suffix)));
  rt.defineValue('replace $find with $replacement in $text', a =>
    toText(a.text).split(toText(a.find)).join(toText(a.replacement)));

  // ------------------------------------------------------------------ bytes
  //
  // Most of what a computer sends over a wire is not writing. A picture, a
  // sound, or a game speaking its own shorthand is a run of numbers from 0
  // to 255, and until now Plain had no way to build one or read one.
  //
  // A run of bytes here is an ordinary list of numbers, so everything you
  // already know works on it: "number of items in", "item 3 of", "for each".
  // What these add is the packing - turning a number into the two or four
  // bytes a program at the other end expects, and turning them back.
  //
  // Least important byte first, which is what nearly every protocol and
  // every ordinary computer uses. If you need it the other way round the
  // phrase says so.

  const asBytes = (value) => {
    const out = [];
    for (const item of list(value)) out.push(toNumber(item) & 0xff);
    return out;
  };

  rt.defineValue('bytes of text $text', a => [...new TextEncoder().encode(toText(a.text))]);
  rt.defineValue('text of bytes $bytes', a => new TextDecoder().decode(Uint8Array.from(asBytes(a.bytes))));

  rt.define('add the byte $number to $bytes', (a, ctx) => {
    const into = a.bytes;
    if (!Array.isArray(into)) ctx.fail('That is not a run of bytes', 'start one with: make packet be []');
    into.push(toNumber(a.number) & 0xff);
  });

  // Whole numbers, in however many bytes the other end is expecting.
  rt.define('add the number $number in $size bytes to $bytes', (a, ctx) => {
    const into = a.bytes;
    if (!Array.isArray(into)) ctx.fail('That is not a run of bytes', 'start one with: make packet be []');
    const size = Math.max(1, Math.min(6, Math.round(toNumber(a.size))));
    let left = Math.round(toNumber(a.number));
    if (left < 0) left += Math.pow(256, size);          // negative counts back from the top
    for (let n = 0; n < size; n++) {
      into.push(left & 0xff);
      left = Math.floor(left / 256);
    }
  });

  // Numbers with a fractional part, in the four bytes almost everything uses.
  rt.define('add the decimal $number to $bytes', (a, ctx) => {
    const into = a.bytes;
    if (!Array.isArray(into)) ctx.fail('That is not a run of bytes', 'start one with: make packet be []');
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, toNumber(a.number), true);
    for (let n = 0; n < 4; n++) into.push(view.getUint8(n));
  });

  rt.define('add the text $text to $bytes', (a, ctx) => {
    const into = a.bytes;
    if (!Array.isArray(into)) ctx.fail('That is not a run of bytes', 'start one with: make packet be []');
    for (const byte of new TextEncoder().encode(toText(a.text))) into.push(byte);
  });

  rt.define('add the bytes $more to $bytes', (a, ctx) => {
    const into = a.bytes;
    if (!Array.isArray(into)) ctx.fail('That is not a run of bytes', 'start one with: make packet be []');
    for (const byte of asBytes(a.more)) into.push(byte);
  });

  // Reading. Counting starts at 1, as it does everywhere else in Plain.
  rt.defineValue('the number in $bytes at $at over $size bytes', a => {
    const bytes = asBytes(a.bytes);
    const at = Math.round(toNumber(a.at)) - 1;
    const size = Math.max(1, Math.min(6, Math.round(toNumber(a.size))));
    let out = 0;
    for (let n = size - 1; n >= 0; n--) out = out * 256 + (bytes[at + n] || 0);
    return out;
  });

  rt.defineValue('the decimal in $bytes at $at', a => {
    const bytes = asBytes(a.bytes);
    const at = Math.round(toNumber(a.at)) - 1;
    const view = new DataView(new ArrayBuffer(4));
    for (let n = 0; n < 4; n++) view.setUint8(n, bytes[at + n] || 0);
    return view.getFloat32(0, true);
  });

  rt.defineValue('the text in $bytes at $at for $size', a => {
    const bytes = asBytes(a.bytes).slice(Math.round(toNumber(a.at)) - 1,
                                         Math.round(toNumber(a.at)) - 1 + Math.round(toNumber(a.size)));
    return new TextDecoder().decode(Uint8Array.from(bytes));
  });

  rt.defineValue('the bytes in $bytes at $at for $size', a =>
    asBytes(a.bytes).slice(Math.round(toNumber(a.at)) - 1,
                           Math.round(toNumber(a.at)) - 1 + Math.round(toNumber(a.size))));

  // For looking at, and for writing tests that say what they mean.
  rt.defineValue('hex of $bytes', a => asBytes(a.bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
  rt.defineValue('bytes from hex $text', a =>
    (toText(a.text).match(/[0-9a-fA-F]{2}/g) || []).map(pair => parseInt(pair, 16)));

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
  rt.defineValue('e', () => Math.E);
  rt.defineValue('exponent of $number', a => Math.exp(toNumber(a.number)));
  rt.defineValue('logarithm of $number', a => Math.log(Math.max(1e-300, toNumber(a.number))));
  rt.defineValue('tangent of $number', a => Math.tan(toNumber(a.number)));

  // The way back. A language with sine, cosine and tangent and no way to ask
  // "what angle was that, then?" cannot work out which way one thing lies
  // from another - which is the first thing anybody drawing or aiming wants.
  // All three answer in radians, as the three above expect.
  rt.defineValue('arcsine of $number', a => Math.asin(Math.max(-1, Math.min(1, toNumber(a.number)))));
  rt.defineValue('arccosine of $number', a => Math.acos(Math.max(-1, Math.min(1, toNumber(a.number)))));

  // Two numbers rather than one, because the sign of each is what says which
  // quarter of the circle the answer is in - something a single ratio cannot
  // tell you. Straight up is a quarter turn; straight left is half of one.
  rt.defineValue('arctangent of $up over $across',
    a => Math.atan2(toNumber(a.up), toNumber(a.across)));

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

  // -------------------------------------------------- taking part of a list
  //
  // Wanting the top five of something, or the next page of it, or the rest
  // after the first, is constant - and until now every one of those meant
  // a loop with a counter in it and an off-by-one waiting to happen.

  rt.defineValue('the first $count of $list', a => {
    const many = Math.max(0, Math.round(toNumber(a.count)));
    return list(a.list).slice(0, many);
  });

  rt.defineValue('the last $count of $list', a => {
    const many = Math.max(0, Math.round(toNumber(a.count)));
    const all = list(a.list);
    return many === 0 ? [] : all.slice(Math.max(0, all.length - many));
  });

  rt.defineValue('everything after the first $count of $list', a => {
    const many = Math.max(0, Math.round(toNumber(a.count)));
    return list(a.list).slice(many);
  });

  // A page of something. Counting from 1, as everywhere else, so "page 1"
  // is the first page rather than the second.
  rt.defineValue('page $page of $list with $size to a page', a => {
    const size = Math.max(1, Math.round(toNumber(a.size)));
    const page = Math.max(1, Math.round(toNumber(a.page)));
    return list(a.list).slice((page - 1) * size, page * size);
  });

  rt.defineValue('how many pages in $list with $size to a page', a => {
    const size = Math.max(1, Math.round(toNumber(a.size)));
    return Math.ceil(list(a.list).length / size);
  });

  // ------------------------------------------------------------ tidying
  //
  // Showing a number to somebody almost never means showing all of it.
  // 3.141592653589793 is a fact; "3.14" is what goes on a screen. Until now
  // that meant multiplying by a hundred, rounding, and dividing again, in
  // every program that ever showed a price or a distance.

  rt.defineValue('round $number to $places places', a => {
    const places = Math.max(0, Math.min(12, Math.round(toNumber(a.places))));
    const value = toNumber(a.number);
    if (!Number.isFinite(value)) return 0;
    return Number(value.toFixed(places));
  });

  // The same, but as text, so trailing noughts stay: money wants "3.50",
  // not "3.5", and a number cannot hold the difference.
  rt.defineValue('show $number to $places places as text', a => {
    const places = Math.max(0, Math.min(12, Math.round(toNumber(a.places))));
    const value = toNumber(a.number);
    return Number.isFinite(value) ? value.toFixed(places) : '0';
  });

  // Lining things up in a column, which is most of what a table is.
  rt.defineValue('pad $text to $width', a => {
    const width = Math.max(0, Math.round(toNumber(a.width)));
    const text = toText(a.text);
    return text.length >= width ? text : text + ' '.repeat(width - text.length);
  });

  rt.defineValue('pad $text to $width on the left', a => {
    const width = Math.max(0, Math.round(toNumber(a.width)));
    const text = toText(a.text);
    return text.length >= width ? text : ' '.repeat(width - text.length) + text;
  });

  // ---------------------------------------------------------- checking
  //
  // A language that can build a server and a game and cannot say whether
  // they work is only half a tool. Every check on this language and on the
  // things built with it has so far been written in another language, which
  // is a strange thing to have to admit.
  //
  //     check that the score is 10
  //     check that the door is open
  //     show how the checks went
  //
  // Nothing is thrown. A failed check is written down and the program
  // carries on, because the second failure is usually the one that explains
  // the first.

  const checks = { passed: 0, failed: 0, notes: [] };

  const wrote = (value) => {
    if (typeof value === 'string') return `"${value}"`;
    return toText(value);
  };

  rt.define('check $value is $expected', (a, ctx) => {
    if (equals(a.value, a.expected)) { checks.passed += 1; return; }
    checks.failed += 1;
    checks.notes.push(`expected ${wrote(a.expected)} but got ${wrote(a.value)}`);
  });

  rt.define('check $value is not $expected', (a, ctx) => {
    if (!equals(a.value, a.expected)) { checks.passed += 1; return; }
    checks.failed += 1;
    checks.notes.push(`did not expect ${wrote(a.expected)}`);
  });

  rt.define('check that $question', (a) => {
    if (truthy(a.question)) { checks.passed += 1; return; }
    checks.failed += 1;
    checks.notes.push('that was not so');
  });

  // The same, with a name, so a run of checks reads as a list of what the
  // program is supposed to do.
  rt.define('check $name : $value is $expected', (a) => {
    if (equals(a.value, a.expected)) { checks.passed += 1; return; }
    checks.failed += 1;
    checks.notes.push(`${toText(a.name)}: expected ${wrote(a.expected)} but got ${wrote(a.value)}`);
  });

  rt.defineValue('how the checks went', () => {
    if (checks.failed === 0) return `all ${checks.passed} checks passed`;
    return `${checks.failed} of ${checks.passed + checks.failed} checks failed\n  ` + checks.notes.join('\n  ');
  });

  rt.defineValue('checks that failed', () => checks.failed);
  rt.defineValue('checks that passed', () => checks.passed);
  rt.define('forget the checks so far', () => { checks.passed = 0; checks.failed = 0; checks.notes = []; });

  // -------------------------------------------------------------- room
  //
  // Memory, said in a way that keeps the good half and refuses the bad one.
  //
  // What a C programmer reaches for memory to do is nearly always one of
  // two things: put a known number of numbers side by side so the processor
  // can read them fast, or hand a block to something else that will fill it
  // in - a decoder, a sound card, a device. Neither of those needs
  // addresses. They need a fixed run of numbers with a known size.
  //
  //     make room for 1024 numbers called samples
  //     put 0.5 at 1 of samples
  //     show what is at 1 of samples
  //
  // What is deliberately absent: there is no way to ask where a block IS.
  // No address, so no arithmetic on addresses, so none of the mistakes that
  // come of it - reading past the end, using a block after it is gone, two
  // names quietly sharing one. Asking for position 2000 of a 1024 block
  // says so rather than reading whatever happens to be next door.
  //
  // A block is a list of numbers, so everything that already works on those
  // works on this: walking it, adding it up, handing it to a toolkit.

  rt.defineValue('room for $count numbers', (a, ctx) => {
    const many = Math.round(toNumber(a.count));
    if (!Number.isFinite(many) || many < 0) ctx.fail('That is not a number of numbers to make room for');
    if (many > 50000000) ctx.fail('That is more room than this can make', 'fifty million numbers is the limit');
    return new Array(many).fill(0);
  });

  const roomAt = (block, where, ctx, what) => {
    if (!Array.isArray(block)) ctx.fail(`${what} needs a block`, 'make one with: make room for 100 numbers');
    const at = Math.round(toNumber(where));
    if (!Number.isFinite(at) || at < 1 || at > block.length) {
      ctx.fail(`There is no position ${toText(where)} in a block of ${block.length}`,
               'positions run from 1 to however many numbers there is room for');
    }
    return at - 1;
  };

  rt.defineValue('what is at $where of $block', (a, ctx) =>
    a.block[roomAt(a.block, a.where, ctx, 'Reading')]);

  rt.define('put $value at $where of $block', (a, ctx) => {
    a.block[roomAt(a.block, a.where, ctx, 'Writing')] = toNumber(a.value);
  });

  rt.define('fill $block with $value', (a, ctx) => {
    if (!Array.isArray(a.block)) ctx.fail('Filling needs a block');
    const value = toNumber(a.value);
    for (let at = 0; at < a.block.length; at++) a.block[at] = value;
  });

  rt.defineValue('how much room is in $block', a => (Array.isArray(a.block) ? a.block.length : 0));

  // ----------------------------------------------------------- toolkits
  //
  // Code somebody else wrote in another language, called from Plain.
  //
  // This is the one thing C++ has that no amount of tidy design replaces:
  // it can call the library that already exists. Thirty years of image
  // decoders, compression, cryptography and physics are written in C, and a
  // language that cannot reach them has to rewrite all of it or go without.
  //
  // The way in is WebAssembly, which is what a C library compiles to when it
  // wants to be portable. It works in a terminal and on a page, it needs
  // nothing installed, and - the part that matters for Plain - it cannot
  // reach outside itself. A toolkit gets numbers in and gives numbers back.
  // It cannot read your files or open a socket unless you hand it the means,
  // which is exactly the bargain somebody choosing Plain has already made.
  //
  //     use the toolkit "maths.wasm" as sums
  //     show ask sums for "add" with 2 and 3
  //
  // What it does not do is let Plain write a driver. That needs addresses,
  // and addresses are the thing this language is for not having.

  const toolkits = new Map();

  const openToolkit = (bytes, ctx) => {
    if (typeof WebAssembly === 'undefined') {
      ctx.fail('This computer cannot open toolkits', 'WebAssembly is missing, which is very unusual');
    }
    try {
      const code = Uint8Array.from(bytes.map(one => toNumber(one) & 0xff));
      const shape = new WebAssembly.Module(code);
      return new WebAssembly.Instance(shape, {});
    } catch (problem) {
      ctx.fail('That is not a toolkit I can open', String(problem.message || problem));
    }
  };

  rt.define('use the toolkit $bytes as #name', (a, ctx) => {
    const opened = openToolkit(list(a.bytes), ctx);
    toolkits.set(String(a.name).toLowerCase(), opened);
    const held = { toolkit: String(a.name).toLowerCase() };
    ctx.exists(a.name) ? ctx.assign(a.name, held) : ctx.define(a.name, held);
  });

  const reach = (thing, name, ctx) => {
    const key = isThing(thing) && thing.toolkit ? String(thing.toolkit) : String(thing).toLowerCase();
    const opened = toolkits.get(key);
    if (!opened) ctx.fail('That is not a toolkit', 'open one first with: use the toolkit ... as ...');
    const found = opened.exports[toText(name)];
    if (typeof found !== 'function') {
      const offered = Object.keys(opened.exports).filter(one => typeof opened.exports[one] === 'function');
      ctx.fail(`That toolkit has nothing called "${toText(name)}"`,
               offered.length ? `it offers: ${offered.join(', ')}` : 'it offers nothing at all');
    }
    return found;
  };

  rt.defineValue('ask $toolkit for $name', (a, ctx) => reach(a.toolkit, a.name, ctx)());
  rt.defineValue('ask $toolkit for $name with $one', (a, ctx) => reach(a.toolkit, a.name, ctx)(toNumber(a.one)));
  rt.defineValue('ask $toolkit for $name with $one and $other', (a, ctx) =>
    reach(a.toolkit, a.name, ctx)(toNumber(a.one), toNumber(a.other)));

  rt.defineValue('what $toolkit offers', (a, ctx) => {
    const key = isThing(a.toolkit) && a.toolkit.toolkit ? String(a.toolkit.toolkit) : String(a.toolkit).toLowerCase();
    const opened = toolkits.get(key);
    if (!opened) ctx.fail('That is not a toolkit');
    return Object.keys(opened.exports).filter(one => typeof opened.exports[one] === 'function').sort();
  });

  // ------------------------------------------------------------- days
  //
  // Plain could say what day it is and could not say anything else about
  // it: not what tomorrow is, not how long until something, not which day
  // of the week a date falls on. That is most of what anybody wants dates
  // for - a booking, a deadline, an age, a "three days ago".
  //
  // A day here is written the way the whole world writes it down,
  // "2026-08-14", because it is the one form that sorts correctly as text
  // and reads correctly to a person. Anything that takes a day also takes
  // "today", so a program can say what it means.

  const asDay = (value) => {
    const written = toText(value).trim();
    if (written === '' || written.toLowerCase() === 'today') return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    if (/^\d{4}-\d{2}-\d{2}$/.test(written)) return new Date(written + 'T00:00:00Z');
    const made = new Date(written);
    return Number.isNaN(made.getTime()) ? new Date(NaN) : made;
  };

  const dayText = (when) => (Number.isNaN(when.getTime()) ? '' : when.toISOString().slice(0, 10));
  const DAY = 86400000;
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

  rt.defineValue('the day after $when', a => dayText(new Date(asDay(a.when).getTime() + DAY)));
  rt.defineValue('the day before $when', a => dayText(new Date(asDay(a.when).getTime() - DAY)));
  rt.defineValue('the day $days days after $when', a => dayText(new Date(asDay(a.when).getTime() + Math.round(toNumber(a.days)) * DAY)));
  rt.defineValue('the day $days days before $when', a => dayText(new Date(asDay(a.when).getTime() - Math.round(toNumber(a.days)) * DAY)));

  rt.defineValue('days between $from and $to', a => {
    const from = asDay(a.from), to = asDay(a.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
    return Math.round((to.getTime() - from.getTime()) / DAY);
  });

  rt.defineValue('the year of $when', a => asDay(a.when).getUTCFullYear());
  rt.defineValue('the month of $when', a => asDay(a.when).getUTCMonth() + 1);
  rt.defineValue('the day of $when', a => asDay(a.when).getUTCDate());
  rt.defineValue('the weekday of $when', a => WEEKDAYS[asDay(a.when).getUTCDay()] || '');
  rt.defineValue('the month name of $when', a => MONTHS[asDay(a.when).getUTCMonth()] || '');

  // The one people actually want to show somebody.
  rt.defineValue('the date $when in words', a => {
    const when = asDay(a.when);
    if (Number.isNaN(when.getTime())) return '';
    return `${WEEKDAYS[when.getUTCDay()]} ${when.getUTCDate()} ${MONTHS[when.getUTCMonth()]} ${when.getUTCFullYear()}`;
  });

  rt.defineValue('is $when a real day', a => !Number.isNaN(asDay(a.when).getTime()));
  rt.defineInfix('$when is before $other', a => asDay(a.when).getTime() < asDay(a.other).getTime());
  rt.defineInfix('$when is after $other', a => asDay(a.when).getTime() > asDay(a.other).getTime());

  // ------------------------------------------------------------- sets
  //
  // A list with nothing repeated in it, and the three questions people ask
  // of two lists. Other languages hand you a whole second kind of container
  // for this; here it is four sentences about the lists you already have.

  rt.defineValue('unique $list', a => {
    const out = [];
    for (const item of list(a.list)) if (!out.some(kept => equals(kept, item))) out.push(item);
    return out;
  });

  rt.defineValue('everything in $list not in $other', a => {
    const drop = list(a.other);
    return list(a.list).filter(item => !drop.some(one => equals(one, item)));
  });

  rt.defineValue('everything in $list also in $other', a => {
    const both = list(a.other);
    const out = [];
    for (const item of list(a.list)) {
      if (both.some(one => equals(one, item)) && !out.some(kept => equals(kept, item))) out.push(item);
    }
    return out;
  });

  rt.defineValue('everything in $list and $other', a => {
    const out = [];
    for (const item of [...list(a.list), ...list(a.other)]) {
      if (!out.some(kept => equals(kept, item))) out.push(item);
    }
    return out;
  });

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

  // There is deliberately no "show ... and stop": having one would make
  // "and" a word that `show` has to watch for, which spoils every sentence
  // that uses it, such as "show bitwise or of 12 and 10". Two lines is
  // cheaper than that.
  rt.define('stop the program', () => { throw new StopProgram(); });

  // Waiting really does stop everything, which is what someone writing a
  // terminal program means. A browser must never be frozen like that, so
  // there it points at the sentence that does the right thing instead.
  rt.define('wait $seconds seconds', (a, ctx) => {
    const seconds = Math.max(0, toNumber(a.seconds));
    if (!canSleep()) {
      ctx.fail(
        'Waiting stops everything, so it only works in a terminal',
        'on a page use "after 2 seconds ... end", which carries on in the meantime'
      );
    }
    sleep(seconds * 1000);
  });

  rt.define('wait a second', (a, ctx) => {
    if (!canSleep()) {
      ctx.fail(
        'Waiting stops everything, so it only works in a terminal',
        'on a page use "after 1 seconds ... end", which carries on in the meantime'
      );
    }
    sleep(1000);
  });

  // ------------------------------------------------- kinds of your own

  const tell = (a, ctx, args) =>
    ctx.interpreter.callMethod(a.thing, a.action, args, ctx.line);

  rt.define('tell $thing to #action', (a, ctx) => tell(a, ctx, []));
  rt.define('tell $thing to #action with $one', (a, ctx) => tell(a, ctx, [a.one]));
  rt.define('tell $thing to #action with $one and $other', (a, ctx) => tell(a, ctx, [a.one, a.other]));

  rt.defineValue('ask $thing to #action', (a, ctx) => tell(a, ctx, []));
  rt.defineValue('ask $thing to #action with $one', (a, ctx) => tell(a, ctx, [a.one]));
  rt.defineValue('ask $thing to #action with $one and $other', (a, ctx) => tell(a, ctx, [a.one, a.other]));

  rt.defineValue('kind name of $thing', (a) =>
    (a.thing && a.thing._kind ? a.thing._kind.name : typeName(a.thing)));

  // "if rex is a kind of Animal" - true for the kind itself and anything
  // built on top of it.
  rt.defineInfix('$thing is a kind of #kind', (a, ctx) => {
    if (!a.thing || !a.thing._kind) return false;
    return ctx.interpreter.kindNames(a.thing._kind).includes(String(a.kind).toLowerCase());
  });

  // ------------------------------------------------ actions as values

  rt.defineValue('the action #name', (a, ctx) => ctx.interpreter.actionValue(a.name, ctx.line));

  const invoke = (action, args, ctx) => {
    if (typeof action !== 'function') ctx.fail(`That is not an action, so I cannot run it`);
    return action(...args);
  };

  rt.defineBoth('call $action', (a, ctx) => invoke(a.action, [], ctx));
  rt.defineBoth('call $action with $one', (a, ctx) => invoke(a.action, [a.one], ctx));
  rt.defineBoth('call $action with $one and $other', (a, ctx) => invoke(a.action, [a.one, a.other], ctx));

  rt.defineInfix('$list changed by $action', (a, ctx) =>
    list(a.list).map(item => invoke(a.action, [item], ctx)));

  rt.defineInfix('$list kept where $action', (a, ctx) =>
    list(a.list).filter(item => truthy(invoke(a.action, [item], ctx))));

  rt.defineInfix('$list added up by $action', (a, ctx) =>
    list(a.list).reduce((sum, item) => sum + toNumber(invoke(a.action, [item], ctx)), 0));

  // --------------------------------------------------------- problems

  rt.define('report a problem saying $message', (a, ctx) => {
    ctx.fail(toText(a.message));
  });

  // --------------------------------- things used as a bag of named values

  rt.defineValue('value $key of $thing', (a) => {
    if (!isThing(a.thing)) return null;
    const key = Object.keys(a.thing).find(k => k.toLowerCase() === toText(a.key).toLowerCase());
    return key === undefined ? null : a.thing[key];
  });

  rt.define('set value $key of $thing to $value', (a, ctx) => {
    if (!isThing(a.thing)) ctx.fail('I can only put named values into a thing');
    const key = Object.keys(a.thing).find(k => k.toLowerCase() === toText(a.key).toLowerCase());
    a.thing[key ?? toText(a.key)] = a.value;
  });

  rt.defineInfix('$thing has $key', (a) => {
    if (!isThing(a.thing)) return false;
    return Object.keys(a.thing).some(k => k.toLowerCase() === toText(a.key).toLowerCase());
  });

  rt.defineValue('values of $thing', (a) => (isThing(a.thing) ? Object.values(a.thing) : []));

  return rt;
}

export class StopProgram extends Error {
  constructor() { super('stopped'); this.name = 'StopProgram'; }
}

// A real pause, without callbacks: Node can be told to hold this thread.
function canSleep() {
  return typeof SharedArrayBuffer !== 'undefined' &&
    typeof Atomics !== 'undefined' &&
    typeof process !== 'undefined' &&
    Boolean(process.versions && process.versions.node) &&
    typeof globalThis.window === 'undefined';
}

function sleep(milliseconds) {
  if (milliseconds <= 0) return;
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
  } catch {
    // Busy waiting is horrible, but a short pause should still be a pause.
    const until = Date.now() + milliseconds;
    while (Date.now() < until) { /* hold */ }
  }
}

// A pattern is written as text, the way it is in every other language.
function pattern(value, ctx, everywhere = false) {
  try {
    return new RegExp(toText(value), everywhere ? 'g' : '');
  } catch (problem) {
    ctx.fail(`"${toText(value)}" is not a pattern I can read`, String(problem.message || problem));
  }
}

function toInt(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
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

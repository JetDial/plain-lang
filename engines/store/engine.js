// Plain - remembering things.
//
//     remember score as "best"
//     show remembered "best" or 0
//
// A program that forgets everything when it stops cannot keep a high score,
// a shopping list or anything a person typed. This keeps values between
// runs: in a file next to the program when Plain runs in a terminal, and in
// the browser's own store when it runs on a page.
//
// Files are separate, and deliberately small: read one, write one, add a
// line to one. Everything stays beside the program, so a beginner cannot
// reach across their whole disk by accident.

import { toText, toNumber } from '../../src/values.js';

export function createStore(host = {}) {
  // A browser: keep it in localStorage, one key each.
  if (host.window && host.window.localStorage) {
    const shelf = host.window.localStorage;
    const prefix = 'plain.remember.';
    return {
      kind: 'browser',
      get(key) {
        const raw = shelf.getItem(prefix + key);
        return raw === null ? undefined : parse(raw);
      },
      set(key, value) { shelf.setItem(prefix + key, JSON.stringify(value ?? null)); },
      remove(key) { shelf.removeItem(prefix + key); },
      keys() {
        const out = [];
        for (let at = 0; at < shelf.length; at++) {
          const name = shelf.key(at);
          if (name && name.startsWith(prefix)) out.push(name.slice(prefix.length));
        }
        return out.sort();
      }
    };
  }

  // A terminal: one small JSON file, written when something changes.
  const fs = host.fs || globalThis.__plainFS;
  const file = host.memoryFile;
  if (!fs || !file) return emptyStore();

  let held = null;
  const load = () => {
    if (held) return held;
    try {
      held = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch {
      held = {};
    }
    return held;
  };
  // Writing the whole file every time something changes is fine for a high
  // score and hopeless for a table: a hundred thousand rows would mean a
  // hundred thousand writes of a file that keeps getting longer. So a change
  // only marks the file as owing a write, and the write happens once the
  // program stops to draw breath - and always before it ends.
  let owing = false;
  let waiting = null;

  const writeNow = () => {
    owing = false;
    if (waiting) { clearTimeout(waiting); waiting = null; }
    try { fs.writeFileSync(file, JSON.stringify(held, null, 2) + '\n', 'utf8'); }
    catch { /* a read-only folder should not stop the program */ }
  };

  const save = () => {
    owing = true;
    if (waiting) return;
    waiting = setTimeout(() => { waiting = null; if (owing) writeNow(); }, 0);
    if (typeof waiting.unref === 'function') waiting.unref();
  };

  // A program that ends - or is stopped with Ctrl+C - still keeps what it
  // was given.
  if (host.atEnd) host.atEnd(() => { if (owing) writeNow(); });

  return {
    kind: 'file',
    where: file,
    get(key) { const all = load(); return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : undefined; },
    set(key, value) { load()[key] = value ?? null; save(); },
    remove(key) { delete load()[key]; save(); },
    keys() { return Object.keys(load()).sort(); },
    // For anything that has to know the file is up to date this instant.
    flush() { if (owing) writeNow(); }
  };
}

function emptyStore() {
  const held = new Map();
  return {
    kind: 'nowhere',
    get: (key) => held.get(key),
    set: (key, value) => held.set(key, value),
    remove: (key) => held.delete(key),
    keys: () => [...held.keys()].sort()
  };
}

function parse(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}

export function installStore(rt, host = {}) {
  if (rt.libraries.has('store')) return rt.store;
  rt.libraries.add('store');

  const store = createStore(host);
  rt.store = store;

  // --------------------------------------------------------- remembering

  rt.define('remember $value as $key', (a) => {
    store.set(toText(a.key), a.value);
  });

  rt.defineValue('remembered $key', (a) => {
    const held = store.get(toText(a.key));
    return held === undefined ? null : held;
  });

  // The one people actually want: a value, or something sensible the first
  // time the program is ever run.
  rt.defineValue('remembered $key or $fallback', (a) => {
    const held = store.get(toText(a.key));
    return held === undefined || held === null ? a.fallback : held;
  });

  rt.define('forget $key', (a) => { store.remove(toText(a.key)); });
  rt.define('forget everything remembered', () => {
    for (const key of store.keys()) store.remove(key);
  });

  rt.defineValue('everything remembered', () => store.keys());
  rt.defineInfix('$key is remembered', (a) => store.get(toText(a.key)) !== undefined);

  // Keeping a best score is common enough to say in one line.
  rt.define('remember $value as $key if it is bigger', (a) => {
    const key = toText(a.key);
    const held = store.get(key);
    if (held === undefined || held === null || toNumber(a.value) > toNumber(held)) store.set(key, a.value);
  });

  // ---------------------------------------------------------------- files

  const files = host.files || null;   // { read, write, append, exists }

  const needFiles = (ctx) => {
    if (!files) {
      ctx.fail(
        'Reading and writing files only works when Plain runs in a terminal',
        'in a browser, use "remember ... as ..." instead'
      );
    }
    return files;
  };

  rt.defineValue('text of file $name', (a, ctx) => {
    const found = needFiles(ctx).read(toText(a.name), ctx);
    return found === null ? '' : found;
  });

  rt.defineValue('lines of file $name', (a, ctx) => {
    const found = needFiles(ctx).read(toText(a.name), ctx);
    if (found === null) return [];
    return String(found).replace(/\r\n?/g, '\n').split('\n').filter((line, at, all) => line !== '' || at < all.length - 1);
  });

  rt.defineValue('does file $name exist', (a, ctx) => needFiles(ctx).exists(toText(a.name), ctx));

  rt.define('write $value to file $name', (a, ctx) => {
    needFiles(ctx).write(toText(a.name), toText(a.value), ctx);
  });

  rt.define('add $value to file $name', (a, ctx) => {
    needFiles(ctx).append(toText(a.name), toText(a.value) + '\n', ctx);
  });

  // -------------------------------------------------- the shapes data comes in
  //
  // Two ways nearly every program on earth writes things down. Plain reads
  // and writes both, so a file or an answer from the web can be worked with
  // as ordinary lists and things.

  rt.defineValue('json of $value', (a, ctx) => {
    try {
      return JSON.stringify(a.value, null, 2);
    } catch {
      ctx.fail('I cannot write that as JSON', 'something in it refers back to itself');
    }
  });

  rt.defineValue('thing from json $text', (a, ctx) => {
    try {
      return JSON.parse(toText(a.text));
    } catch (problem) {
      ctx.fail('That is not JSON I can read', String(problem.message || problem));
    }
  });

  rt.defineValue('rows of $text', (a) => parseCSV(toText(a.text)));
  rt.defineValue('csv of $rows', (a) => writeCSV(a.rows));

  return store;
}

// --------------------------------------------------------------------- CSV
//
// Spreadsheets and half the world's data arrive as commas and newlines,
// with quotes around anything that contains one. A doubled quote inside a
// quoted field means one quote.

function parseCSV(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let started = false;             // tells an empty file from one blank row

  for (let at = 0; at < source.length; at++) {
    const letter = source[at];
    started = true;
    if (quoted) {
      if (letter === '"') {
        if (source[at + 1] === '"') { field += '"'; at++; }
        else quoted = false;
      } else field += letter;
      continue;
    }
    if (letter === '"') { quoted = true; continue; }
    if (letter === ',') { row.push(field); field = ''; continue; }
    if (letter === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += letter;
  }
  if (started && (field !== '' || row.length)) { row.push(field); rows.push(row); }
  return rows;
}

function writeCSV(rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  return list.map(row => {
    const cells = Array.isArray(row) ? row : [row];
    return cells.map(cell => {
      const text = cell === null || cell === undefined ? '' : String(cell);
      return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }).join(',');
  }).join('\n');
}

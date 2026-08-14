// Plain - tables.
//
//     make notes be a table called "notes"
//     save a new thing with title "Hello" in notes
//     for each note in every row of notes
//         show title of note
//     end
//
// A real program keeps things: a list of notes, of users, of orders. A list
// in a name is forgotten the moment the program stops, and a file of JSON
// means writing the reading and the writing yourself every time. A table is
// the small piece in between - rows with ids, kept between runs, with the
// four questions people actually ask: give me all of them, give me the ones
// where something matches, give me this one, and change or drop this one.
//
// It sits on top of "remember", so it keeps things the same way the rest of
// Plain does: a file next to the program in a terminal, the browser's own
// store on a page. Nothing to install, and nothing to set up first.

import { toText, toNumber, equals } from '../../src/values.js';

const PREFIX = 'table:';

export function installData(rt, host = {}) {
  if (rt.libraries.has('data')) return rt.tables;
  rt.libraries.add('data');

  const store = rt.store;
  if (!store) throw new Error('tables need the store engine installed first');

  const tables = new Map();

  // A table is a thing you can hold in a name, so it reads like everything
  // else. What it knows is its own name; the rows live in the store.
  class Table {
    constructor(name) {
      this.name = String(name);
      this.isTable = true;
      this.stamp = 0;          // goes up on every change
      this.lookups = new Map(); // key -> { stamp, byValue }
    }

    get key() { return PREFIX + this.name; }

    read() {
      const held = store.get(this.key);
      if (!held || !Array.isArray(held.rows)) return { next: 1, rows: [] };
      return { next: Number(held.next) || 1, rows: held.rows };
    }

    write(held) {
      store.set(this.key, held);
      this.stamp += 1;         // anything looked up before is out of date
    }

    // Looking through a hundred thousand rows one at a time is fine once and
    // hopeless in a loop. The first question about a field builds a lookup
    // from that field's values to the rows holding them; the rest are
    // instant, until something is written and it is built again.
    lookup(key) {
      const found = this.lookups.get(key);
      if (found && found.stamp === this.stamp) return found.byValue;

      const byValue = new Map();
      for (const row of this.read().rows) {
        const at = sameAs(pick(row, key));
        if (!byValue.has(at)) byValue.set(at, []);
        byValue.get(at).push(row);
      }
      this.lookups.set(key, { stamp: this.stamp, byValue });
      return byValue;
    }

    toPlainText() { return `the table "${this.name}"`; }
  }

  const need = (value, ctx, doing) => {
    if (value instanceof Table) return value;
    ctx.fail(
      `${doing} needs a table`,
      'make one first: make notes be a table called "notes"'
    );
  };

  // A row is a plain thing with an id on it, so everything that already works
  // on things - "title of note", "value \"x\" of note" - works here too.
  const asRow = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return { ...value };
    return { value };
  };

  rt.defineValue('a table called $name', (a) => {
    const name = toText(a.name);
    if (!tables.has(name)) tables.set(name, new Table(name));
    return tables.get(name);
  });

  // ------------------------------------------------------------- writing

  rt.define('save $thing in $table', (a, ctx) => {
    const table = need(a.table, ctx, 'Saving');
    const held = table.read();
    const row = asRow(a.thing);
    row.id = held.next;
    held.next += 1;
    held.rows.push(row);
    table.write(held);
    rt.lastRowId = row.id;
  });

  // The id the last "save" gave out, for when the next thing needs it.
  rt.defineValue('the new id', () => (rt.lastRowId === undefined ? 0 : rt.lastRowId));

  rt.define('change row $id of $table to $thing', (a, ctx) => {
    const table = need(a.table, ctx, 'Changing a row');
    const held = table.read();
    const id = Math.round(toNumber(a.id));
    const at = held.rows.findIndex(row => Number(row.id) === id);
    if (at < 0) return;
    held.rows[at] = { ...asRow(a.thing), id };
    table.write(held);
  });

  rt.define('remove row $id from $table', (a, ctx) => {
    const table = need(a.table, ctx, 'Removing a row');
    const held = table.read();
    const id = Math.round(toNumber(a.id));
    held.rows = held.rows.filter(row => Number(row.id) !== id);
    table.write(held);
  });

  rt.define('empty the table $table', (a, ctx) => {
    const table = need(a.table, ctx, 'Emptying a table');
    table.write({ next: 1, rows: [] });
  });

  // ------------------------------------------------------------- reading

  rt.defineValue('every row of $table', (a, ctx) => need(a.table, ctx, 'Reading').read().rows);

  rt.defineValue('number of rows in $table', (a, ctx) => need(a.table, ctx, 'Counting').read().rows.length);

  rt.defineValue('row $id of $table', (a, ctx) => {
    const table = need(a.table, ctx, 'Reading a row');
    const id = Math.round(toNumber(a.id));
    return table.read().rows.find(row => Number(row.id) === id) || null;
  });

  // The one question every program asks: the rows where something matches.
  // A plain value goes through the lookup; anything more involved, like a
  // list, is compared row by row, because that is what "is" means for those.
  rt.defineValue('rows of $table where $key is $value', (a, ctx) => {
    const table = need(a.table, ctx, 'Looking through a table');
    const key = toText(a.key);
    if (simple(a.value)) return table.lookup(key).get(sameAs(a.value)) || [];
    return table.read().rows.filter(row => equals(pick(row, key), a.value));
  });

  rt.defineValue('first row of $table where $key is $value', (a, ctx) => {
    const table = need(a.table, ctx, 'Looking through a table');
    const key = toText(a.key);
    if (simple(a.value)) return (table.lookup(key).get(sameAs(a.value)) || [])[0] || null;
    return table.read().rows.find(row => equals(pick(row, key), a.value)) || null;
  });

  rt.defineValue('rows of $table where $key contains $value', (a, ctx) => {
    const table = need(a.table, ctx, 'Looking through a table');
    const key = toText(a.key);
    const wanted = toText(a.value).toLowerCase();
    return table.read().rows.filter(row => toText(pick(row, key)).toLowerCase().includes(wanted));
  });

  rt.defineValue('rows of $table sorted by $key', (a, ctx) => {
    const table = need(a.table, ctx, 'Sorting a table');
    const key = toText(a.key);
    const rows = [...table.read().rows];
    const numbers = rows.every(row => typeof pick(row, key) === 'number');
    rows.sort((one, other) => {
      const left = pick(one, key);
      const right = pick(other, key);
      if (numbers) return toNumber(left) - toNumber(right);
      return toText(left).localeCompare(toText(right));
    });
    return rows;
  });

  rt.defineInfix('$table has a row where $key is $value', (a, ctx) => {
    const table = need(a.table, ctx, 'Looking through a table');
    const key = toText(a.key);
    return table.read().rows.some(row => equals(pick(row, key), a.value));
  });

  // ------------------------------------------------- all of it, or none of it
  //
  // Taking money from one row and adding it to another is two changes, and a
  // program that stops between them has done half a thing. Inside this block
  // every table is written down as it was first; if anything goes wrong they
  // are all put back, and the problem carries on its way.

  rt.define('do all of this together ...', (a, ctx) => {
    const before = new Map();
    for (const table of tables.values()) {
      before.set(table, JSON.parse(JSON.stringify(table.read())));
    }
    try {
      ctx.block();
    } catch (problem) {
      for (const [table, held] of before) table.write(held);
      throw problem;
    }
  });

  // ------------------------------------------------------ two tables at once
  //
  // Orders have a customer; comments have a post. Lining the two up by hand
  // is a loop inside a loop, which is slow and easy to get wrong. Each row
  // that comes back is the one from the first table, with the one it was
  // matched to under the name "match".

  rt.defineInfix('$rows joined to $table on $key', (a, ctx) => {
    const table = need(a.table, ctx, 'Joining');
    const key = toText(a.key);
    const rows = Array.isArray(a.rows) ? a.rows : [];
    // Matched on the other table's id unless the key names a field there.
    const byId = table.lookup('id');
    return rows.map(row => ({ ...row, match: (byId.get(sameAs(pick(row, key))) || [])[0] || null }));
  });

  rt.defineInfix('$rows joined to $table on $key matching $theirs', (a, ctx) => {
    const table = need(a.table, ctx, 'Joining');
    const key = toText(a.key);
    const theirs = table.lookup(toText(a.theirs));
    const rows = Array.isArray(a.rows) ? a.rows : [];
    return rows.map(row => ({ ...row, match: (theirs.get(sameAs(pick(row, key))) || [])[0] || null }));
  });

  // --------------------------------------------------- changing what a row is
  //
  // A table written last month has rows without the field you added today.
  // This fills them in, and leaves alone the ones that already have it.

  rt.define('fill in $key with $value on every row of $table', (a, ctx) => {
    const table = need(a.table, ctx, 'Filling in a field');
    const key = toText(a.key);
    const held = table.read();
    let changed = 0;
    for (const row of held.rows) {
      if (pick(row, key) === null) { row[key] = a.value; changed += 1; }
    }
    if (changed) table.write(held);
    rt.lastFilled = changed;
  });

  rt.defineValue('the number filled in', () => (rt.lastFilled === undefined ? 0 : rt.lastFilled));

  rt.define('rename $key to $wanted in every row of $table', (a, ctx) => {
    const table = need(a.table, ctx, 'Renaming a field');
    const from = toText(a.key);
    const to = toText(a.wanted);
    const held = table.read();
    for (const row of held.rows) {
      const found = Object.keys(row).find(one => one.toLowerCase() === from.toLowerCase());
      if (found === undefined || found === to) continue;
      row[to] = row[found];
      delete row[found];
    }
    table.write(held);
  });

  // ------------------------------------------------------------- accounts
  //
  // Almost every program that keeps things also wants to know whose they
  // are. A password must never be written down as itself, and comparing two
  // of them must not be quicker when the first letters match - so the work
  // is handed to the machinery that is built for it rather than done here.

  const needLocks = (ctx) => {
    if (host.lock && host.fits) return host;
    ctx.fail(
      'Accounts only work when Plain runs in a terminal',
      'a page has no safe way to scramble a password'
    );
  };

  const nameOf = (value) => toText(value).trim();

  rt.define('create an account in $table for $name with password $password', (a, ctx) => {
    const locks = needLocks(ctx);
    const table = need(a.table, ctx, 'Making an account');
    const who = nameOf(a.name);
    const secret = toText(a.password);

    if (who === '') ctx.fail('An account needs a name');
    if (secret.length < 8) {
      ctx.fail('That password is too short', 'eight letters or more, and something nobody would guess');
    }
    if (table.lookup('name').get(sameAs(who))) {
      ctx.fail(`There is already an account for ${who}`, 'pick another name, or sign in instead');
    }

    const held = table.read();
    held.rows.push({ name: who, locked: locks.lock(secret), id: held.next });
    held.next += 1;
    table.write(held);
    rt.lastRowId = held.next - 1;
  });

  rt.defineValue('the account in $table for $name with password $password', (a, ctx) => {
    const locks = needLocks(ctx);
    const table = need(a.table, ctx, 'Checking an account');
    const row = (table.lookup('name').get(sameAs(nameOf(a.name))) || [])[0];
    // Checked even when there is no such account, so that a name nobody has
    // does not answer faster than one somebody does.
    const fits = locks.fits(toText(a.password), row ? row.locked : null);
    return row && fits ? row : null;
  });

  rt.defineInfix('$table has an account for $name', (a, ctx) => {
    const table = need(a.table, ctx, 'Checking a table');
    return Boolean(table.lookup('name').get(sameAs(nameOf(a.name))));
  });

  rt.define('change the password in $table for $name to $password', (a, ctx) => {
    const locks = needLocks(ctx);
    const table = need(a.table, ctx, 'Changing a password');
    const secret = toText(a.password);
    if (secret.length < 8) {
      ctx.fail('That password is too short', 'eight letters or more, and something nobody would guess');
    }
    const held = table.read();
    const at = held.rows.findIndex(row => sameAs(pick(row, 'name')) === sameAs(nameOf(a.name)));
    if (at < 0) ctx.fail(`There is no account for ${nameOf(a.name)}`);
    held.rows[at] = { ...held.rows[at], locked: locks.lock(secret) };
    table.write(held);
  });

  rt.tables = { Table, tables };
  return rt.tables;
}

// Values that can be looked up rather than searched for.
function simple(value) {
  const kind = typeof value;
  return value === null || value === undefined || kind === 'number' || kind === 'string' || kind === 'boolean';
}

// Two values Plain calls the same have to land on the same shelf, and 3 and
// "3" are the same to Plain. So anything that reads as a number is filed as
// one, yes/no is filed by which it is, and everything else by its words.
function sameAs(value) {
  if (value === null || value === undefined) return 'nothing';
  if (typeof value === 'boolean') return 'yes/no:' + (value ? 1 : 0);
  if (typeof value === 'number') return Number.isNaN(value) ? 'text:NaN' : 'number:' + value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return 'number:' + Number(trimmed);
    return 'text:' + value;
  }
  return 'text:' + toText(value);
}

// Names in Plain ignore capitals, and a row's fields should too.
function pick(row, key) {
  if (!row || typeof row !== 'object') return null;
  if (key in row) return row[key];
  const found = Object.keys(row).find(one => one.toLowerCase() === key.toLowerCase());
  return found === undefined ? null : row[found];
}

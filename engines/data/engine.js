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
    }

    get key() { return PREFIX + this.name; }

    read() {
      const held = store.get(this.key);
      if (!held || !Array.isArray(held.rows)) return { next: 1, rows: [] };
      return { next: Number(held.next) || 1, rows: held.rows };
    }

    write(held) { store.set(this.key, held); }

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
  rt.defineValue('rows of $table where $key is $value', (a, ctx) => {
    const table = need(a.table, ctx, 'Looking through a table');
    const key = toText(a.key);
    return table.read().rows.filter(row => equals(pick(row, key), a.value));
  });

  rt.defineValue('first row of $table where $key is $value', (a, ctx) => {
    const table = need(a.table, ctx, 'Looking through a table');
    const key = toText(a.key);
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

  rt.tables = { Table, tables };
  return rt.tables;
}

// Names in Plain ignore capitals, and a row's fields should too.
function pick(row, key) {
  if (!row || typeof row !== 'object') return null;
  if (key in row) return row[key];
  const found = Object.keys(row).find(one => one.toLowerCase() === key.toLowerCase());
  return found === undefined ? null : row[found];
}

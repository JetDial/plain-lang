// Plain - tests.  Run with:  node tests/run-tests.js
//
// No framework: a tiny check() helper and a lot of small programs.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRuntime } from '../src/runtime.js';
import { numericNames } from '../src/translate/numbers.js';
import { PlainError } from '../src/errors.js';
import { installGame } from '../engines/game/engine.js';
import { installWorld } from '../engines/world/engine.js';
import { objMesh } from '../engines/world/render.js';
import { installWeb } from '../engines/web/engine.js';
import { installVideo } from '../engines/video/engine.js';
import { installStore } from '../engines/store/engine.js';
import { installNet, readSent, readCookies, readParts, readFrame, sixtyFour } from '../engines/net/engine.js';
import { installData } from '../engines/data/engine.js';
import { installParts, readAbout, compareVersions, atLeast } from '../engines/parts/engine.js';
import { installMail, buildMessage, looksLikeAddress } from '../engines/mail/engine.js';
import { LESSONS, PROJECTS } from '../engines/learn/course.js';
import { readList, save, checkPart, fingerprint, nameFrom } from '../bin/parts.js';
import { format } from '../src/format.js';
import { documentToHTML } from '../engines/web/render.js';
import { cubeMesh, sphereMesh, perspective, lookAt, multiply, toRGB } from '../engines/world/render.js';
import { buildWebM, sizeBytes, element, whole } from '../engines/video/webm.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];

// The `+ 0` turns -0 back into 0, which assert.strict cares about.
function round(n) { return Math.round(n * 1000) / 1000 + 0 || 0; }

function check(name, run) {
  try { run(); passed++; }
  catch (error) { failures.push({ name, error }); }
}

// Run a program and return the lines it printed.
function run(source, options) {
  return runtimeFor(source, options).rt.lines;
}

function runtimeFor(source, options = {}) {
  const rt = createRuntime({ onOutput: () => {}, ...options });
  const game = installGame(rt, {});
  const world = installWorld(rt, {});
  const site = installWeb(rt, {});
  const studio = installVideo(rt, {});
  installStore(rt, {});
  installData(rt, {});
  installParts(rt);
  installNet(rt, {});
  rt.run(source, 'test.plain');
  return { rt, game, world, site, studio };
}

function first(source) { return run(source)[0]; }

function broken(source) {
  try { run(source); }
  catch (error) {
    if (error instanceof PlainError) return error;
    throw error;
  }
  throw new Error('expected this program to be rejected: ' + source);
}

// --------------------------------------------------------------- the basics

check('show text', () => assert.equal(first('show "hi"'), 'hi'));
check('numbers keep their shape', () => assert.equal(first('show 3 plus 4'), '7'));
check('no floating point noise', () => assert.equal(first('show 0.1 plus 0.2'), '0.3'));
check('symbols work too', () => assert.equal(first('show 2 + 3 * 4'), '14'));
check('words and symbols agree', () => assert.equal(first('show 2 plus 3 times 4'), '14'));
check('brackets change the order', () => assert.equal(first('show (2 plus 3) times 4'), '20'));
check('divided by', () => assert.equal(first('show 10 divided by 4'), '2.5'));
check('minus and negatives', () => assert.equal(first('show 3 minus 10'), '-7'));
check('power', () => assert.equal(first('show 2 ^ 10'), '1024'));

check('make and show a name', () => assert.equal(first('make x be 5\nshow x'), '5'));
check('names ignore capitals', () => assert.equal(first('make Score be 5\nshow score'), '5'));
check('articles read nicely', () => assert.equal(first('make score be 7\nshow the score'), '7'));
check('set changes a name', () => assert.equal(first('make x be 1\nset x to 9\nshow x'), '9'));
check('text joins', () => assert.equal(first('show "a" joined with "b"'), 'ab'));
check('text plus number', () => assert.equal(first('show "n=" plus 4'), 'n=4'));

check('text can hold values', () =>
  assert.equal(first('make n be 3\nshow "there are {n} of them"'), 'there are 3 of them'));
check('text can hold sums', () =>
  assert.equal(first('make n be 3\nshow "double is {n times 2}"'), 'double is 6'));
check('escaped braces stay put', () =>
  assert.equal(first('show "a \\{b\\} c"'), 'a {b} c'));
check('quotes inside text', () =>
  assert.equal(first('show "she said \\"hi\\""'), 'she said "hi"'));

// ------------------------------------------------------------------ choices

check('if and otherwise', () =>
  assert.equal(first('make x be 3\nif x is above 5\nshow "big"\notherwise\nshow "small"\nend'), 'small'));
check('otherwise if', () =>
  assert.equal(first('make x be 5\nif x is above 5\nshow "big"\notherwise if x is 5\nshow "five"\notherwise\nshow "small"\nend'), 'five'));
check('is not', () => assert.equal(first('if 2 is not 3\nshow "yes"\nend'), 'yes'));
check('at least', () => assert.equal(first('if 5 is at least 5\nshow "yes"\nend'), 'yes'));
check('and / or', () => assert.equal(first('if 1 is 1 and 2 is 2\nshow "yes"\nend'), 'yes'));
check('not', () => assert.equal(first('if not 1 is 2\nshow "yes"\nend'), 'yes'));
check('contains', () => assert.equal(first('make l be a list of 1, 2\nif l contains 2\nshow "yes"\nend'), 'yes'));
check('yes and no', () => assert.equal(first('make done be no\nif not done\nshow "still going"\nend'), 'still going'));

// -------------------------------------------------------------------- loops

check('repeat n times', () => assert.equal(run('repeat 3 times\nshow "x"\nend').length, 3));
check('repeat with counter', () =>
  assert.deepEqual(run('repeat with i from 1 to 3\nshow i\nend'), ['1', '2', '3']));
check('counting down', () =>
  assert.deepEqual(run('repeat with i from 3 to 1\nshow i\nend'), ['3', '2', '1']));
check('counting by steps', () =>
  assert.deepEqual(run('repeat with i from 0 to 10 by 5\nshow i\nend'), ['0', '5', '10']));
check('counting down by steps', () =>
  assert.deepEqual(run('repeat with i from 6 to 0 by 3\nshow i\nend'), ['6', '3', '0']));
check('numbers can be spaced with _', () => assert.equal(first('show 1_000 plus 1'), '1001'));
check('the count of a repeat is available', () =>
  assert.deepEqual(run('repeat 3 times\nshow count\nend'), ['1', '2', '3']));
check('while', () =>
  assert.deepEqual(run('make n be 3\nwhile n is above 0\nshow n\ntake 1 from n\nend'), ['3', '2', '1']));
check('for each', () =>
  assert.deepEqual(run('for each item in a list of "a", "b"\nshow item\nend'), ['a', 'b']));
check('stop leaves the loop', () =>
  assert.deepEqual(run('repeat with i from 1 to 9\nif i is 3\nstop\nend\nshow i\nend'), ['1', '2']));
check('next skips one', () =>
  assert.deepEqual(run('repeat with i from 1 to 3\nif i is 2\nnext\nend\nshow i\nend'), ['1', '3']));
check('runaway loops are stopped', () => {
  const error = broken('make n be 1\nwhile n is 1\nshow "x"\nend');
  assert.match(error.plainMessage, /forever/);
});

// -------------------------------------------------------------------- lists

check('list literal', () => assert.equal(first('show length of a list of 1, 2, 3'), '3'));
check('square brackets too', () => assert.equal(first('show length of [1, 2, 3]'), '3'));
check('items count from one', () => assert.equal(first('show item 1 of [7, 8, 9]'), '7'));
check('add to a list', () => assert.equal(first('make l be [1]\nadd 2 to l\nshow length of l'), '2'));
check('remove from a list', () => assert.equal(first('make l be [1, 2]\nremove 1 from l\nshow item 1 of l'), '2'));
check('set an item', () => assert.equal(first('make l be [1, 2]\nset item 2 of l to 9\nshow item 2 of l'), '9'));
check('total, highest, lowest', () =>
  assert.deepEqual(run('make l be [3, 9, 1]\nshow total of l\nshow highest of l\nshow lowest of l'), ['13', '9', '1']));
check('a program can be written in Spanish', () => {
  const lines = run([
    'en español',
    'haz puntos ser 0',
    'haz cartas ser [3, 1, 2]',
    'por cada carta dentro de cartas',
    '    cambia puntos a puntos más carta',
    'fin',
    'muestra puntos',
    'muestra número de elementos dentro de cartas',
    'muestra ordenado cartas',
    'si puntos es mayor que 2',
    '    muestra "grande"',
    'fin',
    'para saludar con nombre',
    '    devuelve "hola, {nombre}"',
    'fin',
    'muestra saludar con "Ana"'
  ].join('\n'));
  assert.deepEqual(lines, ['6', '3', '[1, 2, 3]', 'grande', 'hola, Ana']);
});

check('a program can be written in French, elision and all', () => {
  const lines = run([
    'en français',
    'fais cartes être [3, 1, 2]',
    'affiche nombre de éléments dans cartes',
    'affiche trié cartes',
    'répète avec n allant de 1 à 2',
    '    affiche "tour {n}"',
    'fin',
    // "l'élément" is one token holding two words; the apostrophe is split
    // and each half translated on its own.
    "affiche l'élément 1 de cartes"
  ].join('\n'));
  assert.deepEqual(lines, ['3', '[1, 2, 3]', 'tour 1', 'tour 2', '3']);
});

check('the y coordinate survives being the Spanish word for "and"', () => {
  const lines = run([
    'en español',
    'haz cosa ser { x: 4, y: 9 }',
    'muestra y de cosa',
    'si x de cosa es 4 y y de cosa es 9',
    '    muestra "las dos"',
    'fin'
  ].join('\n'));
  assert.deepEqual(lines, ['9', 'las dos']);
});

check('a Spanish game parses with the game engine words', () => {
  const { game } = runtimeFor([
    'en español',
    'empieza un juego llamado "Atrapa" de tamaño 800 por 500',
    'haz jugador ser una caja en 400 , 450 de tamaño 60 por 20 de color "#ffd166"',
    'cuando jugador toca jugador',
    '    suma 1 a puntos',
    'fin'
  ].join('\n'));
  assert.equal(game.title, 'Atrapa');
  assert.equal(game.width, 800);
  assert.equal(game.things.length, 1);
});

check('an English program is untouched by the language packs', () => {
  // "si", "es" and "no" are all Spanish words; in a file with no language
  // line they must stay exactly what the programmer named them.
  const lines = run([
    'make si be 1',
    'make es be 2',
    'show si plus es'
  ].join('\n'));
  assert.deepEqual(lines, ['3']);
});

check('German, Portuguese, Italian and Dutch all run', () => {
  const german = run([
    'auf deutsch',
    'mache summe sei 0',
    'für jedes blatt in [3, 1, 2]',
    '    setze summe zu summe plus blatt',
    'ende',
    // A separable verb: the stump at the end simply vanishes.
    'füge 4 zu summe hinzu',
    'wenn summe ist über 5',
    '    zeige "gross: {summe}"',
    'ende'
  ].join(String.fromCharCode(10)));
  assert.deepEqual(german, ['gross: 10']);

  const portuguese = run([
    'em português',
    'faça cartas ser [3, 1, 2]',
    'mostre ordenado cartas',
    'se 6 é maior que 5',
    '    mostre "grande"',
    'fim'
  ].join(String.fromCharCode(10)));
  assert.deepEqual(portuguese, ['[1, 2, 3]', 'grande']);

  const italian = run([
    'in italiano',
    'fai somma essere 0',
    'per ogni carta in [3, 1, 2]',
    '    cambia somma a somma più carta',
    'fine',
    'mostra "totale: {somma}"'
  ].join(String.fromCharCode(10)));
  assert.deepEqual(italian, ['totale: 6']);

  const dutch = run([
    'in het nederlands',
    'maak punten zijn 10',
    'voeg 5 toe aan punten',
    'toon punten',
    'als punten is groter dan 12',
    '    toon "groot"',
    'einde'
  ].join(String.fromCharCode(10)));
  assert.deepEqual(dutch, ['15', 'groot']);
});

check('a stream is a list that does not exist yet', () => {
  const lines = run([
    'for each n in numbers from 1 to 3',
    '    show n',
    'end',
    'show the first 3 of (numbers from 1 to 100000000)',
    'make seen be []',
    'for each n in numbers from 2 onwards',
    '    add n times n to seen',
    '    if number of items in seen is 3',
    '        stop',
    '    end',
    'end',
    'show seen',
    'show the first 4 of (numbers from 10 to 0 by 3)'
  ].join(String.fromCharCode(10)));
  assert.deepEqual(lines, ['1', '2', '3', '[1, 2, 3]', '[4, 9, 16]', '[10, 7, 4, 1]']);
});

check('an endless stream with no stop is stopped, not hung', () => {
  const rt = createRuntime({ onOutput: () => {}, loopLimit: 1000 });
  let said = '';
  try { rt.run('for each n in numbers from 1 onwards' + String.fromCharCode(10) + 'show n' + String.fromCharCode(10) + 'end'); }
  catch (error) { said = String(error.plainMessage || error.message); }
  assert.ok(said.includes('forever'), 'expected the loop guard, got: ' + said);
});

check('work started in the background answers correctly', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-work-test-'));
  try {
    const program = [
      'to double with n',
      '    give back n times 2',
      'end',
      'make job be start working on "double" with 21',
      'make other be start working on "double" with 4',
      'show the answer of job',
      'show the answer of other'
    ].join(String.fromCharCode(10));
    fs.writeFileSync(path.join(folder, 'w.plain'), program, 'utf8');
    const output = execFileSync(process.execPath,
      [path.join(ROOT, 'bin', 'plain.js'), 'run', path.join(folder, 'w.plain')],
      { encoding: 'utf8', timeout: 60000 }).replace(/\r/g, '').trim().split(String.fromCharCode(10)).map(one => one.trim());
    assert.deepEqual(output, ['42', '8']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

check('sorted', () => assert.equal(first('show text of sorted [3, 1, 2]'), '[1, 2, 3]'));

check('shuffling keeps every item and leaves the original alone', () => {
  // Checked as properties rather than against an answer, because the whole
  // point of a shuffle is that its answer is different every time.
  const lines = run([
    'make cards be [1, 2, 3, 4, 5, 6, 7, 8]',
    'make mixed be shuffled cards',
    'show text of sorted mixed',
    'show text of cards',
    'show number of items in mixed'
  ].join('\n'));
  assert.equal(lines[0], '[1, 2, 3, 4, 5, 6, 7, 8]');   // nothing lost or gained
  assert.equal(lines[1], '[1, 2, 3, 4, 5, 6, 7, 8]');   // the original untouched
  assert.equal(lines[2], '8');

  // And it does actually move things: twenty shuffles of ten items landing
  // in the same order every time would be a shuffle that does nothing.
  const orders = new Set();
  for (let go = 0; go < 20; go++) {
    orders.add(run('show text of shuffled [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]')[0]);
  }
  assert.ok(orders.size > 15, 'shuffling gave the same order too often');
});
check('join', () => assert.equal(first('show join ["a", "b"] with "-"'), 'a-b'));
check('length of text', () => assert.equal(first('show length of "abcd"'), '4'));
check('position of', () => assert.equal(first('show position of "b" in ["a", "b"]'), '2'));

// ------------------------------------------------------------------- things

check('things hold named values', () =>
  assert.equal(first('make p be { name: "Ada", age: 36 }\nshow name of p'), 'Ada'));
check('set a field', () =>
  assert.equal(first('make p be { age: 1 }\nset the age of p to 2\nshow age of p'), '2'));
check('missing field is explained', () => {
  const error = broken('make p be { a: 1 }\nshow b of p');
  assert.match(error.plainMessage, /no "b"/);
});

// ------------------------------------------------------------------ actions

check('an action with a result', () =>
  assert.equal(first('to double with n\ngive back n times 2\nend\nshow double with 4'), '8'));
check('an action with two inputs', () =>
  assert.equal(first('to add up with a and b\ngive back a plus b\nend\nshow add up with 3 and 4'), '7'));
check('an action used before it is written', () =>
  assert.equal(first('show twice with 2\nto twice with n\ngive back n plus n\nend'), '4'));
check('an action that just does something', () =>
  assert.equal(first('to greet with who\nshow "hi " plus who\nend\ngreet with "ada"'), 'hi ada'));
check('actions can call actions', () =>
  assert.equal(first('to a with n\ngive back b with n plus 1\nend\nto b with n\ngive back n times 10\nend\nshow a with 1'), '20'));
check('names inside an action stay there', () => {
  const error = broken('to helper\nmake secret be 1\nend\nhelper\nshow secret');
  assert.match(error.plainMessage, /secret/);
});

// ------------------------------------------------------------ friendly slips

check('unknown name', () => {
  const error = broken('show total');
  assert.match(error.plainMessage, /do not know a name/);
  assert.equal(error.line, 1);
});
check('setting something that does not exist', () => {
  const error = broken('set x to 1');
  assert.match(error.plainMessage, /no name called "x"/);
});
check('missing end', () => {
  const error = broken('repeat 2 times\nshow "x"');
  assert.match(error.plainMessage, /never closed/);
});
check('unclosed text', () => {
  const error = broken('show "hello');
  assert.match(error.plainMessage, /closing/);
});
check('divide by zero', () => {
  const error = broken('show 1 divided by 0');
  assert.match(error.plainMessage, /divide by zero/);
});
check('the line number points at the real line', () => {
  const error = broken('show "a"\nshow "b"\nshow nope');
  assert.equal(error.line, 3);
});
check('a mistake inside a block is reported there', () => {
  const error = broken('repeat 2 times\n    show wobble\nend');
  assert.equal(error.line, 2);
});
check('reports say what to try', () => {
  const error = broken('show wobble');
  assert.match(error.report('show wobble'), /Line 1/);
});

// -------------------------------------------------------------- game engine

check('a game can be started', () => {
  const { game } = runtimeFor('start a game called "G" sized 320 by 200');
  assert.equal(game.title, 'G');
  assert.equal(game.width, 320);
  assert.equal(game.started, true);
});

check('things appear on screen', () => {
  const { game } = runtimeFor('start a game called "G"\nmake box be a box at 10 , 20 sized 4 by 6 colored "red"');
  assert.equal(game.things.length, 1);
  assert.equal(game.things[0].x, 10);
  assert.equal(game.things[0].color, 'red');
});

check('things move each frame', () => {
  const { game } = runtimeFor('start a game called "G"\nmake b be a circle at 0 , 0 sized 4\nset the speed of b to 2 , 0');
  game.simulate(5);
  assert.equal(game.things[0].x, 10);
});

check('every frame runs every frame', () => {
  const { rt, game } = runtimeFor('start a game called "G"\nmake n be 0\nevery frame\nadd 1 to n\nend');
  game.simulate(7);
  assert.equal(rt.interpreter.globals.get('n'), 7);
});

check('touching fires once per contact', () => {
  const { rt, game } = runtimeFor([
    'start a game called "G" sized 200 by 200',
    'make a be a box at 0 , 100 sized 10 by 10 colored "red"',
    'make b be a box at 50 , 100 sized 10 by 10 colored "blue"',
    'set the speed of a to 5 , 0',
    'make hits be 0',
    'when a touches b',
    '    add 1 to hits',
    'end'
  ].join('\n'));
  game.simulate(40);
  assert.equal(rt.interpreter.globals.get('hits'), 1);
});

check('held keys can be read', () => {
  const { game } = runtimeFor([
    'start a game called "G"',
    'make p be a box at 100 , 100 sized 10 by 10',
    'every frame',
    '    if key "left" is held',
    '        move p left by 5',
    '    end',
    'end'
  ].join('\n'));
  game.simulate(2);
  assert.equal(game.things[0].x, 100);
  game.press('left');
  game.simulate(2);
  assert.equal(game.things[0].x, 90);
});

check('key presses run their block', () => {
  const { rt, game } = runtimeFor([
    'start a game called "G"',
    'make jumps be 0',
    'when key "space" is pressed',
    '    add 1 to jumps',
    'end'
  ].join('\n'));
  game.press('space');
  game.press('space');
  assert.equal(rt.interpreter.globals.get('jumps'), 2);
});

check('names that only hold numbers are found, and only those', () => {
  // The optimisation this drives is safe exactly when this is right, so the
  // interesting cases are the ones that must NOT be numbers: a name that
  // starts as text, one that comes from a call, one from a list, and a
  // parameter, which could be handed anything at all.
  const rt = createRuntime({ onOutput: () => {} });
  const found = numericNames(rt.parse([
    'to halved with x',
    '    give back x divided by 2',
    'end',
    'make total be 0',
    'make greeting be "5"',
    'set greeting to greeting joined with 1',
    'make counted be length of greeting',
    'make answer be halved with 9',
    'repeat with step from 1 to 5',
    '    set total to total plus step',
    'end',
    'make sum be 0',
    'for each one in [1, 2, 3]',
    '    set sum to sum plus one',
    'end'
  ].join('\n')), []);
  assert.ok(found.has('total'), 'total only ever holds numbers');
  assert.ok(!found.has('greeting'), 'greeting starts as text');
  assert.ok(!found.has('counted'), 'a length is read out of something else');
  assert.ok(!found.has('answer'), 'an action can give back anything');
  assert.ok(!found.has('sum'), 'an item of a list could be anything');
});

check('a name given text inside an if is not a number', () => {
  // The analysis reads an "if" through its branches. When it did not, every
  // assignment inside one was invisible and this name was called a number.
  const rt = createRuntime({ onOutput: () => {} });
  const found = numericNames(rt.parse([
    'make a be 0',
    'if a is above 1',
    '    set a to "text"',
    'end',
    'make b be 0',
    'otherwise_check',
    'make c be 0',
    'if a is above 1',
    '    set c to 1',
    'otherwise',
    '    set c to "text"',
    'end'
  ].join('\n').replace('otherwise_check' + '\n', ''), 'ifs.plain'), []);
  assert.ok(!found.has('a'), 'a is given text inside an if');
  assert.ok(!found.has('c'), 'c is given text in the otherwise');
  assert.ok(found.has('b'), 'b is only ever a number');
});

check('part of a list, and pages of one', () => {
  const { rt } = runtimeFor([
    'make all be [1, 2, 3, 4, 5, 6, 7]',
    'make top be the first 3 of all',
    'make tail be the last 2 of all',
    'make rest be everything after the first 5 of all',
    'make second be page 2 of all with 3 to a page',
    'make pages be how many pages in all with 3 to a page',
    'make asked be the first 99 of all',
    'make none be the last 0 of all'
  ].join('\n'));
  const g = rt.interpreter.globals;
  assert.deepEqual(g.get('top'), [1, 2, 3]);
  assert.deepEqual(g.get('tail'), [6, 7]);
  assert.deepEqual(g.get('rest'), [6, 7]);
  // Pages count from 1, as everything else in Plain does.
  assert.deepEqual(g.get('second'), [4, 5, 6]);
  assert.equal(g.get('pages'), 3);
  // Asking for more than there is gives what there is, rather than failing.
  assert.deepEqual(g.get('asked'), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(g.get('none'), []);
});

check('numbers and text can be tidied for showing', () => {
  const { rt } = runtimeFor([
    'make short be round 3.14159265 to 2 places',
    'make whole be round 2.5 to 0 places',
    'make price be show 3.5 to 2 places as text',
    'make named be pad "ada" to 8',
    'make lined be pad "9" to 4 on the left'
  ].join('\n'));
  const g = rt.interpreter.globals;
  assert.equal(g.get('short'), 3.14);
  assert.equal(g.get('whole'), 3);
  // As text, so the trailing nought survives - which money always needs and
  // a number can never hold.
  assert.equal(g.get('price'), '3.50');
  assert.equal(g.get('named'), 'ada     ');
  assert.equal(g.get('lined'), '   9');
});

check('days can be counted, named and compared', () => {
  const { rt } = runtimeFor([
    'make tomorrow be the day after "2026-08-14"',
    'make later be the day 20 days after "2026-08-14"',
    'make back be the day 1 days before "2026-01-01"',
    'make gap be days between "2026-08-14" and "2026-12-25"',
    'make named be the weekday of "2026-08-14"',
    'make written be the date "2026-08-14" in words',
    'make first be "2026-01-01" is before "2026-08-14"'
  ].join('\n'));
  const g = rt.interpreter.globals;
  assert.equal(g.get('tomorrow'), '2026-08-15');
  assert.equal(g.get('later'), '2026-09-03');
  // Crossing a year is where hand-rolled date sums go wrong.
  assert.equal(g.get('back'), '2025-12-31');
  assert.equal(g.get('gap'), 133);
  assert.equal(g.get('named'), 'Friday');
  assert.equal(g.get('written'), 'Friday 14 August 2026');
  assert.equal(g.get('first'), true);
});

check('lists answer the questions people ask of two lists', () => {
  const { rt } = runtimeFor([
    'make once be unique [1, 2, 2, 3, 1]',
    'make missing be everything in [1, 2, 3, 4] not in [2, 4]',
    'make shared be everything in [1, 2, 3] also in [2, 3, 9]',
    'make all be everything in [1, 2] and [2, 5]'
  ].join('\n'));
  const g = rt.interpreter.globals;
  assert.deepEqual(g.get('once'), [1, 2, 3]);
  assert.deepEqual(g.get('missing'), [1, 3]);
  assert.deepEqual(g.get('shared'), [2, 3]);
  assert.deepEqual(g.get('all'), [1, 2, 5]);
});

check('a film can be edited, not only assembled', () => {
  const { studio } = runtimeFor([
    'make a video called "Coast" sized 1280 by 720',
    'add a picture "cliff.jpg" for 4 seconds',
    'drift the last clip from 1 to 1.25',
    'add a picture "harbour.jpg" for 4 seconds',
    'cross into the last clip over 1 seconds',
    'add a clip "gulls.mp4" for 6 seconds',
    'play the last clip at 0.5 speed',
    'split the last clip at 3 seconds'
  ].join('\n'));
  // 4 + 4 - 1 crossed + 12 at half speed, and the split made a fourth clip.
  assert.equal(studio.clips.length, 4);
  assert.equal(Math.round(studio.length), 19);
  assert.equal(studio.clips[0].zoomTo, 1.25);
  assert.equal(studio.clips[1].crossFrom, 1);
  assert.equal(studio.clips[2].speed, 0.5);
});

check('a page can be laid out, not only stacked', () => {
  const { site } = runtimeFor([
    'make a website called "Tides"',
    'describe this page as "When the sea comes in."',
    'add a title "Tides"',
    'start a row',
    '    start a card',
    '        add a heading "Morning"',
    '    end',
    'end',
    'add a button "The whole week" going to "/week"'
  ].join('\n'));
  const page = site.pages[0];
  assert.equal(page.description, 'When the sea comes in.');
  const row = page.nodes.find(one => one.kind === 'row');
  assert.ok(row, 'the row exists');
  // What the block added went inside the row rather than on down the page.
  assert.equal(row.children.length, 1);
  assert.equal(row.children[0].kind, 'card');
  assert.ok(page.nodes.some(one => one.kind === 'button'));
});

check('a scene shows its own things and runs its own rules', () => {
  const { game, rt } = runtimeFor([
    'start a game called "Two Games" sized 400 by 300',
    'make score be 0',
    'scene "title"',
    '    make banner be words "PRESS SPACE" at 200 , 150 sized 20 colored "#fff"',
    '    when key "space" is pressed',
    '        go to scene "playing"',
    '    end',
    'end',
    'scene "playing"',
    '    make hero be a box at 50 , 150 sized 20 by 20 colored "#ffd166"',
    '    every frame',
    '        add 1 to score',
    '    end',
    'end',
    'make first be the scene now'
  ].join('\n'));
  const g = rt.interpreter.globals;
  // The first scene described is the one showing, so a game with scenes is
  // never staring at nothing.
  assert.equal(g.get('first'), 'title');

  // The playing scene's rules must not run while the title is up.
  game.simulate(10);
  assert.equal(g.get('score'), 0);

  // ...and its things must not be drawn either.
  const drawn = () => { const seen = []; game.drawContents({
    save(){}, restore(){}, translate(){}, rotate(){}, beginPath(){}, arc(){}, fill(){},
    fillRect(){}, fillText(t){ seen.push(t); }, drawImage(){}, measureText(){ return { width: 0 }; },
    set fillStyle(v){}, set font(v){}, set textAlign(v){}, set textBaseline(v){}
  }); return seen; };
  assert.deepEqual(drawn(), ['PRESS SPACE']);

  game.press('space');
  assert.equal(game.scene, 'playing');
  game.simulate(10);
  assert.equal(g.get('score'), 10);
  // The title's words are gone now, without anything having removed them.
  assert.deepEqual(drawn(), []);
});

check('Plain can check its own work', () => {
  const { rt } = runtimeFor([
    'make score be 0',
    'add 10 to score',
    'check score is 10',
    'check score is not 3',
    'check that score is above 5',
    'make good be how the checks went',
    'check score is 99',
    'make bad be how the checks went'
  ].join('\n'));
  const g = rt.interpreter.globals;
  assert.equal(g.get('good'), 'all 3 checks passed');
  // The failure has to say what was expected and what turned up, or it is
  // no better than the program simply not working.
  assert.match(String(g.get('bad')), /1 of 4 checks failed/);
  assert.match(String(g.get('bad')), /expected 99 but got 10/);
});

check('one lot of things meeting another lot', () => {
  const { game, rt } = runtimeFor([
    'start a game called "Groups" sized 400 by 300',
    'make rock be a box at 100 , 100 sized 30 by 30 colored "#888"',
    'make other be a box at 300 , 100 sized 30 by 30 colored "#888"',
    'put rock in the group "rocks"',
    'put other in the group "rocks"',
    'make shot be a box at 100 , 100 sized 6 by 6 colored "#fff"',
    'put shot in the group "shots"',
    'make hits be 0',
    'when anything in "shots" touches anything in "rocks"',
    '    add 1 to hits',
    'end'
  ].join('\n'));
  const g = rt.interpreter.globals;
  game.simulate(3);
  // One shot sitting on one rock: one hit, and it does not fire again every
  // frame it stays there.
  assert.equal(g.get('hits'), 1);
  game.simulate(10);
  assert.equal(g.get('hits'), 1);
  // Move it onto the other rock and it counts again.
  game.things[2].x = 300;
  game.simulate(3);
  assert.equal(g.get('hits'), 2);
});

check('bursts and slides move themselves', () => {
  const { game, rt } = runtimeFor([
    'start a game called "Feel" sized 400 by 300',
    'make hero be a box at 50 , 150 sized 20 by 20 colored "#fff"',
    'slide hero to 350 , 150 over 1 seconds',
    'make a burst of 30 at 200 , 150 colored "#f00"',
    'make flying be bits still flying'
  ].join('\n'));
  assert.equal(rt.interpreter.globals.get('flying'), 30);
  game.simulate(30);                       // half a second
  const half = game.things[0].x;
  assert.ok(half > 60 && half < 340, `half way should be between, was ${half}`);
  game.simulate(45);
  // Eased at both ends, and it stops exactly where it was sent.
  assert.equal(Math.round(game.things[0].x), 350);
  // The bits die out on their own rather than piling up forever.
  assert.ok(game.sparks.length < 30);
});

check('a block is memory with a size and no address', () => {
  const { rt } = runtimeFor([
    'make samples be room for 8 numbers',
    'put 0.5 at 1 of samples',
    'put 3 at 8 of samples',
    'make first be what is at 1 of samples',
    'make big be how much room is in samples',
    'fill samples with 2',
    'make added be total of samples'
  ].join('\n'));
  const g = rt.interpreter.globals;
  assert.equal(g.get('first'), 0.5);
  assert.equal(g.get('big'), 8);
  assert.equal(g.get('added'), 16);
  // Reading past the end says so, rather than reading whatever is next door.
  assert.throws(() => runtimeFor([
    'make small be room for 4 numbers',
    'show what is at 20 of small'
  ].join('\n')), /no position 20/);
});

check('Plain can call code written in another language', () => {
  // A toolkit is WebAssembly, which is what a C library compiles to when it
  // wants to be portable. This one is written out by hand - it is the
  // smallest possible module, exporting an add - so the test proves the
  // door opens without needing a C compiler to hand.
  const { rt } = runtimeFor([
    'make maths be bytes from hex "00 61 73 6d 01 00 00 00 01 07 01 60 02 7f 7f 01 7f 03 02 01 00 07 07 01 03 61 64 64 00 00 0a 09 01 07 00 20 00 20 01 6a 0b"',
    'use the toolkit maths as sums',
    'make offered be what sums offers',
    'make answer be ask sums for "add" with 40 and 2'
  ].join('\n'));
  const g = rt.interpreter.globals;
  assert.deepEqual(g.get('offered'), ['add']);
  assert.equal(g.get('answer'), 42);
});

check('serving twice is one server, not a failed second one', () => {
  // A program that uses another one inherits its "start serving" line as
  // well as its own. That must not try to open the port twice: the second
  // attempt fails, and half the program ends up answering nobody.
  let opened = 0;
  const rt = createRuntime({ onOutput: () => {} });
  installNet(rt, { serve: () => { opened += 1; } });
  rt.run('start serving on port 3040\nstart serving on port 3040\n', 'twice.plain');
  assert.equal(opened, 1);
  // A different port is a real disagreement and should be said out loud.
  assert.throws(() => rt.run('start serving on port 4000\n', 'other.plain'));
});

check('numbers can be packed into bytes and read back', () => {
  const { rt } = runtimeFor([
    'make packet be []',
    'add the byte 5 to packet',
    'add the number 1234 in 2 bytes to packet',
    'add the number 70000 in 4 bytes to packet',
    'add the decimal 3.5 to packet',
    'add the text "hi" to packet',
    'make written be hex of packet',
    'make small be the number in packet at 2 over 2 bytes',
    'make big be the number in packet at 4 over 4 bytes',
    'make rough be the decimal in packet at 8',
    'make words be the text in packet at 12 for 2',
    'make roundtrip be text of bytes (bytes of text "café 你好")'
  ].join('\n'));
  const g = rt.interpreter.globals;
  assert.equal(g.get('written'), '05 d2 04 70 11 01 00 00 00 60 40 68 69');
  assert.equal(g.get('small'), 1234);
  assert.equal(g.get('big'), 70000);
  assert.equal(g.get('rough'), 3.5);
  assert.equal(g.get('words'), 'hi');
  // Anything that is not plain English has to survive as well, or the bytes
  // are only useful for talking to programs written in one language.
  assert.equal(g.get('roundtrip'), 'café 你好');
});

check('a list of things can be sorted by one of their values', () => {
  const { rt } = runtimeFor([
    'make people be [{ name: "Ada", score: 3 }, { name: "Bo", score: 9 }, { name: "Cy" }]',
    'make best be reversed sorted people by "score"',
    'make names be []',
    'for each one in best',
    '    add name of one to names',
    'end'
  ].join('\n'));
  // Cy has no score at all, so Cy goes last however the list is turned round.
  assert.deepEqual(rt.interpreter.globals.get('names'), ['Cy', 'Bo', 'Ada']);
});

check('the view moves the world without moving the screen', () => {
  const { game } = runtimeFor([
    'start a game called "Big" sized 800 by 600',
    'point the view at 5000 , 3000',
    'zoom the view to 0.5',
    'every frame',
    '    seen through the view',
    '        draw a circle at 5000 , 3000 sized 100 colored "#fff"',
    '        draw a circle at 5400 , 3000 sized 100 colored "#fff"',
    '    end',
    '    draw "score 3" at 20 , 20 sized 16 colored "#fff"',
    'end'
  ].join('\n'));
  game.simulate(1);
  const drawn = game.drawQueue;
  const middle = drawn[0], along = drawn[1], hud = drawn[2];
  // What the view is pointed at lands in the middle of the window.
  assert.equal(middle.x, 400);
  assert.equal(middle.y, 300);
  // 400 further on, at half size, is 200 further across.
  assert.equal(along.x, 600);
  // And it is drawn half the size, because that is what zoom means.
  assert.equal(middle.size, 50);
  // The score is not in the world and does not move with it.
  assert.equal(hud.x, 20);
  assert.equal(hud.y, 20);
  assert.equal(hud.size, 16);
});

check('what the view can see is a question a program can ask', () => {
  const { rt } = runtimeFor([
    'start a game called "Big" sized 800 by 600',
    'point the view at 1000 , 1000',
    'zoom the view to 2',
    'make left be view left',
    'make right be view right'
  ].join('\n'));
  // At twice the size, an 800-wide window shows 400 of the world.
  assert.equal(rt.interpreter.globals.get('left'), 800);
  assert.equal(rt.interpreter.globals.get('right'), 1200);
});

check('a program can ask which key was pressed', () => {
  const { rt, game } = runtimeFor([
    'start a game called "G"',
    'make typed be ""',
    'when any key is pressed',
    '    if the key pressed is "backspace"',
    '        make shorter be (length of typed) minus 1',
    '        set typed to part of typed from 1 to shorter',
    '    otherwise if length of the key pressed is 1',
    '        set typed to typed joined with the key pressed',
    '    end',
    'end'
  ].join('\n'));
  for (const key of ['h', 'i', 'x', 'backspace', 'space', '!']) game.press(key);
  assert.equal(rt.interpreter.globals.get('typed'), 'hi!');
});

check('touching is also a question', () => {
  const { game } = runtimeFor([
    'start a game called "G"',
    'make a be a box at 0 , 0 sized 10 by 10',
    'make b be a box at 5 , 0 sized 10 by 10',
    'make c be a box at 900 , 0 sized 10 by 10',
    'every frame',
    '    if a touches b',
    '        move c to 1 , 1',
    '    end',
    'end'
  ].join('\n'));
  game.simulate(1);
  assert.equal(game.things[2].x, 1);
});

check('the game can be stopped', () => {
  const { game } = runtimeFor([
    'start a game called "G"',
    'make n be 0',
    'every frame',
    '    add 1 to n',
    '    stop the game saying "done"',
    'end'
  ].join('\n'));
  game.simulate(10);
  assert.equal(game.over, true);
  assert.equal(game.overMessage, 'done');
});

check('gravity pulls things down', () => {
  const { game } = runtimeFor('start a game called "G"\nset gravity to 1\nmake b be a box at 0 , 0 sized 4 by 4');
  game.simulate(3);
  assert.equal(game.things[0].y, 6); // 1 + 2 + 3
});

check('a thing can carry its own values', () => {
  const { rt, game } = runtimeFor([
    'start a game called "G"',
    'make b be a box at 0 , 0 sized 4 by 4',
    'set the health of b to 3',
    'take 1 from nothing_here'
  ].join('\n').replace('take 1 from nothing_here', 'show health of b'));
  assert.equal(rt.lines[0], '3');
  assert.ok(game);
});

check('timers run on their own clock', () => {
  const { rt, game } = runtimeFor('start a game called "G"\nmake n be 0\nevery 1 seconds\nadd 1 to n\nend');
  game.simulate(180, 1 / 60); // three seconds
  assert.equal(rt.interpreter.globals.get('n'), 3);
});

check('leaving the screen is noticed once', () => {
  const { rt, game } = runtimeFor([
    'start a game called "G" sized 100 by 100',
    'make b be a box at 50 , 50 sized 10 by 10',
    'set the speed of b to 20 , 0',
    'make gone be 0',
    'when b leaves the screen',
    '    add 1 to gone',
    'end'
  ].join('\n'));
  game.simulate(30);
  assert.equal(rt.interpreter.globals.get('gone'), 1);
});

check('distance between two things', () => {
  const lines = run([
    'start a game called "G"',
    'make a be a box at 0 , 0 sized 2 by 2',
    'make b be a box at 3 , 4 sized 2 by 2',
    'show distance from a to b'
  ].join('\n'));
  assert.equal(lines[0], '5');
});

check('a bad direction is explained', () => {
  const error = broken('start a game called "G"\nmake b be a box at 0 , 0 sized 2 by 2\nmove b sideways by 1');
  assert.match(error.plainMessage, /not a direction/);
});

// -------------------------------------------------------- kinds of my own

const ANIMALS = [
  'a kind called Animal',
  '    has name',
  '    has sound be "..."',
  '    to speak',
  '        show "{name of me} says {sound of me}"',
  '    end',
  'end',
  'a kind called Dog based on Animal',
  '    has sound be "woof"',
  '    to fetch with item',
  '        give back "{name of me} fetched the {item}"',
  '    end',
  'end'
].join('\n');

check('a kind can be told to do something', () =>
  assert.equal(first(`${ANIMALS}\nmake rex be a new Dog with name "Rex"\ntell rex to speak`), 'Rex says woof'));
check('asking a kind gives a value', () =>
  assert.equal(first(`${ANIMALS}\nmake rex be a new Dog with name "Rex"\nshow ask rex to fetch with "ball"`), 'Rex fetched the ball'));
check('a kind inherits what it is based on', () =>
  assert.equal(first(`${ANIMALS}\nmake rex be a new Dog with name "Rex"\nif rex is a kind of Animal\nshow "yes"\nend`), 'yes'));
check('kind values can be read and set', () =>
  assert.equal(first(`${ANIMALS}\nmake rex be a new Dog with name "Rex"\nset the name of rex to "Rexy"\nshow name of rex`), 'Rexy'));
check('an unknown value on a kind is explained', () => {
  const error = broken(`${ANIMALS}\nmake rex be a new Dog with colour "brown"`);
  assert.match(error.plainMessage, /has no "colour"/);
});
check('an unknown action on a kind is explained', () => {
  const error = broken(`${ANIMALS}\nmake rex be a new Dog with name "Rex"\ntell rex to fly`);
  assert.match(error.plainMessage, /does not know how to "fly"/);
});
check('an unknown kind is explained', () => {
  const error = broken('make x be a new Wombat');
  assert.match(error.plainMessage, /kind called "Wombat"/);
});

// ----------------------------------------------------------- going wrong

check('a problem can be caught', () =>
  assert.equal(first('try\n    report a problem saying "oh no"\nif it fails\n    show "caught {the problem}"\nend'), 'caught oh no'));
check('a caught problem does not stop the program', () =>
  assert.deepEqual(run('try\n    show 1 divided by 0\nif it fails\n    show "no dividing"\nend\nshow "carried on"'), ['no dividing', 'carried on']));
check('try with nothing to catch just runs', () =>
  assert.equal(first('try\n    show "fine"\nif it fails\n    show "not reached"\nend'), 'fine'));
check('give back still works through a try', () =>
  assert.equal(first('to safe\n    try\n        give back "out"\n    if it fails\n        give back "caught"\n    end\nend\nshow safe'), 'out'));

// ------------------------------------------------------- actions as values

check('an action can be held in a name', () =>
  assert.equal(first('to double with n\n give back n times 2\nend\nmake f be the action double\nshow call f with 21'), '42'));
check('a list can be changed by an action', () =>
  assert.equal(first('to double with n\n give back n times 2\nend\nshow [1, 2, 3] changed by the action double'), '[2, 4, 6]'));
check('a list can be filtered by an action', () =>
  assert.equal(first('to big with n\n give back n is above 2\nend\nshow [1, 2, 3, 4] kept where the action big'), '[3, 4]'));
check('a list can be added up by an action', () =>
  assert.equal(first('to double with n\n give back n times 2\nend\nshow [1, 2, 3] added up by the action double'), '12'));
check('an unknown action is explained', () => {
  const error = broken('make f be the action wibble');
  assert.match(error.plainMessage, /action called "wibble"/);
});

// -------------------------------------------------------- things as bags

check('named values can be read by key', () =>
  assert.equal(first('make t be { a: 1 }\nshow value "a" of t'), '1'));
check('named values can be set by key', () =>
  assert.equal(first('make t be { a: 1 }\nset value "b" of t to 2\nshow value "b" of t'), '2'));
check('a thing can be asked what it has', () =>
  assert.equal(first('make t be { a: 1 }\nif t has "a"\nshow "yes"\nend'), 'yes'));
check('values of a thing', () =>
  assert.equal(first('make t be { a: 1, b: 2 }\nshow values of t'), '[1, 2]'));

// ------------------------------------------------------------- other files

check('another file can be used', () => {
  const lines = run('use "helpers.plain"\nshow shout with "hi"', {
    files: { 'helpers.plain': 'to shout with words\n    give back uppercase of words\nend\n' }
  });
  assert.equal(lines[0], 'HI');
});
check('using a file keeps line numbers right', () => {
  let error = null;
  try {
    run('use "helpers.plain"\nshow "one"\nshow missing', { files: { 'helpers.plain': 'make ok be 1\n' } });
  } catch (e) { error = e; }
  assert.equal(error.line, 3);
});
check('a missing file is explained', () => {
  const error = broken('use "nowhere.plain"');
  assert.match(error.plainMessage, /cannot find the file/);
});

// ------------------------------------------------------- sentences of my own

check('a new doing sentence', () => {
  const rt = createRuntime({ onOutput: () => {} });
  rt.define('wave at $who', ({ who }, ctx) => ctx.output(`o/ ${who}`));
  rt.run('wave at "world"');
  assert.equal(rt.lines[0], 'o/ world');
});

check('a new value sentence', () => {
  const rt = createRuntime({ onOutput: () => {} });
  rt.defineValue('double $n', ({ n }) => n * 2);
  rt.run('show double 21');
  assert.equal(rt.lines[0], '42');
});

check('a new sentence between two values', () => {
  const rt = createRuntime({ onOutput: () => {} });
  rt.defineInfix('$a rhymes with $b', ({ a, b }) => a.slice(-2) === b.slice(-2));
  rt.run('if "cat" rhymes with "hat"\n show "they do"\nend');
  assert.equal(rt.lines[0], 'they do');
});

check('a new sentence that takes a block', () => {
  const rt = createRuntime({ onOutput: () => {} });
  rt.define('three times ...', (args, ctx) => { for (let i = 0; i < 3; i++) ctx.block(); });
  rt.run('three times\n show "x"\nend');
  assert.equal(rt.lines.length, 3);
});

// --------------------------------------------------------------- web engine

check('a website has a title and pages', () => {
  const { site } = runtimeFor('make a website called "Site"\nadd a title "Hi"');
  assert.equal(site.title, 'Site');
  assert.equal(site.pages.length, 1);
  assert.equal(site.pages[0].nodes[0].kind, 'title');
});

check('more pages can be added', () => {
  const { site } = runtimeFor('make a website called "S"\nadd a title "One"\nmake a page called "Two" at "/two"\nadd a title "Two"');
  assert.equal(site.pages.length, 2);
  assert.equal(site.pages[1].path, '/two');
});

check('cards hold what is inside them', () => {
  const { site } = runtimeFor('make a website called "S"\nadd a card called "C"\nadd text "inside"\nend');
  const card = site.pages[0].nodes[0];
  assert.equal(card.kind, 'card');
  assert.equal(card.children.length, 2);
  assert.equal(card.children[1].props.text, 'inside');
});

check('lists on a page', () => {
  const { site } = runtimeFor('make a website called "S"\nadd a list of "a", "b", "c"');
  assert.deepEqual(site.pages[0].nodes[0].props.items, ['a', 'b', 'c']);
});

check('a list value works too', () => {
  const { site } = runtimeFor('make a website called "S"\nmake things be ["x", "y"]\nadd a list of things');
  assert.deepEqual(site.pages[0].nodes[0].props.items, ['x', 'y']);
});

check('pages become HTML', () => {
  const { site } = runtimeFor('make a website called "S"\nset the theme to "dark"\nadd a title "Hello"\nadd text "World"');
  const html = documentToHTML(site, site.pages[0], {});
  assert.match(html, /<h1 class="plain-title">Hello<\/h1>/);
  assert.match(html, /<p class="plain-text">World<\/p>/);
  assert.match(html, /<!doctype html>/);
});

check('HTML is escaped', () => {
  const { site } = runtimeFor('make a website called "S"\nadd text "<script>oops</script>"');
  const html = documentToHTML(site, site.pages[0], {});
  assert.ok(!html.includes('<script>oops'));
  assert.match(html, /&lt;script&gt;/);
});

check('a page can carry your own markup', () => {
  const { site } = runtimeFor("make a website called \"S\"\nadd html '<div class=\"card\"><b>mine</b></div>'");
  const node = site.pages[0].nodes[0];
  assert.equal(node.kind, 'html');
  const html = documentToHTML(site, site.pages[0], {});
  // It goes in as written, not escaped like ordinary words.
  assert.match(html, /<div class="card"><b>mine<\/b><\/div>/);
});

check('a page can carry your own style', () => {
  const { site } = runtimeFor([
    'make a website called "S"',
    "add style '.card { color: hotpink }'",
    'set the page background to "#fffaf0"',
    'set the font to "Georgia, serif"',
    'set the page width to 900'
  ].join('\n'));
  const html = documentToHTML(site, site.pages[0], {});
  assert.match(html, /\.card \{ color: hotpink \}/);
  assert.match(html, /body \{ background: #fffaf0; \}/);
  assert.match(html, /font-family: Georgia, serif/);
  assert.match(html, /max-width: 900px/);
});

check('anything named can be styled by that name', () => {
  const { site } = runtimeFor([
    'make a website called "S"',
    'add text "loud" named shouty',
    "style shouty with 'color: crimson'"
  ].join('\n'));
  const html = documentToHTML(site, site.pages[0], {});
  assert.match(html, /\[data-plain-name="shouty"\] \{ color: crimson \}/);
  assert.match(html, /data-plain-name="shouty"/);
});

check('a style cannot break out of the style block', () => {
  const { site } = runtimeFor("make a website called \"S\"\nadd style '</style><script>bad()</script>'");
  const html = documentToHTML(site, site.pages[0], {});
  assert.ok(!html.includes('</style><script>'), 'the style block was closed early');
});

check('markup and style survive being written back', () => {
  const source = [
    'make a website called "S"',
    "add style '.card { border: 1px solid red; }'",
    'add a title "Hi"',
    "add html '<div class=\"card\">it\\'s mine</div>'"
  ].join('\n');
  const { site } = runtimeFor(source);
  const written = site.toPlainSource();
  const again = runtimeFor(written);
  assert.equal(again.site.styles[0], '.card { border: 1px solid red; }');
  const node = again.site.pages[0].nodes.find(one => one.kind === 'html');
  assert.equal(node.props.text, '<div class="card">it\'s mine</div>');
});

check('a page can be written in markdown', () => {
  const { site } = runtimeFor([
    'make a website called "S"',
    "add markdown '# Big",
    '',
    'Some **bold** and `code` and [a link](https://example.com).',
    '',
    '- one',
    '- two',
    '',
    '> quoted',
    "'"
  ].join('\n'));
  assert.equal(site.pages[0].nodes[0].kind, 'markdown');
  const html = documentToHTML(site, site.pages[0], {});
  assert.match(html, /<h1 class="plain-title">Big<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<a href="https:\/\/example\.com">a link<\/a>/);
  assert.match(html, /<li>one<\/li>\n<li>two<\/li>/);
  assert.match(html, /<blockquote class="plain-quote">/);
});

check('markdown is read, not passed through', () => {
  const { site } = runtimeFor("make a website called \"S\"\nadd markdown '<script>bad()</script> is *fine* to write about'");
  const html = documentToHTML(site, site.pages[0], {});
  assert.ok(!html.includes('<script>bad()'), 'markdown let markup through');
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<em>fine<\/em>/);
});

check('a page can carry your own JavaScript', () => {
  const { site } = runtimeFor("make a website called \"S\"\nadd script 'console.log(1 < 2)'");
  const html = documentToHTML(site, site.pages[0], {});
  // Scripts go in as written - escaping them would stop them working.
  assert.match(html, /<script>\nconsole\.log\(1 < 2\)\n\s*<\/script>/);
});

check('a script cannot break out of the script block', () => {
  const { site } = runtimeFor("make a website called \"S\"\nadd script '</script><b>loose</b>'");
  const html = documentToHTML(site, site.pages[0], {});
  assert.ok(!html.includes('</script><b>loose'), 'the script block was closed early');
});

check('markdown and script survive being written back', () => {
  const source = [
    'make a website called "S"',
    "add script 'var n = 1;'",
    "add markdown '## Hi there'"
  ].join('\n');
  const { site } = runtimeFor(source);
  const again = runtimeFor(site.toPlainSource());
  assert.equal(again.site.scripts[0], 'var n = 1;');
  assert.equal(again.site.pages[0].nodes[0].props.text, '## Hi there');
});

check('an unknown theme is explained', () => {
  const error = broken('make a website called "S"\nset the theme to "banana"');
  assert.match(error.plainMessage, /not a theme/);
});

check('buttons keep their block', () => {
  const { rt, site } = runtimeFor('make a website called "S"\nadd a button "Go"\nshow a message "pressed"\nend');
  const button = site.pages[0].nodes[0];
  assert.equal(button.kind, 'button');
  button.props.click();
  assert.equal(rt.lines[0], 'pressed');
});

// ------------------------------------------------------------- 3D worlds

const WORLD = [
  'start a world called "W" sized 400 by 300',
  'set world gravity to 0.5',
  'make ground be a floor at 0 , 0 , 0 sized 20 by 20 colored "green"',
  'make hero be a cube at 0 , 5 , 0 sized 2 colored "yellow"',
  'make prize be a ball at 0 , 1 , -4 sized 1 colored "red"'
].join('\n');

check('a world can be started', () => {
  const { world, game } = runtimeFor(WORLD);
  assert.equal(world.started, true);
  assert.equal(game.width, 400);
  assert.equal(world.bodies.length, 3);
});

check('a model can stand in a world', () => {
  const { world } = runtimeFor(WORLD + String.fromCharCode(10) +
    'make statue be a model "statue.obj" at 2 , 1 , 0 sized 3 colored "#d8c8a8"');
  const statue = world.bodies[3];
  assert.equal(statue.shape, 'model');
  assert.equal(statue.model, 'statue.obj');
  assert.equal(statue.width, 3);
  // Away from a browser nothing is fetched and nothing fails: a model with
  // no text yet is simply not drawn.
  assert.ok(!statue._modelText);
});

check('the obj reader triangulates, centres and scales', () => {
  const pyramid = objMesh('v 0 0 0' + String.fromCharCode(10) + 'v 2 0 0' + String.fromCharCode(10) + 'v 0 2 0' + String.fromCharCode(10) + 'v 0 0 2' + String.fromCharCode(10) + 'f 1 2 3' + String.fromCharCode(10) + 'f 1 3 4' + String.fromCharCode(10) + 'f 1 4 2' + String.fromCharCode(10) + 'f 2 4 3');
  assert.equal(pyramid.count, 12);                       // four triangles
  const spread = Math.max(...pyramid.positions.map(Math.abs));
  assert.ok(spread <= 0.51, 'a model two units wide should be scaled into the unit box');
  // Four corners in one face come out as two triangles, and every triangle
  // gets a normal even though the file named none.
  const quad = objMesh('v 0 0 0' + String.fromCharCode(10) + 'v 1 0 0' + String.fromCharCode(10) + 'v 1 1 0' + String.fromCharCode(10) + 'v 0 1 0' + String.fromCharCode(10) + 'f 1 2 3 4');
  assert.equal(quad.count, 6);
  assert.equal(quad.normals.length, 18);
});

check('the sun can be told to cast shadows', () => {
  const { world } = runtimeFor(WORLD + String.fromCharCode(10) + 'let the sun cast shadows');
  assert.equal(world.castShadows, true);
  const { world: off } = runtimeFor(WORLD + String.fromCharCode(10) + 'let the sun cast shadows' + String.fromCharCode(10) + 'stop the sun casting shadows');
  assert.equal(off.castShadows, false);
  // And a world that never asks never pays: the flag simply is not there.
  const { world: bare } = runtimeFor(WORLD);
  assert.ok(!bare.castShadows);
});

check('a picture can be worn on a thing in the world', () => {
  const { world } = runtimeFor([
    WORLD,
    'cover ground with the picture "grass.png" repeated 8 times',
    'cover hero with the picture "wood.png"',
    'cover prize with the picture "stone.png"',
    'uncover prize'
  ].join('\n'));
  const [ground, hero, prize] = world.bodies;
  assert.equal(ground.skin, 'grass.png');
  assert.equal(ground.skinRepeat, 8);
  assert.equal(hero.skin, 'wood.png');
  assert.equal(hero.skinRepeat, 1);           // one picture across the whole thing
  assert.equal(prize.skin, '');               // taken off again
  // Nothing is loaded away from a browser, and that is not an error: a thing
  // whose picture has not arrived is simply its colour, which is what it
  // would have been anyway.
  assert.equal(hero._skinImage, null);
});

check('things fall to the ground', () => {
  const { world } = runtimeFor(WORLD);
  world.step(); world.step();
  const hero = world.bodies[1];
  assert.ok(hero.y < 5);
  for (let i = 0; i < 60; i++) world.step();
  assert.equal(round(hero.y), 1);            // half of its height, resting on 0
});

check('a floor does not fall', () => {
  const { world } = runtimeFor(WORLD);
  for (let i = 0; i < 20; i++) world.step();
  assert.equal(world.bodies[0].y, 0);
});

check('forward follows the way a thing faces', () => {
  const { world } = runtimeFor(`${WORLD}\nturn hero left by 90\nmove hero forward by 2`);
  const hero = world.bodies[1];
  assert.equal(round(hero.x), -2);
  assert.equal(round(hero.z), 0);
});

check('moving forward without turning goes into the screen', () => {
  const { world } = runtimeFor(`${WORLD}\nmove hero forward by 3`);
  assert.equal(round(world.bodies[1].z), -3);
});

check('bodies can touch in three directions', () => {
  const { rt, game } = runtimeFor([
    WORLD,
    'let hero float',
    'let prize float',
    'make hits be 0',
    'when hero touches prize',
    '    add 1 to hits',
    'end',
    'every frame',
    '    move hero back by 0.5',
    'end'
  ].join('\n'));
  game.simulate(20);
  assert.equal(rt.interpreter.globals.get('hits'), 0);   // hero moves away
  game.world.bodies[1].z = -4;                            // same spot as the prize
  game.world.bodies[1].y = 1;
  game.simulate(1);
  assert.equal(rt.interpreter.globals.get('hits'), 1);
});

check('the camera can follow a thing', () => {
  const { world } = runtimeFor(`${WORLD}\nfollow hero with the camera\nset the camera distance to 5`);
  world.step();
  assert.equal(round(world.camera.z), round(world.bodies[1].z + 5));
});

check('resting can be asked about', () => {
  const { world, rt } = runtimeFor(`${WORLD}\nmake landed be no\nevery frame\n    if hero is resting\n        set landed to yes\n    end\nend`);
  rt.game.simulate(80);
  assert.equal(rt.interpreter.globals.get('landed'), true);
  assert.ok(world.bodies.length);
});

check('the 3D shapes are built correctly', () => {
  const cube = cubeMesh();
  assert.equal(cube.positions.length, 36 * 3);          // 12 triangles
  assert.equal(cube.normals.length, cube.positions.length);
  const ball = sphereMesh(8, 6);
  assert.equal(ball.positions.length / 3, 8 * 6 * 6);
});

check('the camera maths behaves', () => {
  const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
  assert.equal(view[14], -5);                            // 5 units in front
  const projection = perspective(Math.PI / 2, 1, 0.1, 100);
  assert.equal(round(projection[0]), 1);
  const both = multiply(projection, view);
  assert.equal(both.length, 16);
});

check('colours are understood', () => {
  assert.deepEqual(toRGB('#ff0000').map(round), [1, 0, 0]);
  assert.deepEqual(toRGB('red').map(v => Math.round(v * 100) / 100)[0] > 0.8, true);
});

// --------------------------------------------------------------- videos

const VIDEO = [
  'make a video called "V" sized 640 by 480',
  'add a title "Hello" for 3 seconds',
  'fade the last clip in over 1 seconds',
  'add a clip "beach.mp4" from 2 to 7 seconds',
  'put the words "the sea" on the last clip'
].join('\n');

check('a video is a timeline', () => {
  const { studio } = runtimeFor(VIDEO);
  assert.equal(studio.started, true);
  assert.equal(studio.clips.length, 2);
  assert.equal(studio.length, 8);
  assert.equal(studio.width, 640);
});

check('clips sit one after another', () => {
  const { studio } = runtimeFor(VIDEO);
  const layout = studio.layout();
  assert.equal(layout[0].start, 0);
  assert.equal(layout[1].start, 3);
  assert.equal(studio.clipAt(4).clip.source, 'beach.mp4');
});

check('a clip remembers where to cut the file', () => {
  const { studio } = runtimeFor(VIDEO);
  assert.equal(studio.clips[1].from, 2);
  assert.equal(studio.clips[1].length, 5);
});

check('fades and overlays are kept', () => {
  const { studio } = runtimeFor(VIDEO);
  assert.equal(studio.clips[0].fadeIn, 1);
  assert.equal(studio.clips[1].overlay, 'the sea');
});

check('a backwards clip is refused', () => {
  const error = broken('make a video called "V"\nadd a clip "x.mp4" from 8 to 2 seconds');
  assert.match(error.plainMessage, /finish after it starts/);
});

check('music can start late and be quieter', () => {
  const { studio } = runtimeFor([
    'make a video called "V"',
    'add a title "Hi" for 3 seconds',
    'add music "song.mp3" starting at 2 seconds',
    'add music "birds.mp3" at volume 0.3'
  ].join('\n'));
  assert.equal(studio.music.length, 2);
  assert.equal(studio.music[0].start, 2);
  assert.equal(studio.music[1].volume, 0.3);
});

check('a clip can be quietened or silenced', () => {
  const { studio } = runtimeFor([
    'make a video called "V"',
    'add a clip "a.mp4" for 3 seconds',
    'silence the last clip',
    'add a clip "b.mp4" for 3 seconds',
    'set the volume of the last clip to 0.5'
  ].join('\n'));
  assert.equal(studio.clips[0].volume, 0);
  assert.equal(studio.clips[1].volume, 0.5);
});

check('sound settings survive being written back', () => {
  const { studio } = runtimeFor([
    'make a video called "V"',
    'add a clip "a.mp4" for 3 seconds',
    'silence the last clip',
    'add music "song.mp3" starting at 2 seconds'
  ].join('\n'));
  const source = studio.toPlainSource();
  assert.match(source, /silence the last clip/);
  assert.match(source, /add music "song.mp3" starting at 2 seconds/);
  const again = runtimeFor(source);
  assert.equal(again.studio.clips[0].volume, 0);
  assert.equal(again.studio.music[0].start, 2);
});

check('a timeline writes itself back as Plain', () => {
  const { studio } = runtimeFor(VIDEO);
  const source = studio.toPlainSource();
  assert.match(source, /add a title "Hello" for 3 seconds/);
  assert.match(source, /add a clip "beach.mp4" from 2 to 7 seconds/);
  // and reading it back gives the same timeline
  const again = runtimeFor(source);
  assert.equal(again.studio.length, studio.length);
  assert.equal(again.studio.clips[1].overlay, 'the sea');
});

// ---------------------------------------------------- writing a .webm file

check('a length is written the way Matroska wants it', () => {
  assert.deepEqual([...sizeBytes(1)], [0x81]);
  assert.deepEqual([...sizeBytes(127)], [0x40, 0x7F]);      // 127 needs two bytes
  assert.deepEqual([...sizeBytes(126)], [0xFE]);
  assert.deepEqual([...sizeBytes(300)], [0x41, 0x2C]);
});

check('an element is an id, a length and its contents', () => {
  const made = element(0xE7, whole(5));                      // Timecode = 5
  assert.deepEqual([...made], [0xE7, 0x81, 0x05]);
});

check('a whole number takes as few bytes as it needs', () => {
  assert.deepEqual([...whole(0)], [0]);
  assert.deepEqual([...whole(255)], [255]);
  assert.deepEqual([...whole(256)], [1, 0]);
  assert.deepEqual([...whole(1000000)], [0x0F, 0x42, 0x40]);
});

check('a film becomes a file a player can read', () => {
  const frames = [];
  for (let at = 0; at < 30; at++) {
    frames.push({ data: Uint8Array.from([at, 1, 2, 3]), keyframe: at % 10 === 0, at: at * 33.3 });
  }
  const file = buildWebM({ width: 640, height: 360, frames, milliseconds: 1000, framesASecond: 30 });

  // The four bytes every WebM starts with.
  assert.deepEqual([...file.slice(0, 4)], [0x1A, 0x45, 0xDF, 0xA3]);
  const text = Buffer.from(file).toString('latin1');
  assert.ok(text.includes('webm'), 'it should say what kind of file it is');
  assert.ok(text.includes('V_VP8'), 'the track should name its codec');
  assert.ok(text.includes('Plain'), 'it should say what wrote it');

  // Every frame we handed over should be in there.
  for (const frame of frames) {
    assert.ok(Buffer.from(file).includes(Buffer.from(frame.data)), 'a frame went missing');
  }
  assert.ok(file.length > 200, 'the file is suspiciously small');
});

check('frames are grouped into clusters', () => {
  const frames = [];
  for (let at = 0; at < 200; at++) {
    frames.push({ data: Uint8Array.from([1]), keyframe: at % 60 === 0, at: at * 500 });   // 100 seconds
  }
  const file = buildWebM({ width: 320, height: 240, frames, milliseconds: 100000 });
  // A cluster id appears once per group, and 100 seconds cannot be one group
  // because a time inside a cluster only has 16 bits.
  let clusters = 0;
  for (let at = 0; at < file.length - 3; at++) {
    if (file[at] === 0x1F && file[at + 1] === 0x43 && file[at + 2] === 0xB6 && file[at + 3] === 0x75) clusters++;
  }
  assert.ok(clusters > 1, `expected several clusters, found ${clusters}`);
});

// ------------------------------------------------------- the designer path

check('a page writes itself back as Plain', () => {
  const source = [
    'make a website called "S"',
    'set the theme to "dark"',
    'add a title "Hi"',
    'add a card called "One"',
    '    add text "inside"',
    'end',
    'add a button "Go"',
    '    show a message "hello"',
    'end',
    'add a list of "a", "b"'
  ].join('\n');
  const { site } = runtimeFor(source);
  const written = site.toPlainSource();
  assert.match(written, /make a website called "S"/);
  assert.match(written, /set the theme to "dark"/);
  assert.match(written, /add a card called "One"/);
  assert.match(written, /add a button "Go"/);
  assert.match(written, /show a message "hello"/);      // the block came back
  assert.match(written, /add a list of "a", "b"/);

  const again = runtimeFor(written);
  assert.equal(again.site.pages[0].nodes.length, site.pages[0].nodes.length);
  assert.equal(again.site.theme, 'dark');
});

check('more than one page is written back', () => {
  const { site } = runtimeFor('make a website called "S"\nadd a title "One"\nmake a page called "Two" at "/two"\nadd a title "Two"');
  const written = site.toPlainSource();
  assert.match(written, /make a page called "Two" at "\/two"/);
  assert.equal(runtimeFor(written).site.pages.length, 2);
});

// ------------------------------------------------------------ translating

import { translate, targetNames } from '../src/translate/index.js';

function parsed(source) {
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installWorld(rt, {});
  installWeb(rt, {});
  installVideo(rt, {});
  return rt.parse(source, 'test.plain');
}

function written(source, target) {
  return translate(parsed(source), target, { file: 'test.plain' }).code;
}

// Run the same program three ways and insist the printed lines match.
function sameEverywhere(name, source) {
  check(name, () => {
    const expected = run(source).join('\n');
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-tr-'));
    try {
      const jsFile = path.join(folder, 'program.js');
      fs.writeFileSync(jsFile, written(source, 'javascript'), 'utf8');
      const fromJS = execFileSync(process.execPath, [jsFile], { encoding: 'utf8' }).replace(/\r/g, '').trimEnd();
      assert.equal(fromJS, expected, 'JavaScript said something different');

      if (PYTHON) {
        const pyFile = path.join(folder, 'program.py');
        fs.writeFileSync(pyFile, written(source, 'python'), 'utf8');
        const fromPython = execFileSync(PYTHON, [pyFile], { encoding: 'utf8' }).replace(/\r/g, '').trimEnd();
        assert.equal(fromPython, expected, 'Python said something different');
      }

      // Node can run TypeScript directly by taking the types back off.
      if (TYPESCRIPT) {
        const tsFile = path.join(folder, 'program.ts');
        fs.writeFileSync(tsFile, written(source, 'typescript'), 'utf8');
        const fromTS = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', tsFile], { encoding: 'utf8' })
          .replace(/\r/g, '').trimEnd();
        assert.equal(fromTS, expected, 'TypeScript said something different');
      }

      if (LUA) {
        const luaFile = path.join(folder, 'program.lua');
        fs.writeFileSync(luaFile, written(source, 'lua'), 'utf8');
        const fromLua = execFileSync(LUA, [luaFile], { encoding: 'utf8' }).replace(/\r/g, '').trimEnd();
        assert.equal(fromLua, expected, 'Lua said something different');
      }

      if (RUBY) {
        const rubyFile = path.join(folder, 'program.rb');
        fs.writeFileSync(rubyFile, written(source, 'ruby'), 'utf8');
        const fromRuby = execFileSync(RUBY, [rubyFile], { encoding: 'utf8' }).replace(/\r/g, '').trimEnd();
        assert.equal(fromRuby, expected, 'Ruby said something different');
      }

      if (JAVA) {
        // A single .java file can be run straight off, with no build step.
        const javaFile = path.join(folder, 'Program.java');
        fs.writeFileSync(javaFile, written(source, 'java'), 'utf8');
        const fromJava = execFileSync(JAVA, [javaFile], { encoding: 'utf8', cwd: folder }).replace(/\r/g, '').trimEnd();
        assert.equal(fromJava, expected, 'Java said something different');
      }

      if (PHP) {
        const phpFile = path.join(folder, 'program.php');
        fs.writeFileSync(phpFile, written(source, 'php'), 'utf8');
        const fromPHP = execFileSync(PHP, [phpFile], { encoding: 'utf8' }).replace(new RegExp(String.fromCharCode(13), 'g'), '').trimEnd();
        assert.equal(fromPHP, expected, 'PHP said something different');
      }

      if (GO) {
        const goFolder = path.join(folder, 'go');
        fs.mkdirSync(goFolder, { recursive: true });
        fs.writeFileSync(path.join(goFolder, 'main.go'), written(source, 'go'), 'utf8');
        fs.writeFileSync(path.join(goFolder, 'go.mod'), 'module program' + String.fromCharCode(10) + String.fromCharCode(10) + 'go 1.21' + String.fromCharCode(10), 'utf8');
        const fromGo = execFileSync(GO, ['run', '.'], { encoding: 'utf8', cwd: goFolder }).replace(new RegExp(String.fromCharCode(13), 'g'), '').trimEnd();
        assert.equal(fromGo, expected, 'Go said something different');
      }

      if (DOTNET) {
        const fromCSharp = runCSharp(written(source, 'csharp'), folder).replace(/\r/g, '').trimEnd();
        assert.equal(fromCSharp, expected, 'C# said something different');
      }

      if (RUST) {
        const fromRust = runRust(written(source, 'rust'), folder).replace(/\r/g, '').trimEnd();
        assert.equal(fromRust, expected, 'Rust said something different');
      }

      if (CC) {
        const fromC = runC(written(source, 'c'), folder).replace(/\r/g, '').trimEnd();
        assert.equal(fromC, expected, 'C said something different');
      }
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
}

// Python is optional: the JavaScript half of every check still runs without it.
const PYTHON = (() => {
  for (const candidate of ['python', 'python3', 'py']) {
    try {
      const version = execFileSync(candidate, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (/Python 3/.test(version)) return candidate;
    } catch { /* try the next one */ }
  }
  return null;
})();

// Lua and C# are checked the same way when the tools are on this machine.
// They are not on every machine, so each one is looked for and skipped
// quietly when missing - and what was skipped is said at the end.
const LUA = (() => {
  for (const candidate of ['lua', 'lua5.4', 'lua54', 'luajit']) {
    try {
      execFileSync(candidate, ['-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return candidate;
    } catch { /* try the next one */ }
  }
  return null;
})();

const DOTNET = (() => {
  try {
    // Runtimes alone cannot build; this needs an SDK.
    const sdks = execFileSync('dotnet', ['--list-sdks'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return sdks.trim() ? 'dotnet' : null;
  } catch {
    return null;
  }
})();

// Node 22 and later can run TypeScript by stripping the types off it.
const TYPESCRIPT = (() => {
  try {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-ts-'));
    const file = path.join(folder, 'try.ts');
    fs.writeFileSync(file, 'const x: number = 1;\nconsole.log(x);\n');
    const said = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    fs.rmSync(folder, { recursive: true, force: true });
    return said.trim() === '1';
  } catch {
    return false;
  }
})();

const RUST = lookFor('rustc', ['--version'], /rustc \d/);
const CC = lookFor('gcc', ['--version'], /gcc|clang/) || lookFor('clang', ['--version'], /clang/) || lookFor('cc', ['--version'], /gcc|clang/);
const RUBY = lookFor('ruby', ['-v'], /ruby \d/);
const GO = lookFor('go', ['version'], /go version/);
const PHP = lookFor('php', ['--version'], /PHP \d/);
// --version writes to stdout; the older -version writes to stderr.
const JAVA = lookFor('java', ['--version'], /\d+\.\d+/);

function lookFor(command, args, wanted) {
  try {
    const said = execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return wanted.test(said) ? command : null;
  } catch (error) {
    // Some tools write their version to stderr and "fail" doing it.
    const said = String((error.stdout || '') + (error.stderr || ''));
    return wanted.test(said) ? command : null;
  }
}

const skipped = [];
if (!TYPESCRIPT) skipped.push('TypeScript (this Node cannot run .ts directly)');
if (!RUBY) skipped.push('Ruby (no ruby on this machine)');
if (!JAVA) skipped.push('Java (no java on this machine)');
if (!GO) skipped.push('Go (no go on this machine)');
if (!PHP) skipped.push('PHP (no php on this machine)');
if (!PYTHON) skipped.push('Python (no python 3 on this machine)');
if (!LUA) skipped.push('Lua (no lua interpreter on this machine)');
if (!DOTNET) skipped.push('C# (dotnet has runtimes but no SDK on this machine)');
if (!RUST) skipped.push('Rust (no rustc on this machine)');
if (!CC) skipped.push('C (no C compiler on this machine)');

// One file, no crates and no Cargo: the runtime is written out with the
// program, so rustc alone is enough. Built without optimising, because this
// is checking what it says, not how fast it says it.
function runRust(code, folder) {
  const file = path.join(folder, 'program.rs');
  fs.writeFileSync(file, code, 'utf8');
  execFileSync(RUST, ['-C', 'opt-level=0', '-C', 'debuginfo=0', '-A', 'warnings', '-o', path.join(folder, 'program.exe'), file], {
    encoding: 'utf8', cwd: folder, stdio: ['ignore', 'pipe', 'pipe']
  });
  return execFileSync(path.join(folder, 'program.exe'), [], { encoding: 'utf8', cwd: folder });
}

// Build and run the generated C# once, in a throwaway project.
function runCSharp(code, folder) {
  fs.writeFileSync(path.join(folder, 'Program.cs'), code, 'utf8');
  fs.writeFileSync(path.join(folder, 'program.csproj'), [
    '<Project Sdk="Microsoft.NET.Sdk">',
    '  <PropertyGroup>',
    '    <OutputType>Exe</OutputType>',
    '    <TargetFramework>net8.0</TargetFramework>',
    '    <Nullable>disable</Nullable>',
    '    <AssemblyName>program</AssemblyName>',
    '    <RootNamespace>program</RootNamespace>',
    '    <EnableDefaultCompileItems>true</EnableDefaultCompileItems>',
    '    <InvariantGlobalization>true</InvariantGlobalization>',
    '  </PropertyGroup>',
    '</Project>'
  ].join('\n'), 'utf8');
  return execFileSync(DOTNET, ['run', '--project', folder, '--verbosity', 'quiet', '--nologo'], {
    encoding: 'utf8',
    cwd: folder,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Without these, a machine running dotnet for the first time greets us
    // on stdout and the comparison fails for a silly reason.
    env: {
      ...process.env,
      DOTNET_NOLOGO: '1',
      DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1'
    }
  });
}

check('it knows what it can write', () => {
  assert.ok(targetNames().includes('javascript'));
  assert.ok(targetNames().includes('python'));
});

check('the file says where it came from', () => {
  assert.match(written('show "hi"', 'javascript'), /Translated from test\.plain/);
  assert.match(written('show "hi"', 'python'), /^# Translated/);
});

check('only the helpers a program needs are written', () => {
  const small = written('show "hi"', 'javascript');
  assert.ok(!small.includes('randomBetween'), 'wrote a helper the program never used');
  assert.ok(small.includes('text('), 'showing something needs the text helper');
});

check('names that only differ by capitals stay one name', () => {
  const code = written('make Score be 1\nadd 1 to score\nshow Score', 'javascript');
  assert.ok(!code.includes('Score'), 'Score and score should become one name');
});

check('a name that clashes with the host language is renamed', () => {
  const code = written('make class be 2\nshow class', 'python');
  assert.match(code, /class_ = 2/);
});

sameEverywhere('translated: showing and sums', [
  'show "hello"',
  'show 2 plus 3 times 4',
  'show 10 divided by 4',
  'show 0.1 plus 0.2',
  'show 7 modulo 3',
  'show 2 ^ 10',
  'show -5 plus 2'
].join('\n'));

sameEverywhere('translated: names and text', [
  'make name be "Ada"',
  'make Age be 36',
  'show "{name} is {age}"',
  'set age to age plus 1',
  'show "next year {age}"',
  'show uppercase of name joined with "!"'
].join('\n'));

sameEverywhere('translated: choosing', [
  'make n be 5',
  'if n is above 10',
  '    show "big"',
  'otherwise if n is 5',
  '    show "five"',
  'otherwise',
  '    show "small"',
  'end',
  'if not n is 4',
  '    show "not four"',
  'end',
  'if n is at least 5 and n is at most 5',
  '    show "exactly five"',
  'end'
].join('\n'));

sameEverywhere('translated: a herd of things with numeric fields', [
  // The struct-layout shape: in Rust this list becomes a Vec of a real
  // struct read as bare f64 fields. Every other target keeps the boxed
  // shape. Same answers required, to the digit.
  'a kind called mote',
  '    has x be 0',
  '    has y be 0',
  '    has fall be 0.5',
  'end',
  'make motes be []',
  'repeat with n from 1 to 50',
  '    add a new mote with x n and y n plus 1 to motes',
  'end',
  'make swept be 0',
  'repeat 3 times',
  '    for each one in motes',
  '        set value "y" of one to y of one plus fall of one',
  '        set swept to swept plus x of one',
  '    end',
  'end',
  'show round swept',
  'make tally be 0',
  'for each one in motes',
  '    set tally to tally plus y of one',
  'end',
  'show round tally'
].join(String.fromCharCode(10)));

sameEverywhere('translated: loops', [
  'repeat 3 times',
  '    show count',
  'end',
  'repeat with i from 5 to 1',
  '    show i',
  'end',
  'repeat with i from 0 to 10 by 5',
  '    show i',
  'end',
  'make n be 3',
  'while n is above 0',
  '    show n',
  '    take 1 from n',
  'end',
  'for each letter in "abc"',
  '    show letter',
  'end',
  'repeat with i from 1 to 5',
  '    if i is 2',
  '        next',
  '    end',
  '    if i is 4',
  '        stop',
  '    end',
  '    show i',
  'end'
].join('\n'));

sameEverywhere('translated: lists', [
  'make things be a list of 3, 1, 2',
  'add 4 to things',
  'show things',
  'show item 1 of things',
  'show length of things',
  'show sorted things',
  'show reversed things',
  'show total of things',
  'show highest of things',
  'show average of things',
  'set item 2 of things to 9',
  'show things',
  'remove 9 from things',
  'show things',
  'show join things with "-"',
  'show position of 4 in things',
  'if things contains 3',
  '    show "it has three"',
  'end',
  'for each thing in things',
  '    show thing',
  'end'
].join('\n'));

sameEverywhere('translated: things', [
  'make player be { name: "Ada", health: 100 }',
  'show name of player',
  'set the health of player to 80',
  'show health of player',
  'show player',
  'show keys of player',
  'show value "name" of player',
  'set value "health" of player to 70',
  'show player',
  'if player has "name"',
  '    show "it has a name"',
  'end'
].join('\n'));

sameEverywhere('translated: actions', [
  'to double with n',
  '    give back n times 2',
  'end',
  'to describe with thing and count',
  '    if count is 1',
  '        give back "one " joined with thing',
  '    end',
  '    give back "{count} {thing}s"',
  'end',
  'show double with 21',
  'show describe with "apple" and 1',
  'show describe with "apple" and 4',
  'show [1, 2, 3] changed by the action double',
  'show [1, 2, 3] added up by the action double',
  'make f be the action double',
  'show call f with 5'
].join('\n'));

sameEverywhere('translated: kinds', [
  'a kind called Animal',
  '    has name',
  '    has sound be "..."',
  '    has legs be 4',
  '    to speak',
  '        show "{name of me} says {sound of me}"',
  '    end',
  '    to describe',
  '        give back "{name of me}, {legs of me} legs"',
  '    end',
  'end',
  'a kind called Dog based on Animal',
  '    has sound be "woof"',
  '    to fetch with item',
  '        give back "{name of me} fetched the {item}"',
  '    end',
  'end',
  'make rex be a new Dog with name "Rex"',
  'tell rex to speak',
  'show ask rex to fetch with "ball"',
  'show ask rex to describe',
  'set the name of rex to "Rexy"',
  'tell rex to speak',
  'show rex',
  'show kind name of rex',
  'if rex is a kind of Animal',
  '    show "an animal too"',
  'end'
].join('\n'));

sameEverywhere('translated: going wrong', [
  'try',
  '    report a problem saying "oh no"',
  'if it fails',
  '    show "caught {the problem}"',
  'end',
  'try',
  '    show 1 divided by 0',
  'if it fails',
  '    show "no dividing"',
  'end',
  'show "carried on"'
].join('\n'));

sameEverywhere('translated: text tools', [
  'make sentence be "the quick brown fox"',
  'show length of sentence',
  'show uppercase of sentence',
  'show parts of sentence split by " "',
  'show replace "quick" with "slow" in sentence',
  'show part of sentence from 5 to 9',
  'show trimmed "  spaced  "',
  'if does sentence start with "the"',
  '    show "starts right"',
  'end'
].join('\n'));

sameEverywhere('translated: numbers', [
  'show round 3.7',
  'show round 3.14159 to 2 places',
  'show floor of 3.9',
  'show ceiling of 3.1',
  'show absolute of -4',
  'show square root of 144',
  'show bigger of 3 and 9',
  'show smaller of 3 and 9'
].join('\n'));

check('every example that is not an engine program translates', () => {
  for (const file of ['hello.plain', 'tour.plain', 'kinds.plain']) {
    const source = fs.readFileSync(path.join(ROOT, 'examples', file), 'utf8');
    for (const target of targetNames()) {
      const code = translate(parsed(source), target, { file }).code;
      assert.ok(code.length > 100, `${file} produced almost nothing for ${target}`);
    }
  }
});

check('engine sentences are refused with a clear list', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'pong.plain'), 'utf8');
  let error = null;
  try { translate(parsed(source), 'javascript', { file: 'pong.plain' }); }
  catch (e) { error = e; }
  assert.ok(error instanceof PlainError, 'should refuse, not guess');
  assert.match(error.plainMessage, /belong to an engine/);
  assert.match(error.plainMessage, /every frame/);
});

check('the command line translates a file', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-cli-tr-'));
  execFileSync(process.execPath, [
    path.join(ROOT, 'bin', 'plain.js'), 'translate',
    path.join(ROOT, 'examples', 'hello.plain'), '--to', 'all', '--out', folder
  ], { encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(folder, 'hello.js')));
  assert.ok(fs.existsSync(path.join(folder, 'hello.py')));
  fs.rmSync(folder, { recursive: true, force: true });
});

// -------------------------------------------------- C# and Lua, by reading
// There is no C# compiler or Lua interpreter here, so these are checked by
// their shape rather than by running them. JavaScript and Python above are
// checked by running them.

// One file, no libraries but the maths one, so any C compiler will do.
function runC(code, folder) {
  const file = path.join(folder, 'program.c');
  const built = path.join(folder, 'program-c.exe');
  fs.writeFileSync(file, code, 'utf8');
  execFileSync(CC, ['-std=c99', '-O1', '-w', '-o', built, file, '-lm'], {
    encoding: 'utf8', cwd: folder, stdio: ['ignore', 'pipe', 'pipe']
  });
  return execFileSync(built, [], { encoding: 'utf8', cwd: folder });
}

// The two runtimes in runtime/ are real files rather than strings inside an
// emitter, so they can be built and run on their own. Each one comes with a
// small program that says what Plain would say, which is the point.
check('the Rust runtime stands up on its own', () => {
  if (!RUST) return;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-rt-'));
  try {
    const code = '#![allow(dead_code, unused_mut, unused_variables, unused_parens, non_snake_case, unused_imports)]\n'
      + fs.readFileSync(path.join(ROOT, 'runtime', 'rust', 'plain.rs'), 'utf8') + '\n'
      + fs.readFileSync(path.join(ROOT, 'runtime', 'rust', 'stubs.rs'), 'utf8');
    const said = runRust(code, folder).replace(/\r/g, '').trim();
    assert.equal(said, ['0.3', '2.5', '[1, 2, 3]', '3', 'I cannot divide by zero'].join('\n'));
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

check('the C runtime stands up on its own', () => {
  if (!CC) return;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-rt-'));
  try {
    const code = fs.readFileSync(path.join(ROOT, 'runtime', 'c', 'plain.c'), 'utf8') + '\n'
      + fs.readFileSync(path.join(ROOT, 'runtime', 'c', 'stubs.c'), 'utf8');
    const said = runC(code, folder).replace(/\r/g, '').trim();
    assert.equal(said, ['0.3', '2.5', '[1, 2, 3]', '3', '3-1-2', 'Hello', 'I cannot divide by zero'].join('\n'));
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

// The sweep is the whole reason C can run a long program at all. Without it
// this loop would ask for a gigabyte; with it, memory stays where it started.
check('C gives memory back as it goes', () => {
  if (!CC) return;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-rt-'));
  try {
    const source = [
      'make i be 0',
      'make total be 0',
      'while i is below 60000',
      '    make words be "row " joined with i',
      '    make bits be a list of words, i, uppercase of words',
      '    add length of item 1 of bits to total',
      '    add 1 to i',
      'end',
      'show total'
    ].join('\n');
    assert.equal(runC(written(source, 'c'), folder).replace(/\r/g, '').trim(), run(source).join('\n'));
    // 60000 turns, four things made each turn: a quarter of a million
    // allocations. The pool is swept every turn, so it never holds more than
    // one turn's worth.
    assert.match(written(source, 'c'), /plain_sweep\(&_frame\)/);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

check('C says what it cannot do rather than writing code that will not build', () => {
  let error = null;
  try { written("show \"ab\" matches 'a+'", 'c'); }
  catch (problem) { error = problem; }
  assert.ok(error instanceof PlainError, 'the pattern should have been refused');
  assert.match(error.plainMessage, /C has no such thing/);
});

check('it can write eleven languages', () => {
  assert.deepEqual(targetNames(),
    ['javascript', 'python', 'csharp', 'lua', 'typescript', 'ruby', 'java', 'go', 'php', 'rust', 'c']);
});

check('Rust says what it cannot do rather than writing code that will not build', () => {
  let error = null;
  try { written("show \"ab\" matches 'a+'", 'rust'); }
  catch (problem) { error = problem; }
  assert.ok(error instanceof PlainError, 'the pattern should have been refused');
  assert.match(error.plainMessage, /Rust has no such thing/);
});

const SHOWCASE = [
  'a kind called Animal',
  '    has name',
  '    has sound be "..."',
  '    to speak',
  '        show "{name of me} says {sound of me}"',
  '    end',
  'end',
  'a kind called Dog based on Animal',
  '    has sound be "woof"',
  'end',
  'to double with n',
  '    give back n times 2',
  'end',
  'make rex be a new Dog with name "Rex"',
  'tell rex to speak',
  'make things be [3, 1, 2]',
  'for each thing in things',
  '    show double with thing',
  'end',
  'repeat with i from 1 to 3',
  '    show i',
  'end',
  'try',
  '    show 1 divided by 0',
  'if it fails',
  '    show "caught {the problem}"',
  'end'
].join('\n');

check('the C# it writes has the right shape', () => {
  const code = written(SHOWCASE, 'csharp');
  assert.match(code, /using System;/);
  assert.match(code, /public class Animal \{/);
  assert.match(code, /public class Dog : Animal \{/);
  assert.match(code, /static dynamic double_\(dynamic n\)/);
  assert.match(code, /public static void Main\(\) \{/);
  assert.match(code, /foreach \(dynamic thing in/);
  assert.match(code, /catch \(Exception _problem\)/);
  // A value the base already has is not declared twice.
  assert.equal((code.match(/public dynamic sound;/g) || []).length, 1);
  assert.equal(balanced(code, '{', '}'), true, 'the braces do not balance');
});

check('the Lua it writes has the right shape', () => {
  const code = written(SHOWCASE, 'lua');
  assert.match(code, /^-- Translated from/);
  assert.match(code, /local Dog = \{\}/);
  assert.match(code, /setmetatable\(Dog, \{ __index = Animal \}\)/);
  assert.match(code, /function Dog\.fill\(into\)\n\s+Animal\.fill\(into\)/);
  assert.match(code, /local function double\(n\)/);
  assert.match(code, /for _, thing in ipairs\(/);
  assert.match(code, /pcall\(function\(\)/);
  assert.equal(luaBlocksBalance(code), true, 'the do/end blocks do not balance');
});

check('every target writes something for every example that is not an engine program', () => {
  for (const file of ['hello.plain', 'tour.plain', 'kinds.plain']) {
    const source = fs.readFileSync(path.join(ROOT, 'examples', file), 'utf8');
    for (const target of targetNames()) {
      const code = translate(parsed(source), target, { file }).code;
      assert.ok(code.length > 200, `${file} produced almost nothing for ${target}`);
    }
  }
});

check('making the same name twice does not break the host language', () => {
  const source = 'make x be 1\nmake x be 2\nshow x';
  assert.match(written(source, 'javascript'), /let x = 1;\nx = 2;/);
  assert.match(written(source, 'csharp'), /dynamic x = 1;\s+x = 2;/);
});

function balanced(code, open, close) {
  // Rough, but enough to catch a missing closer: ignore braces inside text.
  const stripped = code.replace(/"(\\.|[^"\\])*"/g, '""').replace(/'(\\.|[^'\\])*'/g, "''");
  let depth = 0;
  for (const letter of stripped) {
    if (letter === open) depth++;
    else if (letter === close) { depth--; if (depth < 0) return false; }
  }
  return depth === 0;
}

function luaBlocksBalance(code) {
  const stripped = code
    .replace(/"(\\.|[^"\\])*"/g, '""')
    .replace(/--[^\n]*/g, '');
  const opens = (stripped.match(/\b(function|then|do)\b/g) || []).length;
  const ends = (stripped.match(/\bend\b/g) || []).length;
  // "elseif ... then" reuses one end, and a while loop has both "while" and
  // "do", so the counts are compared allowing for those.
  const elseifs = (stripped.match(/\belseif\b/g) || []).length;
  const whileDo = (stripped.match(/\bwhile\b/g) || []).length;
  const forDo = (stripped.match(/\bfor\b/g) || []).length;
  return ends === opens - elseifs - whileDo - forDo + whileDo + forDo - (whileDo + forDo) + (whileDo + forDo) - elseifs + elseifs
    ? true
    : ends === opens - elseifs;
}

// -------------------------------------------------------------- remembering

check('a value can be remembered and read back', () => {
  const store = new Map();
  const host = fakeStore(store);
  assert.equal(firstWith('remember 7 as "best"\nshow remembered "best"', host), '7');
});

check('remembering survives a second program', () => {
  const store = new Map();
  const host = fakeStore(store);
  runWith('remember a list of "bread", "milk" as "shopping"', host);
  assert.equal(firstWith('show remembered "shopping"', host), '["bread", "milk"]');
});

check('a value that was never remembered falls back', () => {
  assert.equal(firstWith('show remembered "nothing yet" or 42', fakeStore(new Map())), '42');
});

check('a best score only goes up', () => {
  const host = fakeStore(new Map());
  runWith('remember 10 as "best" if it is bigger', host);
  runWith('remember 4 as "best" if it is bigger', host);
  assert.equal(firstWith('show remembered "best"', host), '10');
});

check('things can be forgotten', () => {
  const host = fakeStore(new Map());
  runWith('remember 1 as "a"\nremember 2 as "b"', host);
  assert.equal(firstWith('show everything remembered', host), '["a", "b"]');
  runWith('forget "a"', host);
  assert.equal(firstWith('show everything remembered', host), '["b"]');
});

check('a program can ask whether something is remembered', () => {
  const host = fakeStore(new Map());
  runWith('remember 1 as "a"', host);
  assert.equal(firstWith('if "a" is remembered\n show "yes"\notherwise\n show "no"\nend', host), 'yes');
});

check('files can be written, added to and read back', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-files-'));
  const host = realFiles(folder);
  runWith('write "one" to file "notes.txt"\nadd "two" to file "notes.txt"', host);
  assert.equal(firstWith('show lines of file "notes.txt"', host), '["onetwo"]');
  runWith('write "one\\n" to file "notes.txt"\nadd "two" to file "notes.txt"', host);
  assert.equal(firstWith('show lines of file "notes.txt"', host), '["one", "two"]');
  assert.equal(firstWith('show does file "nope.txt" exist', host), 'no');
  fs.rmSync(folder, { recursive: true, force: true });
});

check('a program cannot reach outside its own folder', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-files-'));
  let error = null;
  try { runWith('show text of file "../secrets.txt"', realFiles(folder)); }
  catch (e) { error = e; }
  assert.ok(error instanceof PlainError);
  assert.match(error.plainMessage, /outside this folder/);
  fs.rmSync(folder, { recursive: true, force: true });
});

check('files say plainly that they need a terminal', () => {
  let error = null;
  try { runWith('show text of file "x.txt"', fakeStore(new Map())); }
  catch (e) { error = e; }
  assert.match(error.plainMessage, /terminal/);
});

// Some files here only ever run in a browser, so nothing else in this suite
// would notice if one stopped being valid JavaScript. One did, silently, and
// every `plain play` quietly fell back to a page that could not think.
check('every file in the project is valid JavaScript', () => {
  const found = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) found.push(full);
    }
  };
  walk(ROOT);
  assert.ok(found.length > 30, `only found ${found.length} files to check`);

  const broken = [];
  for (const file of found) {
    try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
    catch (problem) {
      const said = String(problem.stderr || '').split('\n').find(line => line.includes('Error')) || 'would not parse';
      broken.push(`${path.relative(ROOT, file)}: ${said.trim()}`);
    }
  }
  assert.equal(broken.length, 0, `\n  ${broken.join('\n  ')}`);
});

check('things can be written as JSON and read back', () => {
  const host = fakeStore(new Map());
  assert.equal(
    firstWith("show json of a list of 1, \"two\", yes", host),
    '[\n  1,\n  "two",\n  true\n]'
  );
  assert.equal(firstWith('show value "town" of thing from json \'{"town": "Bath"}\'', host), 'Bath');
  assert.equal(firstWith('show item 2 of thing from json "[10, 20]"', host), '20');
  // A round trip keeps the shape.
  assert.equal(
    firstWith('show item 1 of value "years" of thing from json json of thing from json \'{"years":[1815]}\'', host),
    '1815'
  );
});

check('broken JSON is explained rather than crashed on', () => {
  let error = null;
  try { runWith("show thing from json '{oh dear'", fakeStore(new Map())); }
  catch (e) { error = e; }
  assert.ok(error instanceof PlainError);
  assert.match(error.plainMessage, /not JSON I can read/);
});

check('CSV can be read and written, quotes and all', () => {
  const host = fakeStore(new Map());
  const table = 'make t be rows of "a,b\\nAda,\\"likes, commas\\"\\nBob,\\"said \\"\\"hi\\"\\"\\""';
  assert.equal(firstWith(`${table}\nshow number of items in t`, host), '3');
  assert.equal(firstWith(`${table}\nshow item 2 of item 2 of t`, host), 'likes, commas');
  assert.equal(firstWith(`${table}\nshow item 2 of item 3 of t`, host), 'said "hi"');
  assert.equal(firstWith('show rows of ""', host), '[]');
  assert.equal(
    firstWith('make r be a list of "a", "b,c"\nshow csv of a list of r', host),
    'a,"b,c"'
  );
  // Out and back again is the same table.
  assert.equal(
    firstWith(`${table}\nshow item 2 of item 2 of rows of csv of t`, host),
    'likes, commas'
  );
});

function fakeStore(map) {
  return {
    window: {
      localStorage: {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => map.set(key, value),
        removeItem: (key) => map.delete(key),
        get length() { return map.size; },
        key: (at) => [...map.keys()][at] ?? null
      }
    }
  };
}

function realFiles(folder) {
  const inside = (name, ctx) => {
    const wanted = path.resolve(folder, String(name));
    if (wanted !== folder && !wanted.startsWith(folder + path.sep)) {
      ctx.fail(`"${name}" is outside this folder, and Plain only reads and writes files next to your program`);
    }
    return wanted;
  };
  return {
    fs,
    memoryFile: path.join(folder, 'test.memory.json'),
    files: {
      read: (name, ctx) => { const file = inside(name, ctx); return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; },
      exists: (name, ctx) => fs.existsSync(inside(name, ctx)),
      write: (name, text, ctx) => fs.writeFileSync(inside(name, ctx), text, 'utf8'),
      append: (name, text, ctx) => fs.appendFileSync(inside(name, ctx), text, 'utf8')
    }
  };
}

function runWith(source, host) {
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installWeb(rt, {});
  installStore(rt, host);
  installData(rt, {});
  rt.run(source, 'test.plain');
  return rt.lines;
}

function firstWith(source, host) { return runWith(source, host)[0]; }

// ------------------------------------------------------------------ sound

check('a sound can be asked for', () => {
  const { game } = runtimeFor('start a game called "G"\nplay the sound "jump.wav"');
  assert.deepEqual(game.played, ['jump.wav']);
});

check('music can be started and stopped', () => {
  const { game } = runtimeFor('start a game called "G"\nplay music "song.mp3"\nset the sound volume to 0.5');
  assert.deepEqual(game.played, ['song.mp3']);
  assert.equal(game.volume, 0.5);
  game.stopMusic();
  assert.equal(game.music, null);
});

// ----------------------------------------------------------------- shapes

check('there are shapes that need no artwork', () => {
  const { game } = runtimeFor([
    'start a game called "G"',
    'make a be a star at 10 , 10 sized 20 colored "gold"',
    'make b be a heart at 20 , 10 sized 20 colored "red"',
    'make c be a triangle at 30 , 10 sized 20 by 30 colored "blue"',
    'make d be a diamond at 40 , 10 sized 20 colored "cyan"',
    'make e be an arrow at 50 , 10 sized 20 colored "white"',
    'make f be a ring at 60 , 10 sized 20 colored "pink"'
  ].join('\n'));
  assert.deepEqual(game.things.map(thing => thing.shape), ['star', 'heart', 'triangle', 'diamond', 'arrow', 'ring']);
  assert.equal(game.things[2].height, 30);
});

check('the new shapes draw without complaint', () => {
  const { game } = runtimeFor([
    'start a game called "G" sized 100 by 100',
    'make a be a star at 50 , 50 sized 20 colored "gold"',
    'make b be a ring at 50 , 50 sized 20 colored "pink"',
    'make c be a heart at 50 , 50 sized 20 colored "red"'
  ].join('\n'));
  const calls = [];
  const pretend = new Proxy({}, {
    get(_, name) {
      if (name === 'canvas') return { width: 100, height: 100 };
      return (...args) => { calls.push(name); return undefined; };
    },
    set() { return true; }
  });
  game.draw(pretend);
  assert.ok(calls.includes('fill'), 'nothing was filled');
  assert.ok(calls.includes('stroke'), 'the ring was not drawn');
});

// -------------------------------------------------------------- sprites

check('a sprite sheet is cut into frames', () => {
  const { game } = runtimeFor([
    'start a game called "G"',
    'make hero be a sprite "walk.png" at 50 , 50 sized 32 by 32 with 4 by 2 frames'
  ].join('\n'));
  const hero = game.things[0];
  assert.equal(hero.columns, 4);
  assert.equal(hero.rows, 2);
  assert.equal(hero.frameCount, 8);
  assert.equal(hero.frame, 1);
});

check('a row of frames can be given on its own', () => {
  const { game } = runtimeFor('start a game called "G"\nmake hero be a sprite "run.png" at 0 , 0 sized 16 by 16 with 6 frames');
  assert.equal(game.things[0].frameCount, 6);
});

check('animating walks through the frames and loops', () => {
  const { game } = runtimeFor([
    'start a game called "G"',
    'make hero be a sprite "walk.png" at 0 , 0 sized 16 by 16 with 4 frames',
    'animate hero at 10 frames a second'
  ].join('\n'));
  const hero = game.things[0];
  game.simulate(6, 1 / 60);      // 0.1s -> one frame on
  assert.equal(hero.frame, 2);
  game.simulate(18, 1 / 60);     // 0.3s more -> three more, wrapping
  assert.equal(hero.frame, 1);
});

check('animating can be limited to some of the frames', () => {
  const { game } = runtimeFor([
    'start a game called "G"',
    'make hero be a sprite "walk.png" at 0 , 0 sized 16 by 16 with 8 frames',
    'animate hero from 5 to 6 at 10 frames a second'
  ].join('\n'));
  const hero = game.things[0];
  assert.equal(hero.frame, 5);
  game.simulate(6, 1 / 60);
  assert.equal(hero.frame, 6);
  game.simulate(6, 1 / 60);
  assert.equal(hero.frame, 5, 'it should come back round to the first of the two');
});

check('a frame can be held still', () => {
  const { rt, game } = runtimeFor([
    'start a game called "G"',
    'make hero be a sprite "walk.png" at 0 , 0 sized 16 by 16 with 4 frames',
    'animate hero at 10 frames a second',
    'stop animating hero',
    'set the frame of hero to 3',
    'show frame of hero'
  ].join('\n'));
  assert.equal(rt.lines[0], '3');
  game.simulate(60, 1 / 60);
  assert.equal(game.things[0].frame, 3);
});

// ---------------------------------------------------------------- waiting

check('waiting really waits, in a terminal', () => {
  const started = Date.now();
  run('wait 0.2 seconds\nshow "done"');
  assert.ok(Date.now() - started >= 150, 'it did not actually pause');
});

check('one-shot timers happen once', () => {
  const { rt, game } = runtimeFor([
    'start a game called "G"',
    'make n be 0',
    'after 1 seconds',
    '    add 1 to n',
    'end'
  ].join('\n'));
  game.simulate(30, 1 / 60);            // half a second
  assert.equal(rt.interpreter.globals.get('n'), 0);
  game.simulate(120, 1 / 60);           // two more seconds
  assert.equal(rt.interpreter.globals.get('n'), 1, 'it should have happened exactly once');
});

check('repeating timers still repeat', () => {
  const { rt, game } = runtimeFor('start a game called "G"\nmake n be 0\nevery 1 seconds\n    add 1 to n\nend');
  game.simulate(180, 1 / 60);
  assert.equal(rt.interpreter.globals.get('n'), 3);
});

// ------------------------------------------------------- several mistakes

check('every mistake in a file is reported, not just the first', () => {
  const error = broken('show "fine"\nwibble 3\nmake x be 1\nblah blah\nshow "end"');
  assert.ok(error.errors, 'the mistakes were not gathered');
  assert.equal(error.errors.length, 2);
  assert.deepEqual(error.errors.map(one => one.line), [2, 4]);
  const report = error.report('show "fine"\nwibble 3\nmake x be 1\nblah blah\nshow "end"');
  assert.match(report, /I found 2 things to fix/);
  assert.match(report, /Line 2/);
  assert.match(report, /Line 4/);
});

check('mistakes inside a block are found too', () => {
  const error = broken('repeat 2 times\n    wibble\n    show "ok"\nend\nnonsense here');
  assert.deepEqual(error.errors.map(one => one.line), [2, 5]);
});

check('one mistake still reads like one mistake', () => {
  const error = broken('show wobble');
  const report = error.report('show wobble');
  assert.ok(!/things to fix/.test(report), 'a single mistake should not be introduced as a list');
  assert.match(report, /Line 1/);
});

check('an unclosed block stops the reading there', () => {
  const error = broken('repeat 2 times\n    show "x"');
  assert.match(error.plainMessage, /never closed/);
});

// -------------------------------------------------------- patterns, bits

check('text can be matched against a pattern', () => {
  assert.equal(first("if 'a1b2' matches '[0-9]'\n show \"yes\"\nend"), 'yes');
  assert.equal(run("if 'abc' matches '[0-9]'\n show \"yes\"\nend").length, 0);
});

check('single quotes mean exactly what is written', () => {
  assert.equal(first("make n be 3\nshow '{n} stays put'"), '{n} stays put');
  assert.equal(first('make n be 3\nshow "{n} does not"'), '3 does not');
});

check('a pattern can be found and replaced', () => {
  assert.equal(first("show first match of '[0-9]+' in \"room 214 please\""), '214');
  assert.equal(first("show parts of \"a1 b22 c3\" matching '[0-9]+'"), '["1", "22", "3"]');
  assert.equal(first("show replace pattern '[0-9]' with \"x\" in \"a1b2\""), 'axbx');
});

check('a pattern that makes no sense is explained', () => {
  const error = broken("if \"x\" matches '[unclosed'\n show \"no\"\nend");
  assert.match(error.plainMessage, /not a pattern/);
});

check('the bits of a number', () => {
  assert.deepEqual(run([
    'show bitwise and of 12 and 10',
    'show bitwise or of 12 and 10',
    'show bitwise xor of 12 and 10',
    'show bitwise not of 0',
    'show shift 1 left by 8',
    'show shift 256 right by 4'
  ].join('\n')), ['8', '14', '6', '-1', '256', '16']);
});

// --------------------------------------------------------------- tables

check('a table keeps rows, and gives each one an id', () => {
  const said = run([
    'make notes be a table called "notes"',
    'save { title: "one" } in notes',
    'save { title: "two" } in notes',
    'show number of rows in notes',
    'show title of row 2 of notes',
    'show id of first row of notes where "title" is "one"'
  ].join('\n'));
  assert.deepEqual(said, ['2', 'two', '1']);
});

check('rows can be looked through, changed and dropped', () => {
  const said = run([
    'make people be a table called "people"',
    'save { name: "Ada", town: "Bath" } in people',
    'save { name: "Bob", town: "Bath" } in people',
    'save { name: "Cy", town: "Hull" } in people',
    'show number of items in rows of people where "town" is "Bath"',
    'change row 2 of people to { name: "Bob", town: "Hull" }',
    'show number of items in rows of people where "town" is "Hull"',
    'remove row 1 from people',
    'show number of rows in people',
    'show name of item 1 of rows of people sorted by "name"',
    'show number of items in rows of people where "name" contains "b"'
  ].join('\n'));
  assert.deepEqual(said, ['2', '2', '2', 'Bob', '1']);
});

check('a table is kept between runs, the way remembering is', () => {
  const map = new Map();
  const host = fakeStore(map);
  runWith('make notes be a table called "notes"\nsave { title: "kept" } in notes', host);
  assert.equal(firstWith('make notes be a table called "notes"\nshow title of row 1 of notes', host), 'kept');
  // Two tables in one program do not tread on each other.
  runWith('make other be a table called "other"\nsave { title: "elsewhere" } in other', host);
  assert.equal(firstWith('make notes be a table called "notes"\nshow number of rows in notes', host), '1');
});

check('asking a table for a row that is not there says nothing, not nonsense', () => {
  const said = run([
    'make notes be a table called "notes"',
    'show row 99 of notes',
    'show number of items in rows of notes where "title" is "nope"'
  ].join('\n'));
  assert.deepEqual(said, ['nothing', '0']);
});

// A lookup that gives a different answer from reading every row would be
// worse than no lookup at all, so the two are held against each other.
check('looking a row up agrees with reading every row', () => {
  const rows = [];
  for (let at = 1; at <= 400; at++) {
    rows.push(`save { name: "p${at}", town: "t${at % 7}", size: ${at % 5} } in many`);
  }
  const said = run([
    'make many be a table called "many"',
    ...rows,
    'show number of items in rows of many where "town" is "t3"',
    'show number of items in rows of many where "size" is 2',
    // 3 and "3" are the same to Plain, so they must land in the same place.
    'show number of items in rows of many where "size" is "2"',
    'show name of first row of many where "name" is "p399"',
    'show number of items in rows of many where "town" is "nowhere"'
  ].join('\n'));
  assert.deepEqual(said, ['57', '80', '80', 'p399', '0']);
});

check('a lookup notices when the table has changed under it', () => {
  const said = run([
    'make many be a table called "many"',
    'save { town: "Bath" } in many',
    'show number of items in rows of many where "town" is "Bath"',
    'save { town: "Bath" } in many',
    'show number of items in rows of many where "town" is "Bath"',
    'change row 1 of many to { town: "Hull" }',
    'show number of items in rows of many where "town" is "Bath"',
    'show number of items in rows of many where "town" is "Hull"',
    'remove row 2 from many',
    'show number of items in rows of many where "town" is "Bath"'
  ].join('\n'));
  assert.deepEqual(said, ['1', '2', '1', '1', '0']);
});

check('a change that goes wrong halfway leaves nothing half done', () => {
  const said = run([
    'make money be a table called "money"',
    'save { owner: "Ada", pennies: 500 } in money',
    'save { owner: "Bob", pennies: 100 } in money',
    'try',
    '    do all of this together',
    '        change row 1 of money to { owner: "Ada", pennies: 400 }',
    '        change row 2 of money to { owner: "Bob", pennies: 200 }',
    '        report a problem saying "the bank fell over"',
    '    end',
    'if it fails',
    '    show the problem',
    'end',
    'show pennies of row 1 of money',
    'show pennies of row 2 of money',
    'do all of this together',
    '    change row 1 of money to { owner: "Ada", pennies: 400 }',
    '    change row 2 of money to { owner: "Bob", pennies: 200 }',
    'end',
    'show pennies of row 1 of money',
    'show pennies of row 2 of money'
  ].join('\n'));
  assert.deepEqual(said, ['the bank fell over', '500', '100', '400', '200']);
});

check('putting a table back also puts back what was looked up in it', () => {
  const said = run([
    'make money be a table called "money"',
    'save { owner: "Ada" } in money',
    'show number of items in rows of money where "owner" is "Ada"',
    'try',
    '    do all of this together',
    '        change row 1 of money to { owner: "Bob" }',
    '        report a problem saying "no"',
    '    end',
    'if it fails',
    'end',
    'show number of items in rows of money where "owner" is "Ada"',
    'show number of items in rows of money where "owner" is "Bob"'
  ].join('\n'));
  assert.deepEqual(said, ['1', '1', '0']);
});

check('two tables can be lined up against each other', () => {
  const said = run([
    'make people be a table called "people"',
    'make orders be a table called "orders"',
    'save { name: "Ada" } in people',
    'save { name: "Bob" } in people',
    'save { thing: "book", by: 1 } in orders',
    'save { thing: "map", by: 2 } in orders',
    'save { thing: "pen", by: 99 } in orders',
    'make lines be every row of orders joined to people on "by"',
    'show name of match of item 1 of lines',
    'show name of match of item 2 of lines',
    'show match of item 3 of lines',
    'show thing of item 1 of lines',
    // And matched on a field of their own rather than the id.
    'make byName be every row of orders joined to people on "thing" matching "name"',
    'show match of item 1 of byName'
  ].join('\n'));
  assert.deepEqual(said, ['Ada', 'Bob', 'nothing', 'book', 'nothing']);
});

check('rows written before a field existed can be filled in', () => {
  const said = run([
    'make notes be a table called "notes"',
    'save { title: "one" } in notes',
    'save { title: "two", done: yes } in notes',
    'fill in "done" with no on every row of notes',
    'show the number filled in',
    'show done of row 1 of notes',
    'show done of row 2 of notes',
    'rename "title" to "words" in every row of notes',
    'show words of row 1 of notes',
    // Reading a field a thing has not got is a problem, so the gentler
    // question is the one to ask about a field that has gone.
    'show value "title" of row 1 of notes'
  ].join('\n'));
  assert.deepEqual(said, ['1', 'no', 'yes', 'one', 'nothing']);
});

// --------------------------------------------------------------- accounts

const LOCKS = {
  // The same shape as the real one, without the slow scrambling, so the
  // suite stays quick. What is checked here is the behaviour around it.
  lock: (password) => 'test:' + [...String(password)].reverse().join(''),
  fits: (password, locked) => Boolean(locked) && locked === 'test:' + [...String(password)].reverse().join('')
};

function runAccounts(source) {
  const rt = createRuntime({ onOutput: () => {} });
  installStore(rt, {});
  installData(rt, LOCKS);
  rt.run(source, 'accounts.plain');
  return rt.lines;
}

check('an account keeps a scrambled password, never the password', () => {
  const said = runAccounts([
    'make people be a table called "people"',
    'create an account in people for "Ada" with password "correct horse"',
    'show name of row 1 of people',
    'show locked of row 1 of people',
    'show people has an account for "Ada"',
    'show people has an account for "Bob"'
  ].join('\n'));
  assert.equal(said[0], 'Ada');
  assert.ok(!said[1].includes('correct horse'), 'the password was written down as itself');
  assert.deepEqual(said.slice(2), ['yes', 'no']);
});

check('signing in works with the right password and not the wrong one', () => {
  const said = runAccounts([
    'make people be a table called "people"',
    'create an account in people for "Ada" with password "correct horse"',
    'show name of the account in people for "Ada" with password "correct horse"',
    'show the account in people for "Ada" with password "wrong horse"',
    'show the account in people for "Nobody" with password "correct horse"',
    'change the password in people for "Ada" to "another one"',
    'show the account in people for "Ada" with password "correct horse"',
    'show name of the account in people for "Ada" with password "another one"'
  ].join('\n'));
  assert.deepEqual(said, ['Ada', 'nothing', 'nothing', 'nothing', 'Ada']);
});

check('an account cannot be taken twice, and a weak password is refused', () => {
  let error = null;
  try {
    runAccounts([
      'make people be a table called "people"',
      'create an account in people for "Ada" with password "correct horse"',
      'create an account in people for "Ada" with password "something else"'
    ].join('\n'));
  } catch (problem) { error = problem; }
  assert.match(error.plainMessage, /already an account for Ada/);

  error = null;
  try {
    runAccounts('make people be a table called "people"\ncreate an account in people for "Ada" with password "short"');
  } catch (problem) { error = problem; }
  assert.match(error.plainMessage, /too short/);
});

check('accounts say plainly that they need a terminal', () => {
  const rt = createRuntime({ onOutput: () => {} });
  installStore(rt, {});
  installData(rt, {});                      // no locks, as in a browser
  let error = null;
  try {
    rt.run('make people be a table called "people"\ncreate an account in people for "Ada" with password "correct horse"', 'a.plain');
  } catch (problem) { error = problem; }
  assert.match(error.plainMessage, /only work when Plain runs in a terminal/);
});

check('using something that is not a table is explained', () => {
  const error = broken('make notes be a list of 1, 2\nsave { a: 1 } in notes');
  assert.match(error.plainMessage, /needs a table/);
});

// ----------------------------------------------------------------- parts

check('a part says what it is and what it leans on', () => {
  const rt = createRuntime({ onOutput: () => {} });
  installParts(rt);
  const about = readAbout(rt.parse([
    'this part is called "dates" version "1.2.0"',
    'this part needs "money" version "1.0.0" from "https://example.com/money.plain"',
    'this part needs "words" version "2.0.0" from "https://example.com/words.plain"',
    '',
    'to day of with when',
    '    give back part of when from 9 to 10',
    'end'
  ].join('\n'), 'dates.plain'));

  assert.equal(about.name, 'dates');
  assert.equal(about.version, '1.2.0');
  assert.deepEqual(about.needs.map(one => one.name), ['money', 'words']);
  assert.equal(about.needs[0].where, 'https://example.com/money.plain');
});

check('a part that says nothing about itself is still a part', () => {
  const rt = createRuntime({ onOutput: () => {} });
  installParts(rt);
  const about = readAbout(rt.parse('to double with n\n    give back n times 2\nend', 'x.plain'));
  assert.deepEqual(about, { name: null, version: null, needs: [] });
});

// Reading it off the file rather than running it is the whole point: the
// only safe moment to decide whether to trust a part is before it runs.
check('what a part claims cannot be smuggled in', () => {
  const rt = createRuntime({ onOutput: () => {} });
  installParts(rt);
  const about = readAbout(rt.parse([
    '# this part is called "trustme" version "9.9.9"',
    'make pretend be "this part is called \\"trustme\\" version \\"9.9.9\\""',
    'show pretend'
  ].join('\n'), 'sneaky.plain'));
  assert.equal(about.name, null, 'a comment or a piece of text is not a claim');
});

check('1.2.10 comes after 1.2.9', () => {
  assert.equal(compareVersions('1.2.10', '1.2.9'), 1);
  assert.equal(compareVersions('1.2.9', '1.2.10'), -1);
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.ok(atLeast('1.1.0', '1.0.0'));
  assert.ok(atLeast('1.0.0', '1.0.0'));
  assert.ok(!atLeast('0.9.0', '1.0.0'));
});

check('the sentences a part uses to describe itself do nothing when run', () => {
  const said = run([
    'this part is called "dates" version "1.2.0"',
    'this part needs "money" version "1.0.0" from "https://example.com/money.plain"',
    'show "still here"'
  ].join('\n'));
  assert.deepEqual(said, ['still here']);
});

// ----------------------------------------------------------------- email

function runMail(source, host = {}) {
  const rt = createRuntime({ onOutput: () => {} });
  installStore(rt, {});
  const mail = installMail(rt, host);
  rt.run(source, 'mail.plain');
  return { rt, mail };
}

check('a message is written the way a mail server expects one', () => {
  const written = buildMessage({
    from: 'me@example.com',
    to: 'you@example.com',
    subject: 'Café — it worked',
    body: 'Hello there.\n.a line starting with a dot\nÜnicode too.'
  }, new Date(Date.UTC(2026, 7, 14, 9, 48, 34)), 'abc');

  assert.match(written, /^From: me@example\.com\r\n/);
  assert.match(written, /\r\nTo: you@example\.com\r\n/);
  assert.match(written, /\r\nDate: Fri, 14 Aug 2026 09:48:34 \+0000\r\n/);
  assert.match(written, /\r\nMessage-ID: <abc@plain>\r\n/);
  assert.match(written, /\r\nContent-Transfer-Encoding: base64\r\n/);
  assert.ok(written.endsWith('\r\n'), 'a message ends with a line ending');

  // An accented subject goes in the shape a 1982 mail server will carry.
  const subject = /Subject: (.*)\r\n/.exec(written)[1];
  assert.match(subject, /^=\?UTF-8\?B\?.*\?=$/);
  assert.equal(
    Buffer.from(subject.slice(10, -2), 'base64').toString('utf8'),
    'Café — it worked'
  );

  // And the words come back exactly, dot and umlaut and all.
  const body = written.split('\r\n\r\n').slice(1).join('\r\n\r\n');
  assert.equal(
    Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8'),
    'Hello there.\n.a line starting with a dot\nÜnicode too.'
  );
  // No line in a message may be longer than a mail server will take.
  for (const line of written.split('\r\n')) assert.ok(line.length <= 78, `a line was ${line.length} long`);
});

check('a plain subject is left alone', () => {
  const written = buildMessage({ from: 'a@b.com', to: 'c@d.com', subject: 'Your receipt', body: 'hi' });
  assert.match(written, /\r\nSubject: Your receipt\r\n/);
});

check('an address that is not one is refused before anything is sent', () => {
  assert.ok(looksLikeAddress('me@example.com'));
  assert.ok(looksLikeAddress('first.last+tag@sub.example.co.uk'));
  assert.ok(!looksLikeAddress('me'));
  assert.ok(!looksLikeAddress('me@example'));
  assert.ok(!looksLikeAddress('me @example.com'));
  assert.ok(!looksLikeAddress('me@exa mple.com'));
  assert.ok(!looksLikeAddress(''));

  let error = null;
  try {
    runMail([
      'use the mail server "smtp.example.com" on port 587',
      'send an email from "me@example.com" to "nonsense" saying "hi"'
    ].join('\n'), { sendMail: () => 'sent' });
  } catch (problem) { error = problem; }
  assert.match(error.plainMessage, /does not look like an email address/);
});

check('the mail server has to be said before anything is sent', () => {
  let error = null;
  try {
    runMail('send an email from "a@b.com" to "c@d.com" saying "hi"', { sendMail: () => 'sent' });
  } catch (problem) { error = problem; }
  assert.match(error.plainMessage, /do not know which mail server/);
});

check('what is handed to the mail server is what the program said', () => {
  let asked = null;
  const { rt } = runMail([
    'use the mail server "smtp.example.com" on port 2525',
    'sign in to the mail server as "me@example.com" with password "s3cret"',
    'send an email from "me@example.com" to "you@example.com" about "Hello" saying "It worked."',
    'show what the mail server said'
  ].join('\n'), { sendMail: (settings, message) => { asked = { settings, message }; return '250 OK'; } });

  assert.equal(asked.settings.host, 'smtp.example.com');
  assert.equal(asked.settings.port, 2525);
  assert.equal(asked.settings.user, 'me@example.com');
  assert.equal(asked.settings.password, 's3cret');
  assert.deepEqual(asked.message, {
    from: 'me@example.com', to: 'you@example.com', subject: 'Hello', body: 'It worked.'
  });
  assert.deepEqual(rt.lines, ['250 OK']);
});

check('email says plainly that it needs a terminal', () => {
  let error = null;
  try {
    runMail('use the mail server "s" on port 25\nsend an email from "a@b.com" to "c@d.com" saying "hi"', {});
  } catch (problem) { error = problem; }
  assert.match(error.plainMessage, /only works when Plain runs in a terminal/);
});

// ----------------------------------------------------------- the internet

function runNetWith(source, store) {
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installWeb(rt, {});
  installStore(rt, store);
  installData(rt, {});
  const server = installNet(rt, {});
  rt.run(source, 'net.plain');
  return { rt, server };
}

function runNet(source, host = {}) {
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installWeb(rt, {});
  installStore(rt, {});
  installData(rt, {});
  const server = installNet(rt, host);
  rt.run(source, 'net.plain');
  return { rt, server };
}

check('an address can have a part in it', () => {
  const { server } = runNet([
    "when someone visits '/notes/{id}/remove'",
    '    answer with "gone {the address part \\"id\\"}"',
    'end'
  ].join('\n'));
  const found = server.routeFor('/notes/7/remove');
  assert.ok(found, 'the route should have matched');
  assert.deepEqual(found.parts, { id: '7' });
  server.asked = { ...server.asked, parts: found.parts };
  found.route.run();
  assert.equal(server.answer.body, 'gone 7');
  assert.equal(server.routeFor('/notes/7/keep'), null);
  assert.equal(server.routeFor('/notes/7'), null, 'a shorter address should not match');
});

check('a plain address wins over one with a part in it', () => {
  const { server } = runNet([
    "when someone visits '/notes/{id}'",
    '    answer with "one note"',
    'end',
    'when someone visits "/notes/new"',
    '    answer with "a new one"',
    'end'
  ].join('\n'));
  server.routeFor('/notes/new').route.run();
  assert.equal(server.answer.body, 'a new one');
  server.routeFor('/notes/12').route.run();
  assert.equal(server.answer.body, 'one note');
});

check('a page and the form it sends to can share an address', () => {
  const { server } = runNet([
    'when someone visits "/name"',
    '    answer with "the form"',
    'end',
    'when someone sends to "/name"',
    '    answer with "taken"',
    'end'
  ].join('\n'));
  server.routeFor('/name', 'GET').route.run();
  assert.equal(server.answer.body, 'the form');
  server.routeFor('/name', 'POST').route.run();
  assert.equal(server.answer.body, 'taken');
});

check('a filled-in form arrives as a thing', () => {
  assert.deepEqual(readSent('who=Ada&town=Bath'), { who: 'Ada', town: 'Bath' });
  assert.deepEqual(readSent('note=two+words'), { note: 'two words' });
  assert.deepEqual(readSent('note=%3Cb%3E'), { note: '<b>' });
  assert.deepEqual(readSent('{"who":"Ada"}', 'application/json'), { who: 'Ada' });
  assert.deepEqual(readSent(''), {});
  // A form that is not JSON is not read as JSON, whatever it looks like.
  assert.deepEqual(readSent('a=1&b=2', 'application/x-www-form-urlencoded'), { a: '1', b: '2' });
});

check('a program can read what was filled in', () => {
  const { server } = runNet([
    'when someone sends to "/save"',
    '    answer with "hello {the form field \\"who\\"}"',
    'end'
  ].join('\n'));
  server.asked = { ...server.asked, sent: 'who=Ada', kind: 'application/x-www-form-urlencoded' };
  server.routes[0].run();
  assert.equal(server.answer.body, 'hello Ada');
});

check('a visitor can be told apart, and signed in', () => {
  const { server } = runNet([
    'when someone visits "/in"',
    '    sign this visitor in as "Ada"',
    '    keep 3 as "basket" for this visitor',
    'end',
    'when someone visits "/who"',
    '    make basket be what this visitor has as "basket"',
    '    answer with "{who is signed in} has {basket}"',
    'end',
    'when someone visits "/out"',
    '    sign this visitor out',
    'end'
  ].join('\n'));

  server.asked = { ...server.asked, tag: 'aaa' };
  server.routes[0].run();
  server.routes[1].run();
  assert.equal(server.answer.body, 'Ada has 3');

  // Somebody else's browser is somebody else.
  server.asked = { ...server.asked, tag: 'bbb' };
  server.routes[1].run();
  assert.equal(server.answer.body, 'nothing has nothing');

  server.asked = { ...server.asked, tag: 'aaa' };
  server.routes[2].run();
  server.routes[1].run();
  assert.equal(server.answer.body, 'nothing has 3');
});

check('a visitor is still known after the program is restarted', () => {
  const map = new Map();
  const sign = [
    'when someone visits "/in"',
    '    sign this visitor in as "Ada"',
    '    keep 3 as "basket" for this visitor',
    'end'
  ].join('\n');
  const ask = [
    'when someone visits "/who"',
    '    make basket be what this visitor has as "basket"',
    '    answer with "{who is signed in} has {basket}"',
    'end'
  ].join('\n');

  // One run signs them in...
  const first = runNetWith(sign, fakeStore(map));
  first.server.asked = { ...first.server.asked, tag: 'aaa' };
  first.server.routes[0].run();

  // ...and a whole new run, with nothing in memory, still knows them.
  const again = runNetWith(ask, fakeStore(map));
  again.server.asked = { ...again.server.asked, tag: 'aaa' };
  again.server.routes[0].run();
  assert.equal(again.server.answer.body, 'Ada has 3');

  // Somebody else is still somebody else.
  again.server.asked = { ...again.server.asked, tag: 'bbb' };
  again.server.routes[0].run();
  assert.equal(again.server.answer.body, 'nothing has nothing');
});

check('a visitor nobody has seen for a month is forgotten', () => {
  const map = new Map();
  const store = fakeStore(map);
  const old = Date.now() - 40 * 24 * 60 * 60 * 1000;
  map.set('plain.remember.visitor:stale', JSON.stringify({ seen: old, held: { signedIn: 'Ghost' } }));
  map.set('plain.remember.visitor:fresh', JSON.stringify({ seen: Date.now(), held: { signedIn: 'Ada' } }));

  const { server } = runNetWith('when someone visits "/"\n    answer with "hi"\nend', store);
  assert.equal(server.sweepVisitors(), 1, 'one old visitor should have been forgotten');
  assert.ok(!map.has('plain.remember.visitor:stale'));
  assert.ok(map.has('plain.remember.visitor:fresh'));
});

check('forgetting a visitor forgets them for good', () => {
  const map = new Map();
  const store = fakeStore(map);
  const { server } = runNetWith([
    'when someone visits "/in"',
    '    sign this visitor in as "Ada"',
    'end',
    'when someone visits "/out"',
    '    forget everything about this visitor',
    'end'
  ].join('\n'), store);
  server.asked = { ...server.asked, tag: 'aaa' };
  server.routes[0].run();
  assert.ok(map.has('plain.remember.visitor:aaa'));
  server.routes[1].run();
  assert.ok(!map.has('plain.remember.visitor:aaa'));
});

check('a file sent with a form arrives whole, and the words with it', () => {
  const edge = '----PlainTest';
  const raw = Buffer.concat([
    Buffer.from(`--${edge}\r\nContent-Disposition: form-data; name="who"\r\n\r\nAda\r\n`),
    Buffer.from(`--${edge}\r\nContent-Disposition: form-data; name="picture"; filename="cat.png"\r\n`),
    Buffer.from('Content-Type: image/png\r\n\r\n'),
    // Bytes that are not text, to prove nothing is turned into any.
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x0d, 0x0a]),
    Buffer.from(`\r\n--${edge}--\r\n`)
  ]);

  const { server } = runNet([
    'when someone sends to "/upload"',
    '    make sent be the file sent as "picture"',
    '    answer with "{the form field \\"who\\"} sent {name of sent}, {bytes of sent} bytes, {type of sent}"',
    'end'
  ].join('\n'));

  const read = readParts(raw, `multipart/form-data; boundary=${edge}`);
  assert.deepEqual(Object.keys(read.files), ['picture']);
  assert.equal(read.files.picture.name, 'cat.png');
  assert.equal(read.files.picture.size, 9);
  assert.deepEqual([...read.files.picture.bytes], [0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x0d, 0x0a]);
  assert.equal(read.written, 'who=Ada');

  server.asked = { ...server.asked, sent: read.written, kind: 'application/x-www-form-urlencoded', files: read.files };
  server.routes[0].run();
  assert.equal(server.answer.body, 'Ada sent cat.png, 9 bytes, image/png');
});

check('a form with no file in it still reads as a form', () => {
  const edge = 'xyz';
  const raw = Buffer.from(`--${edge}\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n--${edge}\r\nContent-Disposition: form-data; name="b"\r\n\r\ntwo words\r\n--${edge}--\r\n`);
  const read = readParts(raw, `multipart/form-data; boundary=${edge}`);
  assert.deepEqual(read.files, {});
  assert.deepEqual(readSent(read.written), { a: '1', b: 'two words' });
});

check('asking for a file that was not sent says so', () => {
  const { server } = runNet('when someone sends to "/u"\n    show a file was sent as "picture"\nend');
  server.asked = { ...server.asked, files: {} };
  server.routes[0].run();
  // And saving one that is not there is a problem, not a silent nothing.
  const { server: other } = runNet('when someone sends to "/u"\n    save the file sent as "picture" to "kept.png"\nend');
  other.asked = { ...other.asked, files: {} };
  let error = null;
  try { other.routes[0].run(); } catch (problem) { error = problem; }
  assert.match(error.plainMessage, /Nothing was sent as picture/);
});

check('somebody hammering the door is noticed', () => {
  const { server } = runNet([
    'when someone visits "/"',
    '    if this visitor has asked more than 2 times in 60 seconds',
    '        answer with "slow down" and code 429',
    '    otherwise',
    '        answer with "hello"',
    '    end',
    'end'
  ].join('\n'));

  server.asked = { ...server.asked, tag: 'aaa' };
  const answers = [];
  for (let at = 0; at < 4; at++) { server.routes[0].run(); answers.push(server.answer.code || 200); }
  // "more than 2" means the third is one too many.
  assert.deepEqual(answers, [200, 200, 429, 429]);

  // Somebody else starts from nothing.
  server.asked = { ...server.asked, tag: 'bbb' };
  server.routes[0].run();
  assert.equal(server.answer.body, 'hello');
});

check('work can be put on a timer', () => {
  const { server } = runNet('every 5 seconds on the server\n    show "tidying"\nend');
  assert.equal(server.jobs.length, 1);
  assert.equal(server.jobs[0].seconds, 5);
  assert.equal(typeof server.jobs[0].run, 'function');
});

// A live connection is bytes on a wire, and getting the bytes wrong is the
// one thing that cannot be noticed by reading the code.
check('a frame off a live connection is read the way a browser sends it', () => {
  const mask = Buffer.from([1, 2, 3, 4]);
  const body = Buffer.from('hello', 'utf8');
  const masked = Buffer.from(body);
  for (let at = 0; at < masked.length; at++) masked[at] ^= mask[at % 4];
  const frame = Buffer.concat([Buffer.from([0x81, 0x80 | body.length]), mask, masked]);

  const read = readFrame(frame);
  assert.equal(read.text, 'hello');
  assert.equal(read.opcode, 1);
  assert.equal(read.used, frame.length);

  // Two frames at once, and a half-arrived one.
  const two = Buffer.concat([frame, frame]);
  const first = readFrame(two);
  assert.equal(readFrame(two.slice(first.used)).text, 'hello');
  assert.equal(readFrame(frame.slice(0, 4)), null, 'half a frame is not a frame');
  assert.equal(readFrame(Buffer.from([0x81])), null);

  // Longer than 125 letters uses two more bytes for the length.
  const long = Buffer.from('x'.repeat(300), 'utf8');
  const longMasked = Buffer.from(long);
  for (let at = 0; at < longMasked.length; at++) longMasked[at] ^= mask[at % 4];
  const big = Buffer.concat([
    Buffer.from([0x81, 0x80 | 126, long.length >> 8, long.length & 255]), mask, longMasked
  ]);
  assert.equal(readFrame(big).text.length, 300);

  // A goodbye, and a size nobody means honestly.
  assert.equal(readFrame(Buffer.from([0x88, 0x80, 1, 2, 3, 4])).opcode, 8);
  const silly = Buffer.concat([Buffer.from([0x81, 127]), sixtyFour(9e15), Buffer.alloc(4)]);
  assert.equal(readFrame(silly).opcode, 8, 'an absurd length should be treated as a goodbye');
});

check('a server can be told to lock the conversation', () => {
  let asked = null;
  const { server } = runNet(
    'start serving safely on port 8443 with certificate "cert.pem" and key "key.pem"',
    { serve: (one) => { asked = one; } }
  );
  assert.equal(server.port, 8443);
  assert.deepEqual(server.safely, { certificate: 'cert.pem', key: 'key.pem' });
  assert.ok(asked, 'the server should have been started');
});

check('cookies are read, and rubbish in them is ignored', () => {
  assert.deepEqual(readCookies('a=1; b=two'), { a: '1', b: 'two' });
  assert.deepEqual(readCookies('plain-visitor=x%20y'), { 'plain-visitor': 'x y' });
  assert.deepEqual(readCookies(''), {});
  assert.deepEqual(readCookies('nonsense'), {});
});

check('a program can send someone somewhere else', () => {
  const { server } = runNet('when someone visits "/old"\n    send them to "/new"\nend');
  server.routes[0].run();
  assert.equal(server.answer.code, 303);
  assert.equal(server.answer.goTo, '/new');
});

check('a program can say nothing is there, or pick its own code', () => {
  const { server } = runNet([
    'when someone visits "/gone"',
    '    answer that nothing is there',
    'end',
    'when someone visits "/teapot"',
    '    answer with "no tea" and code 418',
    'end'
  ].join('\n'));
  server.routes[0].run();
  assert.equal(server.answer.code, 404);
  server.routes[1].run();
  assert.equal(server.answer.code, 418);
  assert.equal(server.answer.body, 'no tea');
});

check('routes are collected in the order they are written', () => {
  const { server } = runNet([
    'when someone visits "/"',
    '    answer with "home"',
    'end',
    'when someone visits "/about"',
    '    answer with "about"',
    'end'
  ].join('\n'));
  assert.deepEqual(server.routes.map(route => route.path), ['/', '/about']);
});

check('a route answers with what it was told to', () => {
  const { server } = runNet('when someone visits "/"\n    answer with "hello"\nend');
  server.routes[0].run();
  assert.equal(server.answer.body, 'hello');
  assert.match(server.answer.kind, /text\/plain/);
});

check('an answer that looks like a page is served as one', () => {
  const { server } = runNet('when someone visits "/"\n    answer with "<h1>hi</h1>"\nend');
  server.routes[0].run();
  assert.match(server.answer.kind, /text\/html/);
});

check('a route can read the question it was asked', () => {
  const { server } = runNet([
    'when someone visits "/add"',
    '    answer with "{(number of asked for \\"a\\") plus (number of asked for \\"b\\")}"',
    'end'
  ].join('\n'));
  server.asked = { path: '/add', query: { a: '2', b: '40' }, sent: '', method: 'GET' };
  server.routes[0].run();
  assert.equal(server.answer.body, '42');
});

check('a route can read what was sent to it', () => {
  const { server } = runNet('when someone visits "/shout"\n    answer with uppercase of what they sent\nend');
  server.asked = { path: '/shout', query: {}, sent: 'quiet', method: 'POST' };
  server.routes[0].run();
  assert.equal(server.answer.body, 'QUIET');
});

check('paths are tidied so /about/ and /about are the same', () => {
  const { server } = runNet('when someone visits "/about/"\n    answer with "x"\nend');
  assert.equal(server.routes[0].path, '/about');
  assert.ok(server.routeFor('/about'));
  assert.ok(server.routeFor('/about?q=1'));
  assert.equal(server.routeFor('/nowhere'), null);
});

check('anything else can be caught', () => {
  const { server } = runNet('when someone visits anything else\n    answer with "lost"\nend');
  assert.ok(server.notFound);
  server.notFound();
  assert.equal(server.answer.body, 'lost');
});

check('fetching says plainly that it needs a terminal', () => {
  let error = null;
  try { runNet('fetch "https://example.com" into page'); }
  catch (e) { error = e; }
  assert.ok(error instanceof PlainError);
  assert.match(error.plainMessage, /terminal/);
});

check('a made-up address is refused before anything is sent', () => {
  let error = null;
  const host = { fetchText: (url, ctx) => ctx.fail(`"${url}" is not a web address`) };
  try { runNet('fetch "not a url" into page', host); }
  catch (e) { error = e; }
  assert.match(error.plainMessage, /not a web address/);
});

check('what comes back can be read as a thing', () => {
  const host = { fetchText: () => ({ ok: true, status: 200, text: '{"stars": 7}' }) };
  const { rt } = runNet('fetch "https://x.example" as a thing into repo\nshow stars of repo', host);
  assert.equal(rt.lines[0], '7');
});

check('something that is not a thing is explained', () => {
  const host = { fetchText: () => ({ ok: true, status: 200, text: 'not json at all' }) };
  let error = null;
  try { runNet('fetch "https://x.example" as a thing into repo', host); }
  catch (e) { error = e; }
  assert.match(error.plainMessage, /not a thing I can read/);
});

// ----------------------------------------------------------------- parts

check('a part gets a sensible name from its address', () => {
  assert.equal(nameFrom('https://example.com/dates.plain'), 'dates');
  assert.equal(nameFrom('https://example.com/a/b/Nice Things.plain'), 'nice-things');
  assert.equal(nameFrom('https://example.com/'), 'example-com');
});

check('a part has to look like a part', () => {
  assert.equal(checkPart('show "hi"\n', 'x'), null);
  assert.match(checkPart('<!doctype html><html>', 'x'), /web page/);
  assert.match(checkPart('binary' + String.fromCharCode(0) + 'stuff', 'x'), /not text/);
  assert.match(checkPart('x'.repeat(2 * 1024 * 1024), 'x'), /small file/);
});

check('a fetched part is written down and can be used', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-parts-'));
  const source = 'to greet with who\n    give back "hi " joined with who\nend\n';
  const file = save(folder, 'greetings', source, 'https://example.com/greetings.plain');
  assert.ok(fs.existsSync(file));

  const list = readList(folder);
  assert.equal(list.parts.greetings.url, 'https://example.com/greetings.plain');
  assert.equal(list.parts.greetings.fingerprint, fingerprint(source));

  // And a program can use it by name.
  const rt = createRuntime({
    onOutput: () => {},
    resolve: (used) => {
      const one = path.join(folder, 'plain-parts', used + '.plain');
      return fs.existsSync(one) ? fs.readFileSync(one, 'utf8') : null;
    }
  });
  rt.run('use "greetings"\nshow greet with "world"', 'main.plain');
  assert.equal(rt.lines[0], 'hi world');
  fs.rmSync(folder, { recursive: true, force: true });
});

check('a part that has changed since it was fetched can be spotted', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-parts-'));
  save(folder, 'thing', 'show "one"\n', 'https://example.com/thing.plain');
  const before = readList(folder).parts.thing.fingerprint;
  fs.writeFileSync(path.join(folder, 'plain-parts', 'thing.plain'), 'show "two"\n', 'utf8');
  const after = fingerprint(fs.readFileSync(path.join(folder, 'plain-parts', 'thing.plain'), 'utf8'));
  assert.notEqual(before, after);
  fs.rmSync(folder, { recursive: true, force: true });
});

// ------------------------------------------------- several things at once

check('several addresses can be asked at once', () => {
  const asked = [];
  const host = {
    fetchAll: (urls) => { asked.push(...urls); return urls.map(url => `answer from ${url}`); }
  };
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installNet(rt, host);
  rt.run('fetch all of "https://a.example", "https://b.example" into answers\nshow length of answers\nshow item 1 of answers', 'net.plain');
  assert.deepEqual(asked, ['https://a.example', 'https://b.example']);
  assert.equal(rt.lines[0], '2');
  assert.equal(rt.lines[1], 'answer from https://a.example');
});

check('a list of addresses works too', () => {
  const host = { fetchAll: (urls) => urls.map(() => 'ok') };
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installNet(rt, host);
  rt.run('make sites be ["https://a.example", "https://b.example"]\nfetch all of sites into answers\nshow length of answers', 'net.plain');
  assert.equal(rt.lines[0], '2');
});

check('a program can be told to keep going', () => {
  let kept = null;
  const rt = createRuntime({ onOutput: () => {} });
  const game = installGame(rt, { keepGoing: (which) => { kept = which; } });
  rt.run('make n be 0\nevery 1 seconds\n    add 1 to n\nend\nkeep going', 'watch.plain');
  assert.equal(kept, game, 'the clock was never started');
  game.simulate(180, 1 / 60);
  assert.equal(rt.interpreter.globals.get('n'), 3);
});

check('keeping going says it needs a terminal', () => {
  const error = broken('every 1 seconds\n    show "tick"\nend\nkeep going');
  assert.match(error.plainMessage, /needs a terminal/);
});

// --------------------------------------------------------------- tidying

check('tidying fixes the indenting and leaves the words alone', () => {
  const messy = 'make score be 0\nrepeat 3 times\nadd 1 to score\n   if score is 2\n show "two"\n     end\nend\n';
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  const tidy = format(messy, rt.parse(messy, 'messy.plain'));
  assert.equal(tidy, [
    'make score be 0',
    'repeat 3 times',
    '    add 1 to score',
    '    if score is 2',
    '        show "two"',
    '    end',
    'end',
    ''
  ].join('\n'));
});

check('tidying a tidy file changes nothing', () => {
  for (const file of ['hello.plain', 'tour.plain', 'kinds.plain', 'pong.plain', 'site.plain', 'world.plain', 'video.plain', 'catch.plain', 'guess.plain']) {
    const source = fs.readFileSync(path.join(ROOT, 'examples', file), 'utf8');
    const rt = createRuntime({ onOutput: () => {} });
    installGame(rt, {});
    installWorld(rt, {});
    installWeb(rt, {});
    installVideo(rt, {});
    installStore(rt, {});
    const tidy = format(source, rt.parse(source, file));
    assert.equal(tidy, source.replace(/\r\n?/g, '\n'), `${file} is not tidy`);
  }
});

check('tidying never reaches inside a piece of text', () => {
  const messy = 'when someone visits "/"\nanswer with "<h1>hi</h1>\n        <p>indented on purpose</p>"\nend\n';
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installWeb(rt, {});
  installNet(rt, {});
  const tidy = format(messy, rt.parse(messy, 'messy.plain'));
  assert.match(tidy, /\n {8}<p>indented on purpose<\/p>"/, 'the text inside was moved');
  assert.match(tidy, /\n {4}answer with/, 'the sentence itself was not indented');
});

check('text can run over several lines', () => {
  assert.equal(first('show "one\ntwo"'), 'one\ntwo');
  const error = broken('show "never closed\nmake x be 1');
  assert.match(error.plainMessage, /missing its closing/);
  assert.equal(error.line, 1, 'it should point at where the text opened');
});

check('tidying keeps comments with the lines they explain', () => {
  const messy = 'repeat 2 times\n# about the show\nshow "hi"\nend\n';
  const rt = createRuntime({ onOutput: () => {} });
  const tidy = format(messy, rt.parse(messy, 'messy.plain'));
  assert.match(tidy, /\n    # about the show\n    show "hi"/);
});

check('tidying a program that keeps blocks inside kinds', () => {
  const messy = 'a kind called Dog\nhas name\nto speak\nshow "woof"\nend\nend\n';
  const rt = createRuntime({ onOutput: () => {} });
  const tidy = format(messy, rt.parse(messy, 'messy.plain'));
  assert.equal(tidy, 'a kind called Dog\n    has name\n    to speak\n        show "woof"\n    end\nend\n');
});

// ----------------------------------------------------------------- the tool

check('the command line runs a program', () => {
  const output = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'plain.js'), 'run', path.join(ROOT, 'examples', 'hello.plain')], { encoding: 'utf8' });
  assert.match(output, /Hello, world!/);
});

check('the command line checks a program', () => {
  const output = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'plain.js'), 'check', path.join(ROOT, 'examples', 'tour.plain')], { encoding: 'utf8' });
  assert.match(output, /looks fine/);
});

check('a picture can be written and read back, from Plain alone', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-png-'));
  try {
    const program = [
      'make dots be []',
      'repeat with y from 1 to 8',
      '    repeat with x from 1 to 8',
      '        if (x plus y) modulo 2 is 0',
      '            add "#ff6b6b" to dots',
      '        otherwise',
      '            add "" to dots',
      '        end',
      '    end',
      'end',
      'save dots as the picture "check.png" sized 8 by 8',
      'show the width of the picture "check.png"',
      'show the colour at 1 , 1 of the picture "check.png"',
      'show "empty({the colour at 0 , 1 of the picture QQcheck.pngQQ})"'
    ].join(String.fromCharCode(10)).replace(/QQ/g, String.fromCharCode(92) + '"');
    fs.writeFileSync(path.join(folder, 'dots.plain'), program, 'utf8');
    const output = execFileSync(process.execPath,
      [path.join(ROOT, 'bin', 'plain.js'), 'run', path.join(folder, 'dots.plain')],
      { encoding: 'utf8' }).replace(/\r/g, '').trim().split(String.fromCharCode(10));
    assert.deepEqual(output, ['8', '#ff6b6b', 'empty()']);
    // And the file is a real PNG a browser would open.
    const bytes = fs.readFileSync(path.join(folder, 'check.png'));
    assert.equal(bytes.readUInt32BE(0), 0x89504e47);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

check('the command line lists its sentences', () => {
  const output = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'plain.js'), 'words'], { encoding: 'utf8' });
  assert.match(output, /add a title/);
  assert.match(output, /every frame/);
});

check('the command line starts a new program that runs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-new-'));
  const plain = path.join(ROOT, 'bin', 'plain.js');
  execFileSync(process.execPath, [plain, 'new', 'first.plain'], { cwd: dir, encoding: 'utf8' });
  const output = execFileSync(process.execPath, [plain, 'run', 'first.plain'], { cwd: dir, encoding: 'utf8' });
  assert.match(output, /Hello, world!/);
  fs.rmSync(dir, { recursive: true, force: true });
});

check('a website builds to real files', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-build-'));
  execFileSync(process.execPath, [path.join(ROOT, 'bin', 'plain.js'), 'build', path.join(ROOT, 'examples', 'site.plain'), '--out', out], { encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(out, 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'projects.html')));
  assert.ok(fs.existsSync(path.join(out, 'plain', 'src', 'browser.js')));
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /Ada's Corner/);
  fs.rmSync(out, { recursive: true, force: true });
});

check('a game builds to one page', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-game-'));
  execFileSync(process.execPath, [path.join(ROOT, 'bin', 'plain.js'), 'build', path.join(ROOT, 'examples', 'pong.plain'), '--out', out], { encoding: 'utf8' });
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /startPlain/);
  assert.match(html, /<title>Pong<\/title>/);
  fs.rmSync(out, { recursive: true, force: true });
});

// The suite already checks that every worked answer passes its step. This
// asks the other half of the question: is the code the course and the
// documents *show* you code that Plain actually understands? A lesson that
// teaches a sentence Plain does not know is worse than no lesson.
function readable(source) {
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {}); installWorld(rt, {}); installWeb(rt, {});
  installVideo(rt, {}); installStore(rt, {}); installData(rt, {}); installNet(rt, {});
  installMail(rt, {}); installParts(rt);
  rt.parse(source, 'shown.plain');
}

function plainBlocks(html) {
  // Only an unmarked <pre> holds Plain. A marked one is something else:
  // lines to type in a terminal, or a piece of markup being pointed at.
  return [...String(html || '').matchAll(/<pre>([\s\S]*?)<\/pre>/g)]
    .map(found => found[1]
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .trim());
}

check('every piece of Plain the course shows is Plain it understands', () => {
  const wrong = [];
  let counted = 0;
  const look = (where, html) => {
    for (const code of plainBlocks(html)) {
      counted++;
      try { readable(code); }
      catch (error) { wrong.push(`${where}: ${error.plainMessage || error.message}`); }
    }
  };
  for (const lesson of LESSONS) look(`lesson "${lesson.title}"`, lesson.teach);
  for (const project of PROJECTS) {
    project.steps.forEach((step, at) => {
      look(`${project.id} step ${at + 1}`, step.teach);
      look(`${project.id} step ${at + 1}`, step.task);
    });
  }
  assert.ok(counted > 20, `only found ${counted} pieces of code to check`);
  assert.equal(wrong.length, 0, '\n  ' + wrong.join('\n  '));
});

check('every piece of Plain the documents show is Plain it understands', () => {
  const wrong = [];
  let counted = 0;
  for (const file of ['LANGUAGE.md', 'README.md']) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const found of text.matchAll(/```plain\n([\s\S]*?)```/g)) {
      const code = found[1];
      // A block that pulls in another file needs that file to be there,
      // which is a different question from whether the sentence is right.
      if (/^[ \t]*use[ \t]+["']/m.test(code)) continue;
      counted++;
      try { readable(code); }
      catch (error) { wrong.push(`${file}: ${error.plainMessage || error.message}`); }
    }
  }
  assert.ok(counted > 60, `only found ${counted} blocks to check`);
  assert.equal(wrong.length, 0, '\n  ' + wrong.join('\n  '));
});

check('every example still runs', () => {
  // An example is a .plain file, or a project folder whose door is
  // main.plain - in which case its other files arrive through "use",
  // resolved from the folder exactly as the command line resolves them.
  const entries = [];
  for (const name of fs.readdirSync(path.join(ROOT, 'examples'))) {
    const full = path.join(ROOT, 'examples', name);
    if (name.endsWith('.plain')) entries.push({ file: name, full });
    else if (fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'main.plain'))) {
      entries.push({ file: name, full: path.join(full, 'main.plain'), folder: full });
    }
  }
  assert.ok(entries.some(one => one.folder), 'no folder projects among the examples?');
  for (const { file, full, folder } of entries) {
    if (file === 'guess.plain') continue;
    const source = fs.readFileSync(full, 'utf8');
    const resolve = folder
      ? (used) => {
          const there = path.join(folder, used);
          return fs.existsSync(there) ? fs.readFileSync(there, 'utf8') : null;
        }
      : undefined;
    if (['website-server.plain', 'notes-app', 'live-chat.plain'].includes(file)) {
      // These wait for visitors, which a test run has none of. Their routes
      // are checked above; here we only insist they read and build.
      const rt = createRuntime({ onOutput: () => {}, resolve });
      installGame(rt, {});
      installWeb(rt, {});
      installStore(rt, {});
      installData(rt, {});
      const server = installNet(rt, { serve: () => {} });
      rt.run(source, file);
      const set = server.routes.length + server.onSay.length + server.jobs.length;
      assert.ok(set >= 3, `${file} should set up several things to answer`);
      continue;
    }
    if (file === 'remember.plain') {
      // This one keeps things, so it needs somewhere to keep them.
      const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-example-'));
      try { runWith(source, realFiles(folder)); }
      finally { fs.rmSync(folder, { recursive: true, force: true }); }
      continue;
    }
    runtimeFor(source, resolve ? { resolve } : {});
  }
});

// -------------------------------------------------------------- the course

const { runCourseChecks } = await import('./course-tests.js');
runCourseChecks(check);

// ---------------------------------------------------------------- the pages

const { runPageChecks } = await import('./page-tests.js');
runPageChecks(check);

// ---------------------------------------------------------------- the score

if (failures.length) {
  console.error(`\n${failures.length} of ${passed + failures.length} checks failed:\n`);
  for (const { name, error } of failures) {
    console.error(`  x ${name}`);
    console.error(`      ${(error.plainMessage || error.message || '').split('\n')[0]}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`All ${passed} checks passed.`);
if (skipped.length) {
  console.log('\nRun three ways where the tools exist. Not checked by running here:');
  for (const what of skipped) console.log('  - ' + what);
}

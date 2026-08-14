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
import { PlainError } from '../src/errors.js';
import { installGame } from '../engines/game/engine.js';
import { installWeb } from '../engines/web/engine.js';
import { documentToHTML } from '../engines/web/render.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];

function check(name, run) {
  try { run(); passed++; }
  catch (error) { failures.push({ name, error }); }
}

// Run a program and return the lines it printed.
function run(source) {
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installWeb(rt, {});
  rt.run(source, 'test.plain');
  return rt.lines;
}

function runtimeFor(source) {
  const rt = createRuntime({ onOutput: () => {} });
  const game = installGame(rt, {});
  const site = installWeb(rt, {});
  rt.run(source, 'test.plain');
  return { rt, game, site };
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
check('sorted', () => assert.equal(first('show text of sorted [3, 1, 2]'), '[1, 2, 3]'));
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

// ----------------------------------------------------------------- the tool

check('the command line runs a program', () => {
  const output = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'plain.js'), 'run', path.join(ROOT, 'examples', 'hello.plain')], { encoding: 'utf8' });
  assert.match(output, /Hello, world!/);
});

check('the command line checks a program', () => {
  const output = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'plain.js'), 'check', path.join(ROOT, 'examples', 'tour.plain')], { encoding: 'utf8' });
  assert.match(output, /looks fine/);
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

check('every example still runs', () => {
  for (const file of fs.readdirSync(path.join(ROOT, 'examples'))) {
    if (!file.endsWith('.plain') || file === 'guess.plain') continue;
    const rt = createRuntime({ onOutput: () => {} });
    installGame(rt, {});
    installWeb(rt, {});
    rt.run(fs.readFileSync(path.join(ROOT, 'examples', file), 'utf8'), file);
  }
});

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

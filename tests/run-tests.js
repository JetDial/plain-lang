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
import { installWorld } from '../engines/world/engine.js';
import { installWeb } from '../engines/web/engine.js';
import { installVideo } from '../engines/video/engine.js';
import { installStore } from '../engines/store/engine.js';
import { installNet } from '../engines/net/engine.js';
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

check('it can write nine languages', () => {
  assert.deepEqual(targetNames(), ['javascript', 'python', 'csharp', 'lua', 'typescript', 'ruby', 'java', 'go', 'php']);
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

// ----------------------------------------------------------- the internet

function runNet(source, host = {}) {
  const rt = createRuntime({ onOutput: () => {} });
  installGame(rt, {});
  installWeb(rt, {});
  const server = installNet(rt, host);
  rt.run(source, 'net.plain');
  return { rt, server };
}

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
    const source = fs.readFileSync(path.join(ROOT, 'examples', file), 'utf8');
    if (file === 'website-server.plain') {
      // This one waits for visitors, which a test run has none of. Its
      // routes are checked above; here we only insist it reads and builds.
      const rt = createRuntime({ onOutput: () => {} });
      installGame(rt, {});
      installWeb(rt, {});
      installStore(rt, {});
      const server = installNet(rt, { serve: () => {} });
      rt.run(source, file);
      assert.ok(server.routes.length >= 3, 'the example should set up several routes');
      continue;
    }
    if (file === 'remember.plain') {
      // This one keeps things, so it needs somewhere to keep them.
      const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-example-'));
      try { runWith(source, realFiles(folder)); }
      finally { fs.rmSync(folder, { recursive: true, force: true }); }
      continue;
    }
    runtimeFor(source);
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

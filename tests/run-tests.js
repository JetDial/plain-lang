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
import { documentToHTML } from '../engines/web/render.js';
import { cubeMesh, sphereMesh, perspective, lookAt, multiply, toRGB } from '../engines/world/render.js';

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

check('it knows what it can write', () => {
  assert.deepEqual(targetNames(), ['javascript', 'python']);
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
    runtimeFor(fs.readFileSync(path.join(ROOT, 'examples', file), 'utf8'));
  }
});

// -------------------------------------------------------------- the course

const { runCourseChecks } = await import('./course-tests.js');
runCourseChecks(check);

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

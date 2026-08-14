// Plain - checking the pages.
//
// The designer, the video studio and the course are driven here the way a
// person drives them: build the page, click things, and ask what came out.
// The document underneath is the small stand-in in fake-dom.js.

import assert from 'node:assert/strict';

import { createRuntime } from '../src/runtime.js';
import { installGame } from '../engines/game/engine.js';
import { installWorld } from '../engines/world/engine.js';
import { installWeb } from '../engines/web/engine.js';
import { installVideo } from '../engines/video/engine.js';
import { installStore } from '../engines/store/engine.js';
import { startDesigner } from '../engines/web/designer.js';
import { startStudio } from '../engines/video/player.js';
import { startLearning } from '../engines/learn/app.js';
import { paint } from '../engines/learn/highlight.js';
import { FakeWindow } from './fake-dom.js';

export function runPageChecks(check) {
  // A page needs somewhere to save to; this stands in for the Plain server.
  function withFetch(win, saved) {
    globalThis.fetch = async (where, options) => {
      saved.push({ where, body: options && options.body });
      return { ok: true };
    };
    return win;
  }

  function build(source) {
    const win = new FakeWindow();
    const doc = win.document;
    const runtime = createRuntime({ onOutput: () => {} });
    const game = installGame(runtime, { window: win, document: doc });
    const world = installWorld(runtime, { window: win, document: doc });
    const site = installWeb(runtime, { window: win, document: doc });
    const studio = installVideo(runtime, { window: win, document: doc });
    installStore(runtime, { window: win, document: doc });
    runtime.run(source, 'page.plain');
    return { win, doc, runtime, game, world, site, studio };
  }

  // ------------------------------------------------------- the designer

  const SITE = [
    'make a website called "About Me"',
    'set the theme to "dark"',
    'add a title "About Me"',
    'add text "Written in Plain."',
    'add a card called "Things I like"',
    '    add a list of "rain", "maps"',
    'end',
    'add a button "Say hello"',
    '    show a message "Hello!"',
    'end'
  ].join('\n');

  check('page: the designer builds itself', () => {
    const { win, doc, site } = build(SITE);
    startDesigner(site, doc, win);
    assert.ok(doc.querySelector('.designer'), 'no designer on the page');
    assert.ok(doc.querySelectorAll('.blocks button').length >= 10, 'no palette of blocks');
    assert.ok(doc.querySelector('[data-save]'), 'no Save button');
    assert.equal(doc.title, 'Designing About Me');
  });

  check('page: the designer shows a tab for every page', () => {
    const { win, doc, site } = build(`${SITE}\nmake a page called "Projects" at "/projects"\nadd a title "Projects"`);
    startDesigner(site, doc, win);
    const tabs = doc.querySelectorAll('.tab').map(tab => tab.textContent);
    assert.ok(tabs.includes('About Me'), `tabs were ${tabs.join(', ')}`);
    assert.ok(tabs.includes('Projects'));
    assert.ok(tabs.includes('+'), 'no way to add a page');
  });

  check('page: adding a block from the palette puts it on the page', () => {
    const { win, doc, site } = build(SITE);
    startDesigner(site, doc, win);
    const before = site.pages[0].nodes.length;
    doc.querySelectorAll('.blocks button').find(button => button.textContent === 'Quote').click();
    assert.equal(site.pages[0].nodes.length, before + 1);
    assert.equal(site.pages[0].nodes[before].kind, 'quote');
  });

  check('page: the designer saves the page back as Plain sentences', async () => {
    const saved = [];
    const { win, doc, site } = build(SITE);
    withFetch(win, saved);
    startDesigner(site, doc, win);
    doc.querySelector('[data-save]').dispatchEvent({ type: 'click', currentTarget: doc.querySelector('[data-save]') });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(saved.length, 1, 'nothing was sent to be saved');
    assert.equal(saved[0].where, '/source');
    assert.match(saved[0].body, /make a website called "About Me"/);
    assert.match(saved[0].body, /add a card called "Things I like"/);
    assert.match(saved[0].body, /show a message "Hello!"/);
  });

  check('page: changing the theme changes what is saved', async () => {
    const saved = [];
    const { win, doc, site } = build(SITE);
    withFetch(win, saved);
    startDesigner(site, doc, win);
    const picker = doc.querySelector('[data-theme]');
    picker.value = 'ocean';
    picker.dispatchEvent({ type: 'change', target: picker });
    assert.equal(site.theme, 'ocean');
    doc.querySelector('[data-save]').dispatchEvent({ type: 'click', currentTarget: doc.querySelector('[data-save]') });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(saved[0].body, /set the theme to "ocean"/);
  });

  // ---------------------------------------------------------- the studio

  const FILM = [
    'make a video called "My Film" sized 640 by 360',
    'add a title "My Film" for 3 seconds',
    'fade the last clip in over 1 seconds',
    'add a background "#123456" for 2 seconds',
    'put the words "chapter one" on the last clip',
    'add a title "The end" for 2 seconds'
  ].join('\n');

  check('page: the studio builds itself', () => {
    const { win, doc, studio } = build(FILM);
    startStudio(studio, doc, win);
    assert.ok(doc.querySelector('.studio'), 'no studio on the page');
    assert.equal(doc.querySelectorAll('.block').length, 3, 'the timeline should show three clips');
    assert.ok(doc.querySelector('[data-play]'));
    assert.ok(doc.querySelector('[data-export]'));
    assert.equal(doc.querySelector('[data-save]'), null, 'Save should only appear when editing');
  });

  check('page: the studio offers both ways of exporting', () => {
    const { win, doc, studio } = build(FILM);
    startStudio(studio, doc, win);
    assert.ok(doc.querySelector('[data-export]'), 'no Export button');
    assert.ok(doc.querySelector('[data-fast]'), 'no fast Export button');
  });

  check('page: exporting fast says so when the browser cannot encode', () => {
    const { win, doc, studio } = build(FILM);
    startStudio(studio, doc, win);
    const fast = doc.querySelector('[data-fast]');
    fast.dispatchEvent({ type: 'click', currentTarget: fast });
    assert.match(doc.querySelector('[data-note]').textContent, /cannot encode/);
  });

  check('page: the studio shows Save when opened for editing', () => {
    const { win, doc, studio } = build(FILM);
    win.__plainEditable = true;
    startStudio(studio, doc, win);
    assert.ok(doc.querySelector('[data-save]'), 'no Save button while editing');
  });

  check('page: the studio draws the clip the scrubber is on', () => {
    const { win, doc, studio } = build(FILM);
    startStudio(studio, doc, win);
    const canvas = doc.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    ctx.calls.length = 0;
    const scrub = doc.querySelector('[data-scrub]');
    scrub.value = String(Math.round((4 / studio.length) * 1000));   // inside the middle clip
    scrub.dispatchEvent({ type: 'input' });
    const filled = ctx.calls.filter(call => call.name === 'fillRect');
    assert.ok(filled.length > 0, 'nothing was painted');
    const wrote = ctx.calls.filter(call => call.name === 'fillText').map(call => call.args[0]);
    assert.ok(wrote.includes('chapter one'), `the words on the clip were not drawn (${wrote.join(', ')})`);
  });

  check('page: choosing a clip fills in its details', () => {
    const { win, doc, studio } = build(FILM);
    win.__plainEditable = true;
    startStudio(studio, doc, win);
    doc.querySelectorAll('.block')[2].click();
    const words = doc.querySelector('[data-field="text"]');
    assert.equal(words.getAttribute('value'), 'The end');
    const seconds = doc.querySelector('[data-field="length"]');
    assert.equal(seconds.getAttribute('value'), '2');
  });

  check('page: changing a clip length changes the film', () => {
    const { win, doc, studio } = build(FILM);
    win.__plainEditable = true;
    startStudio(studio, doc, win);
    const wasLong = studio.length;
    doc.querySelectorAll('.block')[0].click();
    const seconds = doc.querySelector('[data-field="length"]');
    seconds.value = '6';
    seconds.type = 'number';
    seconds.dispatchEvent({ type: 'input' });
    assert.equal(studio.clips[0].length, 6);
    assert.equal(studio.length, wasLong + 3);
  });

  check('page: a clip can be moved and deleted', () => {
    const { win, doc, studio } = build(FILM);
    win.__plainEditable = true;
    startStudio(studio, doc, win);
    doc.querySelectorAll('.block')[0].click();
    doc.querySelector('[data-move="1"]').click();
    assert.equal(studio.clips[1].text, 'My Film', 'the first clip should have moved along one');
    doc.querySelector('[data-delete]').click();
    assert.equal(studio.clips.length, 2);
  });

  check('page: the studio saves the timeline back as Plain sentences', async () => {
    const saved = [];
    const { win, doc, studio } = build(FILM);
    win.__plainEditable = true;
    withFetch(win, saved);
    startStudio(studio, doc, win);
    const save = doc.querySelector('[data-save]');
    save.dispatchEvent({ type: 'click', currentTarget: save });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(saved.length, 1);
    assert.match(saved[0].body, /make a video called "My Film" sized 640 by 360/);
    assert.match(saved[0].body, /fade the last clip in over 1 seconds/);
    assert.match(saved[0].body, /put the words "chapter one" on the last clip/);
  });

  // ---------------------------------------------------------- the course

  check('page: the course builds itself', () => {
    const win = new FakeWindow();
    startLearning(win.document, win);
    assert.equal(win.document.title, 'Learn Plain');
    assert.ok(win.document.querySelectorAll('.map button').length > 10, 'no list of lessons');
    assert.ok(win.document.querySelector('textarea'), 'no editor');
    assert.ok(win.document.querySelector('.paint'), 'no colouring behind the editor');
  });

  check('page: a right answer is accepted and a wrong one gets a hint', () => {
    const win = new FakeWindow();
    const doc = win.document;
    startLearning(doc, win);

    const type = (text) => {
      const editor = doc.querySelector('textarea');
      editor.value = text;
      editor.dispatchEvent({ type: 'input' });
    };
    const checkIt = () => {
      doc.querySelector('[data-check]').click();
      return doc.querySelector('.verdict').textContent;
    };

    type('show "hi"');
    assert.match(checkIt(), /Two lines/);
    assert.equal(doc.querySelector('[data-next]').hidden, true, 'Next should still be hidden');

    type('show "Hello there"\nshow 12 times 12');
    const verdict = checkIt();
    assert.ok(!/Two lines/.test(verdict), `still complaining: ${verdict}`);
    assert.equal(doc.querySelector('[data-next]').hidden, false, 'Next should be offered now');
    assert.match(doc.querySelector('.map .done').textContent, /^1 of/);
  });

  check('page: a program that stops offers to jump to the line', () => {
    const win = new FakeWindow();
    const doc = win.document;
    startLearning(doc, win);
    const editor = doc.querySelector('textarea');
    editor.value = 'show "one"\nshow "two"\nshow wobble';
    editor.dispatchEvent({ type: 'input' });
    doc.querySelector('[data-run]').click();
    assert.match(doc.querySelector('[data-out]').textContent, /Line 3/);
    const jump = doc.querySelector('.verdict button');
    assert.ok(jump, 'no button to jump to the line');
    assert.equal(jump.textContent, 'line 3');
    assert.equal(editor.value.slice(editor.selectionStart, editor.selectionEnd), 'show wobble');
  });

  check('page: a website written in the course is previewed', () => {
    const win = new FakeWindow();
    const doc = win.document;
    startLearning(doc, win);
    const editor = doc.querySelector('textarea');
    editor.value = 'make a website called "Mine"\nadd a title "Mine"\nadd text "hello"';
    editor.dispatchEvent({ type: 'input' });
    doc.querySelector('[data-run]').click();
    assert.ok(doc.querySelector('.preview iframe'), 'no preview of the page');
  });

  check('page: a game written in the course gets a canvas', () => {
    const win = new FakeWindow();
    const doc = win.document;
    startLearning(doc, win);
    const editor = doc.querySelector('textarea');
    editor.value = 'start a game called "G" sized 100 by 80\nmake box be a box at 50 , 40 sized 10 by 10 colored "red"';
    editor.dispatchEvent({ type: 'input' });
    doc.querySelector('[data-run]').click();
    const canvas = doc.querySelector('.preview canvas');
    assert.ok(canvas, 'no canvas for the game');
    assert.equal(canvas.width, 100);
    assert.ok(win.frames.length > 0, 'the game was never asked to draw');
  });

  check('page: the course can show the program in other languages', () => {
    const win = new FakeWindow();
    const doc = win.document;
    startLearning(doc, win);
    const editor = doc.querySelector('textarea');
    editor.value = 'make x be 2\nshow x times 3';
    editor.dispatchEvent({ type: 'input' });
    doc.querySelector('[data-translate]').click();
    const columns = doc.querySelectorAll('.pair pre');
    assert.equal(columns.length, 4, 'there should be one column per language');
    assert.match(columns[0].textContent, /let x = 2/);
    assert.match(columns[1].textContent, /^# Translated/m);
  });

  check('page: progress is kept for next time', () => {
    const win = new FakeWindow();
    startLearning(win.document, win);
    const editor = win.document.querySelector('textarea');
    editor.value = 'show "Hello there"\nshow 12 times 12';
    editor.dispatchEvent({ type: 'input' });
    win.document.querySelector('[data-check]').click();

    // A fresh page, the same browser.
    const again = new FakeWindow();
    again.localStorage = win.localStorage;
    startLearning(again.document, again);
    assert.match(again.document.querySelector('.map .done').textContent, /^1 of/);
  });

  // ------------------------------------------------------------ colouring

  check('page: code is coloured by the language itself', () => {
    const html = paint('make score be 0   # a note\nshow "hi {score}"\nif score is above 5\nshow yes\nend');
    assert.match(html, /<span class="c-control">make<\/span>/);
    assert.match(html, /<span class="c-number">0<\/span>/);
    assert.match(html, /<span class="c-comment"># a note<\/span>/);
    assert.match(html, /<span class="c-text">"hi \{score\}"<\/span>/);
    assert.match(html, /<span class="c-operator">above<\/span>/);
    assert.match(html, /<span class="c-value">yes<\/span>/);
  });

  check('page: colouring never loses a letter', () => {
    for (const source of [
      'show "a < b & c > d"',
      'make x be 1\nshow x',
      'show "unclosed',
      '',
      '# just a comment',
      'a kind called Dog\n    has name\nend'
    ]) {
      const stripped = paint(source).replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      assert.equal(stripped, source.replace(/\r\n?/g, '\n'), `colouring changed: ${JSON.stringify(source)}`);
    }
  });
}

// Plain - Learn Plain.
// Lessons and projects with a real editor: every check runs the learner's
// program and looks at what it did. Progress is kept in the browser.

import { createRuntime } from '../../src/runtime.js';
import { PlainError } from '../../src/errors.js';
import { installGame } from '../game/engine.js';
import { installWorld } from '../world/engine.js';
import { createRenderer } from '../world/render.js';
import { installWeb } from '../web/engine.js';
import { installVideo } from '../video/engine.js';
import { installStore } from '../store/engine.js';
import { mountPage, stylesheet } from '../web/render.js';
import { translate, targetNames } from '../../src/translate/index.js';
import { PROGRAM_STARTS } from '../../src/translate/runtimes.js';
import { LESSONS, PROJECTS, totalSteps } from './course.js';
import { colourEditor, HIGHLIGHT_STYLE } from './highlight.js';

const STYLE = `
:root { color-scheme: dark; }
body { margin: 0; background: #0b0d13; color: #e8ecf4;
  font: 15.5px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.learn { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }
.map { background: #0e111a; border-right: 1px solid #1e2432; padding: 20px 0 40px; overflow: auto; }
.map h1 { font-size: 15px; margin: 0 20px 4px; letter-spacing: .2px; }
.map .done { font-size: 12px; color: #7c8497; margin: 0 20px 16px; }
.map .group { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #6b7385;
  margin: 20px 20px 8px; }
.map button { display: block; width: 100%; text-align: left; border: 0; background: none;
  color: #c2c9d8; font: inherit; padding: 7px 20px; cursor: pointer; border-left: 3px solid transparent; }
.map button:hover { background: #131826; color: #fff; }
.map button.here { background: #131826; color: #fff; border-left-color: #4c8dff; }
.map button .tick { color: #7ee787; margin-right: 7px; }
.map button .tick.todo { color: #39405180; }
.page { padding: 26px 30px 60px; max-width: 900px; }
.page h2 { font-size: 23px; margin: 0 0 6px; letter-spacing: -0.01em; }
.page .about { color: #98a0b3; margin: 0 0 20px; }
.teach { color: #d6dbe7; }
.teach code { background: #171c28; padding: 1px 5px; border-radius: 5px; font-size: 13.5px;
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }
.teach pre { background: #10141e; border: 1px solid #1e2432; border-radius: 10px;
  padding: 14px 16px; overflow-x: auto; font: 13.5px/1.6 ui-monospace, Consolas, monospace; color: #cfd6e6; }
.task { background: #101a2c; border: 1px solid #22344f; border-left: 3px solid #4c8dff;
  border-radius: 10px; padding: 14px 16px; margin: 20px 0 14px; }
.task b { color: #9dc0ff; display: block; font-size: 12px; text-transform: uppercase;
  letter-spacing: .09em; margin-bottom: 5px; }
.buttons { display: flex; gap: 9px; align-items: center; margin: 12px 0; flex-wrap: wrap; }
button.act { border: 1px solid #2b3243; background: #161b27; color: #e8ecf4; font: inherit;
  padding: 8px 15px; border-radius: 9px; cursor: pointer; }
button.act:hover { border-color: #4c8dff; }
button.act.main { background: #4c8dff; border-color: #4c8dff; color: #08101f; font-weight: 600; }
button.act.next { background: #7ee787; border-color: #7ee787; color: #06210c; font-weight: 600; }
.out { background: #0d1119; border: 1px solid #232a3a; border-radius: 10px; padding: 12px 15px;
  font: 13px/1.6 ui-monospace, Consolas, monospace; white-space: pre-wrap; min-height: 42px;
  color: #cfd6e6; }
.verdict { margin-top: 12px; padding: 12px 15px; border-radius: 10px; font-size: 14.5px; }
.verdict.good { background: #102417; border: 1px solid #245d34; color: #b9f0c4; }
.verdict.hint { background: #241a10; border: 1px solid #5d4324; color: #f0dcb9; }
.verdict.wrong { background: #2a1116; border: 1px solid #6b2434; color: #ffc9d2; }
.preview { margin-top: 12px; border-radius: 10px; overflow: hidden; background: #fff; }
.preview iframe { display: block; width: 100%; height: 380px; border: 0; }
.preview canvas { display: block; width: 100%; background: #000; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
.pair pre { background: #0d1119; border: 1px solid #232a3a; border-radius: 10px; padding: 12px 14px;
  overflow: auto; max-height: 320px; font: 12px/1.55 ui-monospace, Consolas, monospace; color: #cfd6e6; }
.pair h4 { margin: 0 0 6px; font-size: 12px; color: #8f97a9; text-transform: uppercase; letter-spacing: .09em; }
.pair details { margin-bottom: 6px; }
.pair summary { cursor: pointer; color: #8f97a9; font-size: 12px; padding: 4px 0; }
.pair details[open] summary { color: #c3c9d6; }
@media (max-width: 900px) { .learn { grid-template-columns: 1fr; } .pair { grid-template-columns: 1fr; } }
`;

export function startLearning(doc, win) {
  ensureStyle(doc, STYLE + HIGHLIGHT_STYLE);
  doc.title = 'Learn Plain';

  const done = loadProgress(win);
  const state = { kind: 'lesson', index: 0, step: 0, translated: false };

  const root = doc.createElement('div');
  root.className = 'learn';
  root.innerHTML = `<div class="map"></div><div class="page"></div>`;
  doc.body.appendChild(root);
  const map = root.querySelector('.map');
  const page = root.querySelector('.page');

  // ------------------------------------------------------------ progress

  const keyOf = (kind, index, step) => `${kind}:${index}:${step}`;
  const isDone = (kind, index, step) => done.has(keyOf(kind, index, step));
  const markDone = (kind, index, step) => {
    done.add(keyOf(kind, index, step));
    saveProgress(win, done);
  };

  const codeKey = (kind, index, step) => `plain.learn.code.${keyOf(kind, index, step)}`;
  const savedCode = (kind, index, step) => {
    try { return win.localStorage.getItem(codeKey(kind, index, step)); } catch { return null; }
  };
  const saveCode = (kind, index, step, text) => {
    try { win.localStorage.setItem(codeKey(kind, index, step), text); } catch { /* private mode */ }
  };

  function projectDone(index) {
    return PROJECTS[index].steps.every((_, step) => isDone('project', index, step));
  }

  // ---------------------------------------------------------- the sidebar

  function drawMap() {
    const finished = [...done].length;
    map.innerHTML = `<h1>Learn Plain</h1><p class="done">${finished} of ${totalSteps()} steps done</p>`;

    const group = (title) => {
      const heading = doc.createElement('p');
      heading.className = 'group';
      heading.textContent = title;
      map.appendChild(heading);
    };

    group('Lessons');
    LESSONS.forEach((lesson, index) => {
      map.appendChild(mapButton(
        isDone('lesson', index, 0),
        lesson.title,
        state.kind === 'lesson' && state.index === index,
        () => go('lesson', index, 0)
      ));
    });

    group('Projects');
    PROJECTS.forEach((project, index) => {
      map.appendChild(mapButton(
        projectDone(index),
        project.title.replace('Project: ', ''),
        state.kind === 'project' && state.index === index,
        () => go('project', index, firstUndoneStep(index))
      ));
    });
  }

  function mapButton(finished, title, here, onClick) {
    const button = doc.createElement('button');
    button.className = here ? 'here' : '';
    button.innerHTML = `<span class="tick ${finished ? '' : 'todo'}">${finished ? '✓' : '○'}</span>`;
    button.appendChild(doc.createTextNode(title));
    button.addEventListener('click', onClick);
    return button;
  }

  function firstUndoneStep(index) {
    const at = PROJECTS[index].steps.findIndex((_, step) => !isDone('project', index, step));
    return at < 0 ? 0 : at;
  }

  function go(kind, index, step) {
    state.kind = kind;
    state.index = index;
    state.step = step;
    state.translated = false;
    drawMap();
    drawPage();
    win.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ the page

  function drawPage() {
    const isLesson = state.kind === 'lesson';
    const item = isLesson ? LESSONS[state.index] : PROJECTS[state.index];
    const step = isLesson ? null : item.steps[state.step];

    const heading = isLesson
      ? `<h2>${item.title}</h2>`
      : `<h2>${item.title}</h2><p class="about">${item.about} &nbsp;·&nbsp; step ${state.step + 1} of ${item.steps.length}</p>`;

    // A lesson teaches once; a project step can teach too, because some steps
    // are worth a word of explanation before you are asked to do them.
    const teaching = isLesson ? item.teach : (step.teach || '');

    page.innerHTML = `
      ${heading}
      ${teaching ? `<div class="teach">${teaching}</div>` : ''}
      <div class="task"><b>Your turn</b>${isLesson ? item.task : step.task}</div>
      <div class="editor"><textarea spellcheck="false"></textarea></div>
      <div class="buttons">
        <button class="act main" data-run>Run</button>
        <button class="act" data-check>Check my answer</button>
        <button class="act" data-translate>Translate</button>
        <button class="act" data-reset>Start over</button>
        <span style="flex:1"></span>
        <button class="act next" data-next hidden>Next</button>
      </div>
      <div class="out" data-out>Press Run to see what your program does.</div>
      <div data-verdict></div>
      <div data-preview></div>
      <div data-code></div>`;

    const editor = page.querySelector('textarea');
    const starter = (isLesson ? item.start : step.start) || carryOver();
    editor.value = savedCode(state.kind, state.index, state.step) ?? starter ?? '';

    const repaint = colourEditor(editor, doc);
    editor.addEventListener('input', () => saveCode(state.kind, state.index, state.step, editor.value));
    editor.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        event.preventDefault();
        const at = editor.selectionStart;
        editor.value = editor.value.slice(0, at) + '    ' + editor.value.slice(editor.selectionEnd);
        editor.selectionStart = editor.selectionEnd = at + 4;
      }
    });

    page.querySelector('[data-run]').addEventListener('click', () => runIt(editor.value, false));
    page.querySelector('[data-check]').addEventListener('click', () => runIt(editor.value, true));
    page.querySelector('[data-translate]').addEventListener('click', () => showTranslation(editor.value));
    page.querySelector('[data-reset]').addEventListener('click', () => {
      editor.value = starter ?? '';
      saveCode(state.kind, state.index, state.step, editor.value);
      repaint();
    });
    page.querySelector('[data-next]').addEventListener('click', nextStep);

    if (isDone(state.kind, state.index, state.step)) showNext();
  }

  // A project step carries on from the step before it.
  function carryOver() {
    if (state.kind !== 'project' || state.step === 0) return null;
    for (let step = state.step - 1; step >= 0; step--) {
      const kept = savedCode('project', state.index, step);
      if (kept) return kept;
    }
    return PROJECTS[state.index].steps[0].start || null;
  }

  function nextStep() {
    if (state.kind === 'lesson') {
      if (state.index + 1 < LESSONS.length) return go('lesson', state.index + 1, 0);
      return go('project', 0, 0);
    }
    const project = PROJECTS[state.index];
    if (state.step + 1 < project.steps.length) return go('project', state.index, state.step + 1);
    if (state.index + 1 < PROJECTS.length) return go('project', state.index + 1, 0);
    return go('lesson', 0, 0);
  }

  function showNext() {
    const button = page.querySelector('[data-next]');
    if (button) button.hidden = false;
  }

  // -------------------------------------------------------- running code

  function runIt(source, checking) {
    const out = page.querySelector('[data-out]');
    const verdict = page.querySelector('[data-verdict]');
    const preview = page.querySelector('[data-preview]');
    verdict.innerHTML = '';
    preview.textContent = '';
    stopPreview();

    const lines = [];
    const runtime = createRuntime({ onOutput: text => lines.push(text) });
    const game = installGame(runtime, { window: win, document: doc });
    const world = installWorld(runtime, { window: win, document: doc });
    const site = installWeb(runtime, { window: win, document: doc });
    const studio = installVideo(runtime, { window: win, document: doc });
    installStore(runtime, { window: win, document: doc });

    try {
      runtime.run(source, 'your-program.plain');
    } catch (error) {
      showFailure(out, verdict, error, source);
      return;
    }

    out.textContent = lines.length ? lines.join('\n') : '(nothing was shown)';
    showPreview(preview, { game, world, site, studio });

    if (!checking) return;

    const item = state.kind === 'lesson' ? LESSONS[state.index] : PROJECTS[state.index].steps[state.step];
    let result;
    try {
      result = item.check({ lines, source, runtime, game, world, site, studio, translated: state.translated });
    } catch (error) {
      result = 'I could not check that: ' + (error.message || error);
    }

    if (result === true) {
      markDone(state.kind, state.index, state.step);
      drawMap();
      say(verdict, 'good', pickPraise());
      showNext();
    } else {
      say(verdict, 'hint', result);
    }
  }

  function say(holder, kind, text) {
    holder.innerHTML = `<div class="verdict ${kind}"></div>`;
    holder.firstChild.textContent = text;
  }

  // A program that stopped: show the report, and make the line number take
  // you straight to that line in the editor.
  function showFailure(out, verdict, error, source) {
    const report = error instanceof PlainError ? error.report(source) : String(error.message || error);
    out.textContent = report;

    const line = error instanceof PlainError ? error.line : null;
    if (!line) {
      say(verdict, 'wrong', 'The program stopped. The message above says why.');
      return;
    }

    verdict.innerHTML = '<div class="verdict wrong"></div>';
    const box = verdict.firstChild;
    box.appendChild(doc.createTextNode('The program stopped at '));
    const jump = doc.createElement('button');
    jump.className = 'act';
    jump.style.padding = '2px 9px';
    jump.textContent = `line ${line}`;
    jump.addEventListener('click', () => goToLine(line));
    box.appendChild(jump);
    box.appendChild(doc.createTextNode(' - press it to go there.'));
    goToLine(line, false);
  }

  function goToLine(line, focus = true) {
    const editor = page.querySelector('textarea');
    if (!editor) return;
    const lines = editor.value.split('\n');
    const from = lines.slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
    const to = from + (lines[line - 1] || '').length;
    if (focus) editor.focus();
    editor.setSelectionRange(from, to);
    // Put the line roughly in the middle of the box.
    const lineHeight = editor.scrollHeight / Math.max(1, lines.length);
    editor.scrollTop = Math.max(0, (line - 1) * lineHeight - editor.clientHeight / 2);
  }

  const PRAISE = [
    'That works. On you go.',
    'Right - that does what it says.',
    'Good. That is the idea.',
    'Done. Next one.'
  ];
  function pickPraise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }

  // ----------------------------------------------------------- previews

  let running = null;
  function stopPreview() {
    if (running) { win.cancelAnimationFrame(running); running = null; }
  }

  function showPreview(holder, { game, world, site, studio }) {
    if (game.started) return showGame(holder, game, world);
    if (studio.started) return showFilm(holder, studio);
    if (site.pages.some(page => page.nodes.length)) return showSite(holder, site);
  }

  function showSite(holder, site) {
    const box = doc.createElement('div');
    box.className = 'preview';
    const frame = doc.createElement('iframe');
    box.appendChild(frame);
    holder.appendChild(box);
    const inside = frame.contentDocument;
    inside.open();
    inside.write('<!doctype html><meta charset="utf-8"><style>' + stylesheet(site.theme) +
      '</style><body><main class="plain-page" id="app"></main>');
    inside.close();
    site.host = { document: inside, root: inside.getElementById('app') };
    mountPage(site.pages[0], inside.getElementById('app'), inside);
  }

  function showGame(holder, game, world) {
    const box = doc.createElement('div');
    box.className = 'preview';
    const canvas = doc.createElement('canvas');
    canvas.width = game.width;
    canvas.height = game.height;
    box.appendChild(canvas);
    holder.appendChild(box);

    const in3D = world.started;
    let hud = null;
    let renderer = null;
    if (in3D) {
      renderer = createRenderer(canvas);
      hud = doc.createElement('canvas');
      hud.width = game.width;
      hud.height = game.height;
      hud.style.marginTop = '-' + (game.height * (canvas.clientWidth / game.width)) + 'px';
      hud.style.background = 'transparent';
      box.appendChild(hud);
    }
    const ctx = (hud || canvas).getContext('2d');

    // Keys reach the game only while the preview has been clicked.
    const down = event => {
      const key = keyName(event);
      if (['left', 'right', 'up', 'down', 'space'].includes(key)) event.preventDefault();
      if (!game.keys.has(key)) game.press(key);
    };
    const up = event => game.release(keyName(event));
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', down);
    canvas.addEventListener('keyup', up);
    if (hud) { hud.style.pointerEvents = 'none'; }
    canvas.addEventListener('click', () => canvas.focus());

    let last = null;
    const frame = now => {
      const seconds = last === null ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
      last = now;
      game.step(seconds);
      if (renderer) { renderer.draw(world); game.drawHud(ctx); }
      else game.draw(ctx);
      running = win.requestAnimationFrame(frame);
    };
    running = win.requestAnimationFrame(frame);

    const note = doc.createElement('p');
    note.className = 'about';
    note.textContent = 'Click the picture first, then the keys reach your game.';
    holder.appendChild(note);
  }

  function showFilm(holder, studio) {
    const list = studio.layout()
      .map(placed => `${placed.start.toFixed(1)}s  ${placed.clip.kind.padEnd(10)} ${placed.clip.text || placed.clip.source || placed.clip.color}`)
      .join('\n');
    const box = doc.createElement('div');
    box.className = 'out';
    box.style.marginTop = '12px';
    box.textContent = `"${studio.title}" - ${studio.clips.length} clips, ${studio.length.toFixed(1)} seconds\n\n${list}`;
    holder.appendChild(box);
  }

  // -------------------------------------------------------- translation

  function showTranslation(source) {
    const holder = page.querySelector('[data-code]');
    holder.textContent = '';
    const runtime = createRuntime({});
    installGame(runtime, {});
    installWorld(runtime, {});
    installWeb(runtime, {});
    installVideo(runtime, {});
    installStore(runtime, {});

    let program;
    try {
      program = runtime.parse(source, 'your-program.plain');
    } catch (error) {
      showFailure(page.querySelector('[data-out]'), page.querySelector('[data-verdict]'), error, source);
      return;
    }

    const pair = doc.createElement('div');
    pair.className = 'pair';
    for (const target of targetNames()) {
      const column = doc.createElement('div');
      let code;
      try {
        code = translate(program, target, { file: 'your-program.plain' }).code;
      } catch (error) {
        code = (error.plainMessage || error.message || String(error));
      }
      const title = doc.createElement('h4');
      title.textContent = target;
      column.appendChild(title);

      // Rust and C carry a runtime much longer than the program. Showing it
      // first would bury the thing you came to look at, so it is folded up
      // with a note saying how long it is - open it if you want it.
      const split = code.indexOf(PROGRAM_STARTS);
      if (split >= 0) {
        const ends = code.indexOf('\n', split) + 1;
        const runtime = code.slice(0, ends);
        const fold = doc.createElement('details');
        const label = doc.createElement('summary');
        label.textContent = `the ${target} runtime underneath - ${runtime.split('\n').length} lines`;
        const held = doc.createElement('pre');
        held.textContent = runtime;
        fold.appendChild(label);
        fold.appendChild(held);
        column.appendChild(fold);
        code = code.slice(ends).replace(/^\n+/, '');
      }

      const block = doc.createElement('pre');
      block.textContent = code;
      column.appendChild(block);
      pair.appendChild(column);
    }
    holder.appendChild(pair);
    state.translated = true;
  }

  drawMap();
  drawPage();
  return { go, state };
}

const KEY_NAMES = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Left: 'left', Right: 'right', Up: 'up', Down: 'down',
  ' ': 'space', Spacebar: 'space', Escape: 'escape', Enter: 'enter'
};

function keyName(event) {
  return KEY_NAMES[event.key] || String(event.key).toLowerCase();
}

function loadProgress(win) {
  try {
    return new Set(JSON.parse(win.localStorage.getItem('plain.learn.done') || '[]'));
  } catch {
    return new Set();
  }
}

function saveProgress(win, done) {
  try {
    win.localStorage.setItem('plain.learn.done', JSON.stringify([...done]));
  } catch { /* private mode: progress just will not stick */ }
}

function ensureStyle(doc, css) {
  const style = doc.createElement('style');
  style.textContent = css;
  doc.head.appendChild(style);
}

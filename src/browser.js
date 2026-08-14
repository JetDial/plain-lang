// Plain - running in a browser.
// Handles both kinds of program: if it started a game we open a canvas and
// run frames; if it built a website we render the page.

import { createRuntime } from './runtime.js';
import { PlainError } from './errors.js';
import { installGame } from '../engines/game/engine.js';
import { installWeb, THEMES } from '../engines/web/engine.js';
import { mountPage, stylesheet, hrefFor } from '../engines/web/render.js';

const KEY_NAMES = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Left: 'left', Right: 'right', Up: 'up', Down: 'down', Esc: 'escape',
  ' ': 'space', Spacebar: 'space', Escape: 'escape', Enter: 'enter',
  Shift: 'shift', Control: 'control', Alt: 'alt', Tab: 'tab', Backspace: 'backspace'
};

export function keyName(event) {
  const key = event.key;
  if (KEY_NAMES[key]) return KEY_NAMES[key];
  return String(key).toLowerCase();
}

export function startPlain(source, options = {}) {
  const doc = options.document || document;
  const win = options.window || window;
  const host = { window: win, document: doc };

  const runtime = createRuntime({ onOutput: text => console.log(text) });
  const game = installGame(runtime, host);
  const site = installWeb(runtime, host);

  try {
    runtime.run(source, options.file || 'program.plain');
  } catch (error) {
    showError(doc, error, source);
    return { runtime, game, site, ok: false };
  }

  if (game.started) startGame(game, doc, win, source);
  else startSite(site, doc, win);

  const running = { runtime, game, site, ok: true };
  // Handy when poking at a program from the browser console.
  win.plain = running;
  return running;
}

// ------------------------------------------------------------------- games

function startGame(game, doc, win, source) {
  doc.title = game.title;
  ensureStyle(doc, gameStyle());

  let canvas = doc.getElementById('plain-canvas');
  if (!canvas) {
    canvas = doc.createElement('canvas');
    canvas.id = 'plain-canvas';
    const stage = doc.createElement('div');
    stage.className = 'plain-stage';
    stage.appendChild(canvas);
    doc.body.appendChild(stage);
  }
  canvas.width = game.width;
  canvas.height = game.height;
  const ctx = canvas.getContext('2d');

  game.onError = error => showError(doc, error, source);

  win.addEventListener('keydown', event => {
    const name = keyName(event);
    if (['left', 'right', 'up', 'down', 'space'].includes(name)) event.preventDefault();
    if (!game.keys.has(name)) game.press(name);
    else game.keys.add(name);
  });
  win.addEventListener('keyup', event => game.release(keyName(event)));

  const toGame = event => {
    const box = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) * (game.width / box.width),
      y: (event.clientY - box.top) * (game.height / box.height)
    };
  };
  canvas.addEventListener('mousemove', event => { Object.assign(game.mouse, toGame(event)); });
  canvas.addEventListener('mousedown', event => {
    Object.assign(game.mouse, toGame(event));
    game.mouse.down = true;
    for (const rule of game.clicks) game.safely(rule.run);
  });
  win.addEventListener('mouseup', () => { game.mouse.down = false; });

  let last = null;
  const frame = now => {
    const seconds = last === null ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
    last = now;
    game.step(seconds);
    game.draw(ctx);
    win.requestAnimationFrame(frame);
  };
  game.running = true;
  win.requestAnimationFrame(frame);
}

function gameStyle() {
  return `
body { margin: 0; background: #0b0c10; display: grid; place-items: center; min-height: 100vh;
       font: 16px ui-sans-serif, system-ui, sans-serif; color: #e8ecf4; }
.plain-stage { padding: 18px; }
#plain-canvas { max-width: 100vw; max-height: 100vh; border-radius: 10px; box-shadow: 0 18px 60px rgba(0,0,0,.55); }
`.trim();
}

// ----------------------------------------------------------------- websites

function startSite(site, doc, win) {
  // The program may have finished on any page; show the one this address
  // asks for, and the first page otherwise.
  const asked = ((win.location && win.location.pathname) || '/').replace(/^\//, '') || 'index.html';
  site.current = site.pages.find(page => hrefFor(page.path) === asked) || site.pages[0];

  doc.title = site.current.name === site.title ? site.title : `${site.current.name} - ${site.title}`;
  ensureStyle(doc, stylesheet(site.theme));

  let root = doc.getElementById('plain-app');
  if (!root) {
    root = doc.createElement('main');
    root.id = 'plain-app';
    root.className = 'plain-page';
    doc.body.appendChild(root);
  }
  root.className = 'plain-page';
  site.host.root = root;

  if (site.pages.length > 1) buildNav(site, doc, root);
  mountPage(site.current, root, doc);
  for (const run of site.onLoad) run();
}

function buildNav(site, doc, root) {
  const existing = doc.querySelector('.plain-nav');
  if (existing) existing.remove();
  const nav = doc.createElement('nav');
  nav.className = 'plain-nav';
  const title = doc.createElement('strong');
  title.textContent = site.title;
  nav.appendChild(title);
  for (const page of site.pages) {
    const link = doc.createElement('a');
    link.href = '#';
    link.textContent = page.name;
    if (page === site.current) link.className = 'here';
    link.addEventListener('click', event => {
      event.preventDefault();
      site.current = page;
      buildNav(site, doc, root);
      mountPage(page, root, doc);
      doc.title = `${page.name} - ${site.title}`;
    });
    nav.appendChild(link);
  }
  root.parentNode.insertBefore(nav, root);
}

// -------------------------------------------------------------------- oops

export function showError(doc, error, source) {
  const message = error instanceof PlainError ? error.report(source) : String(error && error.message || error);
  console.error(message);
  ensureStyle(doc, `
.plain-error { position: fixed; inset: auto 16px 16px 16px; max-width: 720px; margin: 0 auto;
  background: #2b0f14; color: #ffd7dd; border: 1px solid #7a2436; border-radius: 12px;
  padding: 16px 18px; font: 14px/1.6 ui-monospace, Consolas, monospace; white-space: pre-wrap; z-index: 99; }
`);
  const box = doc.createElement('div');
  box.className = 'plain-error';
  box.textContent = message;
  doc.body.appendChild(box);
}

function ensureStyle(doc, css) {
  const style = doc.createElement('style');
  style.textContent = css;
  doc.head.appendChild(style);
}

// Run any <script type="text/plain-lang"> blocks on the page automatically.
export function autoStart() {
  if (typeof document === 'undefined') return;
  const run = () => {
    const blocks = document.querySelectorAll('script[type="text/plain-lang"]');
    for (const block of blocks) startPlain(block.textContent || '');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}

export { THEMES, createRuntime, installGame, installWeb };

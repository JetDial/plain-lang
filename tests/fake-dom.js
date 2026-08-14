// Plain - a very small stand-in for a browser.
//
// The designer, the video studio and the course are real programs, and until
// now they were only ever checked by hand. There is no browser in the test
// run and no way to install one, so this is enough of a document for those
// three to build themselves, be clicked, and be asked what they did.
//
// It is deliberately small: only what those pages actually use. Anything
// they reach for that is missing will throw, which is the point - the test
// then says so instead of passing quietly.

const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);

class ClassList {
  constructor(node) { this.node = node; }
  get names() { return String(this.node.attrs.class || '').split(/\s+/).filter(Boolean); }
  add(...names) {
    const all = new Set(this.names);
    for (const name of names) all.add(name);
    this.node.attrs.class = [...all].join(' ');
  }
  remove(...names) {
    this.node.attrs.class = this.names.filter(name => !names.includes(name)).join(' ');
  }
  contains(name) { return this.names.includes(name); }
  toggle(name) { this.contains(name) ? this.remove(name) : this.add(name); }
}

export class FakeNode {
  constructor(tag, doc) {
    this.tag = String(tag).toLowerCase();
    this.doc = doc;
    this.attrs = {};
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = {};
    this.text = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.scrollHeight = 100;
    this.clientHeight = 100;
    this.clientWidth = 600;
    this.classList = new ClassList(this);
  }

  // ------------------------------------------------------------ the basics

  get children() { return this.childNodes.filter(child => child instanceof FakeNode); }
  get className() { return this.attrs.class || ''; }
  set className(value) { this.attrs.class = value; }
  get id() { return this.attrs.id || ''; }
  set id(value) { this.attrs.id = value; }

  get dataset() {
    const out = {};
    for (const [key, value] of Object.entries(this.attrs)) {
      if (key.startsWith('data-')) {
        out[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      }
    }
    return out;
  }

  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  hasAttribute(name) { return name in this.attrs; }

  get textContent() {
    if (this.text) return this.text;
    return this.childNodes.map(child => (child instanceof FakeNode ? child.textContent : String(child))).join('');
  }

  set textContent(value) {
    this.childNodes = [];
    this.text = String(value ?? '');
  }

  get innerHTML() { return this.childNodes.map(child => serialise(child)).join(''); }

  set innerHTML(html) {
    this.childNodes = [];
    this.text = '';
    for (const child of parseHTML(String(html ?? ''), this.doc)) this.appendChild(child);
  }

  appendChild(child) {
    if (this.text) { this.childNodes.push(this.text); this.text = ''; }
    // A text node is just a string here.
    if (!(child instanceof FakeNode)) { this.childNodes.push(String(child)); return child; }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child, before) {
    const at = this.childNodes.indexOf(before);
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    if (at < 0) this.childNodes.push(child);
    else this.childNodes.splice(at, 0, child);
    return child;
  }

  removeChild(child) {
    const at = this.childNodes.indexOf(child);
    if (at >= 0) this.childNodes.splice(at, 1);
    child.parentNode = null;
    return child;
  }

  remove() { if (this.parentNode) this.parentNode.removeChild(this); }

  get firstChild() { return this.childNodes[0] ?? null; }

  cloneNode() {
    const copy = new FakeNode(this.tag, this.doc);
    copy.attrs = { ...this.attrs };
    copy.text = this.text;
    copy.value = this.value;
    return copy;
  }

  // ------------------------------------------------------------- searching

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

  querySelectorAll(selector) {
    const found = [];
    for (const part of String(selector).split(',')) {
      for (const node of matchAll(this, part.trim())) {
        if (!found.includes(node)) found.push(node);
      }
    }
    return found;
  }

  // -------------------------------------------------------------- events

  addEventListener(name, run) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(run);
  }

  removeEventListener(name, run) {
    const all = this.listeners.get(name) || [];
    const at = all.indexOf(run);
    if (at >= 0) all.splice(at, 1);
  }

  dispatchEvent(event) {
    const listeners = this.listeners.get(event.type) || [];
    const shaped = { preventDefault() {}, stopPropagation() {}, currentTarget: this, target: this, ...event };
    for (const run of listeners.slice()) run(shaped);
    return true;
  }

  click() { this.dispatchEvent({ type: 'click' }); }
  focus() { this.doc.activeElement = this; }
  blur() {}
  setSelectionRange(from, to) { this.selectionStart = from; this.selectionEnd = to; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }

  // ------------------------------------------------------------- canvases

  getContext(kind) {
    if (kind !== '2d') return null;
    if (!this._context) this._context = fakeContext(this);
    return this._context;
  }

  get contentDocument() {
    // An iframe carries a document of its own.
    if (this.tag !== 'iframe') return null;
    if (!this._inside) this._inside = new FakeDocument();
    return this._inside;
  }
}

export class FakeDocument {
  constructor() {
    this.title = '';
    this.head = new FakeNode('head', this);
    this.body = new FakeNode('body', this);
    this.activeElement = null;
    this.readyState = 'complete';
  }

  createElement(tag) { return new FakeNode(tag, this); }
  createTextNode(text) { return String(text); }
  querySelector(selector) { return this.body.querySelector(selector) || this.head.querySelector(selector); }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
  getElementById(id) { return this.body.querySelector('#' + id); }
  addEventListener() {}
  open() { this.body = new FakeNode('body', this); this.head = new FakeNode('head', this); }

  // Enough of document.write for a page written in one go, which is how the
  // designer fills its preview frame.
  write(html) {
    const text = String(html).replace(/<!doctype[^>]*>/gi, '');
    for (const node of parseHTML(text, this)) {
      if (!(node instanceof FakeNode)) continue;
      if (node.tag === 'body') { for (const child of node.children) this.body.appendChild(child); }
      else if (node.tag === 'style' || node.tag === 'meta' || node.tag === 'title') this.head.appendChild(node);
      else this.body.appendChild(node);
    }
  }

  close() {}
}

export class FakeWindow {
  constructor() {
    this.document = new FakeDocument();
    this.location = { pathname: '/' };
    this.listeners = new Map();
    this.frames = [];
    const shelf = new Map();
    this.localStorage = {
      getItem: (key) => (shelf.has(key) ? shelf.get(key) : null),
      setItem: (key, value) => shelf.set(key, String(value)),
      removeItem: (key) => shelf.delete(key),
      clear: () => shelf.clear(),
      get length() { return shelf.size; },
      key: (at) => [...shelf.keys()][at] ?? null
    };
  }

  addEventListener(name, run) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(run);
  }

  removeEventListener(name, run) {
    const all = this.listeners.get(name) || [];
    const at = all.indexOf(run);
    if (at >= 0) all.splice(at, 1);
  }

  press(name, extra = {}) {
    for (const run of this.listeners.get(name) || []) {
      run({ preventDefault() {}, stopPropagation() {}, ...extra });
    }
  }

  // Frames are collected rather than run, so a test decides when time moves.
  requestAnimationFrame(run) { this.frames.push(run); return this.frames.length; }
  cancelAnimationFrame() {}
  scrollTo() {}
  prompt() { return null; }
}

// --------------------------------------------------------------- matching

function matchAll(root, selector) {
  const parts = selector.split(/\s+/).filter(Boolean);
  let level = [root];
  for (const part of parts) {
    const next = [];
    for (const node of level) {
      for (const found of descendants(node)) {
        if (matches(found, part) && !next.includes(found)) next.push(found);
      }
    }
    level = next;
  }
  return level;
}

function* descendants(node) {
  for (const child of node.children) {
    yield child;
    yield* descendants(child);
  }
}

function matches(node, selector) {
  const bits = selector.match(/^([a-z0-9-]+)?((?:[.#][A-Za-z0-9_-]+|\[[^\]]+\])*)$/i);
  if (!bits) return false;
  const [, tag, rest = ''] = bits;
  if (tag && node.tag !== tag.toLowerCase()) return false;
  for (const piece of rest.match(/[.#][A-Za-z0-9_-]+|\[[^\]]+\]/g) || []) {
    if (piece.startsWith('.') && !node.classList.contains(piece.slice(1))) return false;
    if (piece.startsWith('#') && node.id !== piece.slice(1)) return false;
    if (piece.startsWith('[')) {
      const inner = piece.slice(1, -1);
      const at = inner.indexOf('=');
      if (at < 0) { if (!node.hasAttribute(inner)) return false; }
      else {
        const name = inner.slice(0, at);
        const want = inner.slice(at + 1).replace(/^["']|["']$/g, '');
        if (node.getAttribute(name) !== want) return false;
      }
    }
  }
  return true;
}

// ------------------------------------------------------------ tiny parsing
// Only what these pages produce: tags, attributes, text, self-closing tags.

export function parseHTML(html, doc) {
  const out = [];
  const stack = [];
  const push = (node) => {
    if (stack.length) stack[stack.length - 1].appendChild(node);
    else out.push(node);
  };

  let at = 0;
  while (at < html.length) {
    const open = html.indexOf('<', at);
    if (open < 0) {
      addText(html.slice(at));
      break;
    }
    if (open > at) addText(html.slice(at, open));

    const close = html.indexOf('>', open);
    if (close < 0) { addText(html.slice(open)); break; }
    const inside = html.slice(open + 1, close).trim();
    at = close + 1;

    if (inside.startsWith('/')) {
      const tag = inside.slice(1).trim().toLowerCase();
      while (stack.length && stack[stack.length - 1].tag !== tag) stack.pop();
      stack.pop();
      continue;
    }

    const selfClosing = inside.endsWith('/');
    const body = selfClosing ? inside.slice(0, -1).trim() : inside;
    const space = body.search(/\s/);
    const tag = (space < 0 ? body : body.slice(0, space)).toLowerCase();
    const node = new FakeNode(tag, doc);
    if (space >= 0) readAttributes(node, body.slice(space + 1));
    push(node);
    if (!selfClosing && !VOID_TAGS.has(tag)) stack.push(node);
  }

  function addText(text) {
    const clean = unescapeHTML(text);
    if (!clean) return;
    if (stack.length) {
      const holder = stack[stack.length - 1];
      holder.text = (holder.text || '') + clean;
    } else if (clean.trim()) {
      out.push(clean);
    }
  }

  return out;
}

function readAttributes(node, text) {
  const pattern = /([A-Za-z_:@-][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let found;
  while ((found = pattern.exec(text))) {
    const name = found[1];
    const value = found[3] ?? found[4] ?? found[5] ?? '';
    node.attrs[name] = value;
    if (name === 'value') node.value = value;
    if (name === 'hidden') node.hidden = true;
    if (name === 'disabled') node.disabled = true;
    if (name === 'selected') node.selected = true;
  }
}

function unescapeHTML(text) {
  return String(text)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function serialise(node) {
  if (!(node instanceof FakeNode)) return String(node);
  const attrs = Object.entries(node.attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
  if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs}>`;
  return `<${node.tag}${attrs}>${node.textContent}</${node.tag}>`;
}

// A canvas that remembers what was asked of it, so a test can check that
// something was actually drawn.
function fakeContext(canvas) {
  const calls = [];
  const record = (name) => (...args) => { calls.push({ name, args }); };
  return {
    canvas,
    calls,
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineWidth: 1,
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    clearRect: record('clearRect'),
    fillText: record('fillText'),
    drawImage: record('drawImage'),
    measureText: (text) => ({ width: String(text).length * 8 })
  };
}

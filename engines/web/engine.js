// Plain - the website engine.
//
//     make a website called "My Site"
//     set the theme to "dark"
//     add a title "Hello"
//     add text "This page was written in Plain."
//     add a button "Say hi"
//         show a message "Hi!"
//     end
//
// The program builds a description of the site. `plain build` turns that
// description into HTML files; in a browser the same description becomes
// real elements with working buttons.

import { toText, toNumber, truthy } from '../../src/values.js';
import { mountPage, THEMES } from './render.js';

export class Page {
  constructor(name, path) {
    this.name = name;
    this.path = path;
    this.nodes = [];
  }
}

export class Site {
  constructor() {
    this.title = 'A Plain website';
    this.theme = 'light';
    this.pages = [];
    this.styles = [];              // CSS the program added itself
    this.scripts = [];             // JavaScript the program added itself
    this.byName = new Map();
    this.onLoad = [];
    this.host = {};
    this.current = this.page('Home', '/');
  }

  page(name, path) {
    const existing = this.pages.find(p => p.path === path);
    if (existing) return existing;
    const page = new Page(name, path);
    this.pages.push(page);
    return page;
  }

  // Nodes are added to whichever container block we are inside.
  get target() {
    return this.stack && this.stack.length ? this.stack[this.stack.length - 1].children : this.current.nodes;
  }

  add(kind, props = {}, name = null) {
    const node = { kind, props, children: [], name };
    this.target.push(node);
    if (name) this.byName.set(String(name).toLowerCase(), node);
    return node;
  }

  find(name) {
    return this.byName.get(String(name).toLowerCase()) || null;
  }

  // Redraw after something changed (browser only).
  refresh() {
    if (this.host.document && this.host.root) mountPage(this.current, this.host.root, this.host.document);
  }

  // The whole site written back out as Plain sentences. The designer saves
  // this, so a site built by dragging and a site typed by hand are the same
  // kind of file.
  toPlainSource() {
    const lines = [`make a website called ${quote(this.title)}`];
    if (this.theme !== 'light') lines.push(`set the theme to ${quote(this.theme)}`);
    for (const css of this.styles) lines.push(`add style ${literal(css)}`);
    for (const js of this.scripts) lines.push(`add script ${literal(js)}`);

    this.pages.forEach((page, index) => {
      lines.push('');
      if (index > 0) lines.push(`make a page called ${quote(page.name)} at ${quote(page.path)}`);
      for (const node of page.nodes) lines.push(...nodeToPlain(node, ''));
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  }
}

const KIND_SENTENCE = {
  title: text => `add a title ${quote(text)}`,
  heading: text => `add a heading ${quote(text)}`,
  'small-heading': text => `add a small heading ${quote(text)}`,
  text: text => `add text ${quote(text)}`,
  note: text => `add a note ${quote(text)}`,
  quote: text => `add a quote ${quote(text)}`,
  code: text => `add code ${quote(text)}`,
  footer: text => `add a footer ${quote(text)}`
};

function nodeToPlain(node, indent) {
  const props = node.props || {};
  const named = node.name ? ` named ${node.name}` : '';
  const simple = KIND_SENTENCE[node.kind];
  if (simple) return [indent + simple(props.text ?? '') + named];

  switch (node.kind) {
    case 'space': return [indent + 'add a space'];
    case 'html': return [indent + 'add html ' + literal(props.text || '') + named];
    case 'markdown': return [indent + 'add markdown ' + literal(props.text || '') + named];
    case 'link': return [indent + `add a link ${quote(props.text)} to ${quote(props.url)}`];
    case 'picture':
      return [indent + (props.alt
        ? `add a picture ${quote(props.url)} with words ${quote(props.alt)}`
        : `add a picture ${quote(props.url)}`)];
    case 'list':
      return [indent + `add a list of ${(props.items || []).map(quote).join(', ')}`];
    case 'field':
      return [indent + `add a ${props.big ? 'big ' : ''}text box named ${node.name || 'answer'} with label ${quote(props.label || '')}`];
    case 'button': {
      const body = String(props.source || 'show a message "Hello"')
        .split('\n')
        .map(line => indent + '    ' + line.trim())
        .filter(line => line.trim());
      return [indent + `add a button ${quote(props.text)}`, ...body, indent + 'end'];
    }
    case 'card': {
      const [first, ...rest] = node.children || [];
      const titled = first && first.kind === 'small-heading';
      const open = titled
        ? indent + `add a card called ${quote(first.props.text)}`
        : indent + 'add a card';
      const inside = (titled ? rest : node.children || []).flatMap(child => nodeToPlain(child, indent + '    '));
      return [open, ...inside, indent + 'end'];
    }
    case 'row': {
      const inside = (node.children || []).flatMap(child => nodeToPlain(child, indent + '    '));
      return [indent + 'add a row', ...inside, indent + 'end'];
    }
    default:
      return [indent + `add text ${quote(props.text || '')}`];
  }
}

export function quote(text) {
  // Braces are escaped too, or text written back out would be read as
  // something to fill in.
  return '"' + String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}') + '"';
}

// Style and markup go back in single quotes, which Plain takes exactly as
// they are - much kinder to CSS, which is mostly braces.
export function literal(text) {
  return "'" + String(text ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

export function installWeb(rt, host = {}) {
  if (rt.libraries.has('web')) return rt.site;
  rt.libraries.add('web');

  const site = new Site();
  site.stack = [];
  site.host = host;
  rt.site = site;

  const container = (kind, props, ctx) => {
    const node = site.add(kind, props);
    site.stack.push(node);
    try { ctx.block(); } finally { site.stack.pop(); }
    return node;
  };

  // ------------------------------------------------------------- the site

  rt.define('make a website called $title', (a) => { site.title = toText(a.title); site.current.name = toText(a.title); });

  rt.define('set the theme to $theme', (a, ctx) => {
    const theme = toText(a.theme).toLowerCase();
    if (!THEMES[theme]) ctx.fail(`"${theme}" is not a theme. Try: ${Object.keys(THEMES).join(', ')}`);
    site.theme = theme;
  });

  rt.define('make a page called $name at $path', (a) => {
    const path = normalisePath(toText(a.path));
    site.current = site.page(toText(a.name), path);
  });

  rt.define('make a page called $name', (a) => {
    const name = toText(a.name);
    site.current = site.page(name, normalisePath('/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-')));
  });

  rt.define('work on the page called $name', (a, ctx) => {
    const page = site.pages.find(p => p.name.toLowerCase() === toText(a.name).toLowerCase());
    if (!page) ctx.fail(`There is no page called "${toText(a.name)}"`);
    site.current = page;
  });

  // ------------------------------------------------------------------ text

  rt.define('add a title $text', (a) => void site.add('title', { text: toText(a.text) }));
  rt.define('add a title $text named #id', (a) => void site.add('title', { text: toText(a.text) }, a.id));
  rt.define('add a heading $text', (a) => void site.add('heading', { text: toText(a.text) }));
  rt.define('add a heading $text named #id', (a) => void site.add('heading', { text: toText(a.text) }, a.id));
  rt.define('add a small heading $text', (a) => void site.add('small-heading', { text: toText(a.text) }));
  rt.define('add text $text', (a) => void site.add('text', { text: toText(a.text) }));
  rt.define('add text $text named #id', (a) => void site.add('text', { text: toText(a.text) }, a.id));
  rt.define('add a note $text', (a) => void site.add('note', { text: toText(a.text) }));
  rt.define('add a quote $text', (a) => void site.add('quote', { text: toText(a.text) }));
  rt.define('add code $text', (a) => void site.add('code', { text: toText(a.text) }));
  rt.define('add a space', () => void site.add('space'));

  // ------------------------------------------- your own HTML and CSS
  // Plain writes the page for you, but sometimes you already know the
  // markup you want, or you have some styling to paste in.

  rt.define('add html $text', (a) => void site.add('html', { text: toText(a.text) }));
  rt.define('add html $text named #id', (a) => void site.add('html', { text: toText(a.text) }, a.id));

  rt.define('add style $text', (a) => { site.styles.push(clean(toText(a.text))); });

  // Markdown: the marks people already type. Written by the author, but
  // turned into markup rather than passed through, so a stray < stays a <.
  rt.define('add markdown $text', (a) => void site.add('markdown', { text: toText(a.text) }));
  rt.define('add markdown $text named #id', (a) => void site.add('markdown', { text: toText(a.text) }, a.id));

  // JavaScript, for the corners a sentence has not reached yet.
  rt.define('add script $text', (a) => { site.scripts.push(clean(toText(a.text))); });

  rt.define('set the page background to $color', (a) => {
    site.styles.push(`body { background: ${clean(toText(a.color))}; }`);
  });

  rt.define('set the text colour to $color', (a) => {
    site.styles.push(`body { color: ${clean(toText(a.color))}; }`);
  });

  rt.define('set the text color to $color', (a) => {
    site.styles.push(`body { color: ${clean(toText(a.color))}; }`);
  });

  rt.define('set the font to $font', (a) => {
    site.styles.push(`body { font-family: ${clean(toText(a.font))}; }`);
  });

  rt.define('set the page width to $width', (a) => {
    site.styles.push(`.plain-page { max-width: ${Math.round(toNumber(a.width))}px; }`);
  });

  // Anything on the page that was given a name can be styled by that name.
  rt.define('style #id with $css', (a) => {
    site.styles.push(`[data-plain-name="${clean(String(a.id))}"] { ${clean(toText(a.css))} }`);
  });
  rt.define('add a footer $text', (a) => void site.add('footer', { text: toText(a.text) }));

  // ------------------------------------------------------------ list, media

  rt.define('add a list of $*items', (a) => {
    let items = Array.isArray(a.items) ? a.items : [a.items];
    // "add a list of things" where things is already a list.
    if (items.length === 1 && Array.isArray(items[0])) items = items[0];
    site.add('list', { items: items.map(v => toText(v)) });
  });

  rt.define('add a picture $url', (a) => void site.add('picture', { url: toText(a.url) }));
  rt.define('add a picture $url with words $alt', (a) =>
    void site.add('picture', { url: toText(a.url), alt: toText(a.alt) }));

  rt.define('add a link $text to $url', (a) =>
    void site.add('link', { text: toText(a.text), url: toText(a.url) }));

  // ------------------------------------------------------------ interaction

  rt.define('add a button $text ...', (a, ctx) => {
    const run = ctx.block;
    site.add('button', {
      text: toText(a.text),
      click: () => { run(); site.refresh(); },
      // Kept so the designer can write the button back out unchanged.
      source: ctx.blockSource ? ctx.blockSource() : ''
    });
  });

  rt.define('add a text box named #id with label $label', (a) =>
    void site.add('field', { label: toText(a.label), value: '' }, a.id));

  rt.define('add a big text box named #id with label $label', (a) =>
    void site.add('field', { label: toText(a.label), value: '', big: true }, a.id));

  rt.defineValue('typed in #id', (a, ctx) => {
    const node = site.find(a.id);
    if (!node) ctx.fail(`There is no text box named "${a.id}"`);
    const input = node.element && node.element.querySelector ? node.element.querySelector('input, textarea') : null;
    if (input) node.props.value = input.value;
    return node.props.value || '';
  });

  rt.define('set the words of #id to $value', (a, ctx) => {
    const node = site.find(a.id);
    if (!node) ctx.fail(`There is nothing named "${a.id}" on this page`);
    if (node.kind === 'field') node.props.value = toText(a.value);
    else node.props.text = toText(a.value);
    if (node.element) {
      if (node.kind === 'field') {
        const input = node.element.querySelector('input, textarea');
        if (input) input.value = toText(a.value);
      } else {
        node.element.textContent = toText(a.value);
      }
    }
  });

  rt.define('show a message $text', (a) => {
    const text = toText(a.text);
    if (host.document) showToast(host.document, text);
    else rt.output(text);
  });

  rt.define('when the page loads ...', (a, ctx) => { site.onLoad.push(ctx.block); });

  // -------------------------------------------------------------- grouping

  rt.define('add a card ...', (a, ctx) => void container('card', {}, ctx));
  rt.define('add a card called $title ...', (a, ctx) => {
    const node = container('card', {}, ctx);
    node.children.unshift({ kind: 'small-heading', props: { text: toText(a.title) }, children: [] });
  });
  rt.define('add a row ...', (a, ctx) => void container('row', {}, ctx));

  // Handy for building pages from data.
  rt.defineValue('page count', () => site.pages.length);

  return site;
}

function normalisePath(path) {
  const clean = String(path).trim();
  if (!clean || clean === '/') return '/';
  return '/' + clean.replace(/^\/+/, '').replace(/\/+$/, '');
}

function showToast(document, text) {
  const note = document.createElement('div');
  note.className = 'plain-message';
  note.textContent = text;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 2600);
}

export { THEMES };

// Nothing in a style may close the block it sits in.
// Style and script live inside a block that a stray closing tag would end
// early, taking the rest of the page with it. A backslash keeps the tag
// harmless without changing what the CSS or the JavaScript means.
function clean(text) {
  return String(text)
    .replace(/<\/style/gi, '<\\/style')
    .replace(/<\/script/gi, '<\\/script');
}

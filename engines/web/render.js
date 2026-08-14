// Plain - website rendering.
// One page description, two outputs: an HTML string (for `plain build`) and
// real DOM nodes (for the browser, where buttons actually work).

import { markdownToHTML } from './markdown.js';

export const THEMES = {
  light: { bg: '#f7f7fb', card: '#ffffff', ink: '#16181d', soft: '#5b616e', line: '#e4e6ec', tint: '#2f6df6', tintInk: '#ffffff' },
  dark: { bg: '#0f1117', card: '#171a22', ink: '#eef0f6', soft: '#a3a9b8', line: '#272b36', tint: '#6c8cff', tintInk: '#0f1117' },
  ocean: { bg: '#071a24', card: '#0d2b3a', ink: '#e7f6ff', soft: '#9dc4d6', line: '#14455c', tint: '#31c8c0', tintInk: '#04222c' },
  forest: { bg: '#f3f7f1', card: '#ffffff', ink: '#17251a', soft: '#4f6154', line: '#dde7dd', tint: '#2f7d4f', tintInk: '#ffffff' },
  sunset: { bg: '#1b1020', card: '#291733', ink: '#ffeef6', soft: '#d3aec6', line: '#402350', tint: '#ff7a59', tintInk: '#2a0f18' }
};

export function stylesheet(themeName = 'light') {
  const theme = THEMES[themeName] || THEMES.light;
  return `
:root {
  --bg: ${theme.bg};
  --card: ${theme.card};
  --ink: ${theme.ink};
  --soft: ${theme.soft};
  --line: ${theme.line};
  --tint: ${theme.tint};
  --tint-ink: ${theme.tintInk};
  --radius: 14px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 17px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.plain-page { max-width: 760px; margin: 0 auto; padding: 56px 22px 96px; }
.plain-nav {
  display: flex; flex-wrap: wrap; gap: 18px; align-items: center;
  padding: 16px 22px; border-bottom: 1px solid var(--line); background: var(--card);
}
.plain-nav strong { font-size: 16px; letter-spacing: .2px; }
.plain-nav a { color: var(--soft); text-decoration: none; font-size: 15px; }
.plain-nav a:hover, .plain-nav a.here { color: var(--tint); }
h1.plain-title { font-size: clamp(30px, 5vw, 44px); line-height: 1.15; margin: 0 0 18px; letter-spacing: -0.02em; }
h2.plain-heading { font-size: clamp(22px, 3.4vw, 28px); margin: 40px 0 12px; letter-spacing: -0.01em; }
h3.plain-small-heading { font-size: 19px; margin: 28px 0 8px; }
p.plain-text { margin: 0 0 16px; }
p.plain-note { color: var(--soft); font-size: 15px; margin: 0 0 16px; }
blockquote.plain-quote {
  margin: 22px 0; padding: 4px 0 4px 18px;
  border-left: 3px solid var(--tint); color: var(--soft); font-style: italic;
}
pre.plain-code {
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 16px 18px; overflow-x: auto; font: 14px/1.6 ui-monospace, "Cascadia Code", Consolas, monospace;
}
ul.plain-list { padding-left: 22px; margin: 0 0 18px; }
ul.plain-list li { margin: 6px 0; }
a.plain-link { color: var(--tint); text-underline-offset: 3px; }
img.plain-picture { max-width: 100%; border-radius: var(--radius); display: block; margin: 20px 0; }
button.plain-button {
  appearance: none; border: 0; cursor: pointer;
  background: var(--tint); color: var(--tint-ink);
  font: inherit; font-weight: 600; padding: 11px 20px; border-radius: 999px;
  margin: 0 10px 12px 0; transition: transform .08s ease, filter .15s ease;
}
button.plain-button:hover { filter: brightness(1.07); }
button.plain-button:active { transform: translateY(1px); }
.plain-card {
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 22px 24px; margin: 18px 0;
}
.plain-card > :first-child { margin-top: 0; }
.plain-row { display: flex; flex-wrap: wrap; gap: 18px; margin: 18px 0; }
.plain-row > * { flex: 1 1 220px; margin: 0; }
.plain-space { height: 1px; background: var(--line); border: 0; margin: 34px 0; }
.plain-field { display: block; margin: 0 0 16px; }
.plain-field span { display: block; font-size: 14px; color: var(--soft); margin-bottom: 6px; }
.plain-field input, .plain-field textarea {
  width: 100%; font: inherit; color: var(--ink); background: var(--card);
  border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px;
}
.plain-field input:focus, .plain-field textarea:focus { outline: 2px solid var(--tint); outline-offset: 1px; }
.plain-message {
  position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);
  background: var(--ink); color: var(--bg); padding: 12px 20px; border-radius: 999px;
  font-size: 15px; box-shadow: 0 10px 30px rgba(0,0,0,.25); z-index: 50;
}
.plain-footer { margin-top: 64px; color: var(--soft); font-size: 14px; border-top: 1px solid var(--line); padding-top: 18px; }
@media (max-width: 620px) { .plain-page { padding: 34px 18px 72px; } }
`.trim();
}

// A page node becomes this shape, which both renderers understand.
export function toSpec(node) {
  const p = node.props || {};
  switch (node.kind) {
    case 'title': return { tag: 'h1', className: 'plain-title', text: p.text };
    case 'heading': return { tag: 'h2', className: 'plain-heading', text: p.text };
    case 'small-heading': return { tag: 'h3', className: 'plain-small-heading', text: p.text };
    case 'text': return { tag: 'p', className: 'plain-text', text: p.text };
    case 'note': return { tag: 'p', className: 'plain-note', text: p.text };
    case 'quote': return { tag: 'blockquote', className: 'plain-quote', text: p.text };
    case 'code': return { tag: 'pre', className: 'plain-code', text: p.text };
    case 'space': return { tag: 'hr', className: 'plain-space' };
    // Written by the author, so it goes in as it stands rather than escaped.
    case 'html': return { tag: 'div', className: 'plain-html', raw: p.text || '' };
    // Markdown is marked-up text, not markup: escaped first, then read.
    case 'markdown': return { tag: 'div', className: 'plain-markdown', raw: markdownToHTML(p.text || '') };
    case 'link': return { tag: 'a', className: 'plain-link', text: p.text, attrs: { href: p.url } };
    case 'picture': return { tag: 'img', className: 'plain-picture', attrs: { src: p.url, alt: p.alt || '' }, empty: true };
    case 'button': return { tag: 'button', className: 'plain-button', text: p.text, attrs: { type: 'button' }, click: p.click };
    case 'list':
      return {
        tag: 'ul', className: 'plain-list',
        children: (p.items || []).map(item => ({ tag: 'li', text: String(item) }))
      };
    case 'field':
      return {
        tag: 'label', className: 'plain-field',
        children: [
          { tag: 'span', text: p.label || '' },
          { tag: p.big ? 'textarea' : 'input', attrs: { type: 'text', value: p.value || '', placeholder: p.hint || '' }, empty: !p.big, field: true }
        ]
      };
    case 'card':
      return { tag: 'div', className: 'plain-card', children: (node.children || []).map(toSpec) };
    case 'row':
      return { tag: 'div', className: 'plain-row', children: (node.children || []).map(toSpec) };
    case 'footer':
      return { tag: 'div', className: 'plain-footer', text: p.text };
    default:
      return { tag: 'div', text: p.text || '' };
  }
}

export function escapeHTML(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const VOID_TAGS = new Set(['img', 'hr', 'br', 'input', 'meta', 'link']);

export function specToHTML(spec, indent = '  ') {
  const attrs = { ...(spec.attrs || {}) };
  if (spec.className) attrs.class = spec.className;
  if (spec.name) attrs['data-plain-name'] = spec.name;
  const attrText = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ` ${k}="${escapeHTML(v)}"`).join('');

  if (VOID_TAGS.has(spec.tag)) return `${indent}<${spec.tag}${attrText}>`;

  const inner = [];
  if (spec.raw) inner.push('\n' + spec.raw + '\n' + indent);
  if (spec.text !== undefined && spec.text !== null && spec.text !== '') inner.push(escapeHTML(spec.text));
  const children = spec.children || [];
  if (children.length) {
    const kids = children.map(child => specToHTML(child, indent + '  ')).join('\n');
    inner.push(`\n${kids}\n${indent}`);
  }
  return `${indent}<${spec.tag}${attrText}>${inner.join('')}</${spec.tag}>`;
}

export function pageToHTML(page) {
  return page.nodes.map(node => {
    const spec = toSpec(node);
    if (node.name) spec.name = node.name;
    return specToHTML(spec, '      ');
  }).join('\n');
}

export function navToHTML(site, currentPath) {
  if (site.pages.length < 2) return '';
  const links = site.pages.map(page =>
    `<a${page.path === currentPath ? ' class="here"' : ''} href="${escapeHTML(hrefFor(page.path))}">${escapeHTML(page.name)}</a>`
  ).join('\n      ');
  return `    <nav class="plain-nav">\n      <strong>${escapeHTML(site.title)}</strong>\n      ${links}\n    </nav>`;
}

export function hrefFor(path) {
  if (path === '/' || path === '') return 'index.html';
  return path.replace(/^\//, '').replace(/\/$/, '') + '.html';
}

// A complete standalone page. `script` is injected before </body>.
export function documentToHTML(site, page, { script = '', bodyOnly = false } = {}) {
  const body = `${navToHTML(site, page.path)}
    <main class="plain-page" id="plain-app">
${pageToHTML(page)}
    </main>`;
  if (bodyOnly) return body;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHTML(page.name === site.title ? site.title : `${page.name} - ${site.title}`)}</title>
    <style>
${stylesheet(site.theme)}
${(site.styles || []).join('\n')}
    </style>
  </head>
  <body>
${body}
${(site.scripts || []).map(js => `    <script>\n${js}\n    </script>`).join('\n')}
${script}
  </body>
</html>
`;
}

// ------------------------------------------------------------------ the DOM

export function specToDOM(spec, document, page) {
  const el = document.createElement(spec.tag);
  if (spec.className) el.className = spec.className;
  if (spec.name) el.setAttribute('data-plain-name', spec.name);
  for (const [key, value] of Object.entries(spec.attrs || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'value') el.value = value;
    else el.setAttribute(key, value);
  }
  if (spec.raw) el.innerHTML = spec.raw;
  if (spec.text !== undefined && spec.text !== null && spec.text !== '') el.textContent = spec.text;
  for (const child of spec.children || []) el.appendChild(specToDOM(child, document, page));
  if (spec.click) el.addEventListener('click', () => spec.click());
  return el;
}

export function mountPage(page, root, document) {
  root.textContent = '';
  for (const node of page.nodes) {
    const spec = toSpec(node);
    // A name is how "style crown with ..." finds this thing, so it has to
    // survive into the live page as well as the built one.
    if (node.name) spec.name = node.name;
    const el = specToDOM(spec, document, page);
    node.element = el;
    root.appendChild(el);
  }
  return root;
}

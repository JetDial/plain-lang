// Plain - the website designer.
// A live page on the left, blocks to add on the right. Everything you do
// here is written back out as Plain sentences, so the file stays readable
// and hand-editable. Opened by `plain design site.plain`.

import { mountPage, stylesheet, THEMES } from './render.js';

const STYLE = `
:root { color-scheme: dark; }
body { margin: 0; background: #0c0d12; color: #e9ecf3;
       font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.designer { display: grid; grid-template-columns: 1fr 330px; min-height: 100vh; }
.stage { padding: 18px; overflow: auto; }
.top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.top .title { font-weight: 600; margin-right: auto; }
.top .tab { border: 1px solid #262c3b; background: #141822; color: #c3c9d6;
  padding: 6px 12px; border-radius: 999px; cursor: pointer; font: inherit; }
.top .tab.here { background: #4c8dff; border-color: #4c8dff; color: #08101f; font-weight: 600; }
.frame { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.45); }
.frame iframe { display: block; width: 100%; height: calc(100vh - 132px); border: 0; }
.side { background: #10131b; border-left: 1px solid #212736; padding: 18px; overflow: auto; }
.side h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .09em; color: #7d8496;
  margin: 22px 0 10px; }
.side h2:first-child { margin-top: 0; }
.blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
button, select, input, textarea {
  font: inherit; color: #e9ecf3; background: #161a24; border: 1px solid #2b3040;
  border-radius: 9px; padding: 8px 10px; cursor: pointer; }
input, textarea, select { cursor: text; width: 100%; }
button:hover { border-color: #4c8dff; }
button.main { background: #4c8dff; border-color: #4c8dff; color: #08101f; font-weight: 600; cursor: pointer; }
label { display: block; font-size: 12px; color: #97a0b5; margin: 12px 0 5px; }
.row { display: flex; gap: 8px; }
.note { color: #7d8496; font-size: 13px; margin-top: 14px; }
.saved { color: #7ee787; }
.chosen-outline { outline: 2px solid #4c8dff !important; outline-offset: 2px; border-radius: 4px; }
`;

const BLOCKS = [
  ['Title', 'title', { text: 'A title' }],
  ['Heading', 'heading', { text: 'A heading' }],
  ['Text', 'text', { text: 'Some words about this.' }],
  ['Note', 'note', { text: 'A small quiet note.' }],
  ['Quote', 'quote', { text: 'Something worth quoting.' }],
  ['List', 'list', { items: ['one', 'two', 'three'] }],
  ['Link', 'link', { text: 'A link', url: 'https://example.com' }],
  ['Picture', 'picture', { url: 'picture.png', alt: '' }],
  ['Button', 'button', { text: 'Press me', source: 'show a message "Hello"' }],
  ['Card', 'card', {}],
  ['Row', 'row', {}],
  ['Space', 'space', {}],
  ['Footer', 'footer', { text: 'Made with Plain.' }]
];

export function startDesigner(site, doc, win) {
  ensureStyle(doc, STYLE);
  doc.title = `Designing ${site.title}`;

  const state = { page: site.pages[0], chosen: null };

  const root = doc.createElement('div');
  root.className = 'designer';
  root.innerHTML = `
    <div class="stage">
      <div class="top">
        <span class="title">${escapeHTML(site.title)}</span>
        <span data-tabs></span>
        <button data-save class="main">Save</button>
      </div>
      <div class="frame"><iframe data-preview></iframe></div>
    </div>
    <div class="side">
      <h2>Add a block</h2>
      <div class="blocks" data-blocks></div>
      <h2>Look</h2>
      <label>Theme</label>
      <select data-theme>${Object.keys(THEMES).map(name =>
        `<option value="${name}"${name === site.theme ? ' selected' : ''}>${name}</option>`).join('')}</select>
      <h2>Chosen block</h2>
      <div data-inspector><p class="note">Click something in the page to change it.</p></div>
      <p class="note" data-note>Everything here is saved as Plain sentences.</p>
    </div>`;
  doc.body.appendChild(root);

  const preview = root.querySelector('[data-preview]');
  const inspector = root.querySelector('[data-inspector]');
  const note = root.querySelector('[data-note]');

  // ----------------------------------------------------------- the pages

  function buildTabs() {
    const tabs = root.querySelector('[data-tabs]');
    tabs.textContent = '';
    for (const page of site.pages) {
      const tab = doc.createElement('button');
      tab.className = 'tab' + (page === state.page ? ' here' : '');
      tab.textContent = page.name;
      tab.addEventListener('click', () => { state.page = page; state.chosen = null; render(); });
      tabs.appendChild(tab);
    }
    const add = doc.createElement('button');
    add.className = 'tab';
    add.textContent = '+';
    add.title = 'Add a page';
    add.addEventListener('click', () => {
      const name = win.prompt('What is the new page called?', 'About');
      if (!name) return;
      state.page = site.page(name, '/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      state.chosen = null;
      render();
    });
    tabs.appendChild(add);
  }

  // --------------------------------------------------------- the preview

  function render() {
    buildTabs();
    const frame = preview.contentDocument;
    frame.open();
    frame.write('<!doctype html><meta charset="utf-8"><style>' + stylesheet(site.theme) +
      '\n.chosen-outline{outline:2px solid #4c8dff;outline-offset:2px;border-radius:4px}</style><body><main class="plain-page" id="app"></main>');
    frame.close();
    const host = frame.getElementById('app');
    mountPage(state.page, host, frame);
    wire(state.page.nodes, frame);
    buildInspector();
  }

  function wire(nodes, frame) {
    for (const node of nodes) {
      if (node.element) {
        node.element.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          state.chosen = node;
          for (const other of frame.querySelectorAll('.chosen-outline')) other.classList.remove('chosen-outline');
          node.element.classList.add('chosen-outline');
          buildInspector();
        });
      }
      if (node.children && node.children.length) wireChildren(node, frame);
    }
  }

  // Children are drawn inside their parent, so find them by position.
  function wireChildren(parent, frame) {
    const holder = parent.element;
    if (!holder) return;
    parent.children.forEach((child, index) => {
      const element = holder.children[index];
      if (!element) return;
      child.element = element;
      element.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        state.chosen = child;
        for (const other of frame.querySelectorAll('.chosen-outline')) other.classList.remove('chosen-outline');
        element.classList.add('chosen-outline');
        buildInspector();
      });
      if (child.children && child.children.length) wireChildren(child, frame);
    });
  }

  // -------------------------------------------------------- adding blocks

  function buildBlocks() {
    const holder = root.querySelector('[data-blocks]');
    for (const [label, kind, props] of BLOCKS) {
      const button = doc.createElement('button');
      button.textContent = label;
      button.addEventListener('click', () => {
        const node = { kind, props: JSON.parse(JSON.stringify(props)), children: [], name: null };
        if (kind === 'card') node.children.push({ kind: 'small-heading', props: { text: 'A card' }, children: [] });
        // Add inside the chosen container if there is one.
        const into = state.chosen && (state.chosen.kind === 'card' || state.chosen.kind === 'row')
          ? state.chosen.children : state.page.nodes;
        into.push(node);
        state.chosen = node;
        render();
      });
      holder.appendChild(button);
    }
  }

  // ----------------------------------------------------------- inspector

  function buildInspector() {
    const node = state.chosen;
    if (!node) {
      inspector.innerHTML = '<p class="note">Click something in the page to change it.</p>';
      return;
    }
    const props = node.props || {};
    const fields = [];
    if ('text' in props) fields.push(field('Words', 'text', props.text));
    if ('url' in props) fields.push(field('Address', 'url', props.url));
    if ('alt' in props) fields.push(field('Description', 'alt', props.alt));
    if ('label' in props) fields.push(field('Label', 'label', props.label));
    if ('items' in props) fields.push(field('Items, one per line', 'items', (props.items || []).join('\n'), true));
    if (node.kind === 'button') fields.push(field('What it does', 'source', props.source || '', true));

    inspector.innerHTML = `
      <p class="note">${escapeHTML(node.kind)}</p>
      ${fields.join('')}
      <div class="row" style="margin-top:12px">
        <button data-move="-1">Up</button>
        <button data-move="1">Down</button>
        <button data-remove>Remove</button>
      </div>`;

    for (const input of inspector.querySelectorAll('[data-prop]')) {
      input.addEventListener('input', () => {
        const key = input.dataset.prop;
        props[key] = key === 'items' ? input.value.split('\n').filter(Boolean) : input.value;
        render();
        // Keep typing in the same box.
        const again = inspector.querySelector(`[data-prop="${key}"]`);
        if (again) { again.focus(); again.selectionStart = again.value.length; }
      });
    }
    for (const button of inspector.querySelectorAll('[data-move]')) {
      button.addEventListener('click', () => {
        const list = holderOf(node);
        const at = list.indexOf(node);
        const to = at + Number(button.dataset.move);
        if (at < 0 || to < 0 || to >= list.length) return;
        list.splice(at, 1);
        list.splice(to, 0, node);
        render();
      });
    }
    const remove = inspector.querySelector('[data-remove]');
    if (remove) remove.addEventListener('click', () => {
      const list = holderOf(node);
      const at = list.indexOf(node);
      if (at >= 0) list.splice(at, 1);
      state.chosen = null;
      render();
    });
  }

  function holderOf(node) {
    const search = (nodes) => {
      if (nodes.includes(node)) return nodes;
      for (const child of nodes) {
        if (child.children && child.children.length) {
          const found = search(child.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(state.page.nodes) || state.page.nodes;
  }

  function field(label, key, value, big = false) {
    return `<label>${label}</label>` + (big
      ? `<textarea data-prop="${key}" rows="3">${escapeHTML(value)}</textarea>`
      : `<input data-prop="${key}" value="${escapeHTML(value)}">`);
  }

  // ---------------------------------------------------------------- save

  root.querySelector('[data-theme]').addEventListener('change', event => {
    site.theme = event.target.value;
    render();
  });

  root.querySelector('[data-save]').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const response = await fetch('/source', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: site.toPlainSource()
      });
      note.innerHTML = response.ok
        ? '<span class="saved">Saved. Your Plain file now matches this page.</span>'
        : 'I could not save that.';
    } catch {
      note.textContent = 'I could not reach the Plain server to save.';
    }
    button.disabled = false;
  });

  buildBlocks();
  render();
  return { site, state, render };
}

function ensureStyle(doc, css) {
  const style = doc.createElement('style');
  style.textContent = css;
  doc.head.appendChild(style);
}

function escapeHTML(text) {
  return String(text ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

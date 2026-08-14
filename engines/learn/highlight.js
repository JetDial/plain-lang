// Plain - colouring code as it is typed.
//
// A textarea cannot colour its own text, so a coloured copy sits exactly
// behind it and the textarea itself is made see-through. Both use the same
// font and padding, so the letters line up.
//
// The colouring uses Plain's own lexer, which means it can never disagree
// with the language about what a word is.

import { tokenize } from '../../src/lexer.js';

// Words that start a line and shape the program.
const CONTROL = new Set([
  'if', 'otherwise', 'else', 'end', 'repeat', 'while', 'for', 'each', 'every',
  'to', 'give', 'back', 'return', 'stop', 'next', 'skip', 'try', 'then',
  'make', 'let', 'set', 'change', 'show', 'with', 'has', 'kind', 'based',
  'use', 'from', 'in', 'of', 'be', 'times', 'forever', 'it', 'fails'
]);

// Words that join values together.
const OPERATOR = new Set([
  'plus', 'minus', 'divided', 'over', 'modulo', 'joined', 'and', 'or', 'not',
  'is', 'above', 'below', 'least', 'most', 'contains', 'by', 'at', 'than',
  'more', 'less', 'bigger', 'smaller', 'greater', 'fewer', 'under', 'same', 'as'
]);

const VALUE = new Set(['yes', 'no', 'true', 'false', 'on', 'off', 'nothing', 'none', 'me']);

export const HIGHLIGHT_STYLE = `
.editor { position: relative; }
.editor .paint, .editor textarea {
  margin: 0;
  border: 1px solid transparent;
  padding: 14px 16px;
  font: 13.5px/1.65 ui-monospace, "Cascadia Code", Consolas, monospace;
  letter-spacing: 0;
  tab-size: 4;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
}
.editor .paint {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: #0d1119;
  color: #cfd6e6;
  overflow: hidden;
  pointer-events: none;
}
.editor textarea {
  position: relative;
  width: 100%;
  min-height: 260px;
  resize: vertical;
  background: transparent;
  color: transparent;
  caret-color: #e9edf6;
  border-color: #232a3a;
  border-radius: 10px;
}
.editor textarea::selection { background: #2f4a7d88; }
.editor textarea:focus { outline: 2px solid #2f4a7d; border-color: #2f4a7d; }
.paint .c-control  { color: #ff9ec4; }
.paint .c-operator { color: #a4b3d4; }
.paint .c-value    { color: #d2a8ff; }
.paint .c-number   { color: #ffd166; }
.paint .c-text     { color: #7ee787; }
.paint .c-comment  { color: #6b7385; font-style: italic; }
.paint .c-name     { color: #cfd6e6; }
`;

export function escapeHTML(text) {
  return String(text ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// Turn a program into coloured HTML. Anything the lexer refuses (an unclosed
// quote, say) still shows, just without colour - the editor must never go
// blank while someone is halfway through typing.
export function paint(source) {
  const text = String(source ?? '');
  let tokens;
  try {
    tokens = tokenize(text);
  } catch {
    return escapeHTML(text);
  }

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const painted = lines.map(() => []);
  let at = 0;

  // Where each line starts in the whole text, so tokens can be placed.
  const starts = [];
  let running = 0;
  for (const line of lines) { starts.push(running); running += line.length + 1; }

  // Comments never reach the parser, so find them from the raw lines.
  const commentAt = lines.map(line => {
    const hash = findHash(line);
    if (hash >= 0) return hash;
    return /^\s*note\b/i.test(line) ? line.search(/\S/) : -1;
  });

  const marks = [];   // { line, from, to, kind }
  for (const token of tokens) {
    if (token.type === 'newline' || token.type === 'end') continue;
    const lineIndex = token.line - 1;
    const line = lines[lineIndex];
    if (line === undefined) continue;
    const kind = kindOf(token);
    if (!kind) continue;
    const shown = shownText(token, line, at);
    const from = findFrom(line, token, painted[lineIndex]);
    if (from < 0) continue;
    marks.push({ line: lineIndex, from, to: from + shown.length, kind });
    painted[lineIndex].push(from + shown.length);
  }

  return lines.map((line, index) => {
    const cut = commentAt[index];
    if (cut >= 0) {
      const before = paintLine(line.slice(0, cut), marks.filter(mark => mark.line === index && mark.to <= cut));
      return before + `<span class="c-comment">${escapeHTML(line.slice(cut))}</span>`;
    }
    return paintLine(line, marks.filter(mark => mark.line === index));
  }).join('\n');
}

function paintLine(line, marks) {
  if (!marks.length) return escapeHTML(line);
  const sorted = marks.slice().sort((a, b) => a.from - b.from);
  let out = '';
  let at = 0;
  for (const mark of sorted) {
    if (mark.from < at) continue;
    out += escapeHTML(line.slice(at, mark.from));
    out += `<span class="c-${mark.kind}">${escapeHTML(line.slice(mark.from, mark.to))}</span>`;
    at = mark.to;
  }
  return out + escapeHTML(line.slice(at));
}

function kindOf(token) {
  if (token.type === 'number') return 'number';
  if (token.type === 'text') return 'text';
  if (token.type === 'symbol') return null;
  const word = String(token.value).toLowerCase();
  if (CONTROL.has(word)) return 'control';
  if (OPERATOR.has(word)) return 'operator';
  if (VALUE.has(word)) return 'value';
  return 'name';
}

// The text as it appears in the line, which for a piece of text includes its
// quotes and any escapes.
function shownText(token, line, _at) {
  if (token.type !== 'text') return String(token.value);
  const quote = line.includes('"') ? '"' : "'";
  return quote + String(token.value).replace(/\n/g, '\\n').replace(/"/g, '\\"') + quote;
}

// Find where this token sits, starting after whatever has been placed.
function findFrom(line, token, placed) {
  const after = placed.length ? Math.max(...placed) : 0;
  if (token.type === 'text') {
    const opening = line.indexOf('"', after) >= 0 ? '"' : "'";
    const start = line.indexOf(opening, after);
    if (start < 0) return -1;
    const close = closingQuote(line, start, opening);
    if (close < 0) return -1;
    placed.push(close + 1);
    return start;
  }
  const word = String(token.value);
  const at = indexOfWord(line, word, after);
  return at;
}

function closingQuote(line, start, quote) {
  for (let i = start + 1; i < line.length; i++) {
    if (line[i] === '\\') { i++; continue; }
    if (line[i] === quote) return i;
  }
  return -1;
}

function indexOfWord(line, word, from) {
  let at = from;
  while (at <= line.length - word.length) {
    const found = line.indexOf(word, at);
    if (found < 0) return -1;
    const before = found === 0 ? '' : line[found - 1];
    const after = line[found + word.length] ?? '';
    const wordish = /[A-Za-z0-9_]/;
    if (!(wordish.test(before) && wordish.test(word[0])) &&
        !(wordish.test(after) && wordish.test(word[word.length - 1]))) {
      return found;
    }
    at = found + 1;
  }
  return -1;
}

function findHash(line) {
  let inside = null;
  for (let i = 0; i < line.length; i++) {
    const letter = line[i];
    if (inside) {
      if (letter === '\\') { i++; continue; }
      if (letter === inside) inside = null;
      continue;
    }
    if (letter === '"' || letter === "'") { inside = letter; continue; }
    if (letter === '#') return i;
  }
  return -1;
}

// Wire a textarea up to a coloured copy behind it.
export function colourEditor(editor, doc) {
  const holder = editor.parentNode;
  const paintBox = doc.createElement('pre');
  paintBox.className = 'paint';
  paintBox.setAttribute('aria-hidden', 'true');
  holder.insertBefore(paintBox, editor);

  const redraw = () => {
    // The trailing space keeps the last line visible while typing.
    paintBox.innerHTML = paint(editor.value) + ' ';
    paintBox.scrollTop = editor.scrollTop;
    paintBox.scrollLeft = editor.scrollLeft;
  };

  editor.addEventListener('input', redraw);
  editor.addEventListener('scroll', () => {
    paintBox.scrollTop = editor.scrollTop;
    paintBox.scrollLeft = editor.scrollLeft;
  });
  redraw();
  return redraw;
}

// Plain - lexer.
// Turns source text into a flat list of tokens. Newlines matter (they end a
// statement); indentation does not (indent however you like).

import { PlainError } from './errors.js';

// Longest first, so "<=" wins over "<".
const SYMBOLS = [
  '<=', '>=', '!=', '==',
  '+', '-', '*', '/', '%', '^', '=', '<', '>',
  ',', '(', ')', '[', ']', '{', '}', ':', '.'
];

// An escaped brace keeps a marker so the parser can tell it apart from a
// real {expression} slot. The marker never survives into a finished value.
export const ESCAPED = String.fromCharCode(0);

const ESCAPES = {
  n: '\n', t: '\t', r: '\r', '"': '"', "'": "'", '\\': '\\',
  '{': ESCAPED + '{', '}': ESCAPED + '}'
};

export function tokenize(source, file = '<input>') {
  const src = String(source).replace(/\r\n?/g, '\n');
  const tokens = [];
  let i = 0;
  let line = 1;
  let atLineStart = true;

  const push = (type, value, startLine = line) => {
    tokens.push({ type, value, line: startLine, file });
    if (type !== 'newline') atLineStart = false;
  };

  while (i < src.length) {
    const ch = src[i];

    // Spaces and tabs are separators only.
    if (ch === ' ' || ch === '\t') { i++; continue; }

    if (ch === '\n') {
      push('newline', '\n');
      i++; line++; atLineStart = true;
      continue;
    }

    // Comments: "# like this" anywhere, or a line that starts with "note".
    if (ch === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (atLineStart && /^note\b/i.test(src.slice(i))) {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // Text: "hello" or 'hello'. Supports {expressions} inside, kept raw here
    // and expanded by the parser.
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const startLine = line;
      let out = '';
      i++;
      while (true) {
        if (i >= src.length || src[i] === '\n') {
          throw new PlainError(`This text is missing its closing ${quote}`, startLine, file);
        }
        const c = src[i];
        if (c === '\\') {
          const next = src[i + 1];
          if (next in ESCAPES) { out += ESCAPES[next]; i += 2; continue; }
          // Keep an unknown escape as-is rather than failing on the user.
          out += '\\'; i++; continue;
        }
        if (c === quote) { i++; break; }
        out += c;
        i++;
      }
      push('text', out, startLine);
      continue;
    }

    // Numbers: 12, 3.5, .5
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const start = i;
      while (i < src.length && /[0-9_]/.test(src[i])) i++;
      if (src[i] === '.' && /[0-9]/.test(src[i + 1] || '')) {
        i++;
        while (i < src.length && /[0-9_]/.test(src[i])) i++;
      }
      const raw = src.slice(start, i).replace(/_/g, '');
      push('number', Number(raw));
      continue;
    }

    // Words: names and keywords.
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
      push('word', src.slice(start, i));
      continue;
    }

    const sym = SYMBOLS.find(s => src.startsWith(s, i));
    if (sym) {
      push('symbol', sym);
      i += sym.length;
      continue;
    }

    throw new PlainError(`I do not understand the character "${ch}"`, line, file);
  }

  push('newline', '\n');
  tokens.push({ type: 'end', value: '', line, file });
  return tokens;
}

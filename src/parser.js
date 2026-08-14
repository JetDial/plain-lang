// Plain - parser.
// Turns tokens into a tree. The grammar is deliberately sentence shaped:
// control words first, then any registered phrase, then the small core
// statements.

import { tokenize, ESCAPED } from './lexer.js';
import { PlainError } from './errors.js';
import { stopsAfter } from './phrases.js';

// Only "the" is skipped as decoration. "a" and "an" are left alone because
// they make perfectly good short names ("to add with a and b").
const ARTICLES = new Set(['the']);
const BOOL_TRUE = new Set(['yes', 'true', 'on']);
const BOOL_FALSE = new Set(['no', 'false', 'off']);
const NOTHING = new Set(['nothing', 'none']);

// Words that can never be used as a variable name.
export const RESERVED = new Set([
  'if', 'otherwise', 'else', 'end', 'repeat', 'while', 'for', 'each', 'every',
  // "back" is not reserved: "give back" reads it directly, and "move x back
  // by 1" needs it as a direction.
  'to', 'give', 'return', 'stop', 'next', 'skip', 'make', 'let', 'set',
  'show', 'with', 'and', 'or', 'not', 'is', 'in', 'of', 'be', 'then', 'times',
  'plus', 'minus', 'joined', 'divided', 'by', 'from', 'note', 'the'
]);

export class Parser {
  constructor(tokens, phrases, file = '<input>') {
    this.tokens = tokens;
    this.i = 0;
    this.phrases = phrases; // { statement: PhraseTable, value: PhraseTable }
    this.file = file;
    this.userFunctions = new Map();
  }

  // ---------------------------------------------------------------- helpers

  peek(offset = 0) { return this.tokens[Math.min(this.i + offset, this.tokens.length - 1)]; }
  get line() { return this.peek().line; }

  isWord(value, offset = 0) {
    const t = this.peek(offset);
    return t.type === 'word' && t.value.toLowerCase() === value;
  }

  isSym(value, offset = 0) {
    const t = this.peek(offset);
    return t.type === 'symbol' && t.value === value;
  }

  wordValue(offset = 0) {
    const t = this.peek(offset);
    return t.type === 'word' ? t.value.toLowerCase() : null;
  }

  take() { return this.tokens[this.i++]; }

  eatWord(...values) {
    for (const v of values) {
      if (this.isWord(v)) { this.i++; return v; }
    }
    return null;
  }

  expectWord(value, what) {
    if (!this.eatWord(value)) {
      this.error(`I expected the word "${value}"${what ? ` ${what}` : ''}, but found "${this.describe(this.peek())}"`);
    }
  }

  eatSym(value) {
    if (this.isSym(value)) { this.i++; return true; }
    return false;
  }

  skipNewlines() { while (this.peek().type === 'newline') this.i++; }

  endOfStatement() {
    const t = this.peek();
    if (t.type === 'newline') { this.i++; return; }
    if (t.type === 'end') return;
    this.error(`I did not expect "${this.describe(t)}" at the end of this line`);
  }

  describe(token) {
    if (!token) return 'the end of the file';
    if (token.type === 'end') return 'the end of the file';
    if (token.type === 'newline') return 'the end of the line';
    if (token.type === 'text') return `"${token.value}"`;
    return String(token.value);
  }

  error(message, line = this.line, hint = null) {
    throw new PlainError(message, line, this.file, hint);
  }

  // ---------------------------------------------------------------- program

  parseProgram() {
    this.predeclareFunctions();
    const body = [];
    this.skipNewlines();
    while (this.peek().type !== 'end') {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    return { type: 'Program', body, file: this.file };
  }

  // Functions may be used before they are written, so read every signature
  // first and register the sentences they create.
  predeclareFunctions() {
    const save = this.i;
    let atLineStart = true;
    for (let k = 0; k < this.tokens.length; k++) {
      const t = this.tokens[k];
      if (t.type === 'newline') { atLineStart = true; continue; }
      if (!atLineStart) continue;
      atLineStart = false;
      if (t.type === 'word' && t.value.toLowerCase() === 'to') {
        this.i = k;
        try { this.parseFunctionSignature(); } catch { /* reported later, in order */ }
      }
    }
    this.i = save;
  }

  // ------------------------------------------------------------- statements

  // A terminator is a word ("end") or a run of words (["if","it","fails"]).
  parseBlock(terminators) {
    const body = [];
    this.skipNewlines();
    const startLine = this.line;
    while (true) {
      const t = this.peek();
      if (t.type === 'end') {
        this.error(`This block was never closed. Add "end" on its own line.`);
      }
      if (this.atTerminator(terminators)) break;
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    // The lines this block covers, so tools can show and rewrite the code
    // the way it was actually typed.
    return { type: 'Block', body, startLine, endLine: this.line - 1 };
  }

  atTerminator(terminators) {
    if (this.peek().type !== 'word') return false;
    for (const terminator of terminators) {
      const words = Array.isArray(terminator) ? terminator : [terminator];
      if (words.every((word, offset) => this.isWord(word, offset))) return true;
    }
    return false;
  }

  parseStatement() {
    const t = this.peek();
    if (t.type !== 'word') return this.parseCoreStatement();

    switch (t.value.toLowerCase()) {
      case 'if': return this.parseIf();
      case 'repeat': return this.parseRepeat();
      case 'while': return this.parseWhile();
      case 'for': return this.parseForEach();
      case 'to': return this.parseFunctionDefinition();
      case 'try': return this.parseTry();
      case 'give': case 'return': return this.parseReturn();
      case 'a': case 'an':
        if (this.isWord('kind', 1)) return this.parseKind();
        break;
      case 'end': case 'otherwise': case 'else':
        this.error(`"${t.value}" does not belong here. It closes a block that was never opened.`);
    }

    // Anything registered by the core library, the game engine or the
    // website engine.
    const call = this.tryPhrase(this.phrases.statement, new Set(), t.line);
    if (call) {
      this.endOfStatement();
      return call;
    }

    return this.parseCoreStatement();
  }

  parseCoreStatement() {
    const t = this.peek();
    const word = this.wordValue();

    if (word === 'show') {
      this.i++;
      const value = this.parseExpression();
      this.endOfStatement();
      return { type: 'Show', value, line: t.line };
    }

    if (word === 'make' || word === 'let') {
      this.i++;
      const name = this.parseName('after "make"');
      if (!this.eatWord('be') && !this.eatSym('=')) {
        this.error(`Write it as: make ${name} be <value>`, t.line);
      }
      const value = this.parseExpression();
      this.endOfStatement();
      return { type: 'Make', name, value, line: t.line };
    }

    if (word === 'set' || word === 'change') {
      this.i++;
      const target = this.parseExpression(new Set(['to']));
      this.expectWord('to', 'in a "set" line');
      const value = this.parseExpression();
      this.endOfStatement();
      if (!['Var', 'Field', 'PhraseValue'].includes(target.type)) {
        this.error(`I can only set a name, "something of something", or "item N of a list"`, t.line);
      }
      return { type: 'Set', target, value, line: t.line };
    }

    if (word === 'stop') {
      this.i++;
      this.eatWord('repeating'); this.eatWord('the'); this.eatWord('loop');
      this.endOfStatement();
      return { type: 'Break', line: t.line };
    }

    if (word === 'next' || word === 'skip') {
      this.i++;
      this.eatWord('one');
      this.endOfStatement();
      return { type: 'Continue', line: t.line };
    }

    // A bare expression is only useful if it does something, so give a
    // pointed error rather than silently evaluating it.
    const guess = t.type === 'word' ? `"${t.value}"` : this.describe(t);
    this.error(
      `I do not know how to start a line with ${guess}`,
      t.line,
      `lines usually start with show, make, set, if, repeat, for each, while, to, or a phrase like "add 1 to score"`
    );
  }

  parseName(where) {
    const t = this.peek();
    if (t.type !== 'word') this.error(`I expected a name ${where}, but found ${this.describe(t)}`);
    const name = t.value;
    if (RESERVED.has(name.toLowerCase())) {
      this.error(`"${name}" is a word Plain uses itself, so it cannot be a name`, t.line);
    }
    this.i++;
    return name;
  }

  parseIf() {
    const line = this.line;
    this.i++; // if
    const branches = [];
    let condition = this.parseExpression();
    this.eatWord('then');
    this.endOfStatement();
    let block = this.parseBlock(['end', 'otherwise', 'else']);
    branches.push({ condition, block });

    let otherwise = null;
    while (this.isWord('otherwise') || this.isWord('else')) {
      this.i++;
      if (this.eatWord('if')) {
        const c = this.parseExpression();
        this.eatWord('then');
        this.endOfStatement();
        branches.push({ condition: c, block: this.parseBlock(['end', 'otherwise', 'else']) });
      } else {
        this.endOfStatement();
        otherwise = this.parseBlock(['end']);
        break;
      }
    }
    this.expectWord('end', 'to close this "if"');
    this.endOfStatement();
    return { type: 'If', branches, otherwise, line };
  }

  parseRepeat() {
    const line = this.line;
    this.i++; // repeat

    if (this.eatWord('forever')) {
      this.endOfStatement();
      const block = this.parseBlock(['end']);
      this.expectWord('end', 'to close this "repeat"');
      this.endOfStatement();
      return { type: 'While', condition: { type: 'Bool', value: true }, block, line };
    }

    if (this.eatWord('with')) {
      const name = this.parseName('after "repeat with"');
      this.expectWord('from', 'in a counting loop');
      const from = this.parseExpression(new Set(['to']));
      this.expectWord('to', 'in a counting loop');
      const to = this.parseExpression(new Set(['by']));
      let step = null;
      if (this.eatWord('by')) step = this.parseExpression();
      this.endOfStatement();
      const block = this.parseBlock(['end']);
      this.expectWord('end', 'to close this "repeat"');
      this.endOfStatement();
      return { type: 'Count', name, from, to, step, block, line };
    }

    const count = this.parseExpression(new Set(['times']));
    this.expectWord('times', 'after the number of repeats');
    this.endOfStatement();
    const block = this.parseBlock(['end']);
    this.expectWord('end', 'to close this "repeat"');
    this.endOfStatement();
    return { type: 'Repeat', count, block, line };
  }

  parseWhile() {
    const line = this.line;
    this.i++;
    const condition = this.parseExpression();
    this.endOfStatement();
    const block = this.parseBlock(['end']);
    this.expectWord('end', 'to close this "while"');
    this.endOfStatement();
    return { type: 'While', condition, block, line };
  }

  parseForEach() {
    const line = this.line;
    this.i++; // for
    if (!this.eatWord('each') && !this.eatWord('every')) {
      this.error('Write it as: for each item in things', line);
    }
    const name = this.parseName('after "for each"');
    this.expectWord('in', 'in a "for each" line');
    const list = this.parseExpression();
    this.endOfStatement();
    const block = this.parseBlock(['end']);
    this.expectWord('end', 'to close this "for each"');
    this.endOfStatement();
    return { type: 'ForEach', name, list, block, line };
  }

  // try
  //     ...
  // if it fails
  //     show the problem
  // end
  parseTry() {
    const line = this.line;
    this.i++; // try
    this.endOfStatement();
    const block = this.parseBlock([['if', 'it', 'fails'], 'end']);
    let rescue = null;
    if (this.isWord('if')) {
      this.i += 3; // if it fails
      this.endOfStatement();
      rescue = this.parseBlock(['end']);
    }
    this.expectWord('end', 'to close this "try"');
    this.endOfStatement();
    return { type: 'Try', block, rescue, line };
  }

  // a kind called Dog based on Animal
  //     has name
  //     has sound be "woof"
  //     to speak
  //         show "{name of me} says {sound of me}"
  //     end
  // end
  parseKind() {
    const line = this.line;
    this.i++; // a
    this.expectWord('kind', 'to describe a new kind of thing');
    if (!this.eatWord('called') && !this.eatWord('of')) {
      this.error('Write it as: a kind called Dog', line);
    }
    const name = this.parseName('after "a kind called"');
    let base = null;
    if (this.eatWord('based')) {
      this.expectWord('on', 'after "based"');
      base = this.parseName('after "based on"');
    }
    this.endOfStatement();

    const fields = [];
    const actions = [];
    this.skipNewlines();
    while (!this.isWord('end')) {
      if (this.peek().type === 'end') this.error(`The kind "${name}" was never closed. Add "end".`, line);
      if (this.eatWord('has')) {
        const field = this.parseName(`in the kind "${name}"`);
        let value = null;
        if (this.eatWord('be') || this.eatSym('=')) value = this.parseExpression();
        this.endOfStatement();
        fields.push({ name: field, value });
      } else if (this.isWord('to')) {
        actions.push(this.parseMethod(name));
      } else {
        this.error(`Inside a kind I expected "has something" or "to do something"`, this.line);
      }
      this.skipNewlines();
    }
    this.expectWord('end', `to close the kind "${name}"`);
    this.endOfStatement();
    return { type: 'Kind', name, base, fields, actions, line };
  }

  parseMethod(kindName) {
    const line = this.line;
    this.i++; // to
    const words = [];
    while (this.peek().type === 'word' && !this.isWord('with')) words.push(this.take().value.toLowerCase());
    if (!words.length) this.error(`Give this action of "${kindName}" a name`, line);
    const params = [];
    if (this.eatWord('with')) {
      while (true) {
        params.push(this.parseName('in the list of inputs'));
        if (this.eatWord('and') || this.eatSym(',')) continue;
        break;
      }
    }
    this.endOfStatement();
    const block = this.parseBlock(['end']);
    this.expectWord('end', 'to close this action');
    this.endOfStatement();
    return { name: words.join(' '), params, block, line };
  }

  parseReturn() {
    const line = this.line;
    this.i++; // give / return
    this.eatWord('back');
    let value = null;
    if (this.peek().type !== 'newline' && this.peek().type !== 'end') {
      value = this.parseExpression();
    }
    this.endOfStatement();
    return { type: 'Return', value, line };
  }

  // to <words...> [with a and b]
  parseFunctionSignature() {
    const line = this.line;
    this.i++; // to
    const words = [];
    while (this.peek().type === 'word' && !this.isWord('with')) {
      const w = this.take().value.toLowerCase();
      words.push(w);
    }
    if (!words.length) this.error('Give the action a name, like: to greet with person', line);

    const params = [];
    if (this.eatWord('with')) {
      while (true) {
        params.push(this.parseName('in the list of inputs'));
        if (this.eatWord('and') || this.eatSym(',')) continue;
        break;
      }
    }
    this.endOfStatement();

    const key = words.join(' ') + '/' + params.length;
    const id = 'user:' + key;
    if (!this.userFunctions.has(key)) {
      const specParts = [...words];
      params.forEach((p, idx) => {
        specParts.push(idx === 0 ? 'with' : 'and');
        specParts.push('$' + p);
      });
      const spec = specParts.join(' ');
      this.phrases.statement.add(spec, id);
      this.phrases.value.add(spec, id);
      this.userFunctions.set(key, { id, name: words.join(' '), params });
    }
    return { id, name: words.join(' '), params, line };
  }

  parseFunctionDefinition() {
    const line = this.line;
    const sig = this.parseFunctionSignature();
    const block = this.parseBlock(['end']);
    this.expectWord('end', 'to close this action');
    this.endOfStatement();
    return { type: 'Function', id: sig.id, name: sig.name, params: sig.params, block, line };
  }

  // ----------------------------------------------------------- phrase match

  tryPhrase(table, stops, line) {
    const t = this.peek();
    if (t.type !== 'word') return null;
    const key = t.value.toLowerCase();
    if (stops.has(key)) return null;
    const candidates = table.candidates(key);
    if (!candidates.length) return null;

    // If nothing matches we report the failure that got furthest into the
    // line, which is almost always the sentence the writer meant.
    let best = null;
    let bestReach = -1;

    for (const pattern of candidates) {
      const save = this.i;
      try {
        const matched = this.matchPattern(pattern, stops, line);
        if (matched) return matched;
      } catch (e) {
        if (!(e instanceof PlainError)) throw e;
        const reach = this.i;
        if (reach > bestReach) { bestReach = reach; best = e; }
      }
      this.i = save;
    }

    if (best && bestReach - this.i > 2) throw best;
    return null;
  }

  matchPattern(pattern, outerStops, line, startIndex = 0, preFilled = null) {
    const args = preFilled ? { ...preFilled } : {};
    for (let k = startIndex; k < pattern.parts.length; k++) {
      const part = pattern.parts[k];
      if (part.type === 'word') {
        if (!this.isWord(part.value)) return null;
        this.i++;
      } else if (part.type === 'sym') {
        if (!this.isSym(part.value)) return null;
        this.i++;
      } else if (part.type === 'name') {
        const t = this.peek();
        if (t.type !== 'word' || RESERVED.has(t.value.toLowerCase())) return null;
        args[part.name] = t.value;
        this.i++;
      } else if (part.type === 'args') {
        const stops = union(stopsAfter(pattern, k + 1), outerStops);
        const before = this.i;
        const items = [];
        while (true) {
          items.push(this.parseExpression(union(stops, new Set([',']))));
          if (this.eatSym(',')) continue;
          if (!stops.has('and') && this.isWord('and')) { this.i++; continue; }
          break;
        }
        if (this.i === before) return null;
        args[part.name] = { type: 'List', items, line: this.line };
      } else {
        const stops = union(stopsAfter(pattern, k + 1), outerStops);
        const before = this.i;
        const value = this.parseExpression(stops);
        if (this.i === before) return null;
        args[part.name] = value;
      }
    }

    let block = null;
    if (pattern.block) {
      this.endOfStatement();
      block = this.parseBlock(['end']);
      this.expectWord('end', 'to close this block');
      // The caller finishes the line with endOfStatement().
    }

    return { type: 'Phrase', id: pattern.id, spec: pattern.spec, args, block, line: line ?? this.line };
  }

  // ------------------------------------------------------------ expressions

  parseExpression(stops = new Set()) {
    return this.parseOr(stops);
  }

  parseOr(stops) {
    let left = this.parseAnd(stops);
    while (!this.stopped(stops) && this.isWord('or')) {
      const line = this.line;
      this.i++;
      const right = this.parseAnd(stops);
      left = { type: 'Logic', op: 'or', left, right, line };
    }
    return left;
  }

  parseAnd(stops) {
    let left = this.parseNot(stops);
    while (!this.stopped(stops) && (this.isWord('and') || this.isWord('also'))) {
      const line = this.line;
      this.i++;
      const right = this.parseNot(stops);
      left = { type: 'Logic', op: 'and', left, right, line };
    }
    return left;
  }

  // "not" covers the whole question after it: "not x is 2" asks whether
  // "x is 2" is false, which is how it reads out loud.
  parseNot(stops) {
    if (this.isWord('not')) {
      const line = this.line;
      this.i++;
      return { type: 'Not', value: this.parseNot(stops), line };
    }
    return this.parseComparison(stops);
  }

  parseComparison(stops) {
    let left = this.parseSum(stops);
    while (!this.stopped(stops)) {
      // Sentences that sit between two values: "ball touches paddle".
      const infix = this.tryInfix(left, stops);
      if (infix) { left = infix; continue; }

      const op = this.readComparisonOperator();
      if (!op) break;
      const line = this.line;
      const right = this.parseSum(stops);
      left = { type: 'Compare', op, left, right, line };
    }
    return left;
  }

  tryInfix(left, stops) {
    const t = this.peek();
    if (t.type !== 'word') return null;
    const key = t.value.toLowerCase();
    if (stops.has(key)) return null;
    const candidates = this.phrases.infix.candidates(key);
    if (!candidates.length) return null;

    for (const pattern of candidates) {
      const save = this.i;
      try {
        const matched = this.matchPattern(pattern, stops, t.line, 1, { [pattern.parts[0].name]: left });
        if (matched) return { ...matched, type: 'PhraseValue' };
      } catch (e) {
        if (!(e instanceof PlainError)) throw e;
      }
      this.i = save;
    }
    return null;
  }

  // "is", "is not", "is above", "is at least", "contains", and the symbols.
  readComparisonOperator() {
    if (this.peek().type === 'symbol') {
      const s = this.peek().value;
      const map = { '=': '==', '==': '==', '!=': '!=', '<': '<', '>': '>', '<=': '<=', '>=': '>=' };
      if (map[s]) { this.i++; return map[s]; }
      return null;
    }
    if (this.isWord('contains')) { this.i++; return 'contains'; }
    if (!this.isWord('is')) return null;

    const save = this.i;
    this.i++; // is
    if (this.eatWord('not')) {
      // "is not above" is not supported on purpose - keep one obvious way.
      return '!=';
    }
    if (this.eatWord('above') || this.eatWord('over') || this.eatWord('greater') ||
        this.eatWord('bigger') || this.eatWord('more')) {
      this.eatWord('than');
      return '>';
    }
    if (this.eatWord('below') || this.eatWord('under') || this.eatWord('less') ||
        this.eatWord('smaller') || this.eatWord('fewer')) {
      this.eatWord('than');
      return '<';
    }
    if (this.isWord('at') && (this.isWord('least', 1) || this.isWord('most', 1))) {
      this.i++;
      const which = this.take().value.toLowerCase();
      return which === 'least' ? '>=' : '<=';
    }
    if (this.isWord('the') && this.isWord('same', 1) && this.isWord('as', 2)) {
      this.i += 3;
      return '==';
    }
    // Plain "is" means equals. But if the next token cannot start a value we
    // put "is" back, so phrase patterns using "is" still work.
    if (!this.canStartExpression()) { this.i = save; return null; }
    return '==';
  }

  parseSum(stops) {
    let left = this.parseProduct(stops);
    while (!this.stopped(stops)) {
      const line = this.line;
      if (this.isWord('plus') || this.isSym('+')) { this.i++; left = { type: 'Math', op: '+', left, right: this.parseProduct(stops), line }; continue; }
      if (this.isWord('minus') || this.isSym('-')) { this.i++; left = { type: 'Math', op: '-', left, right: this.parseProduct(stops), line }; continue; }
      if (this.isWord('joined') && this.isWord('with', 1)) { this.i += 2; left = { type: 'Math', op: 'join', left, right: this.parseProduct(stops), line }; continue; }
      break;
    }
    return left;
  }

  parseProduct(stops) {
    let left = this.parsePower(stops);
    while (!this.stopped(stops)) {
      const line = this.line;
      if (this.isWord('times') || this.isSym('*')) { this.i++; left = { type: 'Math', op: '*', left, right: this.parsePower(stops), line }; continue; }
      if (this.isWord('divided') && this.isWord('by', 1)) { this.i += 2; left = { type: 'Math', op: '/', left, right: this.parsePower(stops), line }; continue; }
      if (this.isWord('over') || this.isSym('/')) { this.i++; left = { type: 'Math', op: '/', left, right: this.parsePower(stops), line }; continue; }
      if (this.isWord('modulo') || this.isSym('%')) { this.i++; left = { type: 'Math', op: '%', left, right: this.parsePower(stops), line }; continue; }
      break;
    }
    return left;
  }

  parsePower(stops) {
    const left = this.parseUnary(stops);
    if (!this.stopped(stops) && this.isSym('^')) {
      const line = this.line;
      this.i++;
      return { type: 'Math', op: '^', left, right: this.parsePower(stops), line };
    }
    return left;
  }

  parseUnary(stops) {
    const line = this.line;
    if (this.isWord('not')) { this.i++; return { type: 'Not', value: this.parseUnary(stops), line }; }
    if (this.isSym('-')) { this.i++; return { type: 'Negate', value: this.parseUnary(stops), line }; }
    return this.parsePrimary(stops);
  }

  stopped(stops) {
    const t = this.peek();
    if (t.type === 'newline' || t.type === 'end') return true;
    if (t.type === 'word' && stops.has(t.value.toLowerCase())) return true;
    if (t.type === 'symbol' && stops.has(t.value)) return true;
    return false;
  }

  canStartExpression() {
    const t = this.peek();
    if (t.type === 'number' || t.type === 'text') return true;
    if (t.type === 'word') return !['then', 'and', 'or'].includes(t.value.toLowerCase());
    if (t.type === 'symbol') return ['(', '[', '{', '-'].includes(t.value);
    return false;
  }

  parsePrimary(stops) {
    const t = this.peek();
    const line = t.line;

    if (t.type === 'number') { this.i++; return { type: 'Number', value: t.value, line }; }
    if (t.type === 'text') { this.i++; return this.textNode(t); }

    if (t.type === 'symbol') {
      if (t.value === '(') {
        this.i++;
        const inner = this.parseExpression(new Set());
        if (!this.eatSym(')')) this.error('This "(" is missing its ")"', line);
        return inner;
      }
      if (t.value === '[') return this.parseListLiteral();
      if (t.value === '{') return this.parseRecordLiteral();
    }

    if (t.type === 'word') {
      const w = t.value.toLowerCase();

      // "a new Dog with name "Rex" and age 3"
      if ((w === 'a' || w === 'an') && this.isWord('new', 1)) {
        this.i += 2;
        const kind = this.parseName('after "a new"');
        const pairs = [];
        if (this.eatWord('with')) {
          const inner = union(stops, new Set([',', 'and']));
          while (true) {
            const field = this.parseName(`in the values for a new ${kind}`);
            pairs.push({ key: field, value: this.parseExpression(inner) });
            if (this.eatSym(',')) continue;
            if (!stops.has('and') && this.eatWord('and')) continue;
            break;
          }
        }
        return { type: 'New', kind, pairs, line };
      }

      // "a list of 1, 2, 3"
      if ((w === 'a' || w === 'an') && this.isWord('list', 1) && this.isWord('of', 2)) {
        this.i += 3;
        return this.parseListItems(stops, line);
      }
      if (w === 'a' && this.isWord('list', 1)) { this.i += 2; return { type: 'List', items: [], line }; }

      // Sentences come first, so "the action double" is not mistaken for the
      // decorative "the" in front of a name.
      const phrase = this.tryPhrase(this.phrases.value, stops, line);
      if (phrase) return { ...phrase, type: 'PhraseValue' };

      // Articles read nicely and mean nothing: "the score" is "score".
      if (ARTICLES.has(w) && this.peek(1).type === 'word') { this.i++; return this.parsePrimary(stops); }

      if (BOOL_TRUE.has(w)) { this.i++; return { type: 'Bool', value: true, line }; }
      if (BOOL_FALSE.has(w)) { this.i++; return { type: 'Bool', value: false, line }; }
      if (NOTHING.has(w)) { this.i++; return { type: 'Nothing', line }; }

      if (RESERVED.has(w)) {
        this.error(`I found "${t.value}" where I expected a value`, line);
      }

      this.i++;
      // "hp of player" reads as a field of a thing - unless the sentence
      // around us is waiting for that "of", as in "value key of settings".
      if (this.isWord('of') && !stops.has('of')) {
        this.i++;
        const object = this.parsePrimary(stops);
        return { type: 'Field', name: t.value, object, line };
      }
      return { type: 'Var', name: t.value, line };
    }

    this.error(`I expected a value but found ${this.describe(t)}`, line);
  }

  parseListLiteral() {
    const line = this.line;
    this.i++; // [
    const items = [];
    this.skipNewlines();
    if (!this.isSym(']')) {
      while (true) {
        this.skipNewlines();
        items.push(this.parseExpression(new Set([',', ']'])));
        this.skipNewlines();
        if (this.eatSym(',')) continue;
        break;
      }
    }
    this.skipNewlines();
    if (!this.eatSym(']')) this.error('This list is missing its "]"', line);
    return { type: 'List', items, line };
  }

  parseListItems(stops, line) {
    const items = [];
    const inner = union(stops, new Set([',', 'and']));
    while (true) {
      items.push(this.parseExpression(inner));
      if (this.eatSym(',')) continue;
      // "a list of 1, 2 and 3" reads well, so allow the final "and" too -
      // unless the sentence around us needs that word.
      if (!stops.has('and') && this.eatWord('and')) continue;
      break;
    }
    return { type: 'List', items, line };
  }

  parseRecordLiteral() {
    const line = this.line;
    this.i++; // {
    const pairs = [];
    this.skipNewlines();
    if (!this.isSym('}')) {
      while (true) {
        this.skipNewlines();
        const keyToken = this.peek();
        let key;
        if (keyToken.type === 'word') { key = keyToken.value; this.i++; }
        else if (keyToken.type === 'text') { key = keyToken.value; this.i++; }
        else this.error('A thing needs names on the left, like { name: "Ada" }', line);
        if (!this.eatSym(':')) this.error(`I expected ":" after "${key}"`, line);
        const value = this.parseExpression(new Set([',', '}']));
        pairs.push({ key, value });
        this.skipNewlines();
        if (this.eatSym(',')) continue;
        break;
      }
    }
    this.skipNewlines();
    if (!this.eatSym('}')) this.error('This thing is missing its "}"', line);
    return { type: 'Record', pairs, line };
  }

  // "Score: {points}" becomes a join of text and expressions.
  textNode(token) {
    const raw = token.value;
    const line = token.line;
    if (!raw.includes('{')) return { type: 'Text', value: clean(raw), line };

    const pieces = [];
    let literal = '';
    for (let k = 0; k < raw.length; k++) {
      const c = raw[k];
      if (c === ESCAPED) { literal += raw[k + 1] ?? ''; k++; continue; }
      if (c === '{') {
        const close = findClose(raw, k);
        if (close === -1) this.error('This text has a "{" with no matching "}"', line);
        if (literal) { pieces.push({ type: 'Text', value: literal, line }); literal = ''; }
        const inner = raw.slice(k + 1, close).trim();
        pieces.push(this.parseEmbedded(inner, line));
        k = close;
        continue;
      }
      literal += c;
    }
    if (literal) pieces.push({ type: 'Text', value: literal, line });
    if (!pieces.length) return { type: 'Text', value: '', line };

    return pieces.reduce((left, right) => ({ type: 'Math', op: 'join', left, right, line }));
  }

  parseEmbedded(source, line) {
    if (!source) return { type: 'Text', value: '', line };
    const tokens = tokenize(source, this.file).map(t => ({ ...t, line }));
    const sub = new Parser(tokens, this.phrases, this.file);
    sub.userFunctions = this.userFunctions;
    const expr = sub.parseExpression(new Set());
    return expr;
  }
}

function findClose(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === ESCAPED) { i++; continue; }
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function clean(text) {
  return text.includes(ESCAPED) ? text.split(ESCAPED).join('') : text;
}

function union(a, b) {
  if (!b || !b.size) return a;
  const out = new Set(a);
  for (const v of b) out.add(v);
  return out;
}

export function parse(tokens, phrases, file) {
  return new Parser(tokens, phrases, file).parseProgram();
}

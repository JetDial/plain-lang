// Plain - turning a Plain program into another language.
//
// One walk over the tree, with the syntax bits left to each target. The
// generated code is meant to be read: real names, real loops, real classes,
// and a small set of helper functions for the few places where Plain means
// something a little different from the host language (lists that count from
// 1, text that joins with anything, yes/no truth).

import { PlainError } from '../errors.js';

export class Emitter {
  constructor(options = {}) {
    this.options = options;
    this.out = [];
    this.depth = 0;
    this.used = new Set();        // helpers this program actually needs
    this.unsupported = [];
    this.temporaries = 0;
    // Plain lets you "make" a name that already exists; most languages do
    // not, so we keep track and write an assignment instead.
    this.scopes = [new Set()];
    // When a loop name is already taken further out, the inner one is given
    // a fresh name and remembered here. C# refuses to shadow at all, and it
    // reads better everywhere else too.
    this.aliases = [new Map()];
  }

  known(name) { return this.scopes.some(scope => scope.has(name)); }
  remember(name) { this.scopes[this.scopes.length - 1].add(name); }

  // What a name in the program is called in the written-out code.
  variable(plainName) {
    const wanted = this.identifier(plainName);
    for (let at = this.aliases.length - 1; at >= 0; at--) {
      const found = this.aliases[at].get(wanted);
      if (found) return found;
    }
    return wanted;
  }

  // A loop name that is free, even if the same word is in use further out.
  loopName(plainName) {
    const wanted = this.identifier(plainName);
    if (!this.known(wanted)) return wanted;
    let number = 2;
    while (this.known(wanted + number)) number++;
    return wanted + number;
  }

  bindLoop(plainName, actual) {
    this.remember(actual);
    const wanted = this.identifier(plainName);
    if (wanted !== actual) this.aliases[this.aliases.length - 1].set(wanted, actual);
  }

  // Every kind in the program, so a target can see what a kind inherits.
  collectKinds(program) {
    this.kinds = this.kinds || new Map();
    for (const node of program.body) {
      if (node.type === 'Kind') this.kinds.set(String(node.name).toLowerCase(), node);
    }
  }

  // The values a kind gets from the kinds it is based on.
  inheritedFields(node) {
    const found = new Set();
    let level = node.base ? (this.kinds || new Map()).get(String(node.base).toLowerCase()) : null;
    const seen = new Set();
    while (level && !seen.has(level)) {
      seen.add(level);
      for (const field of level.fields) found.add(this.fieldName(field.name));
      level = level.base ? this.kinds.get(String(level.base).toLowerCase()) : null;
    }
    return found;
  }

  // ------------------------------------------------------------ the shape
  // Targets override these. The defaults are C-like.

  get name() { return 'code'; }
  get extension() { return '.txt'; }
  get indentText() { return '    '; }
  get lineEnd() { return ';'; }
  get selfWord() { return 'this'; }
  get trueWord() { return 'true'; }
  get falseWord() { return 'false'; }
  get nothingWord() { return 'null'; }
  get andWord() { return '&&'; }
  get orWord() { return '||'; }
  get notWord() { return '!'; }

  comment(text) { return '// ' + text; }
  helperCall(name, args) { return `plain_${name}(${args.join(', ')})`; }
  declare(name, value) { return `var ${name} = ${value}`; }
  assign(name, value) { return `${name} = ${value}`; }
  ifHeader(condition) { return `if (${condition}) {`; }
  elseIfHeader(condition) { return `else if (${condition}) {`; }
  elseHeader() { return 'else {'; }
  whileHeader(condition) { return `while (${condition}) {`; }
  forEachHeader(name, iterable) { return `for (var ${name} of ${iterable}) {`; }
  functionHeader(name, params) { return `function ${name}(${params.join(', ')}) {`; }
  classHeader(name, base) { return `class ${name}${base ? ` extends ${base}` : ''} {`; }
  closer() { return '}'; }
  chainPrefix() { return '} '; }
  returnStatement(value) { return value === null ? 'return' : `return ${value}`; }
  breakStatement() { return 'break'; }
  continueStatement() { return 'continue'; }
  listLiteral(items) { return `[${items.join(', ')}]`; }
  recordLiteral(pairs) { return `{ ${pairs.map(([k, v]) => `${this.recordKey(k)}: ${v}`).join(', ')} }`; }
  recordKey(key) { return JSON.stringify(key); }
  textLiteral(text) { return JSON.stringify(text); }
  numberLiteral(value) { return String(value); }
  fieldAccess(object, field) { return `${object}.${field}`; }
  assignField(object, field, value) { return `${this.fieldAccess(object, field)} = ${value}`; }
  newInstance(kind, pairs) { return `new ${kind}(${this.recordLiteral(pairs)})`; }
  methodCall(object, method, args) { return `${object}.${method}(${args.join(', ')})`; }
  callValue(action, args) { return `${action}(${args.join(', ')})`; }
  // Calling an action by its name is not always written the same way as
  // calling one that is being held in a name.
  callFunction(name, args) { return this.callValue(name, args); }
  actionReference(name) { return name; }
  isKindOf(value, kind) { return `${value} instanceof ${kind}`; }
  exitProgram() { return 'process.exit(0)'; }
  raiseProblem(message) { return `throw new Error(${message})`; }
  showStatement(value) { return `console.log(${value})`; }

  // Words the target will not let us use as names.
  get reserved() { return new Set(); }

  // Written once at the top; targets add their own helpers.
  preamble() { return []; }
  postamble() { return []; }
  helperSource() { return {}; }

  // ------------------------------------------------------------- plumbing

  write(text) {
    if (text === '') { this.out.push(''); return; }
    this.out.push(this.indentText.repeat(this.depth) + text);
  }

  writeLine(text) { this.write(text + this.lineEnd); }

  open(header) {
    this.write(header);
    this.depth++;
    this.scopes.push(new Set());
    this.aliases.push(new Map());
  }

  close(text = null) {
    this.depth--;
    if (this.scopes.length > 1) this.scopes.pop();
    if (this.aliases.length > 1) this.aliases.pop();
    const closer = text === null ? this.closer() : text;
    if (closer) this.write(closer);
  }

  // "} else if (x) {" in one line for brace languages, "elif x:" for Python.
  chain(header) {
    this.depth--;
    this.write(this.chainPrefix() + header);
    this.depth++;
  }

  temporary(hint = 'value') {
    this.temporaries++;
    return `_${hint}${this.temporaries}`;
  }

  helper(name, args) {
    this.used.add(name);
    return this.helperCall(name, args);
  }

  // Plain names ignore capitals, so everything is lowered; that also keeps
  // "Score" and "score" as one name, the way the program meant.
  identifier(plainName) {
    let name = String(plainName).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (/^[0-9]/.test(name)) name = '_' + name;
    if (this.reserved.has(name)) name += '_';
    return name;
  }

  // Kinds keep their capital letter, which reads better as a class name.
  kindName(plainName) {
    const clean = String(plainName).replace(/[^A-Za-z0-9_]/g, '');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  fieldName(plainName) {
    return this.identifier(plainName);
  }

  // ------------------------------------------------------------- the walk

  translate(program, meta = {}) {
    this.collectKinds(program);
    const body = this.capture(() => this.statements(program.body));

    if (this.unsupported.length) {
      const list = this.unsupported
        .map(item => `  line ${item.line}: ${item.spec}`)
        .join('\n');
      throw new PlainError(
        `I can translate ordinary programs, but these sentences belong to an engine that only Plain itself can run:\n${list}`,
        this.unsupported[0].line,
        meta.file || null,
        'games, worlds, websites and videos stay in Plain; the rest of your program translates fine'
      );
    }

    const header = [
      this.comment(`Translated from ${meta.file || 'a Plain program'} by Plain ${meta.version || ''}`.trim()),
      this.comment('Plain is the source; this file is what it means in ' + this.name + '.')
    ];

    const helpers = this.emitHelpers();
    const parts = [
      header.join('\n'),
      this.preamble().join('\n'),
      helpers,
      body.join('\n'),
      this.postamble().join('\n')
    ].filter(part => part && part.trim().length);

    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  // Only the helpers this program touched, plus anything they lean on.
  emitHelpers() {
    const sources = this.helperSource();
    const wanted = new Set();
    const add = (name) => {
      if (wanted.has(name) || !sources[name]) return;
      wanted.add(name);
      for (const needed of sources[name].needs || []) add(needed);
    };
    for (const name of this.used) add(name);
    if (!wanted.size) return '';
    const ordered = Object.keys(sources).filter(name => wanted.has(name));
    return ordered.map(name => sources[name].code.trimEnd()).join('\n\n');
  }

  capture(run) {
    const before = this.out;
    this.out = [];
    run();
    const captured = this.out;
    this.out = before;
    return captured;
  }

  statements(nodes) {
    // Kinds and actions first, so the file reads like the Plain one did.
    for (const node of nodes) if (node.type === 'Kind') this.statement(node);
    for (const node of nodes) if (node.type === 'Function') this.statement(node);
    for (const node of nodes) {
      if (node.type === 'Kind' || node.type === 'Function') continue;
      this.statement(node);
    }
  }

  block(node) {
    if (!node || !node.body.length) { this.emptyBlock(); return; }
    for (const statement of node.body) this.statement(statement);
  }

  emptyBlock() { /* brace languages need nothing */ }

  statement(node) {
    switch (node.type) {
      case 'Show': return this.writeLine(this.showStatement(this.text(node.value)));
      case 'Make': {
        const name = this.variable(node.name);
        const value = this.expression(node.value);
        if (this.known(name)) return this.writeLine(this.assign(name, value));
        this.remember(name);
        return this.writeLine(this.declare(name, value));
      }
      case 'Set': {
        const into = node.target;
        // "set item 2 of list to x" is a call, not an assignment.
        if (into.type === 'PhraseValue' && into.spec === 'item $index of $list') {
          return this.writeLine(this.helper('setItem', [
            this.expression(into.args.list), this.expression(into.args.index), this.expression(node.value)
          ]));
        }
        if (into.type === 'Field') {
          return this.writeLine(this.assignField(this.expression(into.object), this.fieldName(into.name), this.expression(node.value)));
        }
        return this.writeLine(this.assign(this.target(into), this.expression(node.value)));
      }
      case 'If': return this.emitIf(node);
      case 'Repeat': return this.emitRepeat(node);
      case 'Count': return this.emitCount(node);
      case 'ForEach': return this.emitForEach(node);
      case 'While': return this.emitWhile(node);
      case 'Function': return this.emitFunction(node);
      case 'Kind': return this.emitKind(node);
      case 'Try': return this.emitTry(node);
      case 'Return': return this.writeLine(this.returnStatement(node.value ? this.expression(node.value) : null));
      case 'Break': return this.writeLine(this.breakStatement());
      case 'Continue': return this.writeLine(this.continueStatement());
      case 'Phrase': return this.emitPhraseStatement(node);
      case 'Block': return this.block(node);
      default:
        this.unsupported.push({ spec: node.type, line: node.line || 0 });
    }
  }

  target(node) {
    if (node.type === 'Var') return this.identifier(node.name);
    if (node.type === 'Field') return this.fieldAccess(this.expression(node.object), this.fieldName(node.name));
    if (node.type === 'PhraseValue' && node.spec === 'item $index of $list') {
      return this.helper('at', [this.expression(node.args.list), this.expression(node.args.index)]);
    }
    this.unsupported.push({ spec: 'setting that', line: node.line || 0 });
    return '_';
  }

  emitIf(node) {
    node.branches.forEach((branch, index) => {
      const condition = this.truth(branch.condition);
      if (index === 0) this.open(this.ifHeader(condition));
      else this.chain(this.elseIfHeader(condition));
      this.block(branch.block);
    });
    if (node.otherwise) {
      this.chain(this.elseHeader());
      this.block(node.otherwise);
    }
    this.close();
  }

  emitRepeat(node) {
    const times = this.expression(node.count);
    const name = this.loopName('count');
    this.open(this.countHeader(name, '1', times, '1'));
    this.bindLoop('count', name);
    this.block(node.block);
    this.close();
  }

  emitCount(node) {
    const name = this.loopName(node.name);
    const from = this.expression(node.from);
    const to = this.expression(node.to);
    const step = node.step ? this.expression(node.step) : '1';
    this.open(this.countHeader(name, from, to, step));
    this.bindLoop(node.name, name);
    this.block(node.block);
    this.close();
  }

  // Plain counts up or down depending on the numbers, so a helper builds the
  // run of numbers rather than trying to squeeze it into a for header.
  countHeader(name, from, to, step) {
    return this.forEachHeader(this.identifier(name), this.helper('range', [from, to, step]));
  }

  emitForEach(node) {
    const name = this.loopName(node.name);
    this.open(this.forEachHeader(name, this.helper('items', [this.expression(node.list)])));
    this.bindLoop(node.name, name);
    this.block(node.block);
    this.close();
  }

  emitWhile(node) {
    this.open(this.whileHeader(this.truth(node.condition)));
    this.block(node.block);
    this.close();
  }

  emitFunction(node) {
    this.write('');
    this.open(this.functionHeader(this.identifier(node.name.replace(/\s+/g, '_')), node.params.map(p => this.identifier(p))));
    for (const param of node.params) this.remember(this.identifier(param));
    this.block(node.block);
    this.finishFunctionBody(node.block);
    this.close();
  }

  // Some languages insist that every way out of an action returns something.
  finishFunctionBody() {}

  emitKind(node) {
    this.write('');
    this.open(this.classHeader(this.kindName(node.name), node.base ? this.kindName(node.base) : null));
    this.emitConstructor(node);
    for (const action of node.actions) {
      this.write('');
      this.open(this.methodHeader(this.identifier(action.name.replace(/\s+/g, '_')), action.params.map(p => this.identifier(p))));
      for (const param of action.params) this.remember(this.identifier(param));
      this.block(action.block);
      this.finishFunctionBody(action.block);
      this.close();
    }
    this.close();
  }

  methodHeader(name, params) { return `${name}(${params.join(', ')}) {`; }

  emitTry(node) {
    this.open(this.tryHeader());
    this.block(node.block);
    this.chain(this.catchHeader('_problem'));
    if (node.rescue) {
      this.remember('problem');
      this.writeLine(this.declare('problem', this.problemText('_problem')));
      this.block(node.rescue);
    } else {
      this.emptyBlock();
    }
    this.close();
  }

  tryHeader() { return 'try {'; }
  catchHeader(name) { return `catch (${name}) {`; }
  problemText(name) { return `${name}.message`; }

  // ------------------------------------------------------------ sentences

  emitPhraseStatement(node) {
    const written = this.phraseStatement(node);
    if (written === undefined) {
      this.unsupported.push({ spec: node.spec, line: node.line || 0 });
      return;
    }
    if (written !== null) this.writeLine(written);
  }

  phraseStatement(node) {
    const args = node.args;
    const value = (key) => this.expression(args[key]);
    const name = (key) => this.variable(args[key]);

    switch (node.spec) {
      case 'add $value to #name':
        return this.assign(name('name'), this.helper('addTo', [name('name'), value('value')]));
      case 'take $value from #name':
        return this.assign(name('name'), `${this.helper('number', [name('name')])} - ${this.helper('number', [value('value')])}`);
      case 'put $value into #name':
        return this.assign(name('name'), value('value'));
      case 'empty #name':
        return this.assign(name('name'), this.helper('emptied', [name('name')]));
      // Assigned back, not just called: in some languages a list that has
      // had something taken out of it is a new list.
      case 'remove $value from #name':
        return this.assign(name('name'), this.helper('removeValue', [name('name'), value('value')]));
      case 'remove item $index from #name':
        return this.assign(name('name'), this.helper('removeAt', [name('name'), value('index')]));
      case 'ask $question into #name':
        return this.assign(name('name'), this.helper('ask', [value('question')]));
      case 'stop the program':
        return this.exitProgram();
      case 'show $value and stop':
        this.writeLine(this.showStatement(this.text(args.value)));
        return this.exitProgram();
      case 'report a problem saying $message':
        return this.raiseProblem(value('message'));
      case 'set value $key of $thing to $value':
        return this.helper('setValue', [value('thing'), value('key'), value('value')]);
      case 'tell $thing to #action':
        return this.methodCall(value('thing'), this.identifier(args.action), []);
      case 'tell $thing to #action with $one':
        return this.methodCall(value('thing'), this.identifier(args.action), [value('one')]);
      case 'tell $thing to #action with $one and $other':
        return this.methodCall(value('thing'), this.identifier(args.action), [value('one'), value('other')]);
      case 'call $action':
        return this.callValue(value('action'), []);
      case 'call $action with $one':
        return this.callValue(value('action'), [value('one')]);
      case 'call $action with $one and $other':
        return this.callValue(value('action'), [value('one'), value('other')]);
      default:
        return this.userAction(node);
    }
  }

  // A sentence the program itself wrote with "to ...".
  userAction(node) {
    if (!String(node.id).startsWith('user:')) return undefined;
    const [words] = String(node.id).slice(5).split('/');
    const order = String(node.spec).split(/\s+/).filter(part => part.startsWith('$')).map(part => part.slice(1));
    const args = order.map(key => this.expression(node.args[key]));
    return this.callFunction(this.identifier(words.replace(/\s+/g, '_')), args);
  }

  // --------------------------------------------------------- expressions

  expression(node) {
    if (node === undefined || node === null) return this.nothingWord;
    switch (node.type) {
      case 'Number': return this.numberLiteral(node.value);
      case 'Text': return this.textLiteral(node.value);
      case 'Bool': return node.value ? this.trueWord : this.falseWord;
      case 'Nothing': return this.nothingWord;
      case 'Var':
        // Inside an action of a kind, "me" is the thing itself.
        return node.name.toLowerCase() === 'me' ? this.selfWord : this.variable(node.name);
      case 'List': return this.listLiteral(node.items.map(item => this.expression(item)));
      case 'Record': return this.recordLiteral(node.pairs.map(pair => [pair.key, this.expression(pair.value)]));
      case 'Field': return this.readField(node);
      case 'New': return this.newInstance(this.kindName(node.kind), node.pairs.map(pair => [pair.key, this.expression(pair.value)]));
      case 'Not': return `${this.notWord}(${this.truth(node.value)})`;
      case 'Negate': return `-(${this.expression(node.value)})`;
      case 'Logic': return `(${this.truth(node.left)} ${node.op === 'and' ? this.andWord : this.orWord} ${this.truth(node.right)})`;
      case 'Compare': return this.comparison(node);
      case 'Math': return this.maths(node);
      case 'PhraseValue': return this.phraseValue(node);
      default:
        this.unsupported.push({ spec: node.type, line: node.line || 0 });
        return this.nothingWord;
    }
  }

  readField(node) {
    const object = this.expression(node.object);
    const field = String(node.name).toLowerCase();
    if (['length', 'size', 'count'].includes(field)) return this.helper('length', [object]);
    if (field === 'first') return this.helper('first', [object]);
    if (field === 'last') return this.helper('last', [object]);
    if (node.object.type === 'Var' && node.object.name.toLowerCase() === 'me') {
      return this.fieldAccess(this.selfWord, this.fieldName(node.name));
    }
    return this.fieldAccess(object, this.fieldName(node.name));
  }

  text(node) {
    return this.helper('text', [this.expression(node)]);
  }

  truth(node) {
    // Comparisons and logic are already true or false.
    if (['Compare', 'Logic', 'Not', 'Bool'].includes(node.type)) return this.expression(node);
    return this.helper('truthy', [this.expression(node)]);
  }

  comparison(node) {
    const left = this.expression(node.left);
    const right = this.expression(node.right);
    switch (node.op) {
      case '==': return this.helper('same', [left, right]);
      case '!=': return `${this.notWord}(${this.helper('same', [left, right])})`;
      case 'contains': return this.helper('has', [left, right]);
      default: return `(${this.helper('number', [left])} ${node.op} ${this.helper('number', [right])})`;
    }
  }

  maths(node) {
    const left = this.expression(node.left);
    const right = this.expression(node.right);
    if (node.op === 'join') return this.helper('join2', [left, right]);
    if (node.op === '+') return this.helper('add', [left, right]);
    if (node.op === '^') return this.power(left, right);
    // Plain refuses to divide by zero rather than handing back infinity.
    if (node.op === '/') return this.helper('divide', [left, right]);
    if (node.op === '%') return this.helper('remainder', [left, right]);
    return `(${this.helper('number', [left])} ${node.op} ${this.helper('number', [right])})`;
  }

  power(left, right) { return `Math.pow(${left}, ${right})`; }

  // Whole numbers only, the way the bit sentences mean them.
  bitwise(sign, left, right) {
    return `(${this.helper('whole', [left])} ${sign} ${this.helper('whole', [right])})`;
  }

  bitwiseNot(value) { return `(~${this.helper('whole', [value])})`; }

  // Sentences a particular language has no honest way to do.
  get cannotDo() { return new Set(); }

  phraseValue(node) {
    const args = node.args;
    const value = (key) => this.expression(args[key]);

    if (this.cannotDo.has(node.spec)) {
      this.unsupported.push({ spec: `${node.spec}  (${this.name} has no such thing)`, line: node.line || 0 });
      return this.nothingWord;
    }

    switch (node.spec) {
      // lists
      case 'item $index of $list': return this.helper('item', [value('list'), value('index')]);
      case 'first of $list': return this.helper('first', [value('list')]);
      case 'last of $list': return this.helper('last', [value('list')]);
      case 'length of $thing': return this.helper('length', [value('thing')]);
      case 'size of $thing': return this.helper('length', [value('thing')]);
      case 'number of items in $list': return this.helper('length', [value('list')]);
      case 'total of $list': return this.helper('total', [value('list')]);
      case 'highest of $list': return this.helper('highest', [value('list')]);
      case 'lowest of $list': return this.helper('lowest', [value('list')]);
      case 'average of $list': return this.helper('average', [value('list')]);
      case 'sorted $list': return this.helper('sorted', [value('list')]);
      case 'reversed $list': return this.helper('reversed', [value('list')]);
      case 'copy of $thing': return this.helper('copy', [value('thing')]);
      case 'join $list with $separator': return this.helper('joinWith', [value('list'), value('separator')]);
      case 'position of $value in $list': return this.helper('position', [value('list'), value('value')]);
      case 'random item of $list': return this.helper('randomItem', [value('list')]);
      case 'keys of $thing': return this.helper('keys', [value('thing')]);
      case 'values of $thing': return this.helper('values', [value('thing')]);
      case 'value $key of $thing': return this.helper('value', [value('thing'), value('key')]);

      // text
      case 'text of $value': return this.helper('text', [value('value')]);
      case 'number of $value': return this.helper('number', [value('value')]);
      case 'uppercase of $text': return this.helper('upper', [value('text')]);
      case 'lowercase of $text': return this.helper('lower', [value('text')]);
      case 'trimmed $text': return this.helper('trimmed', [value('text')]);
      case 'parts of $text split by $separator': return this.helper('split', [value('text'), value('separator')]);
      case 'part of $text from $start to $finish': return this.helper('part', [value('text'), value('start'), value('finish')]);
      case 'replace $find with $replacement in $text': return this.helper('replace', [value('text'), value('find'), value('replacement')]);
      case 'does $text start with $prefix': return this.helper('startsWith', [value('text'), value('prefix')]);

      // patterns
      case '$text matches $pattern': return this.helper('matches', [value('text'), value('pattern')]);
      case 'first match of $pattern in $text': return this.helper('firstMatch', [value('text'), value('pattern')]);
      case 'parts of $text matching $pattern': return this.helper('allMatches', [value('text'), value('pattern')]);
      case 'replace pattern $pattern with $replacement in $text':
        return this.helper('replacePattern', [value('text'), value('pattern'), value('replacement')]);

      // the bits
      case 'bitwise and of $a and $b': return this.bitwise('&', value('a'), value('b'));
      case 'bitwise or of $a and $b': return this.bitwise('|', value('a'), value('b'));
      case 'bitwise xor of $a and $b': return this.bitwise('^', value('a'), value('b'));
      case 'bitwise not of $a': return this.bitwiseNot(value('a'));
      case 'shift $a left by $b': return this.bitwise('<<', value('a'), value('b'));
      case 'shift $a right by $b': return this.bitwise('>>', value('a'), value('b'));
      case 'does $text end with $suffix': return this.helper('endsWith', [value('text'), value('suffix')]);

      // numbers
      case 'round $number': return this.helper('round', [value('number')]);
      case 'round $number to $places places': return this.helper('roundTo', [value('number'), value('places')]);
      case 'floor of $number': return this.helper('floor', [value('number')]);
      case 'ceiling of $number': return this.helper('ceiling', [value('number')]);
      case 'absolute of $number': return this.helper('absolute', [value('number')]);
      case 'square root of $number': return this.helper('squareRoot', [value('number')]);
      case 'sine of $number': return this.helper('sine', [value('number')]);
      case 'cosine of $number': return this.helper('cosine', [value('number')]);
      case 'smaller of $a and $b': return this.helper('smaller', [value('a'), value('b')]);
      case 'bigger of $a and $b': return this.helper('bigger', [value('a'), value('b')]);
      case 'pi': return this.helper('pi', []);
      case 'e': return this.helper('e', []);
      case 'exponent of $number': return this.helper('exponent', [value('number')]);
      case 'logarithm of $number': return this.helper('logarithm', [value('number')]);
      case 'tangent of $number': return this.helper('tangent', [value('number')]);
      case 'random $low to $high': return this.helper('randomBetween', [value('low'), value('high')]);
      case 'random number': return this.helper('randomNumber', []);
      case 'time now': return this.helper('timeNow', []);
      case 'today': return this.helper('today', []);
      case 'kind of $value': return this.helper('kindOf', [value('value')]);
      case 'kind name of $thing': return this.kindNameOf(value('thing'));

      // kinds and actions
      case 'ask $thing to #action': return this.methodCall(value('thing'), this.identifier(args.action), []);
      case 'ask $thing to #action with $one': return this.methodCall(value('thing'), this.identifier(args.action), [value('one')]);
      case 'ask $thing to #action with $one and $other':
        return this.methodCall(value('thing'), this.identifier(args.action), [value('one'), value('other')]);
      case 'the action #name': return this.actionReference(this.identifier(String(args.name).replace(/\s+/g, '_')));
      case 'call $action': return this.callValue(value('action'), []);
      case 'call $action with $one': return this.callValue(value('action'), [value('one')]);
      case 'call $action with $one and $other': return this.callValue(value('action'), [value('one'), value('other')]);

      // sentences that sit between two values
      case '$thing has $key': return this.helper('hasKey', [value('thing'), value('key')]);
      case '$thing is a kind of #kind': return this.isKindOf(value('thing'), this.kindName(args.kind));
      case '$list changed by $action': return this.helper('changedBy', [value('list'), value('action')]);
      case '$list kept where $action': return this.helper('keptWhere', [value('list'), value('action')]);
      case '$list added up by $action': return this.helper('addedUpBy', [value('list'), value('action')]);

      default: {
        const written = this.userAction(node);
        if (written !== undefined) return written;
        this.unsupported.push({ spec: node.spec, line: node.line || 0 });
        return this.nothingWord;
      }
    }
  }

  kindNameOf(value) { return `${value}.constructor.name`; }
}

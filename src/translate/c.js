// Plain -> C.
//
// C has no type that holds anything, no lists that grow, no text that joins,
// and no way to give memory back on its own. Plain needs all four, so
// runtime/c/plain.c builds them: one Value that can be any Plain value, and
// a count of how many names are holding each thing on the heap, swept up at
// the end of every loop turn.
//
// That runtime is a real C file, compiled and checked on its own by the test
// suite, and written out above the program - so `plain translate x --to c`
// gives you one .c file that any C compiler will build.
//
// Two things shape what comes out. Every name a piece of the program holds
// lives in a slot the runtime knows about, so the sweep can tell what is
// still wanted; that means all the names are declared at the top of the
// function they belong to, the way C used to insist on anyway. And every
// name is written to through plain_keep, which lets go of what was there
// before taking hold of what is arriving.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Emitter } from './emitter.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.resolve(HERE, '..', '..', 'runtime', 'c', 'plain.c');

const RESERVED = new Set([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline',
  'int', 'long', 'register', 'restrict', 'return', 'short', 'signed',
  'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned',
  'void', 'volatile', 'while', 'bool', 'true', 'false', 'null', 'NULL',
  // Names this file and the runtime write themselves.
  'main', 'me', 'args', 'count', 'value', 'thing', 'list', 'index', 'time',
  'exit', 'free', 'malloc', 'realloc', 'printf', 'stdin', 'stdout', 'stderr',
  'log', 'exp', 'pow', 'sqrt', 'sin', 'cos', 'tan', 'floor', 'ceil', 'fabs',
  'fmod', 'div', 'remainder', 'gamma', 'y0', 'y1', 'j0', 'j1', 'link', 'read',
  'write', 'close', 'open', 'kill', 'signal', 'random', 'clock'
]);

export class CEmitter extends Emitter {
  get name() { return 'C'; }
  get extension() { return '.c'; }
  get reserved() { return RESERVED; }
  get nothingWord() { return 'plain_nothing()'; }
  get trueWord() { return 'plain_bool(1)'; }
  get falseWord() { return 'plain_bool(0)'; }
  get selfWord() { return 'me'; }

  constructor(options) {
    super(options);
    this.locals = new Set();      // Value names this function holds
    this.helpersNeeded = new Set();
    this.wrappers = new Map();    // actions used as values
  }

  // C has no patterns of its own, and reaching for a library would break the
  // one-file promise, so these say so rather than half working.
  get cannotDo() {
    return new Set([
      '$text matches $pattern',
      'first match of $pattern in $text',
      'parts of $text matching $pattern',
      'replace pattern $pattern with $replacement in $text'
    ]);
  }

  helperCall(name, args) {
    return `plain_${name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}(${args.join(', ')})`;
  }

  // The whole runtime goes out every time; C only warns about what it does
  // not reach, and one unchanging file is one you can read once and trust.
  emitHelpers() { return ''; }

  // -------------------------------------------------------------- the shape

  // Both of these are the same thing in C: the name already exists, up at the
  // top of the function, and writing to it lets go of what was there.
  declare(name, value) {
    this.locals.add(name);
    return `plain_keep(&${name}, ${value})`;
  }

  assign(name, value) {
    this.locals.add(name);
    return `plain_keep(&${name}, ${value})`;
  }

  ifHeader(condition) { return `if (${condition}) {`; }
  elseIfHeader(condition) { return `else if (${condition}) {`; }
  elseHeader() { return 'else {'; }
  whileHeader(condition) { return `while (${condition}) {`; }
  showStatement(value) { return `plain_say(${value})`; }
  exitProgram() { return 'plain_done(), exit(0)'; }
  raiseProblem(message) { return `plain_fail_value(${message})`; }
  chainPrefix() { return '} '; }

  numberLiteral(value) {
    if (!Number.isFinite(value)) return 'plain_number_value(0.0)';
    return `plain_number_value(${Number.isInteger(value) ? `${value}.0` : String(value)})`;
  }

  textLiteral(text) { return `plain_text_value(${cText(text)})`; }

  listLiteral(items) {
    return `plain_list_of(${items.length}${items.length ? ', ' + items.join(', ') : ''})`;
  }

  recordLiteral(pairs) {
    const parts = pairs.map(([key, value]) => `${cText(key)}, ${value}`);
    return `plain_record(${pairs.length}${parts.length ? ', ' + parts.join(', ') : ''})`;
  }

  newInstance(kind, pairs) {
    const parts = pairs.map(([key, value]) => `${cText(this.fieldName(key))}, ${value}`);
    return `plain_new(${cText(kind)}, ${pairs.length}${parts.length ? ', ' + parts.join(', ') : ''})`;
  }

  fieldAccess(object, field) { return `plain_field(${object}, ${cText(field)})`; }
  assignField(object, field, value) { return `plain_set_field(${object}, ${cText(field)}, ${value})`; }
  methodCall(object, method, args) {
    return `plain_tell_with(${object}, ${cText(method)}, ${args.length}${args.length ? ', ' + args.join(', ') : ''})`;
  }
  callValue(action, args) {
    return `plain_run_with(${action}, ${args.length}${args.length ? ', ' + args.join(', ') : ''})`;
  }
  callFunction(name, args) { return `${name}(${args.join(', ')})`; }
  isKindOf(value, kind) { return `plain_is_kind(${value}, ${cText(kind)})`; }
  kindNameOf(value) { return `plain_kind_name(${value})`; }
  power(left, right) { return `plain_power(${left}, ${right})`; }

  // An action held in a name needs a small wrapper of the shape the runtime
  // calls: one that unpacks the list of values and passes them along.
  actionReference(name) {
    this.wrappers.set(name, this.arities.get(name) || 0);
    return `plain_action_value(plain_as_${name})`;
  }

  // ------------------------------------------------- everything is a Value

  truth(node) { return `plain_truthy(${this.expression(node)})`; }

  expression(node) {
    if (node === undefined || node === null) return this.nothingWord;
    switch (node.type) {
      case 'Negate': return `plain_negate(${this.expression(node.value)})`;
      case 'Not': return `plain_bool(!${this.truth(node.value)})`;
      case 'Logic':
        return `plain_bool(${this.truth(node.left)} ${node.op === 'and' ? '&&' : '||'} ${this.truth(node.right)})`;
      default:
        return super.expression(node);
    }
  }

  readField(node) {
    const object = this.expression(node.object);
    const field = String(node.name).toLowerCase();
    if (['length', 'size', 'count'].includes(field)) return `plain_length(${object})`;
    if (field === 'first') return `plain_first(${object})`;
    if (field === 'last') return `plain_last(${object})`;
    return this.fieldAccess(object, this.fieldName(node.name));
  }

  comparison(node) {
    const left = this.expression(node.left);
    const right = this.expression(node.right);
    switch (node.op) {
      case '==': return `plain_same(${left}, ${right})`;
      case '!=': return `plain_bool(!plain_truthy(plain_same(${left}, ${right})))`;
      case 'contains': return `plain_has(${left}, ${right})`;
      case '<': return `plain_less(${left}, ${right})`;
      case '<=': return `plain_less_equal(${left}, ${right})`;
      case '>': return `plain_more(${left}, ${right})`;
      case '>=': return `plain_more_equal(${left}, ${right})`;
      default: return `plain_same(${left}, ${right})`;
    }
  }

  maths(node) {
    const left = this.expression(node.left);
    const right = this.expression(node.right);
    const named = {
      join: 'plain_join2', '+': 'plain_add', '-': 'plain_minus', '*': 'plain_times',
      '/': 'plain_divide', '%': 'plain_remainder', '^': 'plain_power'
    }[node.op];
    return `${named || 'plain_add'}(${left}, ${right})`;
  }

  bitwise(sign, left, right) {
    const word = { '&': 'and', '|': 'or', '^': 'xor', '<<': 'left', '>>': 'right' }[sign] || 'and';
    return `plain_bits(${cText(word)}, ${left}, ${right})`;
  }

  bitwiseNot(value) { return `plain_bits_not(${value})`; }

  phraseStatement(node) {
    if (node.spec === 'take $value from #name') {
      const name = this.variable(node.args.name);
      this.locals.add(name);
      return `plain_keep(&${name}, plain_minus(${name}, ${this.expression(node.args.value)}))`;
    }
    return super.phraseStatement(node);
  }

  // ----------------------------------------------------------------- loops
  //
  // Walking a list means holding on to it: the sweep at the end of each turn
  // would otherwise take it away halfway through.

  walk(name, over, block) {
    const number = ++this.temporaries;
    const held = `_walk${number}`;
    const at = `_at${number}`;
    this.locals.add(held);
    this.counters = this.counters || new Set();
    this.counters.add(at);
    this.writeLine(`plain_keep(&${held}, ${over})`);
    this.open(`for (${at} = 0; ${at} < plain_count(${held}); ${at}++) {`);
    this.writeLine(`plain_keep(&${name}, plain_index(${held}, ${at}))`);
    this.locals.add(name);
    block();
    this.writeLine('plain_sweep(&_frame)');
    this.close();
  }

  emitForEach(node) {
    const name = this.loopName(node.name);
    this.walk(name, `plain_items(${this.expression(node.list)})`, () => {
      this.bindLoop(node.name, name);
      this.block(node.block);
    });
  }

  emitRepeat(node) {
    const name = this.loopName('count');
    const over = `plain_range(plain_number_value(1.0), ${this.expression(node.count)}, plain_number_value(1.0))`;
    this.walk(name, over, () => {
      this.bindLoop('count', name);
      this.block(node.block);
    });
  }

  emitCount(node) {
    const name = this.loopName(node.name);
    const step = node.step ? this.expression(node.step) : 'plain_number_value(1.0)';
    const over = `plain_range(${this.expression(node.from)}, ${this.expression(node.to)}, ${step})`;
    this.walk(name, over, () => {
      this.bindLoop(node.name, name);
      this.block(node.block);
    });
  }

  emitWhile(node) {
    this.open(this.whileHeader(this.truth(node.condition)));
    this.block(node.block);
    this.writeLine('plain_sweep(&_frame)');
    this.close();
  }

  // C has no exceptions. The runtime marks the spot and jumps back to it.
  emitTry(node) {
    const number = ++this.temporaries;
    const spot = `_caught${number}`;
    this.catchers = this.catchers || new Set();
    this.catchers.add(spot);
    this.writeLine(`plain_push_catch(&${spot})`);
    this.open(`if (PLAIN_SETJMP(${spot}.jump) == 0) {`);
    this.block(node.block);
    this.writeLine('plain_pop_catch()');
    this.chain(this.elseHeader());
    this.writeLine('plain_pop_catch()');
    if (node.rescue) {
      const named = this.variable('problem');
      this.locals.add(named);
      this.writeLine(`plain_keep(&${named}, plain_text_value(${spot}.words))`);
      this.block(node.rescue);
    }
    this.close();
  }

  // --------------------------------------------------------------- actions

  returnStatement(value) {
    return `return plain_leave(&_frame, ${value === null ? this.nothingWord : value})`;
  }

  emitFunction(node) {
    this.write('');
    const name = this.identifier(node.name.replace(/\s+/g, '_'));
    const params = node.params.map(one => this.identifier(one));
    this.body(`static Value ${name}(${params.length ? params.map(one => `Value ${one}`).join(', ') : 'void'}) {`,
      params, () => this.block(node.block), node.block);
  }

  emitKind(node) {
    const kind = this.kindName(node.name);
    for (const action of node.actions) {
      this.write('');
      const named = `${kind}_${this.identifier(action.name.replace(/\s+/g, '_'))}`;
      this.body(`static Value ${named}(Value me, Value *args, int _count) {`, ['me'], () => {
        action.params.forEach((param, at) => {
          const one = this.identifier(param);
          this.locals.add(one);
          this.writeLine(`plain_keep(&${one}, plain_at(args, _count, ${at}))`);
        });
        this.block(action.block);
      }, action.block, ['(void)args; (void)_count;']);
    }
  }

  emitConstructor() { /* the tables below do this */ }

  // One function, written twice over: once to find out which names it holds,
  // and once with those names declared at the top where C wants them.
  body(header, params, run, block, extras = []) {
    const heldLocals = this.locals;
    const heldCounters = this.counters;
    const heldCatchers = this.catchers;
    this.locals = new Set();
    this.counters = new Set();
    this.catchers = new Set();

    for (const one of params) this.remember(one);
    const inside = this.capture(() => {
      this.depth++;
      run();
      const last = block && block.body.length ? block.body[block.body.length - 1] : null;
      if (!last || last.type !== 'Return') this.writeLine(this.returnStatement(null));
      this.depth--;
    });

    const names = [...this.locals].filter(one => !params.includes(one));
    this.open(header);
    this.writeLine('PlainFrame _frame');
    for (const one of names) this.writeLine(`Value ${one} = plain_nothing()`);
    for (const one of this.counters) this.writeLine(`size_t ${one} = 0`);
    for (const one of this.catchers) this.writeLine(`PlainCatch ${one}`);
    for (const one of extras) this.write(one);
    this.writeLine('plain_enter(&_frame)');
    for (const one of params) this.writeLine(`plain_param(&_frame, &${one})`);
    for (const one of names) this.writeLine(`plain_local(&_frame, &${one})`);
    this.depth--;
    for (const line of inside) this.out.push(line);
    this.depth++;
    this.close();

    this.locals = heldLocals;
    this.counters = heldCounters;
    this.catchers = heldCatchers;
  }

  // ---------------------------------------------------------------- the file

  translate(program, meta = {}) {
    this.collectKinds(program);
    this.arities = new Map();
    for (const node of program.body) {
      if (node.type === 'Function') {
        this.arities.set(this.identifier(node.name.replace(/\s+/g, '_')), node.params.length);
      }
    }

    const kinds = program.body.filter(node => node.type === 'Kind');

    this.depth = 0;
    const kindCode = this.capture(() => {
      for (const node of kinds) this.statement(node);
    });
    const actions = this.capture(() => {
      for (const node of program.body) if (node.type === 'Function') this.statement(node);
    });

    this.locals = new Set();
    this.counters = new Set();
    this.catchers = new Set();
    const inside = this.capture(() => {
      this.depth++;
      for (const node of program.body) {
        if (node.type === 'Kind' || node.type === 'Function') continue;
        this.statement(node);
      }
      this.depth--;
    });
    const mainNames = [...this.locals];

    if (this.unsupported.length) return Emitter.prototype.translate.call(this, program, meta);

    const out = [
      this.comment(`Translated from ${meta.file || 'a Plain program'} by Plain ${meta.version || ''}`.trim()),
      this.comment('Plain is the source; this file is what it means in C.'),
      this.comment('Build it with:  cc -O2 program.c -o program -lm'),
      '',
      readRuntime(),
      ''
    ];

    // Everything is announced before it is used, so the order of the file is
    // the order the program was written in.
    const heads = [];
    for (const node of program.body) {
      if (node.type !== 'Function') continue;
      const name = this.identifier(node.name.replace(/\s+/g, '_'));
      const params = node.params.map(one => `Value ${this.identifier(one)}`);
      heads.push(`static Value ${name}(${params.length ? params.join(', ') : 'void'});`);
    }
    for (const node of kinds) {
      for (const action of node.actions) {
        heads.push(`static Value ${this.kindName(node.name)}_${this.identifier(action.name.replace(/\s+/g, '_'))}(Value me, Value *args, int _count);`);
      }
    }
    if (heads.length) out.push(...heads, '');

    out.push(...this.kindTables(kinds), '');
    if (kindCode.length) out.push(...kindCode, '');
    if (actions.length) out.push(...actions, '');

    for (const [name, takes] of this.wrappers) {
      const passed = [];
      for (let at = 0; at < takes; at++) passed.push(`plain_at(args, count, ${at})`);
      out.push(`static Value plain_as_${name}(Value *args, int count) {`);
      out.push(`    (void)args; (void)count;`);
      out.push(`    return ${name}(${passed.join(', ')});`);
      out.push('}', '');
    }

    out.push('int main(void) {');
    out.push('    PlainFrame _frame;');
    for (const one of mainNames) out.push(`    Value ${one} = plain_nothing();`);
    for (const one of this.counters) out.push(`    size_t ${one} = 0;`);
    for (const one of this.catchers) out.push(`    PlainCatch ${one};`);
    out.push('    plain_enter(&_frame);');
    for (const one of mainNames) out.push(`    plain_local(&_frame, &${one});`);
    out.push(...inside);
    out.push('    plain_leave(&_frame, plain_nothing());');
    out.push('    plain_done();');
    out.push('    return 0;');
    out.push('}');

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  kindTables(kinds) {
    const lines = [];

    lines.push('/* What each of your kinds is based on. */');
    lines.push('static const char *plain_base(const char *kind) {');
    lines.push('    (void)kind;');
    for (const node of kinds) {
      if (!node.base) continue;
      lines.push(`    if (strcmp(kind, ${cText(this.kindName(node.name))}) == 0) return ${cText(this.kindName(node.base))};`);
    }
    lines.push('    return NULL;');
    lines.push('}');
    lines.push('');

    lines.push('/* The values a new one starts with, base first so that a kind');
    lines.push(' * built on another can say something different. */');
    lines.push('static void plain_defaults(const char *kind, Value into) {');
    lines.push('    (void)kind; (void)into;');
    for (const node of kinds) {
      const parts = [];
      if (node.base) parts.push(`plain_defaults(${cText(this.kindName(node.base))}, into);`);
      for (const field of node.fields) {
        const value = field.value ? this.expression(field.value) : this.nothingWord;
        parts.push(`plain_own(into, ${cText(this.fieldName(field.name))}, ${value});`);
      }
      parts.push('return;');
      lines.push(`    if (strcmp(kind, ${cText(this.kindName(node.name))}) == 0) { ${parts.join(' ')} }`);
    }
    lines.push('}');
    lines.push('');

    lines.push('/* What each kind knows how to do. */');
    lines.push('static int plain_do(const char *kind, const char *action, Value me, Value *args, int count, Value *answer) {');
    lines.push('    (void)kind; (void)action; (void)me; (void)args; (void)count; (void)answer;');
    for (const node of kinds) {
      const kind = this.kindName(node.name);
      for (const one of node.actions) {
        const named = this.identifier(one.name.replace(/\s+/g, '_'));
        lines.push(`    if (strcmp(kind, ${cText(kind)}) == 0 && strcmp(action, ${cText(named)}) == 0) {`);
        lines.push(`        *answer = ${kind}_${named}(me, args, count);`);
        lines.push('        return 1;');
        lines.push('    }');
      }
    }
    lines.push('    return 0;');
    lines.push('}');

    return lines;
  }
}

// C wants \ooo for anything odd, and will not take a stray newline.
function cText(text) {
  let out = '"';
  for (const letter of String(text)) {
    const code = letter.codePointAt(0);
    if (letter === '\\') out += '\\\\';
    else if (letter === '"') out += '\\"';
    else if (letter === '\n') out += '\\n';
    else if (letter === '\r') out += '\\r';
    else if (letter === '\t') out += '\\t';
    else if (code < 0x20 || code === 0x7f) out += '\\' + code.toString(8).padStart(3, '0');
    else out += letter;
  }
  return out + '"';
}

let held = null;

function readRuntime() {
  if (held === null) held = fs.readFileSync(RUNTIME, 'utf8').trimEnd();
  return held;
}

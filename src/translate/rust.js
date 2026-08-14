// Plain -> Rust.
//
// Rust wants to know the type of every value and who owns it. Plain does
// not: a name holds whatever you put in it, and two names can hold the same
// list. So every Plain value becomes one Rust type - `Value` - and sharing
// is done with Rc, which frees a thing when the last name lets go of it.
//
// That type and everything that works on it live in runtime/rust/plain.rs,
// a real Rust file that compiles and is checked on its own. It is pasted in
// above the program, so what comes out is one .rs file that rustc will build
// with no crates, no Cargo, no build file.
//
// Reading a name writes `.clone()` after it. On an Rc that is cheap - it
// nudges a counter - and it saves the generated code from having to reason
// about who owns what.

import { Emitter } from './emitter.js';
import { runtimeSource, PROGRAM_STARTS } from './runtimes.js';

const RESERVED = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else',
  'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop',
  'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'static',
  'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where',
  'while', 'abstract', 'become', 'box', 'do', 'final', 'macro', 'override',
  'priv', 'try', 'typeof', 'union', 'unsized', 'virtual', 'yield',
  // Names this file writes itself.
  'me', 'args', 'main', 'value', 'thing', 'string', 'vec', 'rc', 'option',
  'some', 'none', 'result', 'ok', 'err', 'clone', 'drop'
]);

export class RustEmitter extends Emitter {
  get name() { return 'Rust'; }
  get extension() { return '.rs'; }
  get reserved() { return RESERVED; }
  get nothingWord() { return 'Value::Nothing'; }
  get trueWord() { return 'Value::Bool(true)'; }
  get falseWord() { return 'Value::Bool(false)'; }
  get selfWord() { return 'me'; }

  constructor(options) {
    super(options);
    this.arities = new Map();     // an action's name -> how many things it takes
  }

  // Rust's own library has no patterns in it - everyone reaches for the
  // regex crate - and the whole point of what comes out here is that it
  // needs nothing but rustc. So these say so rather than half working.
  get cannotDo() {
    return new Set([
      '$text matches $pattern',
      'first match of $pattern in $text',
      'parts of $text matching $pattern',
      'replace pattern $pattern with $replacement in $text'
    ]);
  }

  // plain.rs spells its helpers the way Rust does: lower, with underscores.
  helperCall(name, args) {
    return `plain_${name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}(${args.join(', ')})`;
  }

  // The whole runtime is written out every time. Rust only warns about code
  // it never reaches, so there is nothing to gain by picking through it, and
  // a file that is always the same is a file you can read once and trust.
  emitHelpers() { return ''; }

  // -------------------------------------------------------------- the shape

  declare(name, value) { return `let mut ${name} = ${value}`; }
  assign(name, value) { return `${name} = ${value}`; }
  ifHeader(condition) { return `if ${condition} {`; }
  elseIfHeader(condition) { return `else if ${condition} {`; }
  whileHeader(condition) { return `while ${condition} {`; }
  forEachHeader(name, iterable) { return `for mut ${name} in ${iterable} {`; }
  functionHeader(name, params) {
    return `fn ${name}(${params.map(one => `mut ${one}: Value`).join(', ')}) -> Value {`;
  }
  showStatement(value) { return `println!("{}", plain_show(&${value}))`; }
  exitProgram() { return 'std::process::exit(0)'; }
  raiseProblem(message) { return `plain_fail(&plain_show(&${message}))`; }
  returnStatement(value) { return `return ${value === null ? this.nothingWord : value}`; }

  numberLiteral(value) {
    if (!Number.isFinite(value)) return 'Value::Number(f64::NAN)';
    return `Value::Number(${Number.isInteger(value) ? `${value}.0` : String(value)})`;
  }

  textLiteral(text) {
    return `plain_text_value(String::from(${rustText(text)}))`;
  }

  listLiteral(items) {
    return `plain_list_value(vec![${items.join(', ')}])`;
  }

  recordLiteral(pairs) {
    return `plain_record(vec![${pairs.map(([key, value]) => `(${rustText(key)}, ${value})`).join(', ')}])`;
  }

  newInstance(kind, pairs) {
    const filled = pairs.map(([key, value]) => `(${rustText(this.fieldName(key))}, ${value})`);
    return `plain_new(${rustText(kind)}, vec![${filled.join(', ')}])`;
  }

  fieldAccess(object, field) { return `plain_field(${object}, ${rustText(field)})`; }
  assignField(object, field, value) { return `plain_set_field(${object}, ${rustText(field)}, ${value})`; }
  methodCall(object, method, args) { return `plain_tell(${object}, ${rustText(method)}, &[${args.join(', ')}])`; }
  callValue(action, args) { return `plain_run(${action}, &[${args.join(', ')}])`; }
  callFunction(name, args) { return `${name}(${args.join(', ')})`; }
  isKindOf(value, kind) { return `plain_is_kind(${value}, ${rustText(kind)})`; }
  kindNameOf(value) { return `plain_kind_name(${value})`; }
  power(left, right) { return `plain_power(${left}, ${right})`; }

  // An action held in a name is a closure that unpacks the list it is given.
  actionReference(name) {
    const takes = this.arities.get(name) || 0;
    const args = [];
    for (let at = 0; at < takes; at++) args.push(`plain_at(args, ${at})`);
    return `Value::Action(Rc::new(|args: &[Value]| ${name}(${args.join(', ')})))`;
  }

  // ------------------------------------------------------ everything is a Value

  // Reading a name hands out a share of it rather than giving it away.
  expression(node) {
    if (node === undefined || node === null) return this.nothingWord;
    switch (node.type) {
      case 'Var':
        return node.name.toLowerCase() === 'me'
          ? `${this.selfWord}.clone()`
          : `${this.variable(node.name)}.clone()`;
      case 'Negate':
        return `plain_negate(${this.expression(node.value)})`;
      case 'Not':
        return `plain_bool(!${this.truth(node.value)})`;
      case 'Logic':
        return `plain_bool((${this.truth(node.left)} ${node.op === 'and' ? '&&' : '||'} ${this.truth(node.right)}))`;
      default:
        return super.expression(node);
    }
  }

  // "name of me" has to hand out a share of `me` like any other read, or the
  // second thing an action looks at finds it already given away.
  readField(node) {
    const object = this.expression(node.object);
    const field = String(node.name).toLowerCase();
    if (['length', 'size', 'count'].includes(field)) return `plain_length(${object})`;
    if (field === 'first') return `plain_first(${object})`;
    if (field === 'last') return `plain_last(${object})`;
    return this.fieldAccess(object, this.fieldName(node.name));
  }

  // A question is a Value like everything else, so asking whether it holds
  // goes through the same door every time.
  truth(node) {
    return `plain_truthy(${this.expression(node)})`;
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
    return `plain_bits(${rustText(word)}, ${left}, ${right})`;
  }

  bitwiseNot(value) { return `plain_bits_not(${value})`; }

  // "take 1 from score" is a sum, and a sum has to stay a Value.
  phraseStatement(node) {
    if (node.spec === 'take $value from #name') {
      const name = this.variable(node.args.name);
      return `${name} = plain_minus(${name}, ${this.expression(node.args.value)})`;
    }
    return super.phraseStatement(node);
  }

  // ----------------------------------------------------------------- blocks

  // The counting loops hand plain_range three Values, so the ones the
  // program did not write have to be Values too.
  emitRepeat(node) {
    const name = this.loopName('count');
    this.open(this.countHeader(name, 'Value::Number(1.0)', this.expression(node.count), 'Value::Number(1.0)'));
    this.bindLoop('count', name);
    this.block(node.block);
    this.close();
  }

  emitCount(node) {
    const name = this.loopName(node.name);
    const from = this.expression(node.from);
    const to = this.expression(node.to);
    const step = node.step ? this.expression(node.step) : 'Value::Number(1.0)';
    this.open(this.countHeader(name, from, to, step));
    this.bindLoop(node.name, name);
    this.block(node.block);
    this.close();
  }

  emitFunction(node) {
    this.write('');
    const name = this.identifier(node.name.replace(/\s+/g, '_'));
    this.open(this.functionHeader(name, node.params.map(one => this.identifier(one))));
    for (const param of node.params) this.remember(this.identifier(param));
    this.block(node.block);
    this.finishFunctionBody(node.block);
    this.close();
  }

  finishFunctionBody(block) {
    const last = block && block.body.length ? block.body[block.body.length - 1] : null;
    if (!last || last.type !== 'Return') this.writeLine(this.returnStatement(null));
  }

  // Rust has no exceptions to catch. `plain_try` runs the risky part with the
  // usual panic notice turned off and hands back the words if it went wrong.
  emitTry(node) {
    this.open('{');
    this.open('let _problem = plain_try(|| {');
    this.block(node.block);
    this.close('});');
    this.open('if let Some(_words) = _problem {');
    if (node.rescue) {
      this.remember(this.variable('problem'));
      this.writeLine(`let mut ${this.variable('problem')} = plain_text_value(_words)`);
      this.block(node.rescue);
    }
    this.close();
    this.close();
  }

  // A kind becomes plain functions, plus three small tables that say what a
  // kind is based on, what it starts with, and what it knows how to do. The
  // translator has seen every kind by now, so all three can be written out
  // rather than filled in while the program runs.
  emitKind(node) {
    const kind = this.kindName(node.name);
    for (const action of node.actions) {
      this.write('');
      const name = `${kind}_${this.identifier(action.name.replace(/\s+/g, '_'))}`;
      this.open(`fn ${name}(mut me: Value, args: &[Value]) -> Value {`);
      action.params.forEach((param, at) => {
        const named = this.identifier(param);
        this.writeLine(`let mut ${named} = plain_at(args, ${at})`);
        this.remember(named);
      });
      this.block(action.block);
      this.finishFunctionBody(action.block);
      this.close();
    }
  }

  emitConstructor() { /* the tables below do this */ }

  // --------------------------------------------------------------- the file

  translate(program, meta = {}) {
    this.collectKinds(program);
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

    this.depth = 1;
    const main = this.capture(() => {
      for (const node of program.body) {
        if (node.type === 'Kind' || node.type === 'Function') continue;
        this.statement(node);
      }
    });
    this.depth = 0;

    // Anything an engine owns still stops the translation, the same as
    // everywhere else.
    if (this.unsupported.length) return Emitter.prototype.translate.call(this, program, meta);

    const out = [
      this.comment(`Translated from ${meta.file || 'a Plain program'} by Plain ${meta.version || ''}`.trim()),
      this.comment('Plain is the source; this file is what it means in Rust.'),
      this.comment('Build it with:  rustc -O program.rs'),
      '',
      '#![allow(dead_code, unused_mut, unused_variables, unused_parens, non_snake_case, unused_imports, unused_assignments)]',
      '',
      runtimeSource('rust'),
      '',
      `// ----- ${PROGRAM_STARTS} -----`,
      '',
      ...this.kindTables(kinds),
      ''
    ];
    if (kindCode.length) out.push(...kindCode, '');
    if (actions.length) out.push(...actions, '');
    out.push('fn main() {');
    out.push(...main);
    out.push('}');

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  kindTables(kinds) {
    const lines = [];

    lines.push('// What each of your kinds is based on.');
    lines.push('fn plain_base(kind: &str) -> Option<String> {');
    lines.push('    match kind {');
    for (const node of kinds) {
      if (!node.base) continue;
      lines.push(`        ${rustText(this.kindName(node.name))} => Some(String::from(${rustText(this.kindName(node.base))})),`);
    }
    lines.push('        _ => None,');
    lines.push('    }');
    lines.push('}');
    lines.push('');

    lines.push('// The values a new one starts with, base first so that a kind');
    lines.push('// built on another can say something different.');
    lines.push('fn plain_defaults(kind: &str, into: &mut Thing) {');
    lines.push('    match kind {');
    for (const node of kinds) {
      const parts = [];
      if (node.base) parts.push(`plain_defaults(${rustText(this.kindName(node.base))}, into);`);
      for (const field of node.fields) {
        const value = field.value ? this.expression(field.value) : this.nothingWord;
        parts.push(`plain_own(into, ${rustText(this.fieldName(field.name))}, ${value});`);
      }
      lines.push(`        ${rustText(this.kindName(node.name))} => { ${parts.join(' ')} }`);
    }
    lines.push('        _ => {}');
    lines.push('    }');
    lines.push('}');
    lines.push('');

    lines.push('// What each kind knows how to do.');
    lines.push('fn plain_do(kind: &str, action: &str, me: Value, args: &[Value]) -> Option<Value> {');
    lines.push('    match (kind, action) {');
    for (const node of kinds) {
      const kind = this.kindName(node.name);
      for (const one of node.actions) {
        const named = this.identifier(one.name.replace(/\s+/g, '_'));
        lines.push(`        (${rustText(kind)}, ${rustText(named)}) => Some(${kind}_${named}(me, args)),`);
      }
    }
    lines.push('        _ => None,');
    lines.push('    }');
    lines.push('}');

    return lines;
  }
}

// Rust text literals escape a little differently from everyone else: no
// \uXXXX, but \u{XXXX} instead, and a lone backslash still needs doubling.
function rustText(text) {
  let out = '"';
  for (const letter of String(text)) {
    const code = letter.codePointAt(0);
    if (letter === '\\') out += '\\\\';
    else if (letter === '"') out += '\\"';
    else if (letter === '\n') out += '\\n';
    else if (letter === '\r') out += '\\r';
    else if (letter === '\t') out += '\\t';
    else if (letter === '\0') out += '\\0';
    else if (code < 0x20 || code === 0x7f) out += `\\u{${code.toString(16)}}`;
    else out += letter;
  }
  return out + '"';
}


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
import { numericNames, numericLists } from './numbers.js';

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

// Which names in the body being written now hold nothing but numbers. It is
// a set of plain lowercase names, worked out before the body is written.
// Empty means "box everything", which is what this did until now.
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

  // A name proved to hold only numbers becomes the machine's own number,
  // and everything done to it becomes the machine's own arithmetic. That is
  // the whole optimisation: no box, no function call, no looking inside.
  declare(name, value) {
    if (this.plainNumbers && this.plainNumbers.has(this.originalOf(name))) {
      return `let mut ${name}: f64 = ${value}`;
    }
    return `let mut ${name} = ${value}`;
  }
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

  // ---------------------------------------------------- numbers without boxes

  // A name is remembered here under the name the program used, not the one
  // Rust ended up with, so both spellings can be asked about.
  originalOf(name) {
    return this.plainNumberSpellings ? (this.plainNumberSpellings.get(name) || name) : name;
  }

  // Is this expression one the machine can do on its own?
  isPlainNumber(node) {
    if (!node) return false;
    if (node.type === 'Field') return this.isStructField(node);
    if (!this.plainNumbers || this.plainNumbers.size === 0) return false;
    switch (node.type) {
      case 'Number': return true;
      case 'Var': return this.plainNumbers.has(String(node.name).toLowerCase());
      case 'Negate': return this.isPlainNumber(node.value);
      case 'Math': return this.isPlainNumber(node.left) && this.isPlainNumber(node.right);
      default: return false;
    }
  }

  isStructField(node) {
    if (!this.structVars || !node.object || node.object.type !== 'Var') return false;
    const found = this.structVars.get(String(node.object.name).toLowerCase());
    return !!found && found.fields.has(String(node.name).toLowerCase());
  }

  // The bare arithmetic, with no Value anywhere in it.
  bareNumber(node) {
    switch (node.type) {
      case 'Number': {
        const written = String(node.value);
        return written.includes('.') || written.includes('e') ? written : `${written}.0`;
      }
      case 'Var': return this.variable(node.name);
      case 'Field': return this.isStructField(node)
        ? `${this.variable(node.object.name)}.${this.structFieldName(node.name)}`
        : null;
      case 'Negate': return `-(${this.bareNumber(node.value)})`;
      case 'Math': {
        const left = this.bareNumber(node.left);
        const right = this.bareNumber(node.right);
        switch (node.op) {
          case '+': return `(${left} + ${right})`;
          case '-': return `(${left} - ${right})`;
          case '*': return `(${left} * ${right})`;
          case '/': return `(${left} / ${right})`;
          case '%': return `(${left} % ${right})`;
          default: return null;
        }
      }
      default: return null;
    }
  }

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
      case 'Var': {
        if (node.name.toLowerCase() === 'me') return `${this.selfWord}.clone()`;
        // Wanted as a Value here, so it is put in a box at this one point.
        if (this.isPlainNumber(node)) return `Value::Number(${this.variable(node.name)})`;
        return `${this.variable(node.name)}.clone()`;
      }
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
    if (this.isStructField(node)) {
      return `Value::Number(${this.variable(node.object.name)}.${this.structFieldName(node.name)})`;
    }
    const field0 = String(node.name).toLowerCase();
    if (node.object && node.object.type === 'Var' && this.isPlainList(node.object.name)) {
      const list = this.variable(node.object.name);
      if (['length', 'size', 'count'].includes(field0)) return `Value::Number(${list}.len() as f64)`;
      if (field0 === 'first') return `Value::Number(*${list}.first().unwrap_or(&0.0))`;
      if (field0 === 'last') return `Value::Number(*${list}.last().unwrap_or(&0.0))`;
    }
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
    // A comparison of two plain numbers is already a yes or no.
    if (node && node.type === 'Compare' && this.isPlainNumber(node.left) && this.isPlainNumber(node.right)) {
      const sign = { '==': '==', '!=': '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=' }[node.op];
      if (sign) return `(${this.bareNumber(node.left)} ${sign} ${this.bareNumber(node.right)})`;
    }
    return `plain_truthy(${this.expression(node)})`;
  }

  comparison(node) {
    // Comparing two plain numbers is one machine instruction, and the
    // answer is still a Value because the rest of the program expects one.
    if (this.isPlainNumber(node.left) && this.isPlainNumber(node.right)) {
      const sign = { '==': '==', '!=': '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=' }[node.op];
      if (sign) {
        return `Value::Bool(${this.bareNumber(node.left)} ${sign} ${this.bareNumber(node.right)})`;
      }
    }
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
    // Both sides plain numbers: let the machine do the arithmetic, and put
    // the answer in a box once at the end rather than on every step.
    //
    // The box matters. This is asked for from everywhere - including places
    // that hand the answer straight to something expecting a Value - and an
    // expression cannot see what is going to be done with it. The places
    // that genuinely want a bare number ask for one by name.
    if (this.isPlainNumber(node)) {
      const bare = this.bareNumber(node);
      if (bare !== null) return `Value::Number(${bare})`;
    }
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

  // "add 1 to score" and "take 1 from score" write into a name, so they
  // have to agree with what that name is: a bare f64 when the analysis
  // unboxed it, a Value when it did not. Getting this wrong is not a wrong
  // answer, it is a program rustc refuses to build - which is exactly what
  // happened the first day a rustc was on the machine to ask.
  phraseStatement(node) {
    if (node.spec === 'set value $key of $thing to $value' && this.structVars) {
      const args = node.args || {};
      const thing = args.thing;
      if (thing && thing.type === 'Var'
          && this.structVars.has(String(thing.name).toLowerCase())
          && args.key && args.key.type === 'Text') {
        const found = this.structVars.get(String(thing.name).toLowerCase());
        const field = String(args.key.value).toLowerCase();
        if (found.fields.has(field)) {
          const amount = this.isPlainNumber(args.value)
            ? this.bareNumber(args.value)
            : `plain_number(${this.expression(args.value)})`;
          return `${this.variable(thing.name)}.${this.structFieldName(field)} = ${amount}`;
        }
      }
    }
    const writes = ['add $value to #name', 'take $value from #name', 'put $value into #name'];
    if (writes.includes(node.spec)) {
      const name = this.variable(node.args.name);
      const unboxed = this.plainNumbers && this.plainNumbers.has(String(node.args.name).toLowerCase());
      if (unboxed) {
        const amount = this.isPlainNumber(node.args.value)
          ? this.bareNumber(node.args.value)
          : `plain_number(${this.expression(node.args.value)})`;
        if (node.spec === 'add $value to #name') return `${name} += ${amount}`;
        if (node.spec === 'take $value from #name') return `${name} -= ${amount}`;
        return `${name} = ${amount}`;
      }
      if (node.spec === 'take $value from #name') {
        return `${name} = plain_minus(${name}, ${this.expression(node.args.value)})`;
      }
    }
    return super.phraseStatement(node);
  }

  // ----------------------------------------------------------------- blocks

  // "repeat 3 times" counts, and the analysis marks its counter a number
  // by the shape of the sentence - so the loop here has to keep that
  // promise and count with a bare f64, not hand out a boxed Value that
  // every "show count" inside would then wrap a second time.
  emitRepeat(node) {
    const name = this.loopName('count');
    if (this.plainNumbers && this.plainNumbers.has('count')) {
      const bound = `plain_to_${name}`;
      const times = this.isPlainNumber(node.count)
        ? this.bareNumber(node.count)
        : `plain_number(${this.expression(node.count)})`;
      this.writeLine(`let ${bound}: f64 = ${times}`);
      this.writeLine(`let mut ${name}: f64 = 0.0`);
      // The count sits at the top so "next" (continue) still counts.
      this.open(`loop {`);
      this.writeLine(`${name} += 1.0`);
      this.writeLine(`if ${name} > ${bound} { break }`);
      this.bindLoop('count', name);
      this.block(node.block);
      this.close();
      return;
    }
    this.open(this.countHeader(name, 'Value::Number(1.0)', this.expression(node.count), 'Value::Number(1.0)'));
    this.bindLoop('count', name);
    this.block(node.block);
    this.close();
  }

  emitForEach(node) {
    // Walking a Vec of real structs: each pass hands out one struct to
    // read and write as bare f64 fields.
    if (node.list && node.list.type === 'Var' && this.structLists
        && this.structLists.has(String(node.list.name).toLowerCase())) {
      const kind = this.structLists.get(String(node.list.name).toLowerCase());
      const info = this.structKindInfo(kind);
      const name = this.loopName(node.name);
      this.open(`for ${name} in ${this.variable(node.list.name)}.iter_mut() {`);
      this.bindLoop(node.name, name);
      this.structVars = this.structVars || new Map();
      const before = this.structVars.get(String(node.name).toLowerCase());
      this.structVars.set(String(node.name).toLowerCase(), {
        kind, fields: new Set(info.fields.map(one => one.name))
      });
      this.block(node.block);
      if (before === undefined) this.structVars.delete(String(node.name).toLowerCase());
      else this.structVars.set(String(node.name).toLowerCase(), before);
      this.close();
      return;
    }
    // Walking a run of plain numbers: no boxes, no shares handed out, and
    // the shape a processor can do four or eight of at a time.
    if (node.list && node.list.type === 'Var' && this.isPlainList(node.list.name)) {
      const name = this.loopName(node.name);
      this.open(`for &${name} in ${this.variable(node.list.name)}.iter() {`);
      this.bindLoop(node.name, name);
      const before = this.plainNumbers;
      this.plainNumbers = new Set([...(before || []), String(node.name).toLowerCase()]);
      this.block(node.block);
      this.plainNumbers = before;
      this.close();
      return;
    }
    return super.emitForEach(node);
  }

  emitCount(node) {
    const name = this.loopName(node.name);

    // "repeat with n from 1 to 120000" counts. Whatever else is unclear
    // about a program, that name holds a number - it is a number by the
    // shape of the sentence, not by anything we had to prove. So it counts
    // as one, and the whole range stops being a list of boxed values built
    // in memory before the loop even starts.
    const plainFrom = this.isPlainNumber(node.from) ? this.bareNumber(node.from) : null;
    const plainTo = this.isPlainNumber(node.to) ? this.bareNumber(node.to) : null;
    const plainStep = !node.step ? '1.0'
      : (this.isPlainNumber(node.step) ? this.bareNumber(node.step) : null);

    if (plainFrom !== null && plainTo !== null && plainStep !== null) {
      const bound = `plain_to_${name}`;
      const stride = `plain_by_${name}`;
      // Two rules carried over from the interpreter, exactly: the DIRECTION
      // comes from the numbers ("from 5 to 1" counts down, step or no
      // step), and the step only says how big each jump is. And the count
      // happens at the TOP of the loop, not the bottom, because "next"
      // becomes continue - a bottom increment is skipped by continue, and
      // that is not a wrong answer, it is a loop that never ends.
      this.writeLine(`let ${bound}: f64 = ${plainTo}`);
      this.writeLine(`let mut ${stride}: f64 = ${plainStep}`);
      this.writeLine(`let mut ${name}: f64 = ${plainFrom}`);
      this.writeLine(`if ${bound} < ${name} && ${stride} > 0.0 { ${stride} = -${stride}; }`);
      this.writeLine(`if ${bound} > ${name} && ${stride} < 0.0 { ${stride} = -${stride}; }`);
      this.writeLine(`${name} -= ${stride}`);
      this.open(`loop {`);
      this.writeLine(`${name} += ${stride}`);
      this.writeLine(`if (${stride} > 0.0 && ${name} > ${bound}) || (${stride} < 0.0 && ${name} < ${bound}) { break }`);
      this.bindLoop(node.name, name);
      const before = this.plainNumbers;
      this.plainNumbers = new Set([...(before || []), String(node.name).toLowerCase()]);
      this.block(node.block);
      this.plainNumbers = before;
      this.close();
      return;
    }

    const from = this.expression(node.from);
    const to = this.expression(node.to);
    const step = node.step ? this.expression(node.step) : 'Value::Number(1.0)';
    this.open(this.countHeader(name, from, to, step));
    this.bindLoop(node.name, name);
    this.block(node.block);
    this.close();
  }

  // Before writing a body, work out which of its names hold only numbers.
  // Bodies nest - an action inside a kind - so the answer is kept on a
  // stack and put back when the body is finished.

  // ------------------------------------------------------------- structs
  //
  // The measured other half of the C++ gap. A list that provably holds
  // things of ONE declared kind whose fields are all numbers becomes a
  // Vec of a real Rust struct - fields side by side, read as one.f with
  // no reference count, no borrow check and no name search. The proof is
  // strict; anything unproven keeps the boxed shape and stays correct.
  numericShape(node, structVar, structFields) {
    if (!node) return false;
    switch (node.type) {
      case 'Number': return true;
      case 'Negate': return this.numericShape(node.value, structVar, structFields);
      case 'Math': return ['+', '-', '*', '/', '%'].includes(node.op)
        && this.numericShape(node.left, structVar, structFields)
        && this.numericShape(node.right, structVar, structFields);
      case 'Var': return this.plainNumbers && this.plainNumbers.has(String(node.name).toLowerCase());
      case 'Field':
        return !!structVar && node.object && node.object.type === 'Var'
          && String(node.object.name).toLowerCase() === structVar
          && structFields.has(String(node.name).toLowerCase());
      default: return false;
    }
  }

  structKindInfo(kindLower) {
    const kind = this.kinds && this.kinds.get(kindLower);
    if (!kind || kind.base) return null;
    if (!kind.fields || !kind.fields.length) return null;
    if (kind.actions && kind.actions.length) return null;
    const fields = [];
    for (const field of kind.fields) {
      const value = field.value;
      if (!value || value.type !== 'Number') return null;
      fields.push({ name: String(field.name).toLowerCase(), fallback: value.value });
    }
    return { fields };
  }

  findStructs(block) {
    const lists = new Map();     // listLower -> kindLower, or null once rejected
    const reject = (name) => { if (name) lists.set(String(name).toLowerCase(), null); };

    // Any appearance of a candidate name outside the allowed shapes kills
    // it. This walk marks the allowed spots and vetoes the rest.
    const veto = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Var' && lists.has(String(node.name).toLowerCase())) {
        reject(node.name);
        return;
      }
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach(veto);
        else if (value && typeof value === 'object') veto(value);
      }
    };

    const scanBody = (nodes) => {
      for (const node of nodes || []) this.scanStructStatement(node, lists, veto, reject);
    };
    this.scanStructBody = scanBody;
    scanBody(block && block.body);

    const out = new Map();
    for (const [name, kind] of lists) if (kind) out.set(name, kind);
    return out;
  }

  scanStructStatement(node, lists, veto, reject) {
    if (!node || typeof node !== 'object') return;
    const lower = (name) => String(name).toLowerCase();
    switch (node.type) {
      case 'Make': {
        if (node.value && node.value.type === 'List' && (node.value.items || []).length === 0) {
          if (!lists.has(lower(node.name))) lists.set(lower(node.name), undefined);
          return;
        }
        veto(node.value);
        reject(lists.has(lower(node.name)) ? node.name : null);
        return;
      }
      case 'Phrase': {
        const args = node.args || {};
        if (node.spec === 'add $value to #name' && lists.has(lower(args.name))) {
          const state = lists.get(lower(args.name));
          if (state === null) { veto(args.value); return; }
          const made = args.value;
          if (!made || made.type !== 'New') { veto(args.value); reject(args.name); return; }
          const kindLower = lower(made.kind);
          const info = this.structKindInfo(kindLower);
          if (!info || (state !== undefined && state !== kindLower)) { veto(made); reject(args.name); return; }
          const known = new Set(info.fields.map(one => one.name));
          for (const pair of made.pairs || []) {
            if (!known.has(lower(pair.key)) || !this.numericShape(pair.value, null, known)) {
              veto(made); reject(args.name); return;
            }
          }
          lists.set(lower(args.name), kindLower);
          return;
        }
        veto(node);
        return;
      }
      case 'ForEach': {
        const over = node.list;
        if (over && over.type === 'Var' && lists.get(lower(over.name))) {
          const kindLower = lists.get(lower(over.name));
          const info = this.structKindInfo(kindLower);
          const fields = new Set(info.fields.map(one => one.name));
          const eachLower = lower(node.name);
          if (!this.structLoopBodyFits(node.block, eachLower, fields, veto)) reject(over.name);
          // Whatever the verdict, other candidates inside still get vetoed.
          for (const inner of (node.block && node.block.body) || []) {
            this.scanStructStatement(inner, lists, veto, reject);
          }
          return;
        }
        veto(over);
        this.scanStructBody((node.block && node.block.body) || []);
        return;
      }
      case 'If': {
        for (const branch of node.branches || []) {
          veto(branch.condition);
          this.scanStructBody((branch.block && branch.block.body) || []);
        }
        this.scanStructBody((node.otherwise && node.otherwise.body) || []);
        return;
      }
      case 'Repeat': case 'Count': case 'While': {
        veto(node.count); veto(node.from); veto(node.to); veto(node.step); veto(node.condition);
        this.scanStructBody((node.block && node.block.body) || []);
        return;
      }
      default:
        veto(node);
    }
  }

  // Inside "for each one in motes", the loop name may be read as fields,
  // written as fields with numbers, and nothing else.
  structLoopBodyFits(block, eachLower, fields, veto) {
    const usesEachBadly = (node) => {
      if (!node || typeof node !== 'object') return false;
      if (node.type === 'Var' && String(node.name).toLowerCase() === eachLower) return true;
      if (node.type === 'Field' && node.object && node.object.type === 'Var'
          && String(node.object.name).toLowerCase() === eachLower) {
        return !fields.has(String(node.name).toLowerCase());
      }
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) { if (value.some(usesEachBadly)) return true; }
        else if (value && typeof value === 'object' && usesEachBadly(value)) return true;
      }
      return false;
    };
    const fits = (nodes) => {
      for (const node of nodes || []) {
        if (node.type === 'Phrase' && node.spec === 'set value $key of $thing to $value') {
          const args = node.args || {};
          const thing = args.thing, key = args.key;
          if (thing && thing.type === 'Var' && String(thing.name).toLowerCase() === eachLower) {
            if (!key || key.type !== 'Text' || !fields.has(String(key.value).toLowerCase())) return false;
            if (!this.numericShape(args.value, eachLower, fields)) return false;
            continue;
          }
        }
        if (node.type === 'Set' && node.target && node.target.type === 'Var') {
          // Writing a plain number from struct fields is fine.
          if (this.plainNumbers && this.plainNumbers.has(String(node.target.name).toLowerCase())
              && this.numericShape(node.value, eachLower, fields)) continue;
        }
        if (node.type === 'If') {
          let good = true;
          for (const branch of node.branches || []) {
            if (usesEachBadly(branch.condition) && !this.numericShape(branch.condition, eachLower, fields)) good = false;
            if (!fits((branch.block && branch.block.body) || [])) good = false;
          }
          if (!fits((node.otherwise && node.otherwise.body) || [])) good = false;
          if (!good) return false;
          continue;
        }
        if (usesEachBadly(node)) return false;
      }
      return true;
    };
    return fits((block && block.body) || []);
  }

  // Arithmetic over numbers and struct fields, with no Value anywhere.
  structBare(node, eachLower, fields) {
    switch (node.type) {
      case 'Number': {
        const written = String(node.value);
        return written.includes('.') || written.includes('e') ? written : `${written}.0`;
      }
      case 'Var': return this.variable(node.name);
      case 'Negate': return `-(${this.structBare(node.value, eachLower, fields)})`;
      case 'Field': return `${this.variable(node.object.name)}.${this.structFieldName(node.name)}`;
      case 'Math': {
        const left = this.structBare(node.left, eachLower, fields);
        const right = this.structBare(node.right, eachLower, fields);
        const sign = ['+', '-', '*', '/', '%'].includes(node.op) ? node.op : '+';
        return `(${left} ${sign} ${right})`;
      }
      default: return '0.0';
    }
  }

  structTypeName(kindLower) {
    return 'PlainStruct' + kindLower.replace(/[^a-z0-9]/g, '_');
  }

  emitStructTypes() {
    const wanted = new Set();
    const gather = (map) => { for (const kind of (map || new Map()).values()) wanted.add(kind); };
    gather(this.structLists);
    if (!wanted.size) return;
    for (const kindLower of wanted) {
      const info = this.structKindInfo(kindLower);
      const fields = info.fields.map(one => `${this.structFieldName(one.name)}: f64`).join(', ');
      this.writeLine(`#[derive(Clone, Copy)] struct ${this.structTypeName(kindLower)} { ${fields} }`);
    }
  }

  structFieldName(name) {
    const cleaned = String(name).toLowerCase().replace(/[^a-z0-9]/g, '_');
    return 'f_' + cleaned;
  }

  enterNumbers(block, params) {
    this.numberStack = this.numberStack || [];
    this.numberStack.push(this.plainNumbers);
    this.listStack = this.listStack || [];
    this.listStack.push(this.plainLists);
    this.structStack = this.structStack || [];
    this.structStack.push(this.structLists);
    try {
      this.plainLists = numericLists(block, params);
      this.plainNumbers = numericNames(block, params, this.plainLists);
      this.structLists = this.findStructs(block);
      if (this.structLists.size) {
        // Struct fields are numbers, and knowing that widens what else is:
        // "set swept to swept plus x of one" keeps swept bare. One more
        // pass with that knowledge, then the structs re-proved against the
        // wider answer, until nothing changes - two rounds in practice.
        for (let round = 0; round < 3; round++) {
          const loopFields = new Map();
          const gather = (nodes) => {
            for (const node of nodes || []) {
              if (!node || typeof node !== 'object') continue;
              if (node.type === 'ForEach' && node.list && node.list.type === 'Var') {
                const kind = this.structLists.get(String(node.list.name).toLowerCase());
                if (kind) {
                  const info = this.structKindInfo(kind);
                  loopFields.set(String(node.name).toLowerCase(), new Set(info.fields.map(one => one.name)));
                }
              }
              for (const key of Object.keys(node)) {
                const value = node[key];
                if (Array.isArray(value)) gather(value);
                else if (value && typeof value === 'object' && value.type) gather([value]);
              }
            }
          };
          gather(block && block.body);
          const fieldNumeric = (node) => {
            if (!node.object || node.object.type !== 'Var') return false;
            const fields = loopFields.get(String(node.object.name).toLowerCase());
            return !!fields && fields.has(String(node.name).toLowerCase());
          };
          const before = this.plainNumbers.size + this.structLists.size;
          this.plainNumbers = numericNames(block, params, this.plainLists, fieldNumeric);
          this.structLists = this.findStructs(block);
          if (this.plainNumbers.size + this.structLists.size === before) break;
        }
      }
    } catch {
      // A shape this analysis has never seen is not a reason to fail to
      // translate. It is a reason to box everything, as before.
      this.plainNumbers = new Set();
      this.plainLists = new Set();
      this.structLists = new Map();
    }
  }

  leaveNumbers() {
    if (this.structStack) this.structLists = this.structStack.pop();
    this.plainNumbers = (this.numberStack || []).pop();
    this.plainLists = (this.listStack || []).pop();
  }

  isPlainList(name) {
    return !!(this.plainLists && this.plainLists.has(String(name).toLowerCase()));
  }

  // A number for a place that wants one, however it was written.
  asNumber(node) {
    if (this.isPlainNumber(node)) return this.bareNumber(node);
    return `plain_number(${this.expression(node)})`;
  }

  // Making and changing a name that holds only numbers. The value has to be
  // written as bare arithmetic too, or the name is declared as a number and
  // handed a box on the very same line.
  statement(node) {
    if (node && this.plainNumbers && this.plainNumbers.size) {
      if (node.type === 'Make' && this.plainNumbers.has(String(node.name).toLowerCase())) {
        const bare = this.isPlainNumber(node.value) ? this.bareNumber(node.value) : null;
        if (bare !== null) {
          const name = this.variable(node.name);
          const line = this.known(name) ? `${name} = ${bare}` : `let mut ${name}: f64 = ${bare}`;
          this.remember(name);
          return this.writeLine(line);
        }
      }
      if (node.type === 'Make' && this.structLists && this.structLists.has(String(node.name).toLowerCase())) {
        const kind = this.structLists.get(String(node.name).toLowerCase());
        const name = this.variable(node.name);
        this.remember(name);
        return this.writeLine(`let mut ${name}: Vec<${this.structTypeName(kind)}> = Vec::new()`);
      }
      if (node.type === 'Phrase' && node.spec === 'add $value to #name'
          && this.structLists && this.structLists.get(String((node.args || {}).name || '').toLowerCase())) {
        const kind = this.structLists.get(String(node.args.name).toLowerCase());
        const info = this.structKindInfo(kind);
        const given = new Map((node.args.value.pairs || []).map(pair => [String(pair.key).toLowerCase(), pair.value]));
        const parts = info.fields.map(field => {
          const value = given.get(field.name);
          const written = value ? this.structBare(value, null, null) : `${field.fallback}${Number.isInteger(field.fallback) ? '.0' : ''}`;
          return `${this.structFieldName(field.name)}: ${written}`;
        });
        return this.writeLine(`${this.variable(node.args.name)}.push(${this.structTypeName(kind)} { ${parts.join(', ')} })`);
      }
      if (node.type === 'Make' && this.isPlainList(node.name)) {
        const items = (node.value && node.value.items) || [];
        const written = items.map(one => this.asNumber(one)).join(', ');
        const name = this.variable(node.name);
        this.remember(name);
        return this.writeLine(`let mut ${name}: Vec<f64> = vec![${written}]`);
      }
      if (node.type === 'Phrase' && node.spec === 'add $value to #name'
          && this.isPlainList((node.args || {}).name)) {
        const into = this.variable(node.args.name);
        return this.writeLine(`${into}.push(${this.asNumber(node.args.value)})`);
      }
      if (node.type === 'Set' && node.target && node.target.type === 'Var'
          && this.plainNumbers.has(String(node.target.name).toLowerCase())) {
        const bare = this.isPlainNumber(node.value) ? this.bareNumber(node.value) : null;
        if (bare !== null) return this.writeLine(`${this.variable(node.target.name)} = ${bare}`);
      }
    }
    return super.statement(node);
  }

  emitFunction(node) {
    this.write('');
    const name = this.identifier(node.name.replace(/\s+/g, '_'));
    this.open(this.functionHeader(name, node.params.map(one => this.identifier(one))));
    for (const param of node.params) this.remember(this.identifier(param));
    this.enterNumbers(node.block, node.params);
    this.block(node.block);
    this.finishFunctionBody(node.block);
    this.leaveNumbers();
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
      this.enterNumbers({ body: program.body.filter(one => one.type !== 'Kind' && one.type !== 'Function') }, []);
      this.emitStructTypes();
      for (const node of program.body) {
        if (node.type === 'Kind' || node.type === 'Function') continue;
        this.statement(node);
      }
      this.leaveNumbers();
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


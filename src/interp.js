// Plain - interpreter.
// Walks the tree and runs it. Phrase sentences are handed to whichever
// library registered them (core, game engine, website engine).

import { PlainError } from './errors.js';
import {
  truthy, toText, toNumber, equals, contains, itemAt, typeName, isThing
} from './values.js';

class ReturnSignal { constructor(value) { this.value = value; } }
class BreakSignal {}
class ContinueSignal {}

// A thing built from "a kind called Dog". Fields live on the object itself so
// "name of rex" works; the kind is kept aside for its actions.
export class PlainThing {
  constructor(kind, fields) {
    Object.defineProperty(this, '_kind', { value: kind, enumerable: false, writable: true });
    Object.assign(this, fields);
  }

  toPlainText() {
    const entries = Object.entries(this).map(([k, v]) => `${k}: ${v === null ? 'nothing' : typeof v === 'string' ? `"${v}"` : v}`);
    return `a ${this._kind.name} (${entries.join(', ')})`;
  }
}

export class Environment {
  constructor(parent = null) {
    this.values = new Map();
    this.parent = parent;
  }

  // Names are matched without case, so "Score" and "score" are one name.
  static key(name) { return String(name).toLowerCase(); }

  has(name) {
    const k = Environment.key(name);
    return this.values.has(k) || (this.parent ? this.parent.has(name) : false);
  }

  get(name) {
    const k = Environment.key(name);
    if (this.values.has(k)) return this.values.get(k).value;
    if (this.parent) return this.parent.get(name);
    return undefined;
  }

  define(name, value) {
    this.values.set(Environment.key(name), { name, value });
  }

  assign(name, value) {
    const k = Environment.key(name);
    if (this.values.has(k)) { this.values.get(k).value = value; return true; }
    if (this.parent) return this.parent.assign(name, value);
    return false;
  }

  names() {
    const out = this.parent ? this.parent.names() : [];
    for (const entry of this.values.values()) out.push(entry.name);
    return out;
  }
}

export class Interpreter {
  constructor(runtime) {
    this.runtime = runtime;
    this.globals = new Environment();
    this.functions = new Map();
    this.kinds = new Map();
    this.file = '<input>';
    this.loopLimit = runtime.loopLimit ?? 20_000_000;
  }

  fail(message, line, hint) {
    throw new PlainError(message, line, this.file, hint);
  }

  run(program, env = this.globals) {
    this.file = program.file || this.file;
    // Actions and kinds are hoisted so a program can read top-down.
    for (const node of program.body) {
      if (node.type === 'Function' || node.type === 'Kind') this.exec(node, env);
    }
    for (const node of program.body) {
      if (node.type === 'Function' || node.type === 'Kind') continue;
      this.exec(node, env);
    }
  }

  runBlock(block, env) {
    for (const node of block.body) this.exec(node, env);
  }

  // A block captured by a phrase (`every frame ...`) becomes a plain
  // function the engine can call whenever it likes.
  closure(block, env) {
    const self = this;
    const fn = function (...args) {
      const scope = new Environment(env);
      scope.define('it', args[0] ?? null);
      if (args.length > 1) scope.define('other', args[1]);
      try {
        self.runBlock(block, scope);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
      return null;
    };
    fn.plainBlock = true;
    return fn;
  }

  // -------------------------------------------------------------- statements

  exec(node, env) {
    switch (node.type) {
      case 'Show': {
        this.runtime.output(toText(this.evaluate(node.value, env)));
        return;
      }
      case 'Make': {
        env.define(node.name, this.evaluate(node.value, env));
        return;
      }
      case 'Set': {
        const value = this.evaluate(node.value, env);
        this.assignTo(node.target, value, env);
        return;
      }
      case 'If': {
        for (const branch of node.branches) {
          if (truthy(this.evaluate(branch.condition, env))) {
            this.runBlock(branch.block, new Environment(env));
            return;
          }
        }
        if (node.otherwise) this.runBlock(node.otherwise, new Environment(env));
        return;
      }
      case 'Repeat': {
        const times = Math.floor(toNumber(this.evaluate(node.count, env)));
        if (Number.isNaN(times)) this.fail('"repeat" needs a number of times', node.line);
        for (let i = 0; i < times; i++) {
          const scope = new Environment(env);
          scope.define('count', i + 1);
          if (this.loopBody(node.block, scope)) break;
        }
        return;
      }
      case 'Count': {
        const from = toNumber(this.evaluate(node.from, env));
        const to = toNumber(this.evaluate(node.to, env));
        let step = node.step ? toNumber(this.evaluate(node.step, env)) : (to < from ? -1 : 1);
        if (step === 0 || Number.isNaN(step)) this.fail('A counting loop cannot step by 0', node.line);
        // "from 10 to 0 by 2" counts down: the direction comes from the
        // numbers, the step is just how big each jump is.
        if (to < from && step > 0) step = -step;
        if (to > from && step < 0) step = -step;
        let guard = 0;
        for (let v = from; step > 0 ? v <= to : v >= to; v += step) {
          if (++guard > this.loopLimit) this.fail('This loop ran forever, so I stopped it', node.line);
          const scope = new Environment(env);
          scope.define(node.name, v);
          if (this.loopBody(node.block, scope)) break;
        }
        return;
      }
      case 'ForEach': {
        const list = this.evaluate(node.list, env);
        const items = Array.isArray(list) ? list
          : typeof list === 'string' ? [...list]
          : isThing(list) ? Object.keys(list)
          : this.fail(`"for each" needs a list, but got ${typeName(list)}`, node.line);
        for (const item of items) {
          const scope = new Environment(env);
          scope.define(node.name, item);
          if (this.loopBody(node.block, scope)) break;
        }
        return;
      }
      case 'While': {
        let guard = 0;
        while (truthy(this.evaluate(node.condition, env))) {
          if (++guard > this.loopLimit) this.fail('This loop ran forever, so I stopped it', node.line);
          if (this.loopBody(node.block, new Environment(env))) break;
        }
        return;
      }
      case 'Function': {
        this.functions.set(node.id, { ...node, env });
        return;
      }
      case 'Kind': {
        const key = String(node.name).toLowerCase();
        if (node.base && !this.kinds.has(String(node.base).toLowerCase())) {
          this.fail(`I do not know a kind called "${node.base}"`, node.line);
        }
        this.kinds.set(key, { ...node, env, base: node.base ? this.kinds.get(String(node.base).toLowerCase()) : null });
        return;
      }
      case 'Try': {
        try {
          this.runBlock(node.block, new Environment(env));
        } catch (error) {
          if (error instanceof ReturnSignal || error instanceof BreakSignal || error instanceof ContinueSignal) throw error;
          if (!(error instanceof PlainError)) throw error;
          if (!node.rescue) return;
          const scope = new Environment(env);
          scope.define('problem', error.plainMessage || error.message);
          this.runBlock(node.rescue, scope);
        }
        return;
      }
      case 'Return': throw new ReturnSignal(node.value ? this.evaluate(node.value, env) : null);
      case 'Break': throw new BreakSignal();
      case 'Continue': throw new ContinueSignal();
      case 'Phrase': {
        this.callPhrase(node, env, 'statement');
        return;
      }
      case 'Block': return this.runBlock(node, env);
      default:
        this.fail(`I do not know how to run "${node.type}"`, node.line);
    }
  }

  // Returns true when the loop should stop.
  loopBody(block, scope) {
    try {
      this.runBlock(block, scope);
    } catch (e) {
      if (e instanceof BreakSignal) return true;
      if (e instanceof ContinueSignal) return false;
      throw e;
    }
    return false;
  }

  assignTo(target, value, env) {
    if (target.type === 'Var') {
      if (!env.assign(target.name, value)) {
        this.fail(
          `There is no name called "${target.name}" yet`,
          target.line,
          `make ${target.name} be ${toText(value, 1)}`
        );
      }
      return;
    }
    if (target.type === 'Field') {
      const object = this.evaluate(target.object, env);
      if (!isThing(object)) this.fail(`I cannot set "${target.name}" on ${typeName(object)}`, target.line);
      if (typeof object.setPlainField === 'function') object.setPlainField(target.name, value);
      else {
        // Keep the spelling the thing already uses, so "Health" and "health"
        // stay one value.
        const existing = Object.keys(object).find(k => k.toLowerCase() === target.name.toLowerCase());
        object[existing ?? target.name] = value;
      }
      return;
    }
    if (target.type === 'PhraseValue' && target.id === 'core:item') {
      const list = this.evaluate(target.args.list, env);
      const index = Math.floor(toNumber(this.evaluate(target.args.index, env)));
      if (!Array.isArray(list)) this.fail('"item N of" needs a list', target.line);
      const i = index < 0 ? list.length + index : index - 1;
      if (i < 0 || i >= list.length) this.fail(`This list has no item ${index}`, target.line);
      list[i] = value;
      return;
    }
    this.fail('I cannot set that', target.line);
  }

  // ------------------------------------------------------------- expressions

  evaluate(node, env) {
    switch (node.type) {
      case 'Number': case 'Text': case 'Bool': return node.value;
      case 'Nothing': return null;
      case 'List': return node.items.map(item => this.evaluate(item, env));
      case 'Record': {
        const out = {};
        for (const pair of node.pairs) out[pair.key] = this.evaluate(pair.value, env);
        return out;
      }
      case 'Var': {
        if (!env.has(node.name)) {
          this.fail(
            `I do not know a name called "${node.name}"`,
            node.line,
            `make ${node.name} be <value> before using it`
          );
        }
        return env.get(node.name);
      }
      case 'Field': {
        const object = this.evaluate(node.object, env);
        return this.readField(object, node.name, node.line);
      }
      case 'Logic': {
        const left = this.evaluate(node.left, env);
        if (node.op === 'and') return truthy(left) ? truthy(this.evaluate(node.right, env)) : false;
        return truthy(left) ? true : truthy(this.evaluate(node.right, env));
      }
      case 'Not': return !truthy(this.evaluate(node.value, env));
      case 'Negate': return -this.number(this.evaluate(node.value, env), node.line, 'minus');
      case 'Compare': return this.compare(node, env);
      case 'Math': return this.math(node, env);
      case 'PhraseValue': return this.callPhrase(node, env, 'value');
      case 'New': return this.makeThing(node, env);
      default:
        this.fail(`I do not know how to work out "${node.type}"`, node.line);
    }
  }

  readField(object, name, line) {
    if (object === null || object === undefined) {
      this.fail(`I cannot look up "${name}" because that thing is nothing`, line);
    }
    if (typeof object.getPlainField === 'function') {
      const v = object.getPlainField(name);
      if (v !== undefined) return v;
    }
    if (Array.isArray(object) || typeof object === 'string') {
      const lower = name.toLowerCase();
      if (lower === 'length' || lower === 'size' || lower === 'count') return object.length;
      if (lower === 'first') return itemAt(object, 1);
      if (lower === 'last') return itemAt(object, object.length);
    }
    const direct = object[name];
    if (direct !== undefined) return typeof direct === 'function' ? direct.bind(object) : direct;
    // Try a case-insensitive match before giving up.
    if (isThing(object)) {
      const hit = Object.keys(object).find(k => k.toLowerCase() === name.toLowerCase());
      if (hit) return object[hit];
    }
    this.fail(`That thing has no "${name}"`, line, `it has: ${Object.keys(object || {}).join(', ') || 'nothing'}`);
  }

  number(value, line, what) {
    const n = toNumber(value);
    if (Number.isNaN(n)) {
      this.fail(`I cannot use ${typeName(value)} with "${what}"`, line, 'both sides need to be numbers');
    }
    return n;
  }

  math(node, env) {
    const left = this.evaluate(node.left, env);
    const right = this.evaluate(node.right, env);
    if (node.op === 'join') return toText(left) + toText(right);
    if (node.op === '+' && (typeof left === 'string' || typeof right === 'string')) {
      return toText(left) + toText(right);
    }
    const a = this.number(left, node.line, node.op);
    const b = this.number(right, node.line, node.op);
    switch (node.op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        if (b === 0) this.fail('I cannot divide by zero', node.line);
        return a / b;
      case '%':
        if (b === 0) this.fail('I cannot divide by zero', node.line);
        return a % b;
      case '^': return a ** b;
    }
    this.fail(`Unknown maths "${node.op}"`, node.line);
  }

  compare(node, env) {
    const left = this.evaluate(node.left, env);
    const right = this.evaluate(node.right, env);
    switch (node.op) {
      case '==': return equals(left, right);
      case '!=': return !equals(left, right);
      case 'contains': return contains(left, right);
    }
    const bothText = typeof left === 'string' && typeof right === 'string';
    const a = bothText ? left : this.number(left, node.line, node.op);
    const b = bothText ? right : this.number(right, node.line, node.op);
    switch (node.op) {
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
    }
    this.fail(`Unknown comparison "${node.op}"`, node.line);
  }

  // ------------------------------------------------------------------ calls

  callPhrase(node, env, kind) {
    if (node.id.startsWith('user:')) return this.callUserFunction(node, env);

    const handler = this.runtime.handlers.get(node.id);
    if (!handler) this.fail(`Nothing knows how to do "${node.spec}"`, node.line);

    const args = {};
    for (const [key, value] of Object.entries(node.args)) {
      args[key] = typeof value === 'string' ? value : this.evaluate(value, env);
    }
    const context = this.contextFor(node, env);
    if (node.block) context.block = this.closure(node.block, env);

    const result = handler(args, context);
    return result === undefined ? null : result;
  }

  contextFor(node, env) {
    const self = this;
    return {
      runtime: this.runtime,
      interpreter: this,
      env,
      line: node.line,
      spec: node.spec,
      block: null,
      define: (name, value) => env.define(name, value),
      lookup: (name) => env.get(name),
      exists: (name) => env.has(name),
      assign: (name, value) => env.assign(name, value),
      output: (text) => this.runtime.output(text),
      // The lines inside this sentence's block, exactly as they were typed.
      blockSource: () => this.sourceOfBlock(node.block),
      fail: (message, hint) => self.fail(message, node.line, hint),
      call: (fn, ...args) => (typeof fn === 'function' ? fn(...args) : null)
    };
  }

  // ------------------------------------------------------------------ kinds

  makeThing(node, env) {
    const kind = this.kinds.get(String(node.kind).toLowerCase());
    if (!kind) {
      this.fail(
        `I do not know a kind called "${node.kind}"`,
        node.line,
        `describe it first with: a kind called ${node.kind}`
      );
    }
    const fields = {};
    for (const level of kindChain(kind).reverse()) {
      for (const field of level.fields) {
        fields[field.name] = field.value ? this.evaluate(field.value, level.env || env) : null;
      }
    }
    for (const pair of node.pairs) {
      const known = Object.keys(fields).find(k => k.toLowerCase() === pair.key.toLowerCase());
      if (!known) {
        this.fail(
          `A ${kind.name} has no "${pair.key}"`,
          node.line,
          `it has: ${Object.keys(fields).join(', ') || 'no values yet'}`
        );
      }
      fields[known] = this.evaluate(pair.value, env);
    }
    return new PlainThing(kind, fields);
  }

  kindNames(kind) {
    return kindChain(kind).map(level => String(level.name).toLowerCase());
  }

  findMethod(kind, name) {
    const wanted = String(name).toLowerCase();
    for (const level of kindChain(kind)) {
      const hit = level.actions.find(action => action.name === wanted);
      if (hit) return { action: hit, level };
    }
    return null;
  }

  callMethod(thing, name, args, line) {
    if (!(thing instanceof PlainThing)) {
      this.fail(`I can only tell one of your own kinds to do something`, line);
    }
    const found = this.findMethod(thing._kind, name);
    if (!found) {
      const known = kindChain(thing._kind).flatMap(level => level.actions.map(a => a.name));
      this.fail(
        `A ${thing._kind.name} does not know how to "${name}"`,
        line,
        known.length ? `it can: ${known.join(', ')}` : 'give the kind an action with "to ..."'
      );
    }
    const scope = new Environment(found.level.env || this.globals);
    scope.define('me', thing);
    found.action.params.forEach((param, index) => scope.define(param, args[index] ?? null));
    try {
      this.runBlock(found.action.block, scope);
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    }
    return null;
  }

  // The action named `name`, as a value that can be passed around.
  actionValue(name, line) {
    const wanted = String(name).toLowerCase();
    for (const [id, fn] of this.functions) {
      if (fn.name === wanted) return this.wrapFunction(id, fn);
    }
    this.fail(`I do not know an action called "${name}"`, line, `write it with: to ${name} ...`);
  }

  wrapFunction(id, fn) {
    const self = this;
    const wrapped = function (...args) {
      const scope = new Environment(fn.env || self.globals);
      fn.params.forEach((param, index) => scope.define(param, args[index] ?? null));
      try {
        self.runBlock(fn.block, scope);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
      return null;
    };
    wrapped.plainAction = fn.name;
    wrapped.plainInputs = fn.params.length;
    return wrapped;
  }

  sourceOfBlock(block) {
    const source = this.runtime.source;
    if (!block || !source || !block.startLine) return '';
    const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
    return lines.slice(block.startLine - 1, block.endLine).join('\n');
  }

  callUserFunction(node, env) {
    const fn = this.functions.get(node.id);
    if (!fn) this.fail(`I do not know how to "${node.spec}" yet`, node.line);
    const scope = new Environment(fn.env || this.globals);
    for (const param of fn.params) {
      const value = node.args[param];
      scope.define(param, value === undefined ? null : this.evaluate(value, env));
    }
    try {
      this.runBlock(fn.block, scope);
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    }
    return null;
  }
}

// A kind and everything it is based on, nearest first.
function kindChain(kind) {
  const chain = [];
  let level = kind;
  while (level && !chain.includes(level)) { chain.push(level); level = level.base; }
  return chain;
}

export { ReturnSignal, BreakSignal, ContinueSignal, kindChain };

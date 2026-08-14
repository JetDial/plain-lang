// Plain - runtime.
// Holds the sentences the language knows and runs a program with them.

import { tokenize } from './lexer.js';
import { Parser } from './parser.js';
import { PhraseTable } from './phrases.js';
import { Interpreter } from './interp.js';
import { PlainError } from './errors.js';
import { installCore, StopProgram } from './stdlib.js';

let phraseCounter = 0;

export class Runtime {
  constructor(options = {}) {
    this.phrases = { statement: new PhraseTable(), value: new PhraseTable(), infix: new PhraseTable() };
    this.handlers = new Map();
    this.options = options;
    this.loopLimit = options.loopLimit;
    this.lines = [];
    this.onOutput = options.onOutput || null;
    this.interpreter = new Interpreter(this);
    this.libraries = new Set();
    if (options.core !== false) installCore(this);
  }

  // Register a sentence that does something.
  //   define('add $value to #name', (args, ctx) => { ... })
  define(spec, handler, id = null) {
    return this.register('statement', spec, handler, id);
  }

  // Register a sentence that produces a value.
  //   defineValue('length of $thing', (args) => args.thing.length)
  defineValue(spec, handler, id = null) {
    return this.register('value', spec, handler, id);
  }

  // Register the same sentence in both places (useful for things like
  // "random 1 to 6" that read fine either way).
  defineBoth(spec, handler, id = null) {
    const realId = id || `phrase:${++phraseCounter}`;
    this.register('statement', spec, handler, realId);
    this.register('value', spec, handler, realId);
    return realId;
  }

  // Register a sentence that sits between two values:
  //   defineInfix('$a touches $b', ...)  ->  if ball touches paddle
  defineInfix(spec, handler, id = null) {
    return this.register('infix', spec, handler, id);
  }

  register(kind, spec, handler, id) {
    const realId = id || `phrase:${++phraseCounter}`;
    this.phrases[kind].add(spec, realId, kind === 'infix');
    if (handler) this.handlers.set(realId, handler);
    return realId;
  }

  output(text) {
    this.lines.push(text);
    if (this.onOutput) this.onOutput(text);
    else if (typeof console !== 'undefined') console.log(text);
  }

  parse(source, file = '<input>') {
    const tokens = tokenize(source, file);
    const parser = new Parser(tokens, this.phrases, file);
    return parser.parseProgram();
  }

  run(source, file = '<input>') {
    const program = this.parse(source, file);
    try {
      this.interpreter.run(program);
    } catch (error) {
      // "stop the program" is a normal way to finish early.
      if (!(error instanceof StopProgram)) throw error;
    }
    return this;
  }

  // Run and turn any Plain error into a readable report instead of throwing.
  tryRun(source, file = '<input>') {
    try {
      this.run(source, file);
      return { ok: true, output: this.lines.slice() };
    } catch (error) {
      if (error instanceof PlainError) {
        return { ok: false, error, message: error.report(source), output: this.lines.slice() };
      }
      throw error;
    }
  }

  // The full list of sentences currently understood - used by `plain words`.
  vocabulary() {
    return {
      statements: this.phrases.statement.allSpecs(),
      values: this.phrases.value.allSpecs(),
      between: this.phrases.infix.allSpecs()
    };
  }
}

export function createRuntime(options) {
  return new Runtime(options);
}

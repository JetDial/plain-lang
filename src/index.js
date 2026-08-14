// Plain - public entry point.
//
//   import { createRuntime } from 'plain-lang';
//   createRuntime().run('show "hello"');

export { Runtime, createRuntime } from './runtime.js';
export { tokenize } from './lexer.js';
export { Parser, parse, RESERVED } from './parser.js';
export { Interpreter, Environment } from './interp.js';
export { PhraseTable, parseSpec } from './phrases.js';
export { PlainError } from './errors.js';
export { installCore, StopProgram } from './stdlib.js';
export * as values from './values.js';

import { createRuntime } from './runtime.js';

// Convenience: run a snippet and get the printed lines back.
export function runPlain(source, options = {}) {
  const rt = createRuntime(options);
  rt.run(source, options.file || '<input>');
  return rt.lines;
}

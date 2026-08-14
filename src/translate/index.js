// Plain - the translator.
//
//   plain translate hello.plain --to python
//
// Ordinary programs translate: names, sums, questions, loops, lists, things,
// actions, your own kinds, catching problems. Sentences that belong to an
// engine (games, worlds, websites, videos) stay in Plain, and the translator
// says so plainly rather than writing something that only half works.

import { JavaScriptEmitter } from './javascript.js';
import { PythonEmitter } from './python.js';

export const TARGETS = {
  javascript: { emitter: JavaScriptEmitter, also: ['js', 'node'] },
  python: { emitter: PythonEmitter, also: ['py', 'python3'] }
};

export function targetNames() {
  return Object.keys(TARGETS);
}

export function findTarget(name) {
  const wanted = String(name || '').toLowerCase();
  if (TARGETS[wanted]) return TARGETS[wanted];
  return Object.values(TARGETS).find(target => target.also.includes(wanted)) || null;
}

// `program` is a parsed Plain program (runtime.parse(source, file)).
export function translate(program, targetName, meta = {}) {
  const target = findTarget(targetName);
  if (!target) {
    throw new Error(`I cannot write ${targetName}. I know: ${targetNames().join(', ')}`);
  }
  const emitter = new target.emitter();
  return {
    name: emitter.name,
    extension: emitter.extension,
    code: emitter.translate(program, meta)
  };
}

export { Emitter } from './emitter.js';
export { JavaScriptEmitter, PythonEmitter };

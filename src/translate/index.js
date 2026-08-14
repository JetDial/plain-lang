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
import { CSharpEmitter } from './csharp.js';
import { LuaEmitter } from './lua.js';
import { TypeScriptEmitter } from './typescript.js';
import { RubyEmitter } from './ruby.js';
import { JavaEmitter } from './java.js';
import { GoEmitter } from './go.js';
import { PhpEmitter } from './php.js';
import { RustEmitter } from './rust.js';

// `run` says the test suite runs the generated file and compares what it
// prints with what Plain printed. A language whose tool is not on the
// machine is skipped, and the run says which ones it could not check.
export const TARGETS = {
  javascript: { emitter: JavaScriptEmitter, also: ['js', 'node'], run: true },
  python: { emitter: PythonEmitter, also: ['py', 'python3'], run: true },
  csharp: { emitter: CSharpEmitter, also: ['cs', 'c#', 'dotnet', 'unity'], run: true },
  lua: { emitter: LuaEmitter, also: ['love', 'roblox'], run: true },
  typescript: { emitter: TypeScriptEmitter, also: ['ts'], run: true },
  ruby: { emitter: RubyEmitter, also: ['rb'], run: true },
  java: { emitter: JavaEmitter, also: ['jvm'], run: true },
  go: { emitter: GoEmitter, also: ['golang'], run: true },
  php: { emitter: PhpEmitter, also: ['php8'], run: true },
  rust: { emitter: RustEmitter, also: ['rs'], run: true }
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
export {
  JavaScriptEmitter, PythonEmitter, CSharpEmitter, LuaEmitter, TypeScriptEmitter,
  RubyEmitter, JavaEmitter, GoEmitter, PhpEmitter, RustEmitter
};

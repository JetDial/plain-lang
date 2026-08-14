// Plain -> TypeScript.
//
// The same shape as the JavaScript, with types written on. Plain lets a name
// hold whatever you put in it, so the honest type for most things is the one
// that says exactly that.

import { JavaScriptEmitter } from './javascript.js';

export class TypeScriptEmitter extends JavaScriptEmitter {
  get name() { return 'TypeScript'; }
  get extension() { return '.ts'; }

  declare(name, value) { return `let ${name}: any = ${value}`; }
  forEachHeader(name, iterable) { return `for (const ${name} of ${iterable} as any[]) {`; }
  functionHeader(name, params) {
    return `function ${name}(${params.map(p => `${p}: any`).join(', ')}): any {`;
  }
  methodHeader(name, params) {
    return `${name}(${params.map(p => `${p}: any`).join(', ')}): any {`;
  }
  catchHeader(name) { return `catch (${name}: any) {`; }

  emitConstructor(node) {
    const inherited = this.inheritedFields(node);
    this.write('');
    for (const field of node.fields) {
      const name = this.fieldName(field.name);
      if (!inherited.has(name)) this.writeLine(`${name}: any`);
    }
    this.write('');
    this.open('constructor(values: Record<string, any> = {}) {');
    if (node.base) this.writeLine('super(values)');
    for (const field of node.fields) {
      this.writeLine(`this.${this.fieldName(field.name)} = ${field.value ? this.expression(field.value) : 'null'}`);
    }
    this.writeLine('Object.assign(this, values)');
    this.close();
  }

  // The helper object is the JavaScript one; TypeScript is happy with it
  // once it is told not to look too closely.
  emitHelpers() {
    const written = JavaScriptEmitter.prototype.emitHelpers.call(this);
    if (!written) return '';
    return written.replace('const plain = {', 'const plain: any = {');
  }

  preamble() {
    return ["'use strict';"];
  }
}

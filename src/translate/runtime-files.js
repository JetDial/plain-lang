// Plain - reading the Rust and C runtimes off the disk.
//
// This is the only file in the translator that touches the file system, and
// nothing imports it except Plain running in a terminal. Keeping it apart is
// what lets the rest of the translator run in a browser, where the course
// shows your program in every language it can write.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { setRuntimeSource } from './runtimes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

export const RUNTIME_FILES = {
  rust: path.join(ROOT, 'runtime', 'rust', 'plain.rs'),
  c: path.join(ROOT, 'runtime', 'c', 'plain.c')
};

export function loadRuntimeFiles() {
  for (const [name, file] of Object.entries(RUNTIME_FILES)) {
    setRuntimeSource(name, fs.readFileSync(file, 'utf8'));
  }
}

loadRuntimeFiles();

// Plain - where the Rust and C runtimes come from.
//
// Those two targets are not written out of thin air: each one is pasted on
// top of a real source file in runtime/. Reading a file is a terminal thing,
// and the translator also runs in a browser (the course shows your program in
// every language), so nothing here reaches for the file system. Whoever can
// read files hands the text over instead:
//
//   in a terminal   src/translate/runtime-files.js does it when Plain starts
//   in a browser    the course fetches them and calls setRuntimeSource
//
// If nobody has, translating to that language says so plainly rather than
// writing out a file that will not build.

// Rust and C files begin with a runtime far longer than the program. This
// line sits between the two, so the course can fold the runtime away and a
// person opening the file knows where to start reading.
export const PROGRAM_STARTS = 'Plain: your own program starts here';

const sources = new Map();

export function setRuntimeSource(name, text) {
  sources.set(name, String(text).trimEnd());
}

export function hasRuntimeSource(name) {
  return sources.has(name);
}

export function runtimeSource(name) {
  const found = sources.get(name);
  if (found === undefined) {
    throw new Error(
      `I cannot write ${name} here: it is built on runtime/${name === 'rust' ? 'rust/plain.rs' : 'c/plain.c'}, ` +
      'which has not been loaded. In a terminal this happens by itself; in a browser the page has to fetch it first.'
    );
  }
  return found;
}

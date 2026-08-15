// Plain, embedded.
//
// The whole language as one function another program can call:
//
//     import { runPlain } from './embed.js';
//     const { output, ok, problem } = runPlain('show 2 plus 2');
//
// Everything the terminal has is here - the language, the engines, the six
// human languages - minus the things that need a screen or a socket, which
// simply do nothing rather than fail. Handing in `files` lets the program
// `use` other programs without a disk.

import { createRuntime } from './src/runtime.js';
import { installGame } from './engines/game/engine.js';
import { installWorld } from './engines/world/engine.js';
import { installWeb } from './engines/web/engine.js';
import { installVideo } from './engines/video/engine.js';
import { installStore } from './engines/store/engine.js';
import { installData } from './engines/data/engine.js';
import { installParts } from './engines/parts/engine.js';
import { installNet } from './engines/net/engine.js';

export function makePlain(options = {}) {
  const lines = [];
  const runtime = createRuntime({
    onOutput: options.onOutput || (text => lines.push(text)),
    loopLimit: options.loopLimit,
    files: options.files || null,
    resolve: options.resolve || null
  });
  const game = installGame(runtime, options.host || {});
  const world = installWorld(runtime, options.host || {});
  const site = installWeb(runtime, options.host || {});
  const studio = installVideo(runtime, options.host || {});
  installStore(runtime, options.host || {});
  installData(runtime, options.host || {});
  installParts(runtime);
  installNet(runtime, { serve: options.serve || (() => {}) });
  return { runtime, game, world, site, studio, lines };
}

export function runPlain(source, options = {}) {
  const plain = makePlain(options);
  const verdict = plain.runtime.tryRun(source, options.name || 'embedded.plain');
  return {
    ok: verdict.ok,
    output: verdict.output || plain.lines,
    problem: verdict.ok ? null : verdict.message,
    ...plain
  };
}

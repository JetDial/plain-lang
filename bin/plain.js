#!/usr/bin/env node
// Plain - the command line tool.
//
//   plain run    file.plain          run it here in the terminal
//   plain play   file.plain          open a game or website in the browser
//   plain build  file.plain          write a folder of HTML you can publish
//   plain check  file.plain          look for mistakes without running
//   plain words                      list every sentence Plain understands
//   plain new    name                start a new program

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

import { createRuntime } from '../src/runtime.js';
import { PlainError } from '../src/errors.js';
import { installGame } from '../engines/game/engine.js';
import { installWorld } from '../engines/world/engine.js';
import { installWeb } from '../engines/web/engine.js';
import { installVideo } from '../engines/video/engine.js';
import { installStore } from '../engines/store/engine.js';
import { installNet } from '../engines/net/engine.js';
import { documentToHTML, hrefFor } from '../engines/web/render.js';
import { TEMPLATES, templateNames } from './templates.js';
import { translate, targetNames, findTarget } from '../src/translate/index.js';
import { syllabus, totalSteps } from '../engines/learn/course.js';
import { format } from '../src/format.js';

globalThis.__plainFS = fs;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const VERSION = '0.3.0';

// Declared up here because the command switch below runs as the file loads.
const STARTER = `# A new Plain program. Run it with: plain run this-file.plain

make name be "world"
show "Hello, {name}!"

make score be 0
repeat 3 times
    add 10 to score
end
show "Score: {score}"

if score is above 20
    show "That is a good score."
end
`;

const argv = process.argv.slice(2);
const command = (argv[0] || 'help').toLowerCase();
const rest = argv.slice(1);
const flags = readFlags(rest);
const target = rest.find(a => !a.startsWith('-'));

try {
  switch (command) {
    case 'run': await commandRun(target); break;
    case 'play': case 'serve': await commandServe(target, 'play'); break;
    case 'edit': case 'design': case 'studio': await commandServe(target, 'edit'); break;
    case 'build': await commandBuild(target); break;
    case 'check': await commandCheck(target); break;
    case 'words': commandWords(); break;
    case 'new': commandNew(target); break;
    case 'make': commandMake(rest[0], rest[1]); break;
    case 'translate': commandTranslate(target); break;
    case 'learn': case 'teach': await commandLearn(); break;
    case 'fmt': case 'tidy': commandTidy(rest.filter(a => !a.startsWith('-'))); break;
    case 'version': case '--version': case '-v': console.log(`Plain ${VERSION}`); break;
    default: commandHelp();
  }
} catch (error) {
  if (error instanceof PlainError) {
    console.error('\n' + error.report(error._source));
    process.exitCode = 1;
  } else {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------ helpers

function readFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) continue;
    const name = arg.replace(/^-+/, '');
    const next = args[i + 1];
    if (next && !next.startsWith('-')) { out[name] = next; i++; }
    else out[name] = true;
  }
  return out;
}

function readProgram(file) {
  if (!file) fail('Which file? Try: plain run hello.plain');
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) fail(`I cannot find "${file}"`);
  return { full, source: fs.readFileSync(full, 'utf8'), name: path.basename(full, path.extname(full)) };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function buildRuntime(onOutput, baseFile = process.cwd()) {
  const runtime = createRuntime({
    onOutput,
    // `use "helpers.plain"` looks next to the program that used it.
    resolve: (used, fromFile) => {
      const from = fromFile && fs.existsSync(fromFile) ? fromFile : baseFile;
      const full = path.resolve(path.dirname(path.resolve(from)), used);
      return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
    }
  });
  const game = installGame(runtime, {});
  const site = installWeb(runtime, {});
  const world = installWorld(runtime, {});
  const studio = installVideo(runtime, {});
  const store = installStore(runtime, storeHost(baseFile));
  const server = installNet(runtime, netHost(runtime));
  return { runtime, game, site, world, studio, store, server };
}

// Fetching has to finish before the next line runs, and the interpreter does
// not wait for anything. A short-lived helper process does the asking, which
// is simple, and correct, and costs about the blink of an eye.
function netHost(runtime) {
  let last = null;

  const HELPER = `
    const [url, method, body, isJson] = process.argv.slice(1);
    const options = { method, headers: {} };
    if (body) {
      options.body = body;
      options.headers['content-type'] = isJson === 'yes' ? 'application/json' : 'text/plain';
    }
    fetch(url, options)
      .then(async answer => {
        const text = await answer.text();
        process.stdout.write(JSON.stringify({ ok: answer.ok, status: answer.status, text }));
      })
      .catch(problem => {
        process.stdout.write(JSON.stringify({ ok: false, status: 0, text: '', problem: String(problem && problem.message || problem) }));
      });
  `;

  return {
    fetchText(url, ctx, options = {}) {
      if (!/^https?:\/\//i.test(url)) {
        ctx.fail(`"${url}" is not a web address`, 'it should start with http:// or https://');
      }
      let raw;
      try {
        raw = execFileSync(process.execPath, [
          '-e', HELPER, url, options.method || 'GET', options.body || '', options.json ? 'yes' : 'no'
        ], { encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024 });
      } catch (error) {
        ctx.fail(`I could not reach ${url}`, 'check the address, and that you are online');
      }
      let answer;
      try { answer = JSON.parse(raw); } catch { answer = { ok: false, status: 0, text: raw }; }
      if (answer.problem) ctx.fail(`I could not reach ${url}: ${answer.problem}`);
      last = { ok: answer.ok, status: answer.status, text: answer.text };
      return last;
    },

    lastFetch: () => last,

    siteHTML(path) {
      const site = runtime.site;
      if (!site) return '';
      const wanted = String(path).replace(/^\//, '') || 'index.html';
      const page = site.pages.find(one => hrefFor(one.path) === wanted) || site.pages[0];
      return documentToHTML(site, page, {});
    },

    // The program has finished by now; the server keeps the process alive.
    serve(server, ctx) {
      const listener = http.createServer((request, response) => {
        const url = new URL(request.url, `http://localhost:${server.port}`);
        const chunks = [];
        request.on('data', piece => chunks.push(piece));
        request.on('end', () => {
          server.asked = {
            path: url.pathname,
            query: Object.fromEntries(url.searchParams.entries()),
            sent: Buffer.concat(chunks).toString('utf8'),
            method: request.method
          };
          server.answer = null;

          const route = server.routeFor(url.pathname);
          const run = route ? route.run : server.notFound;
          if (!run) {
            response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            response.end(`Nothing is at ${url.pathname}`);
            return;
          }

          try {
            run();
          } catch (error) {
            const message = error instanceof PlainError ? error.report(runtime.source) : String(error.message || error);
            console.error('\n' + message + '\n');
            response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
            response.end(message);
            return;
          }

          const answer = server.answer || { body: '', kind: 'text/plain; charset=utf-8' };
          response.writeHead(200, { 'content-type': answer.kind });
          response.end(answer.body);
          console.log(`  ${request.method} ${url.pathname} -> ${answer.body.length} bytes`);
        });
      });

      listener.on('error', (error) => {
        console.error(`\nI could not serve on port ${server.port}: ${error.message}\n`);
        process.exitCode = 1;
      });

      listener.listen(server.port, () => {
        console.log(`\nPlain is answering at http://localhost:${server.port}`);
        for (const route of server.routes) console.log(`  ${route.path}`);
        console.log('\nPress Ctrl+C to stop.\n');
      });
      server.running = listener;
    }
  };
}

// Remembered values live in one small file beside the program, and files a
// program reads or writes stay in that same folder.
function storeHost(baseFile) {
  const full = path.resolve(baseFile);
  const folder = fs.existsSync(full) && fs.statSync(full).isDirectory() ? full : path.dirname(full);
  const stem = path.basename(full, path.extname(full)) || 'plain';

  const inside = (name, ctx) => {
    const wanted = path.resolve(folder, String(name));
    if (wanted !== folder && !wanted.startsWith(folder + path.sep)) {
      ctx.fail(`"${name}" is outside this folder, and Plain only reads and writes files next to your program`);
    }
    return wanted;
  };

  return {
    fs,
    memoryFile: path.join(folder, `${stem}.memory.json`),
    files: {
      read: (name, ctx) => {
        const file = inside(name, ctx);
        return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      },
      exists: (name, ctx) => fs.existsSync(inside(name, ctx)),
      write: (name, text, ctx) => fs.writeFileSync(inside(name, ctx), text, 'utf8'),
      append: (name, text, ctx) => fs.appendFileSync(inside(name, ctx), text, 'utf8')
    }
  };
}

// Every file a program pulls in with `use`, so a built page can carry them.
function collectUsed(source, file, found = {}) {
  const uses = [...String(source).matchAll(/^[ \t]*use[ \t]+["']([^"'\n]+)["'][ \t]*$/gm)].map(m => m[1]);
  for (const used of uses) {
    if (found[used] !== undefined) continue;
    const full = path.resolve(path.dirname(path.resolve(file)), used);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    found[used] = text;
    collectUsed(text, full, found);
  }
  return found;
}

function reportPlainError(error, source) {
  if (error instanceof PlainError) {
    console.error('\n' + error.report(source) + '\n');
    process.exitCode = 1;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------- run

// Running a program by translating it to JavaScript first. The interpreter
// reads the tree over and over; the translation is read once by a machine
// that has spent twenty years learning to run JavaScript quickly.
function runFast(program) {
  const { runtime } = buildRuntime(() => {}, program.full);
  let code;
  try {
    code = translate(runtime.parse(program.source, path.basename(program.full)), 'javascript', {
      file: path.basename(program.full),
      version: VERSION
    }).code;
  } catch (error) {
    if (error instanceof PlainError) {
      console.error('\n' + error.report(program.source));
      console.error('\nRun it the ordinary way instead:\n');
      console.error(`    plain run ${path.basename(program.full)}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-fast-'));
  const target = path.join(folder, path.basename(program.full, '.plain') + '.js');
  fs.writeFileSync(target, code, 'utf8');
  try {
    execFileSync(process.execPath, [target], { stdio: 'inherit', cwd: path.dirname(program.full) });
  } catch (error) {
    process.exitCode = error.status ?? 1;
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function commandRun(file) {
  const program = readProgram(file);
  if (flags.fast) return runFast(program);
  const { runtime, game, site, studio, world } = buildRuntime(text => console.log(text), program.full);

  try {
    runtime.run(program.source, path.basename(program.full));
  } catch (error) {
    if (reportPlainError(error, program.source)) return;
    throw error;
  }

  if (game.started) {
    const frames = Number(flags.frames || 0);
    if (frames > 0) {
      game.simulate(frames);
      const counted = world.started
        ? `${world.bodies.length} things in the world`
        : `${game.things.length} things on screen`;
      console.log(`\n(simulated ${frames} frames of "${game.title}" - ${counted})`);
    } else {
      console.log(`\nThis is a game ("${game.title}"). To play it:\n\n    plain play ${file}\n`);
    }
    return;
  }

  if (studio.started) {
    const clips = studio.clips.length;
    console.log(`\n"${studio.title}" - ${clips} clip${clips === 1 ? '' : 's'}, ${studio.length.toFixed(1)} seconds, ${studio.width}x${studio.height}`);
    for (const placed of studio.layout()) {
      const clip = placed.clip;
      const what = clip.kind === 'title' ? `"${clip.text}"` : (clip.source || clip.color);
      console.log(`  ${placed.start.toFixed(1)}s  ${clip.kind.padEnd(8)} ${what}`);
    }
    console.log(`\nTo watch it:\n\n    plain play ${file}\n\nTo edit the timeline:\n\n    plain edit ${file}\n`);
    return;
  }

  if (site.pages.some(page => page.nodes.length)) {
    console.log(`\nThis is a website ("${site.title}"). To see it:\n\n    plain play ${file}\n\nTo write the HTML files:\n\n    plain build ${file}\n`);
  }
}

// -------------------------------------------------------------------- check

async function commandCheck(file) {
  const program = readProgram(file);
  const { runtime } = buildRuntime(() => {});
  try {
    runtime.parse(program.source, path.basename(program.full));
    console.log(`${file} looks fine.`);
  } catch (error) {
    if (reportPlainError(error, program.source)) return;
    throw error;
  }
}

// -------------------------------------------------------------------- words

function commandWords() {
  const { runtime } = buildRuntime(() => {});
  const vocabulary = runtime.vocabulary();
  const show = (heading, items) => {
    console.log(`\n${heading}\n${'-'.repeat(heading.length)}`);
    for (const spec of items) console.log('  ' + spec);
  };
  console.log(`Plain ${VERSION} - every sentence it understands.`);
  console.log('  $x means "a value here", #x means "a name here", ... means "a block of lines, closed by end".');
  show('Sentences that do something', vocabulary.statements);
  show('Sentences that give a value', vocabulary.values);
  if (vocabulary.between.length) show('Sentences that sit between two values', vocabulary.between);
  console.log('');
}

// ---------------------------------------------------------------------- new

function commandNew(name) {
  const file = (name || 'hello') + (path.extname(name || '') ? '' : '.plain');
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) fail(`"${file}" already exists.`);
  fs.writeFileSync(full, STARTER, 'utf8');
  console.log(`Made ${file}. Run it with:\n\n    plain run ${file}\n`);
}

// --------------------------------------------------------------------- tidy

function commandTidy(files) {
  const wanted = files.length ? files : ['.'];
  const found = [];
  for (const name of wanted) {
    const full = path.resolve(process.cwd(), name);
    if (!fs.existsSync(full)) fail(`I cannot find "${name}"`);
    if (fs.statSync(full).isDirectory()) {
      for (const entry of fs.readdirSync(full)) {
        if (entry.endsWith('.plain')) found.push(path.join(full, entry));
      }
    } else {
      found.push(full);
    }
  }
  if (!found.length) fail('No .plain files here to tidy.');

  let changed = 0;
  let unreadable = 0;
  for (const file of found) {
    const source = fs.readFileSync(file, 'utf8');
    const { runtime } = buildRuntime(() => {}, file);
    let program;
    try {
      program = runtime.parse(source, path.basename(file));
    } catch (error) {
      // A file that does not parse cannot be tidied; say so and move on.
      console.log(`${path.relative(process.cwd(), file)}: cannot tidy - ${error.plainMessage || error.message}`);
      unreadable++;
      continue;
    }
    const tidy = format(source, program);
    const already = tidy === source.replace(/\r\n?/g, '\n');
    if (already) continue;
    changed++;
    if (flags.check) {
      console.log(`${path.relative(process.cwd(), file)}: needs tidying`);
    } else {
      fs.writeFileSync(file, tidy, 'utf8');
      console.log(`Tidied ${path.relative(process.cwd(), file)}`);
    }
  }

  if (unreadable) process.exitCode = 1;
  if (!changed && !unreadable) console.log(`Nothing to do: ${found.length} file${found.length === 1 ? '' : 's'} already tidy.`);
  if (flags.check && changed) process.exitCode = 1;
}

// -------------------------------------------------------------------- learn

async function commandLearn() {
  const course = syllabus();

  if (flags.list) {
    console.log(`\nLearn Plain - ${course.length} parts, ${totalSteps()} steps.\n`);
    for (const part of course) {
      const label = part.kind === 'lesson' ? 'lesson ' : 'project';
      console.log(`  ${label}  ${part.title}${part.steps > 1 ? `  (${part.steps} steps)` : ''}`);
    }
    console.log('\nStart it with:\n\n    plain learn\n');
    return;
  }

  const port = Number(flags.port || flags.p || 4500);
  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Learn Plain</title>
  </head>
  <body>
    <script type="module">
      import { learnPlain } from '/plain/src/browser.js';
      learnPlain();
    </script>
  </body>
</html>
`;

  const server = http.createServer((request, response) => {
    const route = decodeURIComponent(new URL(request.url, `http://localhost:${port}`).pathname);
    if (route.startsWith('/plain/')) return sendFile(response, path.join(ROOT, route.slice('/plain/'.length)));
    if (route === '/' || route === '/index.html') return sendText(response, 200, page, 'text/html');
    sendText(response, 404, 'Not found', 'text/plain');
  });

  server.listen(port, () => {
    const address = `http://localhost:${port}`;
    console.log(`\nLearn Plain is open at ${address}`);
    console.log(`${course.length} parts, ${totalSteps()} steps. Your progress is kept in the browser.`);
    console.log('Press Ctrl+C to stop.\n');
    if (!flags['no-open']) openBrowser(address);
  });
}

// ---------------------------------------------------------------- translate

function commandTranslate(file) {
  const program = readProgram(file);
  const wanted = flags.to || flags.t;

  if (wanted === true || !wanted) {
    console.log(`Translate into what? One of: ${targetNames().join(', ')}, or all\n`);
    console.log(`    plain translate ${file || '<file.plain>'} --to python`);
    console.log(`    plain translate ${file || '<file.plain>'} --to all --out translated\n`);
    process.exitCode = 1;
    return;
  }

  const chosen = String(wanted).toLowerCase() === 'all' ? targetNames() : [String(wanted)];
  for (const name of chosen) {
    if (!findTarget(name)) fail(`I cannot write ${name}. I know: ${targetNames().join(', ')}`);
  }

  const { runtime } = buildRuntime(() => {}, program.full);
  let parsed;
  try {
    parsed = runtime.parse(program.source, path.basename(program.full));
  } catch (error) {
    if (reportPlainError(error, program.source)) return;
    throw error;
  }

  const meta = { file: path.basename(program.full), version: VERSION };
  const results = [];
  for (const name of chosen) {
    try {
      results.push(translate(parsed, name, meta));
    } catch (error) {
      if (reportPlainError(error, program.source)) return;
      throw error;
    }
  }

  const out = flags.out || flags.o;
  if (!out) {
    // Straight to the terminal, so it can be piped somewhere.
    console.log(results.map(result => result.code).join('\n'));
    return;
  }

  const folder = path.resolve(process.cwd(), out);
  const asFolder = chosen.length > 1 || !path.extname(folder);
  if (asFolder) fs.mkdirSync(folder, { recursive: true });
  for (const result of results) {
    const target = asFolder ? path.join(folder, program.name + result.extension) : folder;
    fs.writeFileSync(target, result.code, 'utf8');
    console.log(`Wrote ${result.name} to ${path.relative(process.cwd(), target)}`);
  }
}

// --------------------------------------------------------------------- make

function commandMake(kind, name) {
  const key = String(kind || '').toLowerCase();
  const template = TEMPLATES[key];
  if (!template) {
    console.log(`Make what? One of: ${templateNames().join(', ')}\n`);
    console.log('  plain make game space-catch');
    console.log('  plain make world moon-walk');
    console.log('  plain make site my-notes');
    console.log('  plain make video holiday\n');
    process.exitCode = 1;
    return;
  }
  const chosen = name || key;
  const file = chosen.endsWith('.plain') ? chosen : chosen + '.plain';
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) fail(`"${file}" already exists.`);
  fs.writeFileSync(full, template.source(prettyName(chosen)), 'utf8');
  console.log(`Made ${file} - ${template.about}\n`);
  console.log(`    plain ${template.command} ${file}\n`);
}

function prettyName(name) {
  return String(name).replace(/\.plain$/, '').replace(/[-_]+/g, ' ')
    .replace(/\b[a-z]/g, c => c.toUpperCase());
}

// -------------------------------------------------------------------- build

async function commandBuild(file) {
  const program = readProgram(file);
  const out = path.resolve(process.cwd(), flags.out || flags.o || 'out');
  const { runtime, game, site, studio } = buildRuntime(text => console.log(text), program.full);

  try {
    runtime.run(program.source, path.basename(program.full));
  } catch (error) {
    if (reportPlainError(error, program.source)) return;
    throw error;
  }

  fs.mkdirSync(out, { recursive: true });
  copyRuntime(out);

  const script = `    <script type="module">
      import { startPlain } from './plain/src/browser.js';
      startPlain(${JSON.stringify(program.source)}, { file: ${JSON.stringify(path.basename(program.full))} });
    </script>`;

  if (game.started) {
    fs.writeFileSync(path.join(out, 'index.html'), gamePage(game.title, script), 'utf8');
    console.log(`Built the game into ${path.join(path.relative(process.cwd(), out), 'index.html')}`);
    console.log('Put the folder on a web host to share it. To play it here, use:');
    console.log(`\n    plain play ${file}\n`);
    console.log('(Browsers refuse to load a game opened straight from disk, so it needs a host.)');
    return;
  }

  let count = 0;
  for (const page of site.pages) {
    if (!page.nodes.length && site.pages.length > 1) continue;
    const html = documentToHTML(site, page, { script });
    fs.writeFileSync(path.join(out, hrefFor(page.path)), html, 'utf8');
    count++;
  }
  console.log(`Built ${count} page${count === 1 ? '' : 's'} into ${path.relative(process.cwd(), out)}`);
  console.log('Put the whole folder on any web host. Opening index.html from disk');
  console.log('shows the pages, but buttons only come alive once it is served.');
}

function copyRuntime(out) {
  const to = path.join(out, 'plain');
  fs.rmSync(to, { recursive: true, force: true });
  for (const folder of ['src', 'engines']) {
    fs.cpSync(path.join(ROOT, folder), path.join(to, folder), { recursive: true });
  }
}

function gamePage(title, script) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title.replace(/[<>&]/g, '')}</title>
  </head>
  <body>
${script}
  </body>
</html>
`;
}

// -------------------------------------------------------------------- serve

async function commandServe(file, mode = 'play') {
  const program = readProgram(file);
  const port = Number(flags.port || flags.p || 4400);
  const folder = path.dirname(program.full);
  const editing = mode === 'edit';

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    const route = decodeURIComponent(url.pathname);

    try {
      // The designer and the video studio save through here.
      if (request.method === 'POST' && route === '/source') {
        if (!editing) return sendText(response, 403, 'This page was not opened for editing', 'text/plain');
        let body = '';
        request.on('data', chunk => { body += chunk; });
        request.on('end', () => {
          fs.writeFileSync(program.full, body, 'utf8');
          console.log(`  saved ${path.basename(program.full)} (${body.split('\n').length} lines)`);
          sendText(response, 200, 'saved', 'text/plain');
        });
        return;
      }

      // The runtime modules, straight from the Plain installation.
      if (route.startsWith('/plain/')) {
        return sendFile(response, path.join(ROOT, route.slice('/plain/'.length)));
      }

      // Every request re-reads the program, so a refresh shows your edits.
      const source = fs.readFileSync(program.full, 'utf8');
      const { runtime, game, site, studio } = buildRuntime(text => console.log('  ' + text), program.full);
      try {
        runtime.run(source, path.basename(program.full));
      } catch (error) {
        return sendText(response, 500, errorPage(error, source), 'text/html');
      }

      const options = {
        file: path.basename(program.full),
        files: collectUsed(source, program.full)
      };
      const start = editing ? 'editPlain' : 'startPlain';
      const script = `    <script type="module">
      import { ${start} } from '/plain/src/browser.js';
      ${start}(${JSON.stringify(source)}, ${JSON.stringify(options)});
    </script>`;

      if ((game.started || studio.started) && (route === '/' || route === '/index.html')) {
        return sendText(response, 200, gamePage(game.started ? game.title : studio.title, script), 'text/html');
      }

      const page = site.pages.find(p => hrefFor(p.path) === route.replace(/^\//, '')) ||
                   (route === '/' ? site.pages[0] : null);
      if (page) {
        // The designer runs the program itself, so it only needs a shell.
        if (editing) return sendText(response, 200, gamePage(`Designing ${site.title}`, script), 'text/html');
        return sendText(response, 200, documentToHTML(site, page, { script }), 'text/html');
      }

      // Anything else: a real file sitting next to the program (images, etc).
      const asset = path.join(folder, route.replace(/^\//, ''));
      if (fs.existsSync(asset) && fs.statSync(asset).isFile()) return sendFile(response, asset);

      sendText(response, 404, 'Not found', 'text/plain');
    } catch (error) {
      sendText(response, 500, errorPage(error, ''), 'text/html');
    }
  });

  server.listen(port, () => {
    const address = `http://localhost:${port}`;
    console.log(`\nPlain is ${editing ? 'editing' : 'serving'} ${path.basename(program.full)} at ${address}`);
    console.log(editing
      ? 'Change things on the page, then press Save to write them back as Plain sentences.'
      : 'Edit the file and refresh the page to see changes.');
    console.log('Press Ctrl+C to stop.\n');
    if (!flags['no-open']) openBrowser(address);
  });
}

function sendText(response, code, body, type) {
  response.writeHead(code, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  response.end(body);
}

const MIME = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.html': 'text/html', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.plain': 'text/plain'
};

function sendFile(response, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return sendText(response, 404, 'Not found', 'text/plain');
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(response);
}

function errorPage(error, source) {
  const message = error instanceof PlainError ? error.report(source) : String(error && error.stack || error);
  return `<!doctype html><meta charset="utf-8"><title>Plain found a problem</title>
<body style="margin:0;background:#1b0d11;color:#ffd9df;font:15px/1.7 ui-monospace,Consolas,monospace">
<div style="max-width:760px;margin:60px auto;padding:26px;background:#2b0f14;border:1px solid #7a2436;border-radius:14px">
<h1 style="margin:0 0 14px;font:600 20px ui-sans-serif,system-ui,sans-serif;color:#ffb3c0">Plain found a problem</h1>
<pre style="white-space:pre-wrap;margin:0">${String(message).replace(/[<&]/g, c => (c === '<' ? '&lt;' : '&amp;'))}</pre>
</div></body>`;
}

function openBrowser(address) {
  try {
    const command = process.platform === 'win32' ? 'cmd'
      : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', address] : [address];
    spawn(command, args, { stdio: 'ignore', detached: true }).unref();
  } catch { /* opening a browser is optional */ }
}

// --------------------------------------------------------------------- help

function commandHelp() {
  console.log(`
Plain ${VERSION} - a language you write like a normal sentence.

  plain run <file.plain>      run the program in this terminal   (--fast)
  plain play <file.plain>     open a game, world, site or video in the browser
  plain edit <file.plain>     open the designer (sites) or the studio (videos)
  plain build <file.plain>    write HTML files you can publish   (--out folder)
  plain check <file.plain>    look for mistakes without running it
  plain words                 list every sentence Plain understands
  plain learn                 lessons and projects, in your browser
  plain translate <file>      write it in JavaScript, TypeScript, Python, C# or Lua
  plain fmt <file|folder>     tidy the indenting                    (--check)
  plain new <name>            start a blank program
  plain make <kind> <name>    start a finished one: ${templateNames().join(', ')}

A first program:

  make name be "world"
  show "Hello, {name}!"

Something bigger, in one line each:

  plain make game space        a 2D game with gravity, jumping and coins
  plain make world moon        a 3D world you walk around
  plain make site notes        a website you can design by dragging
  plain make video holiday     a video timeline you can trim and export

Read LANGUAGE.md for the whole language on one page.
`);
}

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
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { createRuntime } from '../src/runtime.js';
import { PlainError } from '../src/errors.js';
import { installGame } from '../engines/game/engine.js';
import { installWorld } from '../engines/world/engine.js';
import { installWeb } from '../engines/web/engine.js';
import { installVideo } from '../engines/video/engine.js';
import { documentToHTML, hrefFor } from '../engines/web/render.js';
import { TEMPLATES, templateNames } from './templates.js';

globalThis.__plainFS = fs;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const VERSION = '0.2.0';

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
  return { runtime, game, site, world, studio };
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

async function commandRun(file) {
  const program = readProgram(file);
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

  plain run <file.plain>      run the program in this terminal
  plain play <file.plain>     open a game, world, site or video in the browser
  plain edit <file.plain>     open the designer (sites) or the studio (videos)
  plain build <file.plain>    write HTML files you can publish   (--out folder)
  plain check <file.plain>    look for mistakes without running it
  plain words                 list every sentence Plain understands
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

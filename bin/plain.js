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
import https from 'node:https';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

import { createRuntime } from '../src/runtime.js';
import { PlainError } from '../src/errors.js';
import { installGame } from '../engines/game/engine.js';
import { installWorld } from '../engines/world/engine.js';
import { installWeb } from '../engines/web/engine.js';
import { installVideo } from '../engines/video/engine.js';
import { installStore } from '../engines/store/engine.js';
import { installNet, readCookies, readParts, readFrame, sixtyFour } from '../engines/net/engine.js';
import { installData } from '../engines/data/engine.js';
import { installMail, buildMessage } from '../engines/mail/engine.js';
import { documentToHTML, hrefFor } from '../engines/web/render.js';
import { TEMPLATES, templateNames } from './templates.js';
import { translate, targetNames, findTarget } from '../src/translate/index.js';
import { syllabus, totalSteps } from '../engines/learn/course.js';
import { format } from '../src/format.js';
import { readList, writeList, save, peek, checkPart, fingerprint, nameFrom, FOLDER } from './parts.js';
import { installParts, readAbout, atLeast } from '../engines/parts/engine.js';

globalThis.__plainFS = fs;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const VERSION = '0.4.0';

// Declared up here because the command switch below runs as the file loads.

// Everything owing a write when the program ends, in one list. One program
// has one store, but the test suite makes hundreds, and one listener each
// would have Node warning about a leak it was right to notice.
const packages = new Map();
const owed = new Set();
let listening = false;

function rememberToWrite(write) {
  owed.add(write);
  if (listening) return;
  listening = true;
  const all = () => { for (const one of owed) one(); };
  process.on('exit', all);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { all(); process.exit(0); });
  }
}

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
    case 'get': commandGet(target, rest.filter(a => !a.startsWith('-'))[2]); break;
    case 'parts': commandParts(); break;
    case 'pack': commandPack(target); break;
    case 'remove': case 'drop': commandRemove(target); break;
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
    // helpers.plain next door, or dates from the parts folder.
    resolve: (used, fromFile) => {
      const from = fromFile && fs.existsSync(fromFile) ? fromFile : baseFile;
      const beside = path.dirname(path.resolve(from));
      const tries = [
        path.resolve(beside, used),
        path.resolve(beside, used + '.plain'),
        path.resolve(beside, FOLDER, used + '.plain'),
        path.resolve(process.cwd(), FOLDER, used + '.plain')
      ];
      for (const one of tries) {
        if (fs.existsSync(one) && fs.statSync(one).isFile()) return fs.readFileSync(one, 'utf8');
      }
      return null;
    }
  });
  const game = installGame(runtime, { keepGoing });
  const site = installWeb(runtime, {});
  const world = installWorld(runtime, {});
  const studio = installVideo(runtime, {});
  const keeping = storeHost(baseFile);
  const store = installStore(runtime, keeping);
  const tables = installData(runtime, locksmith());
  const server = installNet(runtime, {
    ...netHost(runtime),
    putFile: keeping.putFile,
    tell: (who, words, raw) => (server.host ? server.host.tell(who, words, raw) : null),
    tellAll: (words, except) => (server.host ? server.host.tellAll(words, except) : null),
    connected: () => (server.host ? server.host.connected() : 0),
    tellOne: (number, words, raw) => (server.host ? server.host.tellOne(number, words, raw) : null),
    whoIs: (who) => (server.host ? server.host.whoIs(who) : 0)
  });
  const mail = installMail(runtime, { sendMail });
  installParts(runtime, { usePackage });
  return { runtime, game, site, world, studio, store, server, tables, mail };
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

    // All of them asked at once, which is the whole point of asking for
    // several: two seconds each becomes two seconds altogether.
    fetchAll(urls, ctx) {
      if (!urls.length) return [];
      for (const url of urls) {
        if (!/^https?:\/\//i.test(url)) ctx.fail(`"${url}" is not a web address`);
      }
      const together = `
        const urls = process.argv.slice(1);
        Promise.all(urls.map(one =>
          fetch(one).then(answer => answer.text()).catch(problem => '')
        )).then(all => process.stdout.write(JSON.stringify(all)));
      `;
      let raw;
      try {
        raw = execFileSync(process.execPath, ['-e', together, ...urls], {
          encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024
        });
      } catch {
        ctx.fail('I could not reach some of those addresses');
      }
      try { return JSON.parse(raw); } catch { return urls.map(() => ''); }
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
      // Locked or not, the answering below is the same; only the door
      // differs. The two files are the certificate a browser checks and the
      // key that proves it belongs to you.
      let locked = null;
      if (server.safely) {
        try {
          locked = {
            cert: fs.readFileSync(path.resolve(process.cwd(), server.safely.certificate)),
            key: fs.readFileSync(path.resolve(process.cwd(), server.safely.key))
          };
        } catch (problem) {
          ctx.fail(
            `I could not read the certificate or the key: ${problem.message}`,
            'both are files, and both are needed'
          );
        }
      }

      const answering = (request, response) => {
        const url = new URL(request.url, `http://localhost:${server.port}`);
        const chunks = [];
        request.on('data', piece => chunks.push(piece));
        request.on('end', () => {
          // Every visitor carries a tag, so the program can tell one from
          // another. It is a random name and nothing more: what belongs to
          // it never leaves this machine.
          const cookies = readCookies(request.headers.cookie);
          let tag = cookies['plain-visitor'];
          let fresh = false;
          if (!tag || !/^[A-Za-z0-9]{8,}$/.test(tag)) {
            tag = crypto.randomBytes(18).toString('base64url');
            fresh = true;
          }

          const found = server.routeFor(url.pathname, request.method);
          const raw = Buffer.concat(chunks);
          const kind = request.headers['content-type'] || '';
          // A form with a file in it is sent in pieces, each with a name.
          // The pieces that are only words go in with the rest of the form.
          const sentIn = /multipart\/form-data/i.test(kind) ? readParts(raw, kind) : null;

          server.asked = {
            path: url.pathname,
            query: Object.fromEntries(url.searchParams.entries()),
            sent: sentIn ? sentIn.written : raw.toString('utf8'),
            kind: sentIn ? 'application/x-www-form-urlencoded' : kind,
            files: sentIn ? sentIn.files : {},
            method: request.method,
            parts: found ? found.parts : {},
            cookies,
            tag
          };
          server.answer = null;

          const setTag = fresh
            ? { 'set-cookie': `plain-visitor=${tag}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` }
            : {};

          const run = found ? found.route.run : server.notFound;
          if (!run) {
            // Nothing claimed it: try the folder of files, if there is one.
            if (server.folder && handOut(server, url.pathname, response, setTag)) return;
            response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...setTag });
            response.end(`Nothing is at ${url.pathname}`);
            return;
          }

          try {
            run();
          } catch (error) {
            const message = error instanceof PlainError ? error.report(runtime.source) : String(error.message || error);
            console.error('\n' + message + '\n');
            response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', ...setTag });
            response.end(message);
            return;
          }

          const answer = server.answer || { body: '', kind: 'text/plain; charset=utf-8' };
          const code = answer.code || 200;
          const headers = { 'content-type': answer.kind, ...setTag };
          if (answer.goTo) headers.location = answer.goTo;
          response.writeHead(code, headers);
          response.end(answer.body);
          console.log(`  ${request.method} ${url.pathname} -> ${code}${answer.goTo ? ' ' + answer.goTo : ` ${answer.body.length} bytes`}`);
        });
      };

      const listener = locked ? https.createServer(locked, answering) : http.createServer(answering);

      // ------------------------------------------------ staying connected
      //
      // A browser asks to change the subject from pages to a conversation,
      // and proves it is really a browser by a small sum on a key it sends.
      // After that both sides send frames: a couple of bytes of length, and
      // the words, which from a browser are muddled with a four-byte mask.
      const talking = new Set();

      // Writing and bytes go out the same way, differing in one bit of the
      // first byte: 0x81 says "this is text", 0x82 says "this is a run of
      // bytes". A program at the other end that expects a shorthand will
      // ignore anything sent as text, so the difference matters.
      const speak = (socket, words, raw) => {
        const body = raw
          ? Buffer.from(Array.isArray(words) ? words.map(b => Number(b) & 0xff) : [])
          : Buffer.from(String(words), 'utf8');
        const kind = raw ? 0x82 : 0x81;
        const head = body.length < 126
          ? Buffer.from([kind, body.length])
          : body.length < 65536
            ? Buffer.from([kind, 126, body.length >> 8, body.length & 255])
            : Buffer.concat([Buffer.from([kind, 127]), sixtyFour(body.length)]);
        try { socket.write(Buffer.concat([head, body])); } catch { /* they went away */ }
      };

      const say = (blocks, socket, words, bytes) => {
        server.who = socket;
        server.said = words === undefined ? '' : words;
        server.sent = bytes || [];
        for (const run of blocks) {
          try { run(); }
          catch (error) {
            const said = error instanceof PlainError ? error.report(runtime.source) : String(error.message || error);
            console.error('\n' + said + '\n');
          }
        }
        server.who = null;
      };

      if (server.onOpen.length || server.onSay.length || server.onShut.length) {
        listener.on('upgrade', (request, socket) => {
          const key = request.headers['sec-websocket-key'];
          if (!key) { socket.destroy(); return; }
          const answer = crypto.createHash('sha1')
            .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
          socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
            `Sec-WebSocket-Accept: ${answer}\r\n\r\n`
          );
          socket.setNoDelay(true);
          talking.add(socket);
          console.log(`  ~ someone connected (${talking.size} on the line)`);
          say(server.onOpen, socket);

          let held = Buffer.alloc(0);
          socket.on('data', piece => {
            held = Buffer.concat([held, piece]);
            for (;;) {
              const frame = readFrame(held);
              if (!frame) break;
              held = held.slice(frame.used);
              if (frame.opcode === 8) { socket.end(); return; }         // goodbye
              if (frame.opcode === 9) { socket.write(Buffer.from([0x8a, 0])); continue; }  // are you there
              if (frame.opcode === 1) say(server.onSay, socket, frame.text);
              // A binary frame. The handler is the same one - a program that
              // speaks a shorthand reads "what they sent" instead of "what
              // they said", and one that does not will see empty text and
              // ignore it, which is the right thing to do with a message you
              // cannot read.
              if (frame.opcode === 2) say(server.onSay, socket, '', frame.bytes);
            }
          });

          const gone = () => {
            if (!talking.delete(socket)) return;
            say(server.onShut, socket);
          };
          socket.on('close', gone);
          socket.on('error', gone);
        });
      }

      // Each connection gets a number of its own, once, so a program can
      // tell them apart without trusting anything they say.
      const numbers = new WeakMap();
      const byNumber = new Map();
      let nextNumber = 0;

      server.host = {
        whoIs: (socket) => {
          if (!socket) return 0;
          if (!numbers.has(socket)) {
            numbers.set(socket, ++nextNumber);
            byNumber.set(nextNumber, socket);
          }
          return numbers.get(socket);
        },
        tell: (socket, words, raw) => { if (socket) speak(socket, words, raw); },
        tellOne: (number, words, raw) => {
          const socket = byNumber.get(number);
          if (socket && talking.has(socket)) speak(socket, words, raw);
          else byNumber.delete(number);
        },
        tellAll: (words, except) => {
          for (const one of talking) if (one !== except) speak(one, words);
        },
        connected: () => talking.size
      };

      listener.on('error', (error) => {
        console.error(`\nI could not serve on port ${server.port}: ${error.message}\n`);
        process.exitCode = 1;
      });

      listener.listen(server.port, () => {
        const swept = server.sweepVisitors ? server.sweepVisitors() : 0;
        console.log(`\nPlain is answering at http${locked ? 's' : ''}://localhost:${server.port}`);
        if (swept) console.log(`  (forgot ${swept} visitor${swept === 1 ? '' : 's'} nobody has seen for a month)`);
        for (const route of server.routes) console.log(`  ${route.path}`);

        // Work on a timer, once the door is open.
        for (const job of server.jobs) {
          const beat = setInterval(() => {
            try { job.run(); }
            catch (error) {
              const said = error instanceof PlainError ? error.report(runtime.source) : String(error.message || error);
              console.error('\n' + said + '\n');
            }
          }, job.seconds * 1000);
          if (typeof beat.unref === 'function') { /* the server keeps us alive */ }
        }
        if (server.jobs.length) {
          console.log(`  (${server.jobs.length} thing${server.jobs.length === 1 ? '' : 's'} done on a timer)`);
        }
        console.log('\nPress Ctrl+C to stop.\n');
      });
      server.running = listener;
    }
  };
}

// "keep going" holds the program open and keeps its clock ticking, so
// timers written with "every N seconds" carry on happening.
function keepGoing(game) {
  console.log('\nKeeping going. Press Ctrl+C to stop.\n');
  let last = Date.now();
  const beat = setInterval(() => {
    const now = Date.now();
    const seconds = (now - last) / 1000;
    last = now;
    try {
      game.step(seconds);
    } catch (error) {
      console.error('\n' + (error instanceof PlainError ? error.report('') : error.message) + '\n');
      clearInterval(beat);
      process.exitCode = 1;
      return;
    }
    if (game.over) {
      clearInterval(beat);
      if (game.overMessage) console.log(game.overMessage);
    }
  }, 50);
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

    // Whatever is still owed gets written when the program ends, however it
    // ends: falling off the bottom, stopping itself, or Ctrl+C.
    atEnd: rememberToWrite,

    // Says who else is already keeping things in this file, or nothing if
    // it is free. A note is left beside it with this program's number in it,
    // and taken away when the program ends. A note left behind by something
    // that crashed is ignored, because the number in it belongs to nobody.
    claim: (file) => {
      const note = file + '.busy';
      try {
        if (fs.existsSync(note)) {
          const who = Number(fs.readFileSync(note, 'utf8').trim());
          if (who && who !== process.pid && alive(who)) return `process ${who}`;
        }
        fs.writeFileSync(note, String(process.pid), 'utf8');
        rememberToWrite(() => { try { fs.unlinkSync(note); } catch { /* already gone */ } });
      } catch {
        return null;      // a folder that cannot be written to has no sharers
      }
      return null;
    },
    files: {
      read: (name, ctx) => {
        const file = inside(name, ctx);
        return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      },
      exists: (name, ctx) => fs.existsSync(inside(name, ctx)),
      write: (name, text, ctx) => fs.writeFileSync(inside(name, ctx), text, 'utf8'),
      append: (name, text, ctx) => fs.appendFileSync(inside(name, ctx), text, 'utf8')
    },

    // A file somebody sent, put where the program asked - inside the same
    // fence as everything else, and into a folder that is made if needed.
    putFile: (name, bytes, ctx) => {
      const file = inside(name, ctx);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
  };
}

// Sending waits for its answer, the way fetching does, and for the same
// reason: the next line of the program is about to assume it worked. The
// conversation happens in a program of its own.
function sendMail(settings, message, ctx) {
  const written = buildMessage(message);
  const asking = {
    host: settings.host,
    port: settings.port,
    user: settings.user,
    password: settings.password,
    from: message.from,
    to: message.to
  };
  let raw;
  try {
    raw = execFileSync(process.execPath, [
      path.join(HERE, 'mail-helper.mjs'), JSON.stringify(asking), written
    ], { encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
  } catch (problem) {
    ctx.fail(
      `I could not reach the mail server at ${settings.host}:${settings.port}`,
      'check the address and the port, and that you are online'
    );
  }
  let answer;
  try { answer = JSON.parse(raw); } catch { answer = { ok: false, said: String(raw).trim() }; }
  if (!answer.ok) {
    ctx.fail(`The mail server would not take that message: ${answer.said}`);
  }
  return answer.said;
}

// Somebody else's JavaScript, off npm. Loaded the old way rather than the
// new one because the interpreter does not wait for anything, and half of
// npm still ships the old way anyway. A package that only ships the new way
// says so rather than failing strangely.

function usePackage(name, ctx) {
  if (packages.has(name)) return packages.get(name);
  if (!/^[@a-z0-9][\w.@/-]*$/i.test(name)) ctx.fail(`"${name}" is not a package name`);

  const asking = createRequire(path.join(process.cwd(), 'plain.js'));
  let found;
  try {
    found = asking(name);
  } catch (problem) {
    if (String(problem.code) === 'ERR_REQUIRE_ESM') {
      ctx.fail(
        `The package "${name}" is written the new way, which Plain cannot wait for`,
        'try an older one that does the same job'
      );
    }
    ctx.fail(
      `I cannot find the package "${name}"`,
      `fetch it first:  npm install ${name}`
    );
  }
  // Most packages of the old sort hang everything off one value.
  const held = found && found.__esModule && found.default !== undefined ? found.default : found;
  packages.set(name, held);
  return held;
}

// Is anybody actually running under that number? Signal 0 asks without
// sending anything, which is exactly the question.
function alive(who) {
  try { process.kill(who, 0); return true; }
  catch (problem) { return problem.code === 'EPERM'; }
}

// Scrambling a password, and checking one, are the two things a program must
// never do by hand. Node has the machinery built for it: a slow, salted
// scramble, and a comparison that takes the same time whether it matches on
// the first letter or the last.
function locksmith() {
  return {
    lock(password) {
      const salt = crypto.randomBytes(16);
      const scrambled = crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
      return `scrypt:${salt.toString('hex')}:${scrambled.toString('hex')}`;
    },

    fits(password, locked) {
      // A name nobody has still costs the same work, so that guessing names
      // learns nothing from how quickly the answer comes back.
      const [, saltHex, wantedHex] = String(locked || '').split(':');
      const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
      const wanted = wantedHex ? Buffer.from(wantedHex, 'hex') : crypto.randomBytes(32);
      let got;
      try {
        got = crypto.scryptSync(String(password), salt, wanted.length, { N: 16384, r: 8, p: 1 });
      } catch {
        return false;
      }
      return Boolean(locked) && got.length === wanted.length && crypto.timingSafeEqual(got, wanted);
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

// -------------------------------------------------------------------- parts

function partsFolder() {
  return process.cwd();
}

// One part, fetched and written down. Nothing is fetched unless asked for.
function commandGet(url, asName) {
  const folder = partsFolder();
  const list = readList(folder);

  // No address: put back exactly what this folder was using. Anything that
  // has changed at the far end is refused rather than quietly taken, because
  // "fetch what I had" has to mean what it says. --update takes the new one.
  if (!url) {
    const names = Object.keys(list.parts);
    if (!names.length) {
      console.log('\nNothing to fetch. To add a part:\n');
      console.log('    plain get https://example.com/dates.plain\n');
      return;
    }
    console.log(`\nFetching ${names.length} part${names.length === 1 ? '' : 's'} again.\n`);
    let changed = 0;
    for (const name of names) {
      const held = list.parts[name];
      if (!getOne(folder, held.url, name, held.fingerprint, { quiet: true })) changed++;
    }
    if (changed && !flags.update) {
      console.log(`\n${changed} part${changed === 1 ? ' has' : 's have'} changed since you fetched them,`);
      console.log('and were not taken. To look, open the address. To accept them:\n');
      console.log('    plain get --update\n');
      process.exitCode = 1;
    } else {
      console.log('');
    }
    return;
  }

  // An address: fetch it, and everything it says it needs.
  const wanted = [{ url, name: asName || nameFrom(url) }];
  const done = new Map();

  while (wanted.length) {
    const one = wanted.shift();
    if (done.has(one.name)) continue;

    const about = getOne(folder, one.url, one.name, null);
    if (!about) continue;
    done.set(one.name, about);

    for (const need of about.needs) {
      if (!need.name || !need.where) continue;
      const already = done.get(need.name);
      if (already) {
        if (!atLeast(already.version, need.version)) {
          console.log(`\n  ${one.name} needs ${need.name} ${need.version}, but ${already.version} is here.`);
          console.log('  The older one wins, which may not be what either of them wanted.');
        }
        continue;
      }
      if (done.size > 32) fail('That part leads to more parts than Plain will fetch at once.');
      console.log(`    (needs ${need.name} ${need.version})`);
      wanted.push({ url: need.where, name: need.name });
    }
  }
  console.log('');
}

function commandRemove(name) {
  if (!name) fail('Which part? Try: plain remove dates');
  const folder = partsFolder();
  const list = readList(folder);
  if (!list.parts[name]) fail(`This folder does not use a part called "${name}"`);

  // Anything still leaning on it should be said out loud.
  const leaning = Object.entries(list.parts)
    .filter(([other, one]) => other !== name && (one.needs || []).some(need => need.name === name))
    .map(([other]) => other);

  delete list.parts[name];
  writeList(folder, list);
  const file = path.join(folder, FOLDER, name + '.plain');
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch { /* already gone */ }

  console.log(`\nRemoved ${name}.`);
  if (leaning.length) console.log(`  ${leaning.join(', ')} said they needed it, and are still here.`);
  console.log('');
}

// Gives back what the part says about itself, or nothing if it was refused.
function getOne(folder, url, name, expected, options = {}) {
  if (!/^https?:\/\//i.test(url)) fail(`"${url}" is not a web address. It should start with http:// or https://`);

  const host = netHost(createRuntime({}));
  let got;
  try {
    got = host.fetchText(url, { fail: (message) => fail(message) });
  } catch (error) {
    fail(error.plainMessage || error.message);
  }
  if (!got.ok) fail(`${url} answered ${got.status || 'nothing'}`);

  const wrong = checkPart(got.text, url);
  if (wrong) fail(wrong);

  const mark = fingerprint(got.text);
  if (expected && mark !== expected) {
    if (!flags.update) {
      console.log(`  ${name}  REFUSED - it has changed since you fetched it`);
      console.log(`    was ${expected}`);
      console.log(`    is  ${mark}`);
      console.log(`    ${url}`);
      return null;
    }
    console.log(`  ${name}  changed, and taken because you said --update`);
  }

  // Read before it is trusted: what a part says about itself is read off the
  // file by the parser, without running a line of it.
  let about = { name: null, version: null, needs: [] };
  try {
    const rt = createRuntime({ onOutput: () => {} });
    installParts(rt);
    about = readAbout(rt.parse(got.text, name + '.plain'));
  } catch (error) {
    fail(`${url} is not a Plain file I can read: ${error.plainMessage || error.message}`);
  }

  const file = save(folder, name, got.text, url, about);
  const said = about.version ? `${about.name || name} ${about.version}` : name;
  console.log(`  ${said.padEnd(20)} ${String(got.text.length).padStart(6)} letters  ${mark}`);
  if (!options.quiet) {
    console.log(`    from ${url}`);
    console.log(`    into ${path.relative(process.cwd(), file)}`);
    for (const line of peek(got.text, 4)) console.log(`    | ${line}`);
    console.log(`    use it with:  use "${name}"`);
  }
  return about;
}

function commandParts() {
  const list = readList(partsFolder());
  const names = Object.keys(list.parts);
  if (!names.length) {
    console.log('\nThis folder uses no parts.\n\n    plain get https://example.com/dates.plain\n');
    return;
  }
  console.log(`\n${names.length} part${names.length === 1 ? '' : 's'} in ${path.basename(process.cwd())}:\n`);
  for (const name of names) {
    const one = list.parts[name];
    const file = path.join(partsFolder(), FOLDER, name + '.plain');
    const here = fs.existsSync(file);
    const same = here && fingerprint(fs.readFileSync(file, 'utf8')) === one.fingerprint;
    const state = !here ? 'missing - run plain get' : same ? 'as fetched' : 'changed since it was fetched';
    console.log(`  ${name.padEnd(16)} ${state}`);
    console.log(`  ${''.padEnd(16)} ${one.url}`);
  }
  console.log('');
}

// --------------------------------------------------------------------- tidy

// ------------------------------------------------------------------- pack
//
// Everything needed to run one program on a machine that is not this one, in
// a single folder: the program, the files it uses, Plain itself, and three
// small files that say how to start it. Plain has no dependencies, so this
// is a copy rather than a build - which is why it can be read and checked
// rather than trusted.
function commandPack(file) {
  const program = readProgram(file);
  const out = path.resolve(process.cwd(), flags.out || `${program.name}-packed`);
  const from = path.dirname(program.full);

  fs.mkdirSync(out, { recursive: true });
  for (const folder of ['src', 'engines', 'runtime']) copyInto(path.join(ROOT, folder), path.join(out, folder));
  fs.mkdirSync(path.join(out, 'bin'), { recursive: true });
  for (const one of ['plain.js', 'parts.js', 'templates.js', 'mail-helper.mjs']) {
    fs.copyFileSync(path.join(ROOT, 'bin', one), path.join(out, 'bin', one));
  }

  // The program, and everything it pulls in with `use`.
  const app = path.join(out, 'app');
  fs.mkdirSync(app, { recursive: true });
  fs.copyFileSync(program.full, path.join(app, path.basename(program.full)));
  const used = collectUsed(program.source, program.full);
  for (const one of Object.keys(used)) {
    const beside = path.resolve(from, one);
    if (!fs.existsSync(beside)) continue;
    const landing = path.join(app, path.relative(from, beside));
    fs.mkdirSync(path.dirname(landing), { recursive: true });
    fs.copyFileSync(beside, landing);
  }

  const started = `app/${path.basename(program.full)}`;
  const port = (/start serving(?: safely)? on port (\d+)/.exec(program.source) || [])[1] || '3000';

  write(path.join(out, 'package.json'), JSON.stringify({
    name: program.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'plain-app',
    private: true,
    type: 'module',
    scripts: { start: `node bin/plain.js run ${started}` },
    engines: { node: '>=18' }
  }, null, 2) + '\n');

  write(path.join(out, 'start.sh'), [
    '#!/bin/sh',
    '# Start the program. Nothing to install first: Plain is all here.',
    'cd "$(dirname "$0")"',
    `exec node bin/plain.js run ${started}`,
    ''
  ].join('\n'));

  write(path.join(out, 'Dockerfile'), [
    'FROM node:22-alpine',
    'WORKDIR /app',
    'COPY . .',
    `EXPOSE ${port}`,
    `CMD ["node", "bin/plain.js", "run", "${started}"]`,
    ''
  ].join('\n'));

  write(path.join(out, `${program.name}.service`), [
    '[Unit]',
    `Description=${program.name}, written in Plain`,
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=/opt/${program.name}`,
    `ExecStart=/usr/bin/node /opt/${program.name}/bin/plain.js run /opt/${program.name}/${started}`,
    'Restart=always',
    'RestartSec=2',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    ''
  ].join('\n'));

  write(path.join(out, 'README.md'), [
    `# ${program.name}`,
    '',
    'Written in Plain. Everything needed to run it is in this folder, and the',
    'only thing that has to be on the machine already is Node 18 or newer.',
    '',
    '```bash',
    'sh start.sh',
    '```',
    '',
    'or, with Docker:',
    '',
    '```bash',
    `docker build -t ${program.name} . && docker run -p ${port}:${port} ${program.name}`,
    '```',
    '',
    'or as something the machine keeps running, on a Linux box with systemd:',
    '',
    '```bash',
    `sudo cp -r . /opt/${program.name}`,
    `sudo cp ${program.name}.service /etc/systemd/system/`,
    `sudo systemctl enable --now ${program.name}`,
    '```',
    '',
    '## What is kept, and where',
    '',
    'Anything the program remembers - and every table - lives in',
    `\`${started.replace(/\.plain$/, '')}.memory.json\`, beside the program.`,
    'That file is the whole of your data: copy it to back it up, and keep it',
    'when you replace this folder with a newer one.',
    '',
    'Only one copy of the program may use that file at a time. A second is',
    'told so rather than left to quietly overwrite the first.',
    ''
  ].join('\n'));

  const counted = countFiles(out);
  console.log(`Packed ${program.name} into ${path.relative(process.cwd(), out) || '.'}`);
  console.log(`  ${counted} files, everything it needs, nothing to install.`);
  console.log('');
  console.log('  sh start.sh                     run it here');
  console.log('  docker build -t app . ...       run it in a box');
  console.log(`  ${program.name}.service          keep it running on a Linux server`);
}

function copyInto(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const one = path.join(from, entry.name);
    const other = path.join(to, entry.name);
    if (entry.isDirectory()) copyInto(one, other);
    else fs.copyFileSync(one, other);
  }
}

function countFiles(folder) {
  let many = 0;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) many += countFiles(path.join(folder, entry.name));
    else many++;
  }
  return many;
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

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

// A folder of files handed out as they are. Fenced to that folder, so an
// address with ".." in it cannot walk out of it and read the rest of a disk.
function handOut(server, asked, response, extra = {}) {
  const folder = path.resolve(process.cwd(), server.folder);
  const wanted = path.resolve(folder, '.' + decodeURIComponent(asked));
  if (wanted !== folder && !wanted.startsWith(folder + path.sep)) return false;
  if (!fs.existsSync(wanted) || !fs.statSync(wanted).isFile()) return false;
  const type = MIME[path.extname(wanted).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, { 'content-type': type, ...extra });
  fs.createReadStream(wanted).pipe(response);
  return true;
}

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
  plain pack <file>           everything it needs, in one folder to copy
  plain remove <name>         stop using a part
  plain words                 list every sentence Plain understands
  plain learn                 lessons and projects, in your browser
  plain translate <file>      write it in 11 other languages        (--to rust)
  plain fmt <file|folder>     tidy the indenting                    (--check)
  plain get <url> [as name]   fetch a part into this folder
  plain parts                 what this folder is using
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

// Plain - talking to the rest of the internet.
//
//     fetch "https://example.com" into page
//     show length of page
//
//     when someone visits "/"
//         answer with "Hello from Plain"
//     end
//     start serving on port 3000
//
// Fetching waits for its answer, because that is what someone writing a
// program means by "fetch this and then use it". Serving is the other way
// round: the program finishes and the server carries on answering.
//
// None of this works on a page, where a program cannot be allowed to freeze
// the browser or open a port. There it says so and points at what does.

import { toText, toNumber } from '../../src/values.js';

export class Server {
  constructor() {
    this.routes = [];          // { path, parts, method, run }
    this.notFound = null;
    this.port = null;
    this.running = null;
    this.asked = { path: '/', query: {}, sent: '', method: 'GET', parts: {}, cookies: {} };
    this.answer = null;
    this.folder = null;        // files handed out as they are, if asked for
    this.visitors = new Map(); // what each visitor is carrying, by their tag
    this.jobs = [];            // work done on a timer rather than when asked
    this.onOpen = [];          // somebody stayed on the line
    this.onSay = [];
    this.onShut = [];
    this.who = null;           // the connection being talked to right now
    this.onHear = [];          // being one of the people, rather than the server
    this.onJoined = [];
    this.onLost = [];
    this.heard = '';
    this.joined = false;
    this.said = '';            // what it just said
    this.sent = [];            // and the same as bytes, for a shorthand
  }

  // "/notes/{id}" matches "/notes/7" and remembers that id is 7. Anything
  // written plainly still matches exactly, and is preferred, so a fixed
  // "/notes/new" wins over "/notes/{id}".
  routeFor(path, method = 'GET') {
    const wanted = String(path).split('?')[0].replace(/\/+$/, '') || '/';

    // A route that says how it is asked - "when someone sends to" - is
    // meant for exactly that, so it is looked for first. Otherwise a page
    // and the form it posts to could share an address and the page would
    // always win, which is not what anybody wrote.
    for (const named of [true, false]) {
      const suits = (route) => (named ? route.method === method : !route.method);

      const exact = this.routes.find(route => !route.parts.length && route.path === wanted && suits(route));
      if (exact) return { route: exact, parts: {} };

      for (const route of this.routes) {
        if (!route.parts.length || !suits(route)) continue;
        const found = matchPath(route.path, wanted);
        if (found) return { route, parts: found };
      }
    }
    return null;
  }
}

// The pieces of "/notes/{id}/edit" lined up against the address asked for.
function matchPath(shape, wanted) {
  const want = shape.split('/').filter(Boolean);
  const got = wanted.split('/').filter(Boolean);
  if (want.length !== got.length) return null;
  const parts = {};
  for (let at = 0; at < want.length; at++) {
    const piece = want[at];
    if (piece.startsWith('{') && piece.endsWith('}')) {
      parts[piece.slice(1, -1)] = decodeURIComponent(got[at]);
      continue;
    }
    if (piece !== got[at]) return null;
  }
  return parts;
}

// What a browser sends when a form is filled in, and what a program sends
// when it has something to say. Either way it arrives as a thing.
export function readSent(text, kind = '') {
  const body = String(text ?? '');
  if (!body.trim()) return {};
  if (/json/i.test(kind) || /^[[{]/.test(body.trim())) {
    try { return JSON.parse(body); } catch { /* fall through to a form */ }
  }
  const out = {};
  for (const pair of body.split('&')) {
    if (!pair) continue;
    const at = pair.indexOf('=');
    const name = decodeURIComponent((at < 0 ? pair : pair.slice(0, at)).replace(/\+/g, ' '));
    const value = at < 0 ? '' : decodeURIComponent(pair.slice(at + 1).replace(/\+/g, ' '));
    out[name] = value;
  }
  return out;
}

// A form carrying a file arrives in pieces, each with a boundary line before
// it, its own few headers, a blank line, and then whatever was sent - which
// may be a picture, so it is kept as bytes and never turned into text.
export function readParts(raw, kind) {
  const edge = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(kind);
  const files = {};
  const written = [];
  if (!edge) return { files, written: '' };

  const line = Buffer.from('--' + (edge[1] || edge[2]).trim());
  const gap = Buffer.from('\r\n\r\n');
  let at = raw.indexOf(line);
  if (at < 0) return { files, written: '' };

  while (at >= 0) {
    const from = at + line.length;
    if (raw.slice(from, from + 2).toString() === '--') break;   // the last one
    const next = raw.indexOf(line, from);
    const ends = next < 0 ? raw.length : next;

    const head = raw.indexOf(gap, from);
    if (head < 0 || head > ends) break;
    const headers = raw.slice(from, head).toString('utf8');
    // The piece ends with the \r\n that belongs to the boundary after it.
    const body = raw.slice(head + gap.length, Math.max(head + gap.length, ends - 2));

    const named = /name="([^"]*)"/i.exec(headers);
    const called = /filename="([^"]*)"/i.exec(headers);
    const says = /content-type:\s*([^\r\n;]+)/i.exec(headers);
    const name = named ? named[1] : '';

    if (name) {
      if (called && called[1]) {
        files[name] = {
          // Only the last piece of what they called it, so a name with a
          // path in it cannot decide where anything ends up.
          name: String(called[1]).split(/[\\/]/).pop(),
          kind: says ? says[1].trim() : 'application/octet-stream',
          size: body.length,
          bytes: body
        };
      } else {
        written.push(encodeURIComponent(name) + '=' + encodeURIComponent(body.toString('utf8')));
      }
    }
    at = next;
  }
  return { files, written: written.join('&') };
}

// One frame off a live connection, or nothing if not all of it has arrived
// yet. The shape: a byte of flags, a byte of length that may mean "the real
// length is in the next two bytes, or the next eight", and - from a browser,
// always - four bytes of mask that everything after is muddled with.
export function readFrame(held) {
  if (held.length < 2) return null;
  const opcode = held[0] & 0x0f;
  const masked = (held[1] & 0x80) !== 0;
  let length = held[1] & 0x7f;
  let at = 2;

  if (length === 126) {
    if (held.length < 4) return null;
    length = held.readUInt16BE(2);
    at = 4;
  } else if (length === 127) {
    if (held.length < 10) return null;
    const big = held.readBigUInt64BE(2);
    // Anything this large is a mistake or somebody trying it on.
    if (big > 64n * 1024n * 1024n) return { used: held.length, opcode: 8, text: '' };
    length = Number(big);
    at = 10;
  }

  const mask = masked ? held.slice(at, at + 4) : null;
  if (masked) at += 4;
  if (held.length < at + length) return null;

  const body = Buffer.from(held.slice(at, at + length));
  if (mask) for (let n = 0; n < body.length; n++) body[n] ^= mask[n % 4];
  // The bytes as well as the text. A frame carrying a picture, or a game
  // speaking its own shorthand, is not writing at all, and turning it into
  // text loses it. Both are handed over and the reader picks.
  return { used: at + length, opcode, text: body.toString('utf8'), bytes: [...body] };
}

// The eight bytes a very long frame's length is written in.
export function sixtyFour(length) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(BigInt(length));
  return out;
}

export function readCookies(header) {
  const out = {};
  for (const pair of String(header || '').split(';')) {
    const at = pair.indexOf('=');
    if (at < 0) continue;
    out[pair.slice(0, at).trim()] = decodeURIComponent(pair.slice(at + 1).trim());
  }
  return out;
}

export function installNet(rt, host = {}) {
  if (rt.libraries.has('net')) return rt.server;
  rt.libraries.add('net');

  const server = new Server();
  rt.server = server;

  const needTerminal = (ctx, what) => {
    ctx.fail(
      `${what} only works when Plain runs in a terminal`,
      'a page cannot be made to wait, and cannot open a port of its own'
    );
  };

  // ------------------------------------------------------------ fetching

  rt.define('fetch $url into #name', (a, ctx) => {
    if (!host.fetchText) needTerminal(ctx, 'Fetching');
    const got = host.fetchText(toText(a.url), ctx);
    ctx.exists(a.name) ? ctx.assign(a.name, got.text) : ctx.define(a.name, got.text);
  });

  rt.define('fetch $url as a thing into #name', (a, ctx) => {
    if (!host.fetchText) needTerminal(ctx, 'Fetching');
    const got = host.fetchText(toText(a.url), ctx);
    let value = null;
    try {
      value = JSON.parse(got.text);
    } catch {
      ctx.fail(`What came back from ${toText(a.url)} is not a thing I can read`, 'try "fetch ... into ..." to see it as text');
    }
    ctx.exists(a.name) ? ctx.assign(a.name, value) : ctx.define(a.name, value);
  });

  rt.define('send $value to $url into #name', (a, ctx) => {
    if (!host.fetchText) needTerminal(ctx, 'Sending');
    const got = host.fetchText(toText(a.url), ctx, {
      method: 'POST',
      body: typeof a.value === 'string' ? a.value : JSON.stringify(a.value),
      json: typeof a.value !== 'string'
    });
    ctx.exists(a.name) ? ctx.assign(a.name, got.text) : ctx.define(a.name, got.text);
  });

  // Several at once. One at a time would wait for each in turn; these are
  // all asked together and the answers come back in the order given.
  rt.define('fetch all of $*urls into #name', (a, ctx) => {
    if (!host.fetchAll) needTerminal(ctx, 'Fetching');
    let urls = Array.isArray(a.urls) ? a.urls : [a.urls];
    if (urls.length === 1 && Array.isArray(urls[0])) urls = urls[0];
    const got = host.fetchAll(urls.map(one => toText(one)), ctx);
    ctx.exists(a.name) ? ctx.assign(a.name, got) : ctx.define(a.name, got);
  });

  rt.defineValue('what came back', () => (host.lastFetch ? host.lastFetch() : null));

  // ------------------------------------------------------------- serving

  const addRoute = (path, method, run) => {
    const clean = normalise(path);
    const parts = clean.split('/').filter(piece => piece.startsWith('{') && piece.endsWith('}'));
    server.routes.push({ path: clean, parts, method, run });
  };

  rt.define('when someone visits $path ...', (a, ctx) => {
    addRoute(toText(a.path), null, ctx.block);
  });

  // A form arriving is a different thing from a page being looked at, and a
  // program should be able to say which one it means.
  rt.define('when someone sends to $path ...', (a, ctx) => {
    addRoute(toText(a.path), 'POST', ctx.block);
  });

  rt.define('when someone asks for $path ...', (a, ctx) => {
    addRoute(toText(a.path), 'GET', ctx.block);
  });

  rt.define('when someone visits anything else ...', (a, ctx) => {
    server.notFound = ctx.block;
  });

  rt.define('answer with $value', (a) => {
    server.answer = { body: toText(a.value), kind: guessKind(toText(a.value)) };
  });

  rt.define('answer with the page $value', (a) => {
    server.answer = { body: toText(a.value), kind: 'text/html; charset=utf-8' };
  });

  // A website written in the same program, handed straight to the visitor.
  rt.define('answer with the website', (a, ctx) => {
    if (!host.siteHTML) ctx.fail('There is no website in this program to answer with');
    server.answer = { body: host.siteHTML(server.asked.path), kind: 'text/html; charset=utf-8' };
  });

  // ------------------------------------------------------- too much at once
  //
  // Somebody hammering a form a thousand times a second is either a mistake
  // or somebody trying it on, and either way the answer is the same. What
  // each visitor has done lately is remembered, and nothing older than the
  // window is kept.

  const knocks = new Map();

  rt.defineValue('this visitor has asked more than $times times in $seconds seconds', (a) => {
    const tag = server.asked.tag || 'nobody';
    const many = Math.max(0, Math.round(toNumber(a.times)));
    const window = Math.max(0, toNumber(a.seconds)) * 1000;
    const now = Date.now();

    const seen = (knocks.get(tag) || []).filter(when => now - when < window);
    seen.push(now);
    knocks.set(tag, seen);

    // A busy server should not fill up with people who came once.
    if (knocks.size > 4096) {
      for (const [who, when] of knocks) {
        if (!when.length || now - when[when.length - 1] > window) knocks.delete(who);
      }
    }
    return seen.length > many;
  });

  // ------------------------------------------------------------ on a timer
  //
  // Tidying up, sending what is due, looking at something that changes:
  // work a server does when nobody has asked it anything.

  rt.define('every $seconds seconds on the server ...', (a, ctx) => {
    server.jobs.push({ seconds: Math.max(0.05, toNumber(a.seconds)), run: ctx.block });
  });

  // ------------------------------------------------------- staying connected
  //
  // A page that has to be told the moment something happens cannot keep
  // asking. These three are the whole of it: somebody arrives, somebody
  // says something, somebody goes.

  rt.define('when someone connects ...', (a, ctx) => { server.onOpen.push(ctx.block); });
  rt.define('when someone says something ...', (a, ctx) => { server.onSay.push(ctx.block); });
  rt.define('when someone disconnects ...', (a, ctx) => { server.onShut.push(ctx.block); });

  rt.defineValue('what they said', () => server.said);

  // Which connection is talking. Everything a game needs to tell one player
  // from another hangs off this, and it is given out here rather than sent
  // by the browser - so nobody can claim to be somebody else.
  rt.defineValue('who is talking', () => (host.whoIs ? host.whoIs(server.who) : 0));
  rt.defineValue('how many are connected', () => (host.connected ? host.connected() : 0));

  rt.define('tell them $value', (a, ctx) => {
    if (!host.tell) needTerminal(ctx, 'Talking to a connection');
    host.tell(server.who, toText(a.value));
  });

  rt.define('tell everyone $value', (a, ctx) => {
    if (!host.tellAll) needTerminal(ctx, 'Talking to a connection');
    host.tellAll(toText(a.value));
  });

  // Telling one particular connection, named by the number it was given.
  // "tell them" only knows who is talking, which is no use on a timer - and
  // a server that sends each player only what is near them has to do exactly
  // that, from a timer, to everybody in turn.
  rt.define('tell connection $number $value', (a, ctx) => {
    if (!host.tellOne) needTerminal(ctx, 'Talking to a connection');
    host.tellOne(Math.round(toNumber(a.number)), toText(a.value));
  });

  // The same, in bytes rather than writing. A great many programs speak a
  // shorthand of their own rather than text, and a Plain program that wants
  // to talk to one has to be able to answer in the same shorthand.
  rt.define('tell connection $number the bytes $bytes', (a, ctx) => {
    if (!host.tellOne) needTerminal(ctx, 'Talking to a connection');
    host.tellOne(Math.round(toNumber(a.number)), a.bytes, true);
  });

  rt.define('tell them the bytes $bytes', (a, ctx) => {
    if (!host.tell) needTerminal(ctx, 'Talking to a connection');
    host.tell(server.who, a.bytes, true);
  });

  rt.define('tell everyone the bytes $bytes', (a, ctx) => {
    if (!host.tellAll) needTerminal(ctx, 'Talking to a connection');
    host.tellAll(a.bytes, null, true);
  });

  rt.define('tell everyone else the bytes $bytes', (a, ctx) => {
    if (!host.tellAll) needTerminal(ctx, 'Talking to a connection');
    host.tellAll(a.bytes, server.who, true);
  });

  // What just arrived, as bytes. Empty unless the other end spoke in bytes.
  // Not "what they sent" - that already means the body of a form somebody
  // posted, and two meanings for one sentence is how a language starts
  // lying to the person reading it.
  rt.defineValue('the bytes they sent', () => server.sent || []);

  rt.define('tell everyone else $value', (a, ctx) => {
    if (!host.tellAll) needTerminal(ctx, 'Talking to a connection');
    host.tellAll(toText(a.value), server.who);
  });

  // ------------------------------------------------- joining somebody else
  //
  // Plain can be a server that people stay connected to. This is the other
  // half: being one of the people. It works in a browser, where the page can
  // keep a line open without freezing, and nowhere else.

  rt.define('connect to $where', (a) => {
    server.joining = toText(a.where);
    // Nothing to connect to in a terminal, and that is not a mistake: the
    // same program is read once here to see what kind of thing it is, and
    // then run properly on a page. A game does the same with its canvas.
    if (host.connect) host.connect(server.joining, server);
  });

  rt.define('when the server says something ...', (a, ctx) => { server.onHear.push(ctx.block); });
  rt.define('when the server is there ...', (a, ctx) => { server.onJoined.push(ctx.block); });
  rt.define('when the server goes away ...', (a, ctx) => { server.onLost.push(ctx.block); });

  rt.defineValue('what the server said', () => server.heard);
  rt.defineValue('the bytes the server sent', () => server.heardBytes || []);
  rt.defineValue('the server is there', () => Boolean(server.joined));

  rt.define('send the bytes $bytes to the server', (a, ctx) => {
    if (!host.sendUp) ctx.fail('There is no server to send to yet');
    host.sendUp(a.bytes, true);
  });

  rt.define('send $value to the server', (a, ctx) => {
    if (!host.sendUp) ctx.fail('There is no server to send to yet');
    host.sendUp(toText(a.value));
  });

  rt.define('start serving on port $port', (a, ctx) => {
    if (!host.serve) needTerminal(ctx, 'Serving');
    server.port = Math.round(toNumber(a.port));
    host.serve(server, ctx);
  });

  // The same server, with the conversation locked. The two files are the
  // certificate a browser checks and the key that proves it is yours.
  rt.define('start serving safely on port $port with certificate $cert and key $key', (a, ctx) => {
    if (!host.serve) needTerminal(ctx, 'Serving');
    server.port = Math.round(toNumber(a.port));
    server.safely = { certificate: toText(a.cert), key: toText(a.key) };
    host.serve(server, ctx);
  });

  rt.defineValue('what was asked for', () => server.asked.path);
  rt.defineValue('what they sent', () => server.asked.sent);
  rt.defineValue('how they asked', () => server.asked.method);
  rt.defineValue('asked for $name', (a) => {
    const found = server.asked.query[toText(a.name)];
    return found === undefined ? '' : found;
  });

  // ------------------------------------------------- what the visitor sent
  //
  // A filled-in form and a program sending JSON arrive differently on the
  // wire and identically here: as a thing with named values.

  rt.defineValue('the form', () => readSent(server.asked.sent, server.asked.kind));

  rt.defineValue('the form field $name', (a) => {
    const found = readSent(server.asked.sent, server.asked.kind)[toText(a.name)];
    return found === undefined ? '' : found;
  });

  // The pieces of the address itself: "/notes/{id}" hands back the id.
  rt.defineValue('the address part $name', (a) => {
    const found = server.asked.parts[toText(a.name)];
    return found === undefined ? '' : found;
  });

  // ------------------------------------------------------ files sent in
  //
  // A picture arriving from a form is not text, so it is never turned into
  // any. What a program gets is what it needs to decide - the name it had,
  // what it claims to be, and how big it is - and a way to put it somewhere.

  const uploaded = (name) => (server.asked.files || {})[toText(name)] || null;

  // Called name, type and bytes on purpose: "size of" and "kind of" already
  // mean something in Plain, and a field with either of those names could
  // never be read.
  rt.defineValue('the file sent as $name', (a) => {
    const found = uploaded(a.name);
    if (!found) return null;
    return { name: found.name, type: found.kind, bytes: found.size };
  });

  rt.defineValue('a file was sent as $name', (a) => Boolean(uploaded(a.name)));

  rt.defineValue('the text of the file sent as $name', (a) => {
    const found = uploaded(a.name);
    return found ? found.bytes.toString('utf8') : '';
  });

  rt.define('save the file sent as $name to $where', (a, ctx) => {
    const found = uploaded(a.name);
    if (!found) ctx.fail(`Nothing was sent as ${toText(a.name)}`);
    if (!host.putFile) needTerminal(ctx, 'Keeping a file that was sent');
    host.putFile(toText(a.where), found.bytes, ctx);
  });

  // ----------------------------------------------------------- answering

  rt.define('send them to $path', (a) => {
    server.answer = { body: '', kind: 'text/plain; charset=utf-8', code: 303, goTo: toText(a.path) };
  });

  rt.define('answer with $value and code $code', (a) => {
    server.answer = { body: toText(a.value), kind: guessKind(toText(a.value)), code: Math.round(toNumber(a.code)) };
  });

  rt.define('answer that nothing is there', () => {
    server.answer = { body: 'Nothing is there', kind: 'text/plain; charset=utf-8', code: 404 };
  });

  // A folder of files - pictures, stylesheets, whatever a page asks for -
  // handed out as they are, for anything no route claimed.
  rt.define('hand out the files in $folder', (a) => {
    server.folder = toText(a.folder);
  });

  // ------------------------------------------------------- the visitor
  //
  // Something has to remember who is who between one page and the next. The
  // browser is given a tag, and what belongs to that tag is kept here, so
  // nothing private ever leaves the machine the program runs on.

  // What a visitor is carrying is kept the way everything else in Plain is
  // kept, so a program that is restarted does not throw everybody out. Each
  // one also carries when it was last seen, so old ones can be swept away
  // rather than piling up for ever.
  const VISITOR = 'visitor:';
  const MONTH = 30 * 24 * 60 * 60 * 1000;

  const carrying = () => {
    const tag = server.asked.tag;
    if (!tag) return {};
    if (!server.visitors.has(tag)) {
      const kept = rt.store ? rt.store.get(VISITOR + tag) : undefined;
      const held = kept && typeof kept === 'object' && kept.held ? kept.held : {};
      server.visitors.set(tag, held);
    }
    return server.visitors.get(tag);
  };

  const writeVisitor = () => {
    const tag = server.asked.tag;
    if (!tag || !rt.store) return;
    rt.store.set(VISITOR + tag, { seen: Date.now(), held: server.visitors.get(tag) || {} });
  };

  // Anybody who has not been seen for a month is forgotten, which keeps the
  // file from growing forever on a server that has been up a long time.
  server.sweepVisitors = () => {
    if (!rt.store) return 0;
    let gone = 0;
    for (const key of rt.store.keys()) {
      if (!key.startsWith(VISITOR)) continue;
      const kept = rt.store.get(key);
      const seen = kept && Number(kept.seen);
      if (!seen || Date.now() - seen > MONTH) { rt.store.remove(key); gone += 1; }
    }
    return gone;
  };

  rt.define('keep $value as $key for this visitor', (a) => {
    carrying()[toText(a.key)] = a.value;
    writeVisitor();
  });

  // Not "this visitor's $key": an apostrophe is how text in single quotes
  // begins, so a phrase with one in it would be read as the start of a
  // string every time somebody used it.
  rt.defineValue('what this visitor has as $key', (a) => {
    const found = carrying()[toText(a.key)];
    return found === undefined ? null : found;
  });

  rt.defineValue('this visitor has $key', (a) => carrying()[toText(a.key)] !== undefined);

  rt.define('forget everything about this visitor', () => {
    if (!server.asked.tag) return;
    server.visitors.set(server.asked.tag, {});
    if (rt.store) rt.store.remove(VISITOR + server.asked.tag);
  });

  // Signing in is what nearly every program wants this for, so it says so.
  rt.define('sign this visitor in as $who', (a) => {
    carrying().signedIn = a.who;
    writeVisitor();
  });

  rt.define('sign this visitor out', () => {
    delete carrying().signedIn;
    writeVisitor();
  });

  rt.defineValue('who is signed in', () => {
    const found = carrying().signedIn;
    return found === undefined ? null : found;
  });

  rt.defineValue('somebody is signed in', () => carrying().signedIn !== undefined);

  return server;
}

function normalise(path) {
  const clean = String(path).trim();
  if (!clean || clean === '/') return '/';
  return ('/' + clean.replace(/^\/+/, '').replace(/\/+$/, '')) || '/';
}

// Enough of a guess to serve a page as a page and a list as data.
function guessKind(body) {
  const start = body.trimStart().slice(0, 1);
  if (start === '<') return 'text/html; charset=utf-8';
  if (start === '{' || start === '[') return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

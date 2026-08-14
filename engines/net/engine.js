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
    this.routes = [];          // { path, run }
    this.notFound = null;
    this.port = null;
    this.running = null;
    this.asked = { path: '/', query: {}, sent: '', method: 'GET' };
    this.answer = null;
  }

  routeFor(path) {
    const wanted = String(path).split('?')[0].replace(/\/+$/, '') || '/';
    return this.routes.find(route => route.path === wanted) || null;
  }
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

  rt.define('when someone visits $path ...', (a, ctx) => {
    const path = normalise(toText(a.path));
    server.routes.push({ path, run: ctx.block });
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

  rt.define('start serving on port $port', (a, ctx) => {
    if (!host.serve) needTerminal(ctx, 'Serving');
    server.port = Math.round(toNumber(a.port));
    host.serve(server, ctx);
  });

  rt.defineValue('what was asked for', () => server.asked.path);
  rt.defineValue('what they sent', () => server.asked.sent);
  rt.defineValue('how they asked', () => server.asked.method);
  rt.defineValue('asked for $name', (a) => {
    const found = server.asked.query[toText(a.name)];
    return found === undefined ? '' : found;
  });

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

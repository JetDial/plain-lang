// Plain - what a part says about itself.
//
//     this part is called "dates" version "1.2.0"
//     this part needs "money" version "1.0.0" from "https://example.com/money.plain"
//
// A part is a .plain file somebody else wrote. Two sentences at the top of
// it are how it says what it is and what it leans on, so `plain get` can
// fetch the whole family rather than one file and a surprise.
//
// They are ordinary sentences, not a comment and not a separate manifest
// file, for three reasons: a part is one file and stays one file, the
// sentences are checked by the same parser as everything else, and they can
// be read off a file that has been fetched but not yet run - which is the
// only safe moment to decide whether to trust it.
//
// Running them does nothing but remember. Nobody has to call them.

import { toText } from '../../src/values.js';

export function installParts(rt, host = {}) {
  if (rt.libraries.has('parts')) return rt.part;
  rt.libraries.add('parts');

  const part = { name: null, version: null, needs: [] };
  rt.part = part;

  rt.define('this part is called $name version $version', (a) => {
    part.name = toText(a.name);
    part.version = toText(a.version);
  });

  rt.define('this part needs $name version $version from $where', (a) => {
    part.needs.push({ name: toText(a.name), version: toText(a.version), where: toText(a.where) });
  });

  // ------------------------------------------------------- other people's
  //
  // A part is Plain. A package is somebody else's JavaScript, off npm, and
  // there is a great deal of it: dates, colours, spreadsheets, whatever you
  // were about to write yourself. It is fetched by npm and used from here.
  //
  //     make dates be the package "dayjs"
  //     show call dates with "2026-08-14"
  //
  // Only in a terminal: a page has no node_modules to look in.
  rt.defineValue('the package $name', (a, ctx) => {
    if (!host.usePackage) {
      ctx.fail(
        'Packages only work when Plain runs in a terminal',
        'a page has nowhere to look for them'
      );
    }
    return host.usePackage(toText(a.name), ctx);
  });

  // Somebody else's code keeps its workings on the thing itself, so calling
  // one of its actions has to be done *through* that thing - otherwise it
  // gets handed the action with no idea what it belongs to.
  const doing = (thing, named, args, ctx) => {
    const found = thing === null || thing === undefined ? undefined : thing[named];
    if (typeof found !== 'function') {
      ctx.fail(`That has nothing called "${named}" that can be done`);
    }
    return found.apply(thing, args);
  };

  rt.defineValue('call $method of $thing', (a, ctx) =>
    doing(a.thing, toText(a.method), [], ctx));

  rt.defineValue('call $method of $thing with $one', (a, ctx) =>
    doing(a.thing, toText(a.method), [a.one], ctx));

  rt.defineValue('call $method of $thing with $one and $other', (a, ctx) =>
    doing(a.thing, toText(a.method), [a.one, a.other], ctx));

  return part;
}

// The same two sentences, read off a file that has been fetched and not run.
// The real parser does the reading, so a part cannot pretend to be something
// else by putting the words in a comment or inside a piece of text.
export function readAbout(program) {
  const about = { name: null, version: null, needs: [] };
  const words = (node) => (node && node.type === 'Text' ? String(node.value) : null);

  for (const node of program.body) {
    if (node.type !== 'Phrase') continue;
    if (node.spec === 'this part is called $name version $version') {
      about.name = words(node.args.name);
      about.version = words(node.args.version);
    }
    if (node.spec === 'this part needs $name version $version from $where') {
      about.needs.push({
        name: words(node.args.name),
        version: words(node.args.version),
        where: words(node.args.where)
      });
    }
  }
  return about;
}

// 1.2.10 comes after 1.2.9, which is not what comparing the words would say.
export function compareVersions(one, other) {
  const bits = (text) => String(text || '0').split('.').map(piece => Number(piece.replace(/\D.*$/, '')) || 0);
  const a = bits(one);
  const b = bits(other);
  for (let at = 0; at < Math.max(a.length, b.length); at++) {
    const left = a[at] || 0;
    const right = b[at] || 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

export function atLeast(have, wanted) {
  return compareVersions(have, wanted) >= 0;
}

// Plain - parts.
//
//   plain get https://example.com/dates.plain
//   plain get                      # fetch everything listed again, and check it
//   plain parts                    # what this folder is using
//
// A part is a single .plain file. It is kept next to your program in a
// `plain-parts` folder, and what was fetched is written down in
// `plain-parts.json` with its size and fingerprint, so you can see when
// something you depend on has changed underneath you.
//
// Two things make this safer than it sounds. A part is Plain source, read by
// Plain's own interpreter - there is no way for it to run a program of its
// own, reach your disk outside the folder, or install anything. And nothing
// is ever fetched on its own: a part arrives only when you type `plain get`.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const FOLDER = 'plain-parts';
export const LIST = 'plain-parts.json';

const MOST = 1024 * 1024;        // a part should be a file, not a download

export function listFile(folder) {
  return path.join(folder, LIST);
}

export function readList(folder) {
  const file = listFile(folder);
  if (!fs.existsSync(file)) return { parts: {} };
  try {
    const held = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { parts: held.parts || {} };
  } catch {
    return { parts: {} };
  }
}

export function writeList(folder, list) {
  const ordered = {};
  for (const name of Object.keys(list.parts).sort()) ordered[name] = list.parts[name];
  fs.writeFileSync(listFile(folder), JSON.stringify({ parts: ordered }, null, 2) + '\n', 'utf8');
}

export function fingerprint(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

// A sensible name for a part, taken from its address.
export function nameFrom(url) {
  const last = String(url).split(/[?#]/)[0].split('/').filter(Boolean).pop() || 'part';
  return last.replace(/\.plain$/i, '').replace(/[^A-Za-z0-9_-]/g, '-').toLowerCase() || 'part';
}

// What a part must look like before it is allowed to land on disk.
export function checkPart(text, url) {
  if (text.length > MOST) {
    return `${url} is ${Math.round(text.length / 1024)}kB, and a part should be a small file`;
  }
  if (text.includes(String.fromCharCode(0))) {
    return `${url} is not text, so it is not a Plain part`;
  }
  const looksLikePage = /^\s*<(!doctype|html|\?xml)/i.test(text);
  if (looksLikePage) {
    return `${url} gave back a web page, not a .plain file`;
  }
  return null;
}

export function save(folder, name, text, url) {
  const parts = path.join(folder, FOLDER);
  fs.mkdirSync(parts, { recursive: true });
  const file = path.join(parts, name + '.plain');
  fs.writeFileSync(file, text, 'utf8');

  const list = readList(folder);
  list.parts[name] = {
    url,
    fingerprint: fingerprint(text),
    letters: text.length,
    got: new Date().toISOString().slice(0, 10)
  };
  writeList(folder, list);
  return file;
}

// The first few lines, so someone can see what has arrived.
export function peek(text, howMany = 6) {
  return text.replace(/\r\n?/g, '\n').split('\n').slice(0, howMany);
}

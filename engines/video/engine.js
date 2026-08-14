// Plain - the video engine.
//
//     make a video called "Holiday" sized 1280 by 720
//     add a title "Summer" for 3 seconds
//     add a clip "beach.mp4" from 4 to 12 seconds
//     fade the last clip in over 1 seconds
//     add music "song.mp3"
//
// The program describes a timeline. `plain play` shows it with a preview and
// a scrubber; `plain edit` opens the same timeline with handles you can drag,
// and writes your changes back as Plain sentences.

import { toText, toNumber } from '../../src/values.js';

export class Clip {
  constructor(options = {}) {
    this.kind = options.kind || 'title';    // video | picture | title | colour
    this.source = options.source || '';
    this.text = options.text || '';
    this.color = options.color || '#101018';
    this.textColor = options.textColor || '#ffffff';
    this.length = Math.max(0.1, num(options.length, 3));
    this.from = Math.max(0, num(options.from, 0));   // where in the source file
    this.fadeIn = 0;
    this.fadeOut = 0;
    this.overlay = '';
  }

  toPlainText() {
    return `<${this.kind} clip, ${round(this.length)}s>`;
  }
}

export class Studio {
  constructor() {
    this.started = false;
    this.title = 'A Plain video';
    this.width = 1280;
    this.height = 720;
    this.fps = 30;
    this.clips = [];
    this.music = [];
    this.volume = 1;
  }

  get length() {
    return this.clips.reduce((total, clip) => total + clip.length, 0);
  }

  // Where each clip sits on the timeline.
  layout() {
    let at = 0;
    return this.clips.map(clip => {
      const placed = { clip, start: at, finish: at + clip.length };
      at += clip.length;
      return placed;
    });
  }

  clipAt(seconds) {
    return this.layout().find(placed => seconds >= placed.start && seconds < placed.finish) || null;
  }

  last() {
    return this.clips[this.clips.length - 1] || null;
  }

  // The whole timeline written back out as Plain sentences. This is what the
  // editor saves, so a video edited by hand and a video edited by dragging
  // are the same file.
  toPlainSource() {
    const lines = [`make a video called ${quote(this.title)} sized ${this.width} by ${this.height}`];
    if (this.fps !== 30) lines.push(`set the frame rate to ${this.fps}`);
    lines.push('');
    for (const clip of this.clips) {
      if (clip.kind === 'video') {
        lines.push(`add a clip ${quote(clip.source)} from ${round(clip.from)} to ${round(clip.from + clip.length)} seconds`);
      } else if (clip.kind === 'picture') {
        lines.push(`add a picture ${quote(clip.source)} for ${round(clip.length)} seconds`);
      } else if (clip.kind === 'colour') {
        lines.push(`add a background ${quote(clip.color)} for ${round(clip.length)} seconds`);
      } else {
        lines.push(`add a title ${quote(clip.text)} for ${round(clip.length)} seconds`);
      }
      if (clip.overlay) lines.push(`put the words ${quote(clip.overlay)} on the last clip`);
      if (clip.fadeIn) lines.push(`fade the last clip in over ${round(clip.fadeIn)} seconds`);
      if (clip.fadeOut) lines.push(`fade the last clip out over ${round(clip.fadeOut)} seconds`);
    }
    if (this.music.length) {
      lines.push('');
      for (const track of this.music) lines.push(`add music ${quote(track)}`);
    }
    if (this.volume !== 1) lines.push(`set the volume to ${round(this.volume)}`);
    return lines.join('\n') + '\n';
  }
}

export function installVideo(rt, host = {}) {
  if (rt.libraries.has('video')) return rt.studio;
  rt.libraries.add('video');

  const studio = new Studio();
  rt.studio = studio;

  const add = (clip) => { studio.clips.push(clip); return clip; };
  const lastOr = (ctx) => {
    const clip = studio.last();
    if (!clip) ctx.fail('There is no clip yet. Add one first.');
    return clip;
  };

  rt.define('make a video called $title sized $width by $height', (a) => {
    studio.title = toText(a.title);
    studio.width = Math.round(toNumber(a.width));
    studio.height = Math.round(toNumber(a.height));
    studio.started = true;
  });

  rt.define('make a video called $title', (a) => {
    studio.title = toText(a.title);
    studio.started = true;
  });

  rt.define('set the frame rate to $fps', (a) => { studio.fps = Math.max(1, Math.round(toNumber(a.fps))); });
  rt.define('set the volume to $level', (a) => { studio.volume = Math.min(1, Math.max(0, toNumber(a.level))); });

  // --------------------------------------------------------------- clips

  rt.define('add a clip $source from $start to $finish seconds', (a, ctx) => {
    const from = toNumber(a.start);
    const to = toNumber(a.finish);
    if (to <= from) ctx.fail('A clip has to finish after it starts');
    add(new Clip({ kind: 'video', source: toText(a.source), from, length: to - from }));
  });

  rt.define('add a clip $source for $seconds seconds', (a) =>
    void add(new Clip({ kind: 'video', source: toText(a.source), length: toNumber(a.seconds) })));

  rt.define('add a picture $source for $seconds seconds', (a) =>
    void add(new Clip({ kind: 'picture', source: toText(a.source), length: toNumber(a.seconds) })));

  rt.define('add a title $text for $seconds seconds', (a) =>
    void add(new Clip({ kind: 'title', text: toText(a.text), length: toNumber(a.seconds) })));

  rt.define('add a title $text for $seconds seconds colored $color', (a) =>
    void add(new Clip({ kind: 'title', text: toText(a.text), length: toNumber(a.seconds), color: toText(a.color) })));

  rt.define('add a background $color for $seconds seconds', (a) =>
    void add(new Clip({ kind: 'colour', color: toText(a.color), length: toNumber(a.seconds) })));

  rt.define('put the words $text on the last clip', (a, ctx) => { lastOr(ctx).overlay = toText(a.text); });
  rt.define('fade the last clip in over $seconds seconds', (a, ctx) => { lastOr(ctx).fadeIn = toNumber(a.seconds); });
  rt.define('fade the last clip out over $seconds seconds', (a, ctx) => { lastOr(ctx).fadeOut = toNumber(a.seconds); });
  rt.define('trim the last clip to $seconds seconds', (a, ctx) => {
    lastOr(ctx).length = Math.max(0.1, toNumber(a.seconds));
  });

  rt.define('add music $source', (a) => { studio.music.push(toText(a.source)); });

  // -------------------------------------------------------------- asking

  rt.defineValue('video length', () => studio.length);
  rt.defineValue('clip count', () => studio.clips.length);
  rt.defineValue('video width', () => studio.width);
  rt.defineValue('video height', () => studio.height);

  return studio;
}

function num(value, fallback) {
  const n = toNumber(value);
  return Number.isNaN(n) ? fallback : n;
}

function round(n) { return Math.round(n * 100) / 100; }

export function quote(text) {
  return '"' + String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

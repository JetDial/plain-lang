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
    this.volume = 1;             // how loud this clip's own sound is
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
    this.overlays = [];          // a second track, laid over the clips
    this.music = [];
    this.volume = 1;
  }

  // What belongs on top at this moment.
  overlaysAt(seconds) {
    return this.overlays.filter(one => seconds >= one.start && seconds < one.finish);
  }

  get length() {
    // A crossfade means two clips are on screen at once for that long, so
    // the film is shorter than the sum of its parts by exactly the overlap.
    return this.clips.reduce((total, clip) => total + clip.length - (clip.crossFrom || 0), 0);
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
      if (clip.volume === 0) lines.push('silence the last clip');
      else if (clip.volume !== 1) lines.push(`set the volume of the last clip to ${round(clip.volume)}`);
    }
    if (this.overlays.length) {
      lines.push('');
      for (const one of this.overlays) {
        lines.push(one.kind === 'picture'
          ? `put the picture ${quote(one.source)} on top from ${round(one.start)} to ${round(one.finish)} seconds`
          : `put the words ${quote(one.text)} on top from ${round(one.start)} to ${round(one.finish)} seconds`);
        if (one.where && one.where !== (one.kind === 'picture' ? 'middle' : 'bottom')) {
          lines.push(`put the last thing on top ${one.where}`);
        }
        if (one.fade) lines.push(`fade the last thing on top over ${round(one.fade)} seconds`);
      }
    }
    if (this.music.length) {
      lines.push('');
      for (const track of this.music) {
        if (track.start) lines.push(`add music ${quote(track.source)} starting at ${round(track.start)} seconds`);
        else if (track.volume !== 1) lines.push(`add music ${quote(track.source)} at volume ${round(track.volume)}`);
        else lines.push(`add music ${quote(track.source)}`);
      }
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

  // A second track: things laid over the picture at a time of your choosing,
  // rather than stuck to one clip.
  rt.define('put the words $text on top from $start to $finish seconds', (a, ctx) => {
    const start = toNumber(a.start);
    const finish = toNumber(a.finish);
    if (finish <= start) ctx.fail('That has to finish after it starts');
    studio.overlays.push({ kind: 'words', text: toText(a.text), start, finish, where: 'bottom', fade: 0 });
  });

  rt.define('put the words $text on top at $start seconds for $length seconds', (a) => {
    const start = toNumber(a.start);
    studio.overlays.push({
      kind: 'words', text: toText(a.text), start, finish: start + Math.max(0.1, toNumber(a.length)),
      where: 'bottom', fade: 0
    });
  });

  rt.define('put the picture $source on top from $start to $finish seconds', (a, ctx) => {
    const start = toNumber(a.start);
    const finish = toNumber(a.finish);
    if (finish <= start) ctx.fail('That has to finish after it starts');
    studio.overlays.push({ kind: 'picture', source: toText(a.source), start, finish, where: 'middle', fade: 0 });
  });

  rt.define('put the last thing on top #where', (a, ctx) => {
    const last = studio.overlays[studio.overlays.length - 1];
    if (!last) ctx.fail('There is nothing on the top track yet');
    const where = String(a.where).toLowerCase();
    if (!['top', 'middle', 'bottom'].includes(where)) ctx.fail(`"${a.where}" is not a place. Use top, middle or bottom.`);
    last.where = where;
  });

  rt.define('fade the last thing on top over $seconds seconds', (a, ctx) => {
    const last = studio.overlays[studio.overlays.length - 1];
    if (!last) ctx.fail('There is nothing on the top track yet');
    last.fade = Math.max(0, toNumber(a.seconds));
  });

  rt.defineValue('things on top', () => studio.overlays.length);
  rt.define('fade the last clip in over $seconds seconds', (a, ctx) => { lastOr(ctx).fadeIn = toNumber(a.seconds); });
  rt.define('fade the last clip out over $seconds seconds', (a, ctx) => { lastOr(ctx).fadeOut = toNumber(a.seconds); });
  rt.define('trim the last clip to $seconds seconds', (a, ctx) => {
    lastOr(ctx).length = Math.max(0.1, toNumber(a.seconds));
  });

  rt.define('add music $source', (a) => {
    studio.music.push({ source: toText(a.source), start: 0, volume: 1 });
  });

  rt.define('add music $source starting at $seconds seconds', (a) => {
    studio.music.push({ source: toText(a.source), start: Math.max(0, toNumber(a.seconds)), volume: 1 });
  });

  rt.define('add music $source at volume $level', (a) => {
    studio.music.push({ source: toText(a.source), start: 0, volume: Math.min(1, Math.max(0, toNumber(a.level))) });
  });

  rt.define('silence the last clip', (a, ctx) => { lastOr(ctx).volume = 0; });
  rt.define('set the volume of the last clip to $level', (a, ctx) => {
    lastOr(ctx).volume = Math.min(1, Math.max(0, toNumber(a.level)));
  });

  // -------------------------------------------------------------- asking

  // --------------------------------------------- what an editor actually does
  //
  // Everything above cuts one clip against the next and puts words over the
  // top. That is a slideshow. What makes something look edited is the four
  // things below, and every editor people pay for has all four.

  // A crossfade. Not two fades that happen to meet - one clip is still
  // there while the next arrives, which is why it looks like a change of
  // subject rather than a gap.
  rt.define('cross into the last clip over $seconds seconds', (a, ctx) => {
    const clip = lastOr(ctx);
    const at = studio.clips.indexOf(clip);
    if (at < 1) ctx.fail('There is nothing to cross into it from', 'a crossfade needs a clip before this one');
    const over = Math.max(0.01, toNumber(a.seconds));
    clip.crossFrom = over;
    studio.clips[at - 1].crossTo = over;
  });

  // Slow motion and its opposite. A clip played at half speed lasts twice
  // as long, which the timeline has to know about.
  rt.define('play the last clip at $speed speed', (a, ctx) => {
    const clip = lastOr(ctx);
    const speed = Math.max(0.05, toNumber(a.speed));
    const was = clip.length;
    clip.speed = speed;
    clip.length = was / speed;
  });

  // The slow drift across a still picture that stops it looking like a
  // slide. Named after the man who made a career of it.
  rt.define('drift the last clip from $fromZoom to $toZoom', (a, ctx) => {
    const clip = lastOr(ctx);
    clip.zoomFrom = Math.max(0.1, toNumber(a.fromZoom));
    clip.zoomTo = Math.max(0.1, toNumber(a.toZoom));
  });

  rt.define('drift the last clip #where', (a, ctx) => {
    const clip = lastOr(ctx);
    const which = String(a.where).toLowerCase();
    const ways = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] };
    if (!ways[which]) ctx.fail(`"${a.where}" is not a way to drift`, 'use left, right, up or down');
    clip.driftX = ways[which][0];
    clip.driftY = ways[which][1];
  });

  // Colour, which is most of what "graded" means.
  rt.define('make the last clip $amount brighter', (a, ctx) => { lastOr(ctx).brightness = 1 + toNumber(a.amount); });
  rt.define('make the last clip $amount darker', (a, ctx) => { lastOr(ctx).brightness = Math.max(0, 1 - toNumber(a.amount)); });
  rt.define('drain the colour from the last clip', (a, ctx) => { lastOr(ctx).saturation = 0; });
  rt.define('set the colour of the last clip to $amount', (a, ctx) => { lastOr(ctx).saturation = Math.max(0, toNumber(a.amount)); });
  rt.define('tint the last clip $color', (a, ctx) => { lastOr(ctx).tint = toText(a.color); });

  // Splitting, which is the single most used action in any editor.
  rt.define('split the last clip at $seconds seconds', (a, ctx) => {
    const clip = lastOr(ctx);
    const at = Math.max(0.01, Math.min(clip.length - 0.01, toNumber(a.seconds)));
    const second = { ...clip, length: clip.length - at };
    clip.length = at;
    studio.clips.push(second);
  });

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

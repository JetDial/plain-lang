// Plain - the game engine.
//
// Everything here is registered as a Plain sentence, so a game reads like a
// description of the game:
//
//     start a game called "Pong" sized 800 by 600
//     make ball be a circle at 400 , 300 sized 20 colored "white"
//     every frame
//         move ball by dx of ball , dy of ball
//     end
//
// The same engine runs in two ways: on a canvas in the browser, and headless
// in Node (used by `plain run` and by the tests), where every frame is
// simulated but nothing is drawn.

import { toText, toNumber, truthy } from '../../src/values.js';

const DIRECTIONS = {
  left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1],
  west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1]
};

export class Thing {
  constructor(options = {}) {
    this.name = options.name || 'thing';
    this.shape = options.shape || 'box';   // box | circle | picture | words
    this.x = num(options.x, 0);
    this.y = num(options.y, 0);
    this.width = num(options.width, 20);
    this.height = num(options.height, 20);
    this.color = options.color ?? 'white';
    this.dx = 0;
    this.dy = 0;
    this.angle = 0;
    this.text = options.text ?? '';
    this.source = options.source ?? '';    // picture url
    this.hidden = false;
    this.gone = false;
    this.data = {};                        // anything the program invents
    this._image = null;

    // A sprite sheet is one picture cut into a grid of frames.
    this.columns = num(options.columns, 1);
    this.rows = num(options.rows, 1);
    this.frame = 1;
    this.firstFrame = 1;
    this.lastFrame = num(options.columns, 1) * num(options.rows, 1);
    this.framesASecond = 0;                // 0 means "hold still"
    this.frameClock = 0;
  }

  get frameCount() { return Math.max(1, this.columns * this.rows); }

  // Move the animation on by however much time has passed.
  advance(seconds) {
    if (!this.framesASecond) return;
    this.frameClock += seconds;
    // The tiny allowance is the same one the timers use: without it, ten
    // sixtieths of a second lands a hair under a tenth and drops a frame.
    const each = 1 / this.framesASecond - 1e-9;
    while (this.frameClock >= each) {
      this.frameClock -= each;
      this.frame = this.frame >= this.lastFrame ? this.firstFrame : this.frame + 1;
    }
  }

  get left() { return this.x - this.width / 2; }
  get right() { return this.x + this.width / 2; }
  get top() { return this.y - this.height / 2; }
  get bottom() { return this.y + this.height / 2; }

  touches(other) {
    if (!other || this.gone || other.gone || this.hidden || other.hidden) return false;
    return this.left < other.right && this.right > other.left &&
           this.top < other.bottom && this.bottom > other.top;
  }

  distanceTo(other) {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  // Which names a Plain program may read with "x of ball".
  getPlainField(name) {
    const key = String(name).toLowerCase();
    switch (key) {
      case 'x': case 'y': case 'width': case 'height': case 'color':
      case 'dx': case 'dy': case 'angle': case 'text': case 'name':
      case 'frame':
        return this[key];
      case 'frames': return this.frameCount;
      case 'size': return Math.max(this.width, this.height);
      case 'left': return this.left;
      case 'right': return this.right;
      case 'top': return this.top;
      case 'bottom': return this.bottom;
      case 'speed': return Math.hypot(this.dx, this.dy);
      case 'hidden': return this.hidden;
      case 'visible': return !this.hidden;
      case 'gone': return this.gone;
    }
    if (key in this.data) return this.data[key];
    return undefined;
  }

  setPlainField(name, value) {
    const key = String(name).toLowerCase();
    switch (key) {
      case 'x': case 'y': case 'width': case 'height':
      case 'dx': case 'dy': case 'angle':
        this[key] = toNumber(value); return;
      case 'frame':
        this.frame = Math.min(this.frameCount, Math.max(1, Math.round(toNumber(value)))); return;
      case 'size': this.width = toNumber(value); this.height = toNumber(value); return;
      case 'color': this.color = toText(value); return;
      case 'text': this.text = toText(value); return;
      case 'hidden': this.hidden = truthy(value); return;
      case 'visible': this.hidden = !truthy(value); return;
      case 'speed': {
        const current = Math.hypot(this.dx, this.dy) || 1;
        const factor = toNumber(value) / current;
        this.dx *= factor; this.dy *= factor; return;
      }
    }
    this.data[key] = value;
  }

  toPlainText() {
    return `<${this.shape} ${this.name} at ${Math.round(this.x)}, ${Math.round(this.y)}>`;
  }
}

export class Game {
  constructor(host = {}) {
    this.host = host;                 // { canvas, window, document } or {}
    this.title = 'Plain game';
    this.width = 800;
    this.height = 600;
    this.background = '#101018';
    this.gravity = 0;
    this.things = [];
    this.everyFrame = [];
    this.collisions = [];             // { a, b, run, touching }
    this.keyPress = [];               // { key, run }
    this.timers = [];                 // { every, next, run }
    this.leaving = [];                // { thing, run }
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.clicks = [];                 // { run }
    this.drawQueue = [];
    this.frame = 0;
    this.time = 0;                    // seconds of game time
    this.running = false;
    this.started = false;
    this.over = false;
    this.overMessage = '';
    this.onError = null;
    this.volume = 0.7;
    this.music = null;
    this.sounds = new Map();      // name -> audio, so a sound loads once
    this.played = [];             // what was asked for, which the tests read
  }

  // Sound files sit next to the program. With no browser there is nothing
  // to play, so the request is simply recorded.
  playSound(name) {
    this.played.push(name);
    const w = this.host.window;
    if (!w || !w.Audio) return;
    try {
      let audio = this.sounds.get(name);
      if (!audio) { audio = new w.Audio(name); this.sounds.set(name, audio); }
      const voice = audio.cloneNode ? audio.cloneNode() : audio;   // let it overlap
      voice.volume = this.volume;
      voice.play().catch(() => {});
    } catch { /* sound is a nice-to-have */ }
  }

  playMusic(name) {
    this.played.push(name);
    const w = this.host.window;
    if (!w || !w.Audio) { this.music = { name, volume: this.volume }; return; }
    try {
      this.stopMusic();
      const audio = new w.Audio(name);
      audio.loop = true;
      audio.volume = this.volume;
      audio.play().catch(() => {});
      this.music = audio;
    } catch { /* sound is a nice-to-have */ }
  }

  stopMusic() {
    if (this.music && this.music.pause) { this.music.pause(); this.music.currentTime = 0; }
    this.music = null;
  }

  add(thing) { this.things.push(thing); return thing; }

  // ------------------------------------------------------------- simulation

  step(seconds = 1 / 60) {
    if (this.over) return;
    this.frame++;
    this.time += seconds;
    this.drawQueue = [];

    for (const run of this.everyFrame) this.safely(run);

    for (const timer of this.timers) {
      // The small allowance keeps a "every 1 seconds" timer on the beat
      // instead of slipping a frame every time the clock lands just short.
      if (timer.done) continue;
      if (this.time >= timer.next - 1e-9) {
        timer.next += timer.every;
        if (timer.next < this.time) timer.next = this.time + timer.every;
        this.safely(timer.run);
        if (timer.once) timer.done = true;
      }
    }
    if (this.timers.some(timer => timer.done)) this.timers = this.timers.filter(timer => !timer.done);

    for (const thing of this.things) {
      if (thing.gone) continue;
      thing.dy += this.gravity;
      thing.x += thing.dx;
      thing.y += thing.dy;
      thing.advance(seconds);
    }

    // The 3D world, when there is one, moves on the same clock.
    if (this.world) this.world.step();

    for (const rule of this.collisions) {
      const hit = rule.a.touches(rule.b);
      // Fire once per contact, not once per frame of contact.
      if (hit && !rule.touching) this.safely(() => rule.run(rule.a, rule.b));
      rule.touching = hit;
    }

    for (const rule of this.leaving) {
      const t = rule.thing;
      const out = t.right < 0 || t.left > this.width || t.bottom < 0 || t.top > this.height;
      if (out && !rule.outside) this.safely(() => rule.run(t));
      rule.outside = out;
    }

    this.things = this.things.filter(t => !t.gone);
  }

  safely(run) {
    try { run(); }
    catch (error) {
      this.over = true;
      if (this.onError) this.onError(error);
      else throw error;
    }
  }

  simulate(frames = 60, seconds = 1 / 60) {
    for (let i = 0; i < frames && !this.over; i++) this.step(seconds);
    return this;
  }

  press(key) { this.keys.add(String(key).toLowerCase()); this.fireKey(key); }
  release(key) { this.keys.delete(String(key).toLowerCase()); }
  fireKey(key) {
    const name = String(key).toLowerCase();
    for (const rule of this.keyPress) {
      if (rule.key === name || rule.key === 'any') this.safely(rule.run);
    }
  }

  // ---------------------------------------------------------------- drawing

  draw(ctx) {
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawContents(ctx);
  }

  // Used when a 3D world is behind us: keep the background see-through so
  // flat things and drawings act as a heads-up display.
  drawHud(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawContents(ctx);
  }

  drawContents(ctx) {
    for (const thing of this.things) {
      if (thing.hidden || thing.gone) continue;
      ctx.save();
      ctx.translate(thing.x, thing.y);
      if (thing.angle) ctx.rotate(thing.angle * Math.PI / 180);
      ctx.fillStyle = thing.color;
      if (thing.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, thing.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (POLYGONS[thing.shape]) {
        drawPolygon(ctx, POLYGONS[thing.shape](thing.width / 2, thing.height / 2));
      } else if (thing.shape === 'ring') {
        ctx.lineWidth = Math.max(2, thing.width / 8);
        ctx.strokeStyle = thing.color;
        ctx.beginPath();
        ctx.arc(0, 0, thing.width / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (thing.shape === 'words') {
        ctx.font = `${Math.max(10, thing.height)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(toText(thing.text), 0, 0);
      } else if (thing.shape === 'picture' && thing._image && thing._image.complete) {
        if (thing.frameCount > 1) {
          // One frame out of the sheet's grid.
          const sheetWidth = thing._image.naturalWidth || thing._image.width || 0;
          const sheetHeight = thing._image.naturalHeight || thing._image.height || 0;
          const frameWidth = sheetWidth / thing.columns;
          const frameHeight = sheetHeight / thing.rows;
          const at = Math.max(0, Math.min(thing.frameCount - 1, thing.frame - 1));
          const column = at % thing.columns;
          const row = Math.floor(at / thing.columns);
          ctx.drawImage(
            thing._image,
            column * frameWidth, row * frameHeight, frameWidth, frameHeight,
            -thing.width / 2, -thing.height / 2, thing.width, thing.height
          );
        } else {
          ctx.drawImage(thing._image, -thing.width / 2, -thing.height / 2, thing.width, thing.height);
        }
      } else {
        ctx.fillRect(-thing.width / 2, -thing.height / 2, thing.width, thing.height);
      }
      ctx.restore();
    }

    for (const item of this.drawQueue) {
      ctx.save();
      ctx.fillStyle = item.color;
      if (item.kind === 'text') {
        ctx.font = `${item.size}px system-ui, sans-serif`;
        ctx.textAlign = item.align || 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(item.text, item.x, item.y);
      } else if (item.kind === 'circle') {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'triangle' || item.kind === 'arrow' || item.kind === 'plane') {
        // Drawn nose-first along nothing, then turned to where it points.
        const long = item.size / 2;
        ctx.translate(item.x, item.y);
        ctx.rotate((item.angle * Math.PI) / 180);
        ctx.beginPath();
        if (item.kind === 'triangle') {
          ctx.moveTo(long, 0);
          ctx.lineTo(-long, long * 0.85);
          ctx.lineTo(-long, -long * 0.85);
        } else if (item.kind === 'arrow') {
          ctx.moveTo(long, 0);
          ctx.lineTo(-long, long * 0.6);
          ctx.lineTo(-long * 0.45, 0);
          ctx.lineTo(-long, -long * 0.6);
        } else {
          // A swept shape with a tail, which reads as an aeroplane at any size.
          ctx.moveTo(long, 0);
          ctx.lineTo(-long * 0.25, long * 0.30);
          ctx.lineTo(-long * 0.55, long * 0.85);
          ctx.lineTo(-long * 0.80, long * 0.85);
          ctx.lineTo(-long * 0.70, long * 0.22);
          ctx.lineTo(-long, 0);
          ctx.lineTo(-long * 0.70, -long * 0.22);
          ctx.lineTo(-long * 0.80, -long * 0.85);
          ctx.lineTo(-long * 0.55, -long * 0.85);
          ctx.lineTo(-long * 0.25, -long * 0.30);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(item.x - item.width / 2, item.y - item.height / 2, item.width, item.height);
      }
      ctx.restore();
    }

    if (this.over && this.overMessage) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.overMessage, this.width / 2, this.height / 2);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- sentences

export function installGame(rt, host = {}) {
  if (rt.libraries.has('game')) return rt.game;
  rt.libraries.add('game');

  const game = new Game(host);
  rt.game = game;

  // Anything that can be on screen: a flat Thing, or a Body from the 3D
  // world engine. Both know how to move and how to touch each other.
  const thingOf = (value, ctx) => {
    if (value instanceof Thing) return value;
    if (value && typeof value.touches === 'function' && typeof value.x === 'number') return value;
    ctx.fail(`I expected something on screen here, but got ${toText(value, 1)}`);
  };

  const inWorld = (value) => value && typeof value.z === 'number' && typeof value.turnY === 'number';

  // ------------------------------------------------------------- the window

  rt.define('start a game called $title sized $width by $height', (a) => {
    game.title = toText(a.title);
    game.width = toNumber(a.width);
    game.height = toNumber(a.height);
    game.started = true;
  });

  rt.define('start a game called $title', (a) => {
    game.title = toText(a.title);
    game.started = true;
  });

  rt.define('set the background to $color', (a) => { game.background = toText(a.color); });
  rt.define('set gravity to $amount', (a) => { game.gravity = toNumber(a.amount); });

  rt.defineValue('game width', () => game.width);
  rt.defineValue('game height', () => game.height);
  rt.defineValue('frame number', () => game.frame);
  rt.defineValue('game time', () => game.time);

  // ---------------------------------------------------------------- things

  const makeThing = (ctx, name, options) => {
    const thing = game.add(new Thing({ ...options, name }));
    if (thing.shape === 'picture' && host.document) {
      const image = new host.window.Image();
      image.src = thing.source;
      thing._image = image;
    }
    ctx.define(name, thing);
    return thing;
  };

  rt.define('make #name be a box at $x , $y sized $width by $height colored $color', (a, ctx) =>
    void makeThing(ctx, a.name, { shape: 'box', x: a.x, y: a.y, width: a.width, height: a.height, color: toText(a.color) }));

  rt.define('make #name be a box at $x , $y sized $width by $height', (a, ctx) =>
    void makeThing(ctx, a.name, { shape: 'box', x: a.x, y: a.y, width: a.width, height: a.height }));

  rt.define('make #name be a circle at $x , $y sized $size colored $color', (a, ctx) =>
    void makeThing(ctx, a.name, { shape: 'circle', x: a.x, y: a.y, width: a.size, height: a.size, color: toText(a.color) }));

  rt.define('make #name be a circle at $x , $y sized $size', (a, ctx) =>
    void makeThing(ctx, a.name, { shape: 'circle', x: a.x, y: a.y, width: a.size, height: a.size }));

  // Shapes with no artwork needed: star, heart, triangle, diamond, arrow, ring.
  for (const shape of ['star', 'heart', 'triangle', 'diamond', 'arrow', 'ring']) {
    const article = /^[aeiou]/.test(shape) ? 'an' : 'a';
    rt.define(`make #name be ${article} ${shape} at $x , $y sized $size colored $color`, (a, ctx) =>
      void makeThing(ctx, a.name, { shape, x: a.x, y: a.y, width: a.size, height: a.size, color: toText(a.color) }));
    rt.define(`make #name be ${article} ${shape} at $x , $y sized $width by $height colored $color`, (a, ctx) =>
      void makeThing(ctx, a.name, { shape, x: a.x, y: a.y, width: a.width, height: a.height, color: toText(a.color) }));
  }

  rt.define('make #name be a picture $source at $x , $y sized $width by $height', (a, ctx) =>
    void makeThing(ctx, a.name, { shape: 'picture', source: toText(a.source), x: a.x, y: a.y, width: a.width, height: a.height }));

  // A sprite sheet: one picture holding a grid of frames.
  rt.define('make #name be a sprite $source at $x , $y sized $width by $height with $columns by $rows frames', (a, ctx) =>
    void makeThing(ctx, a.name, {
      shape: 'picture', source: toText(a.source), x: a.x, y: a.y,
      width: a.width, height: a.height,
      columns: Math.max(1, Math.round(toNumber(a.columns))),
      rows: Math.max(1, Math.round(toNumber(a.rows)))
    }));

  rt.define('make #name be a sprite $source at $x , $y sized $width by $height with $columns frames', (a, ctx) =>
    void makeThing(ctx, a.name, {
      shape: 'picture', source: toText(a.source), x: a.x, y: a.y,
      width: a.width, height: a.height,
      columns: Math.max(1, Math.round(toNumber(a.columns))), rows: 1
    }));

  rt.define('set the frame of $thing to $number', (a, ctx) => {
    thingOf(a.thing, ctx).setPlainField('frame', a.number);
  });

  rt.define('animate $thing at $speed frames a second', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.firstFrame = 1;
    t.lastFrame = t.frameCount;
    t.framesASecond = Math.max(0, toNumber(a.speed));
    t.frameClock = 0;
  });

  rt.define('animate $thing from $first to $last at $speed frames a second', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.firstFrame = Math.max(1, Math.round(toNumber(a.first)));
    t.lastFrame = Math.min(t.frameCount, Math.round(toNumber(a.last)));
    if (t.frame < t.firstFrame || t.frame > t.lastFrame) t.frame = t.firstFrame;
    t.framesASecond = Math.max(0, toNumber(a.speed));
    t.frameClock = 0;
  });

  rt.define('stop animating $thing', (a, ctx) => { thingOf(a.thing, ctx).framesASecond = 0; });

  rt.defineValue('frame of $thing', (a, ctx) => thingOf(a.thing, ctx).frame);

  rt.define('make #name be words $text at $x , $y sized $size colored $color', (a, ctx) =>
    void makeThing(ctx, a.name, { shape: 'words', text: toText(a.text), x: a.x, y: a.y, width: toNumber(a.size) * 8, height: a.size, color: toText(a.color) }));

  rt.define('remove $thing from the game', (a, ctx) => { thingOf(a.thing, ctx).gone = true; });
  rt.define('hide $thing', (a, ctx) => { thingOf(a.thing, ctx).hidden = true; });
  rt.define('reveal $thing', (a, ctx) => { thingOf(a.thing, ctx).hidden = false; });

  // --------------------------------------------------------------- movement

  rt.define('move $thing by $dx , $dy', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.x += toNumber(a.dx);
    t.y += toNumber(a.dy);
  });

  rt.define('move $thing to $x , $y', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.x = toNumber(a.x);
    t.y = toNumber(a.y);
  });

  rt.define('move $thing #direction by $amount', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    if (inWorld(t) && game.moveBodyInDirection) {
      return game.moveBodyInDirection(t, a.direction, toNumber(a.amount), ctx);
    }
    const step = DIRECTIONS[String(a.direction).toLowerCase()];
    if (!step) ctx.fail(`"${a.direction}" is not a direction. Use left, right, up or down.`);
    t.x += step[0] * toNumber(a.amount);
    t.y += step[1] * toNumber(a.amount);
  });

  rt.define('set the speed of $thing to $dx , $dy', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.dx = toNumber(a.dx);
    t.dy = toNumber(a.dy);
  });

  rt.define('stop $thing moving', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.dx = 0; t.dy = 0;
  });

  rt.define('bounce $thing', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.dx = -t.dx; t.dy = -t.dy;
  });

  rt.define('bounce $thing sideways', (a, ctx) => { thingOf(a.thing, ctx).dx *= -1; });
  rt.define('bounce $thing upright', (a, ctx) => { thingOf(a.thing, ctx).dy *= -1; });

  rt.define('keep $thing on the screen', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.x = Math.min(Math.max(t.x, t.width / 2), game.width - t.width / 2);
    t.y = Math.min(Math.max(t.y, t.height / 2), game.height - t.height / 2);
  });

  rt.define('point $thing at $x , $y', (a, ctx) => {
    const t = thingOf(a.thing, ctx);
    t.angle = Math.atan2(toNumber(a.y) - t.y, toNumber(a.x) - t.x) * 180 / Math.PI;
  });

  // ----------------------------------------------------------------- events

  rt.define('every frame ...', (a, ctx) => { game.everyFrame.push(ctx.block); });

  rt.define('every $seconds seconds ...', (a, ctx) => {
    const every = Math.max(0.001, toNumber(a.seconds));
    game.timers.push({ every, next: game.time + every, run: ctx.block });
  });

  // The same clock, but it happens once. This is how a page waits: the rest
  // of the program carries on in the meantime.
  rt.define('after $seconds seconds ...', (a, ctx) => {
    const wait = Math.max(0, toNumber(a.seconds));
    game.timers.push({ every: wait, next: game.time + wait, run: ctx.block, once: true });
  });

  rt.define('when $one touches $other ...', (a, ctx) => {
    game.collisions.push({
      a: thingOf(a.one, ctx), b: thingOf(a.other, ctx), run: ctx.block, touching: false
    });
  });

  rt.define('when key $key is pressed ...', (a, ctx) => {
    game.keyPress.push({ key: toText(a.key).toLowerCase(), run: ctx.block });
  });

  rt.define('when any key is pressed ...', (a, ctx) => {
    game.keyPress.push({ key: 'any', run: ctx.block });
  });

  rt.define('when the mouse is clicked ...', (a, ctx) => { game.clicks.push({ run: ctx.block }); });

  rt.define('when $thing leaves the screen ...', (a, ctx) => {
    game.leaving.push({ thing: thingOf(a.thing, ctx), run: ctx.block, outside: false });
  });

  // ------------------------------------------------------------------ input

  rt.defineValue('key $key is held', (a) => game.keys.has(toText(a.key).toLowerCase()));
  rt.defineValue('mouse x', () => game.mouse.x);
  rt.defineValue('mouse y', () => game.mouse.y);
  rt.defineValue('mouse is down', () => game.mouse.down);

  rt.defineInfix('$one touches $other', (a) =>
    (a.one && typeof a.one.touches === 'function') ? a.one.touches(a.other) : false);

  rt.defineValue('distance from $one to $other', (a, ctx) =>
    thingOf(a.one, ctx).distanceTo(thingOf(a.other, ctx)));

  // ------------------------------------------------------ drawing right now

  rt.define('draw $text at $x , $y', (a) => {
    game.drawQueue.push({ kind: 'text', text: toText(a.text), x: toNumber(a.x), y: toNumber(a.y), size: 20, color: '#ffffff' });
  });

  rt.define('draw $text at $x , $y sized $size colored $color', (a) => {
    game.drawQueue.push({ kind: 'text', text: toText(a.text), x: toNumber(a.x), y: toNumber(a.y), size: toNumber(a.size), color: toText(a.color) });
  });

  rt.define('draw a box at $x , $y sized $width by $height colored $color', (a) => {
    game.drawQueue.push({ kind: 'box', x: toNumber(a.x), y: toNumber(a.y), width: toNumber(a.width), height: toNumber(a.height), color: toText(a.color) });
  });

  rt.define('draw a circle at $x , $y sized $size colored $color', (a) => {
    game.drawQueue.push({ kind: 'circle', x: toNumber(a.x), y: toNumber(a.y), size: toNumber(a.size), color: toText(a.color) });
  });

  // Anything with a front to it - an aeroplane, an arrow, a fish - has to be
  // drawn pointing somewhere. Without this the only shapes a game can draw
  // are ones that look the same whichever way round they are.
  const turned = (kind) => (a) => {
    game.drawQueue.push({
      kind, x: toNumber(a.x), y: toNumber(a.y),
      size: toNumber(a.size), angle: toNumber(a.degrees),
      color: toText(a.color)
    });
  };

  rt.define('draw a triangle at $x , $y sized $size turned $degrees colored $color', turned('triangle'));
  rt.define('draw an arrow at $x , $y sized $size turned $degrees colored $color', turned('arrow'));
  rt.define('draw a plane at $x , $y sized $size turned $degrees colored $color', turned('plane'));

  // ------------------------------------------------------------- ending it

  // Not "end the game": `end` closes a block, so it would be read as one.
  rt.define('stop the game saying $message', (a) => {
    game.over = true;
    game.overMessage = toText(a.message);
  });

  rt.define('stop the game', () => { game.over = true; });

  // A terminal program ends when its last line is read. This keeps the
  // clock running instead, so "every 2 seconds" goes on happening.
  rt.define('keep going', (a, ctx) => {
    if (!host.keepGoing) {
      ctx.fail(
        '"keep going" needs a terminal',
        'a page keeps going on its own, so it is not needed there'
      );
    }
    host.keepGoing(game);
  });

  rt.define('play a beep', () => beep(host, 440));
  rt.define('play a beep at $pitch', (a) => beep(host, toNumber(a.pitch)));

  // ------------------------------------------------------------- sound

  rt.define('play the sound $name', (a) => game.playSound(toText(a.name)));
  rt.define('play music $name', (a) => game.playMusic(toText(a.name)));
  rt.define('stop the music', () => game.stopMusic());
  rt.define('set the sound volume to $level', (a) => {
    game.volume = Math.min(1, Math.max(0, toNumber(a.level)));
    if (game.music) game.music.volume = game.volume;
  });

  return game;
}

function num(value, fallback) {
  const n = toNumber(value);
  return Number.isNaN(n) ? fallback : n;
}

// Shapes that make a game look like a game without needing any artwork.
// Each one is drawn inside a box of the thing's width and height.
const POLYGONS = {
  triangle: (w, h) => [[0, -h], [w, h], [-w, h]],
  diamond: (w, h) => [[0, -h], [w, 0], [0, h], [-w, 0]],
  star: (w, h) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const reach = i % 2 === 0 ? 1 : 0.42;
      points.push([Math.cos(angle) * w * reach, Math.sin(angle) * h * reach]);
    }
    return points;
  },
  heart: (w, h) => {
    const points = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      points.push([(x / 17) * w, (y / 17) * h]);
    }
    return points;
  },
  arrow: (w, h) => [[w, 0], [0.1 * w, h], [0.1 * w, 0.4 * h], [-w, 0.4 * h], [-w, -0.4 * h], [0.1 * w, -0.4 * h], [0.1 * w, -h]]
};

function drawPolygon(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], at) => (at === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function beep(host, frequency) {
  const w = host.window;
  if (!w || !(w.AudioContext || w.webkitAudioContext)) return;
  try {
    host._audio = host._audio || new (w.AudioContext || w.webkitAudioContext)();
    const audio = host._audio;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = frequency;
    osc.type = 'square';
    gain.gain.value = 0.05;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.08);
  } catch { /* sound is a nice-to-have */ }
}

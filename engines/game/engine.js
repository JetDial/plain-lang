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
    this.group = '';                       // which lot it belongs to, if any
    this.facing = 1;                       // 1 looks right, -1 looks left
    this.fade = 1;                         // 1 solid, 0 invisible
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
      case 'group': return this.group;
      case 'facing': return this.facing;
      case 'fade': return this.fade;
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
      case 'group': this.group = toText(value); return;
      case 'facing': this.facing = toNumber(value) < 0 ? -1 : 1; return;
      case 'fade': this.fade = Math.max(0, Math.min(1, toNumber(value))); return;
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
    this.pressed = '';                // the key that set the last press going
    // Where the view is looking, and how close it sits. Only drawing done
    // inside "seen through the view" is moved by it; everything else stays
    // where it is put, which is what a score in a corner wants.
    this.view = { x: 0, y: 0, zoom: 1, through: false };
    this.sparks = [];                 // little bits thrown out by an explosion
    this.slides = [];                 // things on their way somewhere
    this.lastStep = 1 / 60;           // how long the last frame took
    // A game is usually several games: a title screen, the playing, and the
    // bit at the end that says what happened. Each has its own things on
    // screen and its own rules, and they must not run at once.
    this.scene = '';                  // which one is showing; '' means "no scenes"
    this.writingScene = '';           // which one is being described right now
    this.sceneStarts = [];            // { scene, run }
    this.shake = { left: 0, strength: 0 };
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

  add(thing) {
    thing.scene = this.writingScene;
    this.things.push(thing);
    return thing;
  }

  // Does this belong to what is showing? Anything made outside a scene
  // belongs to all of them, which is what a score or a background is.
  showing(item) {
    const owner = item && item.scene;
    return !owner || owner === this.scene;
  }

  goToScene(name) {
    this.scene = String(name);
    for (const start of this.sceneStarts) {
      if (start.scene === this.scene) this.safely(start.run);
    }
  }

  // ------------------------------------------------------------- simulation

  // Sparks and slides move themselves, which is the point of them: you say
  // what should happen once and the engine keeps it happening.
  advanceExtras(seconds) {
    this.lastStep = seconds;
    if (this.shake.left > 0) this.shake.left = Math.max(0, this.shake.left - seconds);
    const living = [];
    for (const spark of this.sparks) {
      spark.life -= seconds;
      if (spark.life <= 0) continue;
      spark.x += spark.dx * seconds;
      spark.y += spark.dy * seconds;
      spark.dy += spark.pull * seconds;
      living.push(spark);
    }
    this.sparks = living;

    const going = [];
    for (const slide of this.slides) {
      slide.gone += seconds;
      const part = Math.min(1, slide.gone / slide.seconds);
      // Eased, because nothing in the world starts and stops at full speed.
      const eased = part < 0.5 ? 2 * part * part : 1 - Math.pow(-2 * part + 2, 2) / 2;
      slide.thing.x = slide.fromX + (slide.toX - slide.fromX) * eased;
      slide.thing.y = slide.fromY + (slide.toY - slide.fromY) * eased;
      if (part < 1) going.push(slide);
    }
    this.slides = going;
  }

  step(seconds = 1 / 60) {
    this.advanceExtras(seconds);
    if (this.over) return;
    this.frame++;
    this.time += seconds;
    this.drawQueue = [];

    for (const rule of this.everyFrame) {
      if (this.showing(rule)) this.safely(rule.run || rule);
    }

    for (const timer of this.timers) {
      // The small allowance keeps a "every 1 seconds" timer on the beat
      // instead of slipping a frame every time the clock lands just short.
      if (timer.done || !this.showing(timer)) continue;
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
      if (!this.showing(rule)) continue;
      if (rule.groups) {
        // Every one of this lot against every one of that lot. A pair that
        // is already touching does not fire again until it has come apart,
        // which is what makes "when a bullet hits a rock" happen once.
        rule.met = rule.met || new Set();
        const met = new Set();
        for (const one of this.things) {
          if (one.gone || one.hidden || one.group !== rule.groups[0]) continue;
          for (const other of this.things) {
            if (other === one || other.gone || other.hidden || other.group !== rule.groups[1]) continue;
            if (!one.touches(other)) continue;
            const pair = `${this.things.indexOf(one)}:${this.things.indexOf(other)}`;
            met.add(pair);
            if (rule.met.has(pair)) continue;
            this.touched = { one, other };
            this.safely(() => rule.run(one, other));
          }
        }
        rule.met = met;
        continue;
      }
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
    this.pressed = name;
    for (const rule of this.keyPress) {
      if (!this.showing(rule)) continue;
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
      if (!this.showing(thing)) continue;
      ctx.save();
      ctx.globalAlpha = thing.fade;
      ctx.translate(thing.x, thing.y);
      if (thing.angle) ctx.rotate(thing.angle * Math.PI / 180);
      if (thing.facing < 0) ctx.scale(-1, 1);
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

    // Sparks are drawn under the queue, so anything a program draws itself
    // sits on top of the mess.
    for (const spark of this.sparks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, spark.life / spark.born));
      ctx.fillStyle = spark.color;
      const where = this.view.through
        ? { x: (spark.x - this.view.x) * this.view.zoom + this.width / 2,
            y: (spark.y - this.view.y) * this.view.zoom + this.height / 2 }
        : { x: spark.x, y: spark.y };
      ctx.beginPath();
      ctx.arc(where.x, where.y, Math.max(0.5, spark.size / 2), 0, Math.PI * 2);
      ctx.fill();
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
      } else if (item.kind === 'arc') {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.thick;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size / 2,
                (item.from * Math.PI) / 180, (item.to * Math.PI) / 180);
        ctx.stroke();
      } else if (item.kind === 'line') {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.thick;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y);
        ctx.lineTo(item.tox, item.toy);
        ctx.stroke();
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
          // A swept wing with a tail behind it. Drawn down one side and back
          // up the other, so the two halves cannot drift apart.
          ctx.moveTo(long, 0);
          ctx.lineTo(-long * 0.20, long * 0.22);
          ctx.lineTo(-long * 0.35, long * 0.80);
          ctx.lineTo(-long * 0.60, long * 0.80);
          ctx.lineTo(-long * 0.55, long * 0.18);
          ctx.lineTo(-long * 0.85, long * 0.15);
          ctx.lineTo(-long, long * 0.42);
          ctx.lineTo(-long, -long * 0.42);
          ctx.lineTo(-long * 0.85, -long * 0.15);
          ctx.lineTo(-long * 0.55, -long * 0.18);
          ctx.lineTo(-long * 0.60, -long * 0.80);
          ctx.lineTo(-long * 0.35, -long * 0.80);
          ctx.lineTo(-long * 0.20, -long * 0.22);
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
  // A drawing of somebody walking right is a drawing of them walking left,
  // turned over. Every game with a person in it needs this and nothing else
  // in the engine could do it.
  rt.define('face $thing #where', (a, ctx) => {
    const thing = thingOf(a.thing, ctx);
    const which = String(a.where).toLowerCase();
    if (which === 'left') thing.facing = -1;
    else if (which === 'right') thing.facing = 1;
    else ctx.fail(`"${a.where}" is not a way to face`, 'use left or right');
  });

  rt.define('turn $thing over', (a, ctx) => {
    const thing = thingOf(a.thing, ctx);
    thing.facing = thing.facing < 0 ? 1 : -1;
  });

  // How solid something is, which is how anything fades in, fades out, or
  // flickers while it cannot be hurt.
  rt.define('set the fade of $thing to $amount', (a, ctx) => {
    thingOf(a.thing, ctx).fade = Math.max(0, Math.min(1, toNumber(a.amount)));
  });

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

  rt.define('every frame ...', (a, ctx) => {
    game.everyFrame.push({ run: ctx.block, scene: game.writingScene });
  });

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

  // ------------------------------------------------------------- groups
  //
  // A game with forty bullets and thirty rocks cannot name every pair. It
  // has two lots of things and one rule about what happens when one lot
  // meets the other, which is what every engine calls layers.
  //
  //     put bullet in the group "shots"
  //     put rock in the group "rocks"
  //
  //     when anything in "shots" touches anything in "rocks"
  //         remove the one that touched from the game
  //         remove the other one from the game
  //     end
  rt.define('put $thing in the group $name', (a, ctx) => {
    thingOf(a.thing, ctx).group = toText(a.name);
  });

  rt.define('when anything in $one touches anything in $other ...', (a, ctx) => {
    game.collisions.push({
      groups: [toText(a.one), toText(a.other)], run: ctx.block, scene: game.writingScene
    });
  });

  rt.defineValue('the one that touched', () => (game.touched ? game.touched.one : null));
  rt.defineValue('the other one', () => (game.touched ? game.touched.other : null));

  rt.define('when $one touches $other ...', (a, ctx) => {
    game.collisions.push({
      a: thingOf(a.one, ctx), b: thingOf(a.other, ctx), run: ctx.block, touching: false
    });
  });

  rt.define('when key $key is pressed ...', (a, ctx) => {
    game.keyPress.push({ key: toText(a.key).toLowerCase(), run: ctx.block, scene: game.writingScene });
  });

  rt.define('when any key is pressed ...', (a, ctx) => {
    game.keyPress.push({ key: 'any', run: ctx.block, scene: game.writingScene });
  });

  rt.define('when the mouse is clicked ...', (a, ctx) => {
    game.clicks.push({ run: ctx.block, scene: game.writingScene });
  });

  rt.define('when $thing leaves the screen ...', (a, ctx) => {
    game.leaving.push({ thing: thingOf(a.thing, ctx), run: ctx.block, outside: false });
  });

  // ------------------------------------------------------------------ input

  rt.defineValue('key $key is held', (a) => game.keys.has(toText(a.key).toLowerCase()));

  // "when any key is pressed" can tell you that something happened but not
  // what, which is no use at all if a person is trying to type. This is the
  // key that set it going: one letter for a letter, and a name like "enter",
  // "backspace" or "left" for the ones that have no letter.
  rt.defineValue('the key pressed', () => game.pressed);
  rt.defineValue('mouse x', () => game.mouse.x);
  rt.defineValue('mouse y', () => game.mouse.y);
  rt.defineValue('mouse is down', () => game.mouse.down);

  rt.defineInfix('$one touches $other', (a) =>
    (a.one && typeof a.one.touches === 'function') ? a.one.touches(a.other) : false);

  rt.defineValue('distance from $one to $other', (a, ctx) =>
    thingOf(a.one, ctx).distanceTo(thingOf(a.other, ctx)));

  // ------------------------------------------------------ drawing right now

  rt.define('draw $text at $x , $y', (a) => {
    { const at = seen(a.x, a.y);
      game.drawQueue.push({ kind: 'text', text: toText(a.text), x: at.x, y: at.y, size: scaled(20), color: '#ffffff' }); }
  });

  rt.define('draw $text at $x , $y sized $size colored $color', (a) => {
    { const at = seen(a.x, a.y);
      game.drawQueue.push({ kind: 'text', text: toText(a.text), x: at.x, y: at.y, size: scaled(a.size), color: toText(a.color) }); }
  });

  // --------------------------------------------------------------- the view
  //
  // A game bigger than its window needs to decide which part of it you are
  // looking at, and every one of them ends up writing the same sum:
  //
  //     (x minus camx) times zoom plus half the width
  //
  // once for every single thing it draws. Get it wrong in one place and one
  // kind of thing sits still while the rest of the world slides past it.
  //
  // So it is written once, here. Point the view somewhere, and anything
  // drawn inside "seen through the view" is drawn where it belongs in the
  // world. Anything drawn outside it is drawn on the screen, which is where
  // a score, a health bar and a menu want to be.

  const jolt = () => {
    if (game.shake.left <= 0) return { x: 0, y: 0 };
    // Hardest at the moment it happens and gone by the end, which is what
    // makes it read as an impact rather than a wobble.
    const much = game.shake.strength * (game.shake.left / game.shake.born);
    return { x: (Math.random() * 2 - 1) * much, y: (Math.random() * 2 - 1) * much };
  };

  const seen = (x, y) => {
    const off = jolt();
    return game.view.through
      ? { x: (toNumber(x) - game.view.x) * game.view.zoom + game.width / 2 + off.x,
          y: (toNumber(y) - game.view.y) * game.view.zoom + game.height / 2 + off.y }
      : { x: toNumber(x) + off.x, y: toNumber(y) + off.y };
  };

  const scaled = (n) => (game.view.through ? toNumber(n) * game.view.zoom : toNumber(n));

  // The whole picture knocked sideways for a moment. Every game that has
  // ever had an explosion in it has this, and it is the cheapest way to
  // make something feel heavy.
  rt.define('shake the view by $strength for $seconds seconds', (a) => {
    game.shake.strength = Math.max(0, toNumber(a.strength));
    game.shake.left = Math.max(0, toNumber(a.seconds));
    game.shake.born = Math.max(0.001, game.shake.left);
  });

  rt.define('shake the view', () => {
    game.shake.strength = 8;
    game.shake.left = 0.35;
    game.shake.born = 0.35;
  });

  rt.defineValue('the view is shaking', () => game.shake.left > 0);

  rt.define('point the view at $x , $y', (a) => {
    game.view.x = toNumber(a.x);
    game.view.y = toNumber(a.y);
  });

  rt.define('zoom the view to $amount', (a) => {
    game.view.zoom = Math.max(0.01, toNumber(a.amount));
  });

  rt.define('seen through the view ...', (a, ctx) => {
    const before = game.view.through;
    game.view.through = true;
    try { ctx.block(); } finally { game.view.through = before; }
  });

  rt.defineValue('view x', () => game.view.x);
  rt.defineValue('view y', () => game.view.y);
  rt.defineValue('view zoom', () => game.view.zoom);

  // Which part of the world is on the screen at all. Anything outside this
  // does not need drawing, and in a big world that is most of it.
  rt.defineValue('view left', () => game.view.x - (game.width / 2) / game.view.zoom);
  rt.defineValue('view right', () => game.view.x + (game.width / 2) / game.view.zoom);
  rt.defineValue('view top', () => game.view.y - (game.height / 2) / game.view.zoom);
  rt.defineValue('view bottom', () => game.view.y + (game.height / 2) / game.view.zoom);

  // A curved line - part of a circle round a point. Health and energy read
  // around the thing they belong to rather than in a corner, so a player's
  // eyes never leave the fight to find out how they are doing.
  rt.define('draw an arc at $x , $y sized $size from $from to $to thick $thick colored $color', (a) => {
    const at = seen(a.x, a.y);
    game.drawQueue.push({
      kind: 'arc', x: at.x, y: at.y, size: scaled(a.size),
      from: toNumber(a.from), to: toNumber(a.to),
      thick: Math.max(0.5, scaled(a.thick)), color: toText(a.color)
    });
  });

  // A straight line, which every other drawing tool has and this did not.
  rt.define('draw a line from $x , $y to $tox , $toy thick $thick colored $color', (a) => {
    const from = seen(a.x, a.y), to = seen(a.tox, a.toy);
    game.drawQueue.push({
      kind: 'line', x: from.x, y: from.y, tox: to.x, toy: to.y,
      thick: Math.max(0.2, scaled(a.thick)), color: toText(a.color)
    });
  });

  // Text placed by its middle rather than its left edge. Centring anything
  // without this means measuring the letters yourself, which nobody should
  // have to do to put a title on a screen.
  rt.define('draw $text centred at $x , $y sized $size colored $color', (a) => {
    const at = seen(a.x, a.y);
    game.drawQueue.push({
      kind: 'text', text: toText(a.text), x: at.x, y: at.y,
      size: scaled(a.size), color: toText(a.color), align: 'center'
    });
  });

  rt.define('draw a box at $x , $y sized $width by $height colored $color', (a) => {
    { const at = seen(a.x, a.y);
      game.drawQueue.push({ kind: 'box', x: at.x, y: at.y, width: scaled(a.width), height: scaled(a.height), color: toText(a.color) }); }
  });

  rt.define('draw a circle at $x , $y sized $size colored $color', (a) => {
    { const at = seen(a.x, a.y);
      game.drawQueue.push({ kind: 'circle', x: at.x, y: at.y, size: scaled(a.size), color: toText(a.color) }); }
  });

  // Anything with a front to it - an aeroplane, an arrow, a fish - has to be
  // drawn pointing somewhere. Without this the only shapes a game can draw
  // are ones that look the same whichever way round they are.
  const turned = (kind) => (a) => {
    const at = seen(a.x, a.y);
    game.drawQueue.push({
      kind, x: at.x, y: at.y,
      size: scaled(a.size), angle: toNumber(a.degrees),
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

  // Sounds a game actually needs, none of which are a beep.
  //
  // A game with no sound files should still be able to make a noise. A beep
  // is a pure tone, and nothing in the world is a pure tone: an explosion is
  // a rush of noise that dies away, a missile is noise that slides downwards,
  // a pickup is a short rise. All three are noise shaped by hand, which
  // takes no files, no downloads and no permission.
  // ---------------------------------------------------------------- scenes
  //
  // A game is nearly always several games. A title screen, the playing, and
  // the bit at the end that says what happened - each with its own things on
  // the screen and its own rules, and none of them allowed to run while
  // another is showing.
  //
  // Without a word for this, a program ends up with "if the state is
  // playing" wrapped round every single block, which is both hard to read
  // and easy to get wrong in one place.
  //
  //     scene "title"
  //         make words be words "PRESS SPACE" at 400 , 300 sized 40 colored "#fff"
  //         when key "space" is pressed
  //             go to scene "playing"
  //         end
  //     end
  //
  // Anything made or said inside a scene belongs to it: its things are
  // drawn only while it is showing, and its blocks run only then. Anything
  // outside every scene belongs to all of them, which is what a score, a
  // background and a piece of music are.
  rt.define('scene $name ...', (a, ctx) => {
    const before = game.writingScene;
    game.writingScene = toText(a.name);
    try { ctx.block(); } finally { game.writingScene = before; }
    // The first scene described is the one that shows, unless the program
    // says otherwise - so a game with scenes is never staring at nothing.
    if (!game.scene) game.scene = toText(a.name);
  });

  rt.define('go to scene $name', (a) => { game.goToScene(toText(a.name)); });

  rt.define('when scene $name starts ...', (a, ctx) => {
    game.sceneStarts.push({ scene: toText(a.name), run: ctx.block });
  });

  rt.defineValue('the scene now', () => game.scene);
  rt.defineValue('showing scene $name', (a) => game.scene === toText(a.name));

  // ------------------------------------------------------------ bits and easing
  //
  // Two things every game engine has and this did not. Neither is hard; both
  // are the difference between a game that works and a game that feels made.
  //
  // A burst is a handful of bits thrown out from a point, which is what an
  // explosion, a splash, a puff of dust and a shower of sparks all are. They
  // move themselves and fade out, so a program says it once.
  rt.define('make a burst at $x , $y colored $color', (a) => {
    burst(game, toNumber(a.x), toNumber(a.y), toText(a.color), 18, 220, 0.6);
  });

  rt.define('make a burst of $many at $x , $y colored $color', (a) => {
    burst(game, toNumber(a.x), toNumber(a.y), toText(a.color), Math.round(toNumber(a.many)), 220, 0.6);
  });

  rt.define('make a slow burst of $many at $x , $y colored $color', (a) => {
    burst(game, toNumber(a.x), toNumber(a.y), toText(a.color), Math.round(toNumber(a.many)), 70, 1.6);
  });

  rt.defineValue('bits still flying', () => game.sparks.length);

  // Sliding something somewhere over time, eased at both ends, because
  // nothing in the world starts and stops at full speed. Written once, and
  // then it happens on its own.
  rt.define('slide $thing to $x , $y over $seconds seconds', (a, ctx) => {
    const thing = thingOf(a.thing, ctx);
    game.slides = game.slides.filter(one => one.thing !== thing);
    game.slides.push({
      thing, fromX: thing.x, fromY: thing.y,
      toX: toNumber(a.x), toY: toNumber(a.y),
      seconds: Math.max(0.001, toNumber(a.seconds)), gone: 0
    });
  });

  rt.defineInfix('$thing is still sliding', (a, ctx) => {
    const thing = thingOf(a.thing, ctx);
    return game.slides.some(one => one.thing === thing);
  });

  // How long the last frame actually took. A game that moves things by a
  // fixed amount each frame runs at a different speed on a different
  // machine; one that multiplies by this does not.
  rt.defineValue('seconds since the last frame', () => game.lastStep);

  rt.define('play a bang', () => noise(host, { seconds: 0.45, from: 900, to: 60, level: 0.35 }));
  rt.define('play a thud', () => noise(host, { seconds: 0.18, from: 400, to: 40, level: 0.3 }));
  rt.define('play a whoosh', () => noise(host, { seconds: 0.25, from: 1800, to: 300, level: 0.12 }));
  rt.define('play a blip at $pitch', (a) => tone(host, toNumber(a.pitch), 0.08, 0.14));
  rt.define('play a rising note', () => tone(host, 420, 0.16, 0.16, 900));
  rt.define('play a falling note', () => tone(host, 700, 0.22, 0.16, 180));

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

// Noise, filtered so it slides from one pitch to another while it fades.
// That shape - loud, bright, then gone - is what the ear reads as a bang.
function noise(host, { seconds, from, to, level }) {
  const w = host.window;
  if (!w || !(w.AudioContext || w.webkitAudioContext)) return;
  try {
    host._audio = host._audio || new (w.AudioContext || w.webkitAudioContext)();
    const audio = host._audio;
    const frames = Math.floor(audio.sampleRate * seconds);
    const store = audio.createBuffer(1, frames, audio.sampleRate);
    const at = store.getChannelData(0);
    for (let n = 0; n < frames; n++) at[n] = Math.random() * 2 - 1;

    const voice = audio.createBufferSource();
    voice.buffer = store;
    const sieve = audio.createBiquadFilter();
    sieve.type = 'lowpass';
    sieve.frequency.setValueAtTime(from, audio.currentTime);
    sieve.frequency.exponentialRampToValueAtTime(Math.max(20, to), audio.currentTime + seconds);
    const loud = audio.createGain();
    loud.gain.setValueAtTime(level, audio.currentTime);
    loud.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
    voice.connect(sieve).connect(loud).connect(audio.destination);
    voice.start();
  } catch { /* sound is a nice-to-have */ }
}

// A note, optionally sliding to another pitch on the way out.
function tone(host, pitch, seconds, level, slideTo) {
  const w = host.window;
  if (!w || !(w.AudioContext || w.webkitAudioContext)) return;
  try {
    host._audio = host._audio || new (w.AudioContext || w.webkitAudioContext)();
    const audio = host._audio;
    const osc = audio.createOscillator();
    const loud = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, audio.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audio.currentTime + seconds);
    loud.gain.setValueAtTime(level, audio.currentTime);
    loud.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
    osc.connect(loud).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + seconds);
  } catch { /* sound is a nice-to-have */ }
}

// A handful of bits thrown out from a point, each with its own direction,
// speed and lifetime, so they never look like a pattern.
function burst(game, x, y, color, many, speed, life) {
  for (let n = 0; n < many; n++) {
    const way = Math.random() * Math.PI * 2;
    const fast = speed * (0.35 + Math.random() * 0.65);
    const born = life * (0.5 + Math.random() * 0.8);
    game.sparks.push({
      x, y, color,
      dx: Math.cos(way) * fast,
      dy: Math.sin(way) * fast,
      pull: speed * 0.35,
      size: 2 + Math.random() * 4,
      life: born, born
    });
  }
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

// Plain - the 3D world engine.
//
//     start a world called "Space" sized 900 by 600
//     make ground be a floor at 0 , 0 , 0 sized 40 by 40 colored "#2f7d4f"
//     make hero be a cube at 0 , 1 , 0 sized 1 colored "#ffd166"
//     follow hero with the camera
//
//     every frame
//         if key "w" is held
//             move hero forward by 0.2
//         end
//     end
//
// It shares the game engine's clock, keys and HUD drawing, so a 3D program
// and a 2D program are written the same way. Rendering is WebGL in the
// browser; in Node the whole world still runs, it just is not drawn.

import { toText, toNumber, truthy } from '../../src/values.js';
import { installGame } from '../game/engine.js';

const DIRECTIONS = {
  forward: [0, 0, -1], back: [0, 0, 1], backward: [0, 0, 1],
  left: [-1, 0, 0], right: [1, 0, 0],
  up: [0, 1, 0], down: [0, -1, 0]
};

export class Body {
  constructor(options = {}) {
    this.name = options.name || 'body';
    this.shape = options.shape || 'cube';   // cube | ball | floor | post | cone
    this.x = num(options.x, 0);
    this.y = num(options.y, 0);
    this.z = num(options.z, 0);
    this.width = num(options.width, 1);
    this.height = num(options.height, 1);
    this.depth = num(options.depth, 1);
    this.color = options.color ?? '#cccccc';
    this.dx = 0; this.dy = 0; this.dz = 0;
    this.turnX = 0; this.turnY = 0; this.turnZ = 0;
    this.hidden = false;
    this.gone = false;
    this.heavy = true;                      // does world gravity pull on it
    this.data = {};
  }

  get left() { return this.x - this.width / 2; }
  get right() { return this.x + this.width / 2; }
  get bottom() { return this.y - this.height / 2; }
  get top() { return this.y + this.height / 2; }
  get near() { return this.z - this.depth / 2; }
  get far() { return this.z + this.depth / 2; }

  touches(other) {
    if (!other || this.gone || other.gone || this.hidden || other.hidden) return false;
    if (typeof other.near !== 'number') return false;  // a flat thing, not a body
    return this.left < other.right && this.right > other.left &&
           this.bottom < other.top && this.top > other.bottom &&
           this.near < other.far && this.far > other.near;
  }

  distanceTo(other) {
    return Math.hypot(this.x - other.x, this.y - other.y, this.z - (other.z ?? 0));
  }

  getPlainField(name) {
    const key = String(name).toLowerCase();
    switch (key) {
      case 'x': case 'y': case 'z': case 'width': case 'height': case 'depth':
      case 'color': case 'dx': case 'dy': case 'dz': case 'name':
        return this[key];
      case 'size': return Math.max(this.width, this.height, this.depth);
      case 'turn': case 'facing': return this.turnY;
      case 'top': return this.top;
      case 'bottom': return this.bottom;
      case 'speed': return Math.hypot(this.dx, this.dy, this.dz);
      case 'hidden': return this.hidden;
      case 'visible': return !this.hidden;
      case 'heavy': return this.heavy;
      case 'gone': return this.gone;
    }
    if (key in this.data) return this.data[key];
    return undefined;
  }

  setPlainField(name, value) {
    const key = String(name).toLowerCase();
    switch (key) {
      case 'x': case 'y': case 'z': case 'width': case 'height': case 'depth':
      case 'dx': case 'dy': case 'dz':
        this[key] = toNumber(value); return;
      case 'size':
        this.width = this.height = this.depth = toNumber(value); return;
      case 'turn': case 'facing': this.turnY = toNumber(value); return;
      case 'color': this.color = toText(value); return;
      case 'hidden': this.hidden = truthy(value); return;
      case 'visible': this.hidden = !truthy(value); return;
      case 'heavy': this.heavy = truthy(value); return;
    }
    this.data[key] = value;
  }

  toPlainText() {
    return `<${this.shape} ${this.name} at ${round(this.x)}, ${round(this.y)}, ${round(this.z)}>`;
  }
}

// A colour said as words or as a # number, turned into three numbers from
// nought to one, which is the only thing a shader understands.
function colourOf(said) {
  const named = {
    white: '#ffffff', black: '#000000', red: '#ff0000', green: '#00ff00',
    blue: '#0000ff', yellow: '#ffe066', orange: '#ff8c42', warm: '#ffd7a8',
    cold: '#a8d7ff', grey: '#888888', gray: '#888888'
  };
  let text = String(said == null ? '' : said).trim().toLowerCase();
  if (named[text]) text = named[text];
  if (text.length === 4 && text[0] === '#') {
    text = '#' + text[1] + text[1] + text[2] + text[2] + text[3] + text[3];
  }
  if (!/^#[0-9a-f]{6}$/.test(text)) return { r: 1, g: 1, b: 1 };
  return {
    r: parseInt(text.slice(1, 3), 16) / 255,
    g: parseInt(text.slice(3, 5), 16) / 255,
    b: parseInt(text.slice(5, 7), 16) / 255
  };
}

export class World {
  constructor() {
    this.started = false;
    this.sky = '#0b1020';
    this.gravity = 0;
    this.ground = null;          // y level that stops falling, or null
    this.bodies = [];
    this.camera = { x: 0, y: 6, z: 12, atX: 0, atY: 0, atZ: 0, follow: null, distance: 12, height: 6 };
    this.light = { x: 0.4, y: 1, z: 0.6 };
    this.lightColor = { r: 1, g: 1, b: 1 };
    // How much of a thing is lit when the sun is not on it. Nought is a
    // world with black shadows; one is a world with no shadows at all.
    this.ambient = 0.42;
    this.lamp = null;                 // one lamp: a place rather than a way
    this.fog = 0.75;                  // how much distance fades into the sky
  }

  add(body) { this.bodies.push(body); return body; }

  step() {
    for (const body of this.bodies) {
      if (body.gone) continue;
      if (body.heavy) body.dy -= this.gravity;
      body.x += body.dx;
      body.y += body.dy;
      body.z += body.dz;
      if (this.ground !== null && body.heavy && body.bottom < this.ground) {
        body.y = this.ground + body.height / 2;
        if (body.dy < 0) body.dy = 0;
      }
    }
    this.bodies = this.bodies.filter(body => !body.gone);

    const follow = this.camera.follow;
    if (follow && !follow.gone) {
      const angle = follow.turnY * Math.PI / 180;
      this.camera.x = follow.x + Math.sin(angle) * this.camera.distance;
      this.camera.z = follow.z + Math.cos(angle) * this.camera.distance;
      this.camera.y = follow.y + this.camera.height;
      this.camera.atX = follow.x;
      this.camera.atY = follow.y;
      this.camera.atZ = follow.z;
    }
  }
}

// --------------------------------------------------------------- sentences

export function installWorld(rt, host = {}) {
  if (rt.libraries.has('world')) return rt.world;
  // The world borrows the game engine's clock, keys, timers and HUD.
  const game = rt.game || installGame(rt, host);
  rt.libraries.add('world');

  const world = new World();
  rt.world = world;
  game.world = world;

  const bodyOf = (value, ctx) => {
    if (value instanceof Body) return value;
    ctx.fail(`I expected something from the world here, but got ${toText(value, 1)}`);
  };

  const make = (ctx, name, options) => {
    const body = world.add(new Body({ ...options, name }));
    ctx.define(name, body);
    return body;
  };

  rt.define('start a world called $title sized $width by $height', (a) => {
    game.title = toText(a.title);
    game.width = toNumber(a.width);
    game.height = toNumber(a.height);
    game.started = true;
    world.started = true;
  });

  rt.define('start a world called $title', (a) => {
    game.title = toText(a.title);
    game.started = true;
    world.started = true;
  });

  rt.define('set the sky to $color', (a) => { world.sky = toText(a.color); });
  rt.define('set world gravity to $amount', (a) => {
    world.gravity = toNumber(a.amount);
    if (world.ground === null) world.ground = 0;
  });
  rt.define('set the ground level to $level', (a) => { world.ground = toNumber(a.level); });
  // ------------------------------------------------------------- lighting
  //
  // One directional light was enough to see a world and not enough to make
  // one. These are the three that every 3D program reaches for next: how
  // dark the shadows are, what colour the sun is, and a lamp - a light with
  // a place, which falls off as you walk away from it and lights the side
  // of a thing that faces it.

  rt.define('set the shadows to $amount', (a) => {
    // Said the way a person thinks about it: more shadow, less ambient.
    world.ambient = Math.max(0, Math.min(1, 1 - toNumber(a.amount)));
  });

  rt.define('set the light colour to $color', (a) => { world.lightColor = colourOf(a.color); });
  rt.define('set the light color to $color', (a) => { world.lightColor = colourOf(a.color); });

  rt.define('put a lamp at $x , $y , $z reaching $reach colored $color', (a) => {
    const shade = colourOf(a.color);
    world.lamp = {
      x: toNumber(a.x), y: toNumber(a.y), z: toNumber(a.z),
      reach: Math.max(0.01, toNumber(a.reach)),
      r: shade.r, g: shade.g, b: shade.b
    };
  });

  rt.define('move the lamp to $x , $y , $z', (a, ctx) => {
    if (!world.lamp) ctx.fail('There is no lamp yet', 'put one somewhere first');
    world.lamp.x = toNumber(a.x);
    world.lamp.y = toNumber(a.y);
    world.lamp.z = toNumber(a.z);
  });

  rt.define('take the lamp away', () => { world.lamp = null; });

  // How much of the distance disappears into the sky. Fog is the cheapest
  // way to make a world feel large, because it stops the far edge of it
  // looking like an edge.
  rt.define('set the haze to $amount', (a) => {
    world.fog = Math.max(0, Math.min(1, toNumber(a.amount)));
  });

  rt.define('set the light to $x , $y , $z', (a) => {
    world.light = { x: toNumber(a.x), y: toNumber(a.y), z: toNumber(a.z) };
  });

  // ------------------------------------------------------------- shapes

  rt.define('make #name be a cube at $x , $y , $z sized $size colored $color', (a, ctx) =>
    void make(ctx, a.name, { shape: 'cube', x: a.x, y: a.y, z: a.z, width: a.size, height: a.size, depth: a.size, color: toText(a.color) }));

  rt.define('make #name be a block at $x , $y , $z sized $width by $height by $depth colored $color', (a, ctx) =>
    void make(ctx, a.name, { shape: 'cube', x: a.x, y: a.y, z: a.z, width: a.width, height: a.height, depth: a.depth, color: toText(a.color) }));

  rt.define('make #name be a ball at $x , $y , $z sized $size colored $color', (a, ctx) =>
    void make(ctx, a.name, { shape: 'ball', x: a.x, y: a.y, z: a.z, width: a.size, height: a.size, depth: a.size, color: toText(a.color) }));

  rt.define('make #name be a floor at $x , $y , $z sized $width by $depth colored $color', (a, ctx) =>
    void Object.assign(make(ctx, a.name, { shape: 'floor', x: a.x, y: a.y, z: a.z, width: a.width, height: 0.2, depth: a.depth, color: toText(a.color) }), { heavy: false }));

  rt.define('make #name be a post at $x , $y , $z sized $size by $height colored $color', (a, ctx) =>
    void make(ctx, a.name, { shape: 'post', x: a.x, y: a.y, z: a.z, width: a.size, height: a.height, depth: a.size, color: toText(a.color) }));

  rt.define('make #name be a cone at $x , $y , $z sized $size by $height colored $color', (a, ctx) =>
    void make(ctx, a.name, { shape: 'cone', x: a.x, y: a.y, z: a.z, width: a.size, height: a.height, depth: a.size, color: toText(a.color) }));

  rt.define('remove $body from the world', (a, ctx) => { bodyOf(a.body, ctx).gone = true; });
  rt.define('let $body float', (a, ctx) => { bodyOf(a.body, ctx).heavy = false; });
  rt.define('let $body fall', (a, ctx) => { bodyOf(a.body, ctx).heavy = true; });

  // ----------------------------------------------------------- movement

  rt.define('move $body by $dx , $dy , $dz', (a, ctx) => {
    const body = bodyOf(a.body, ctx);
    body.x += toNumber(a.dx); body.y += toNumber(a.dy); body.z += toNumber(a.dz);
  });

  rt.define('move $body to $x , $y , $z', (a, ctx) => {
    const body = bodyOf(a.body, ctx);
    body.x = toNumber(a.x); body.y = toNumber(a.y); body.z = toNumber(a.z);
  });

  // "move x forward by 1" is registered once, by the game engine, and sent
  // here whenever the thing being moved lives in the world.
  game.moveBodyInDirection = (body, direction, amount, ctx) => {
    const step = DIRECTIONS[String(direction).toLowerCase()];
    if (!step) ctx.fail(`"${direction}" is not a direction. Use forward, back, left, right, up or down.`);
    // The same turn the renderer applies, so what you see is where you go.
    const angle = body.turnY * Math.PI / 180;
    const sin = Math.sin(angle), cos = Math.cos(angle);
    body.x += (step[0] * cos + step[2] * sin) * amount;
    body.z += (-step[0] * sin + step[2] * cos) * amount;
    body.y += step[1] * amount;
  };

  rt.define('turn $body #direction by $degrees', (a, ctx) => {
    const body = bodyOf(a.body, ctx);
    const which = String(a.direction).toLowerCase();
    const degrees = toNumber(a.degrees);
    if (which === 'left') body.turnY += degrees;
    else if (which === 'right') body.turnY -= degrees;
    else if (which === 'up') body.turnX += degrees;
    else if (which === 'down') body.turnX -= degrees;
    else if (which === 'over') body.turnZ += degrees;
    else ctx.fail(`"${a.direction}" is not a way to turn. Use left, right, up, down or over.`);
  });

  rt.define('set the speed of $body to $dx , $dy , $dz', (a, ctx) => {
    const body = bodyOf(a.body, ctx);
    body.dx = toNumber(a.dx); body.dy = toNumber(a.dy); body.dz = toNumber(a.dz);
  });

  rt.define('push $body up by $amount', (a, ctx) => { bodyOf(a.body, ctx).dy += toNumber(a.amount); });
  rt.define('stop $body still', (a, ctx) => {
    const body = bodyOf(a.body, ctx);
    body.dx = 0; body.dy = 0; body.dz = 0;
  });

  // ------------------------------------------------------------- camera

  rt.define('move the camera to $x , $y , $z', (a) => {
    world.camera.follow = null;
    world.camera.x = toNumber(a.x);
    world.camera.y = toNumber(a.y);
    world.camera.z = toNumber(a.z);
  });

  rt.define('point the camera at $body', (a, ctx) => {
    const body = bodyOf(a.body, ctx);
    world.camera.atX = body.x; world.camera.atY = body.y; world.camera.atZ = body.z;
  });

  rt.define('point the camera at $x , $y , $z', (a) => {
    world.camera.atX = toNumber(a.x);
    world.camera.atY = toNumber(a.y);
    world.camera.atZ = toNumber(a.z);
  });

  rt.define('follow $body with the camera', (a, ctx) => {
    world.camera.follow = bodyOf(a.body, ctx);
  });

  rt.define('set the camera distance to $distance', (a) => { world.camera.distance = toNumber(a.distance); });
  rt.define('set the camera height to $height', (a) => { world.camera.height = toNumber(a.height); });

  // ------------------------------------------------------------ asking

  rt.defineValue('ground level', () => world.ground ?? 0);
  // --------------------------------------------------------------- picking
  //
  // "What is under the mouse" is the question a 3D program cannot answer
  // without it, and it is the one every editor, every strategy game and
  // every point-and-click needs. The answer is a line drawn out of the
  // camera through the point on the screen, and whichever body it meets
  // first.
  const bodyUnder = (screenX, screenY) => {
    const width = game.width || 800, height = game.height || 600;
    // Where the camera is, and which way it faces.
    const eye = world.camera;
    const at = eye.follow
      ? { x: eye.follow.x, y: eye.follow.y, z: eye.follow.z }
      : (eye.at || { x: 0, y: 0, z: 0 });
    const from = { x: eye.x, y: eye.y, z: eye.z };
    const ahead = norm({ x: at.x - from.x, y: at.y - from.y, z: at.z - from.z });
    const right = norm(cross(ahead, { x: 0, y: 1, z: 0 }));
    const up = cross(right, ahead);

    // A point on the screen, turned into a direction out of the camera.
    const across = (screenX / width) * 2 - 1;
    const down = 1 - (screenY / height) * 2;
    const spread = Math.tan((60 * Math.PI / 180) / 2);
    const wide = (width / height) * spread;
    const way = norm({
      x: ahead.x + right.x * across * wide + up.x * down * spread,
      y: ahead.y + right.y * across * wide + up.y * down * spread,
      z: ahead.z + right.z * across * wide + up.z * down * spread
    });

    // Whichever body that line meets first, treating each as a ball around
    // its middle - near enough for picking, and it needs no mesh maths.
    let best = null, nearest = Infinity;
    for (const body of world.bodies) {
      if (body.gone || body.hidden) continue;
      const size = Math.max(body.width || 1, body.height || 1, body.depth || 1) / 2;
      const towards = { x: body.x - from.x, y: body.y - from.y, z: body.z - from.z };
      const along = towards.x * way.x + towards.y * way.y + towards.z * way.z;
      if (along <= 0) continue;
      const missX = towards.x - way.x * along;
      const missY = towards.y - way.y * along;
      const missZ = towards.z - way.z * along;
      const miss = Math.sqrt(missX * missX + missY * missY + missZ * missZ);
      if (miss > size) continue;
      if (along < nearest) { nearest = along; best = body; }
    }
    return best;
  };

  const norm = (v) => {
    const long = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / long, y: v.y / long, z: v.z / long };
  };
  const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });

  rt.defineValue('what is under the mouse', () => bodyUnder(game.mouse.x, game.mouse.y));
  rt.defineValue('what is at $x , $y on the screen', (a) => bodyUnder(toNumber(a.x), toNumber(a.y)));
  rt.defineValue('what the camera is looking at', () => bodyUnder((game.width || 800) / 2, (game.height || 600) / 2));

  rt.defineValue('camera x', () => world.camera.x);
  rt.defineValue('camera y', () => world.camera.y);
  rt.defineValue('camera z', () => world.camera.z);

  rt.defineInfix('$body is resting', (a) =>
    a.body instanceof Body && world.ground !== null && Math.abs(a.body.bottom - world.ground) < 0.01);

  return world;
}

function num(value, fallback) {
  const n = toNumber(value);
  return Number.isNaN(n) ? fallback : n;
}

function round(n) { return Math.round(n * 100) / 100; }

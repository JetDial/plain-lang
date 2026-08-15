// Plain - drawing the 3D world.
// A small WebGL renderer: one shader, a handful of built-in meshes, one
// directional light. Enough to see a world; nothing a beginner has to know.

// The shadow pass: the world drawn from where the sun stands, keeping only
// how far away everything is. WebGL1 has no depth textures without asking
// nicely, so the distance is packed into the four bytes of an ordinary
// colour - an old trick, and a reliable one.
const SHADOW_VERTEX = `
attribute vec3 position;
uniform mat4 model;
uniform mat4 lightView;
void main() {
  gl_Position = lightView * model * vec4(position, 1.0);
}`;

const SHADOW_FRAGMENT = `
precision mediump float;
vec4 pack(float depth) {
  vec4 spread = vec4(1.0, 255.0, 65025.0, 16581375.0) * depth;
  spread = fract(spread);
  spread -= spread.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  return spread;
}
void main() {
  gl_FragColor = pack(gl_FragCoord.z);
}`;

const VERTEX_SHADER = `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform mat4 rotation;
uniform mat4 lightView;
varying vec3 shadedNormal;
varying float depthFade;
varying vec3 worldPlace;
varying vec3 localPlace;
varying vec3 localNormal;
varying vec4 sunPlace;
void main() {
  vec4 world = model * vec4(position, 1.0);
  vec4 eye = view * world;
  gl_Position = projection * eye;
  shadedNormal = normalize((rotation * vec4(normal, 0.0)).xyz);
  worldPlace = world.xyz;
  sunPlace = lightView * world;
  // Kept in the shape's own space, before it is moved or turned, so a
  // picture stays put on a thing that is walking about instead of the
  // thing sliding along underneath its own skin.
  localPlace = position;
  localNormal = normal;
  depthFade = clamp(-eye.z / 140.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 color;
uniform vec3 light;
uniform vec3 lightColor;
uniform vec3 sky;
uniform float ambient;
uniform vec3 lamp;          // where a lamp is, if there is one
uniform vec3 lampColor;
uniform float lampReach;    // 0 means there is no lamp
uniform float fogFrom;      // how much of the distance fades into the sky
uniform sampler2D skin;
uniform float skinned;      // 0 means this thing has no picture on it
uniform float repeated;     // how many times the picture tiles across it
uniform sampler2D sunDepth;
uniform float casting;      // 0 means nothing casts shadows
varying vec3 shadedNormal;
varying float depthFade;
varying vec3 worldPlace;
varying vec3 localPlace;
varying vec3 localNormal;
varying vec4 sunPlace;

float unpack(vec4 colour) {
  return dot(colour, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}

// Is this spot the nearest thing to the sun along its own ray? If not,
// something stands between it and the light, and it is in shadow.
float sunlight() {
  if (casting < 0.5) return 1.0;
  vec3 spot = sunPlace.xyz / sunPlace.w * 0.5 + 0.5;
  if (spot.x < 0.0 || spot.x > 1.0 || spot.y < 0.0 || spot.y > 1.0 || spot.z > 1.0) return 1.0;
  float nearest = unpack(texture2D(sunDepth, spot.xy));
  return spot.z - 0.003 > nearest ? 0.35 : 1.0;
}

void main() {
  vec3 face = normalize(shadedNormal);

  // A picture on a thing, worked out here rather than carried on the mesh.
  // The shapes are built with corners and normals and no texture corners at
  // all, so instead of adding them the picture is projected from all three
  // directions at once and mixed by which way the surface points. On a box
  // that is exactly the same answer as proper texture corners would give;
  // on a ball it has no seam, which proper corners would.
  vec3 paint = color;
  if (skinned > 0.5) {
    vec3 blend = abs(normalize(localNormal));
    blend = blend / max(blend.x + blend.y + blend.z, 0.0001);
    vec2 fromX = (localPlace.zy + 0.5) * repeated;
    vec2 fromY = (localPlace.xz + 0.5) * repeated;
    vec2 fromZ = (localPlace.xy + 0.5) * repeated;
    vec3 painted = texture2D(skin, fromX).rgb * blend.x
                 + texture2D(skin, fromY).rgb * blend.y
                 + texture2D(skin, fromZ).rgb * blend.z;
    // Multiplied by the colour rather than replacing it, so one grey stone
    // picture makes grey stone, green stone and red stone.
    paint = painted * color;
  }

  // The sun: one direction, the same everywhere - unless something stands
  // between this spot and it.
  float lit = max(dot(face, normalize(light)), 0.0) * sunlight();
  vec3 shaded = paint * (ambient + (1.0 - ambient) * lit) * lightColor;

  // A lamp: a place rather than a direction, so it falls off with distance
  // and lights the side of a thing that faces it.
  if (lampReach > 0.0) {
    vec3 towards = lamp - worldPlace;
    float far = length(towards);
    float near = max(1.0 - far / lampReach, 0.0);
    float facing = max(dot(face, normalize(towards)), 0.0);
    shaded += paint * lampColor * facing * near * near;
  }

  gl_FragColor = vec4(mix(shaded, sky, depthFade * fogFrom), 1.0);
}`;

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) ||
             canvas.getContext('experimental-webgl');
  if (!gl) return null;

  const program = link(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  if (!program) return null;

  const attributes = {
    position: gl.getAttribLocation(program, 'position'),
    normal: gl.getAttribLocation(program, 'normal')
  };
  const uniforms = {};
  for (const name of ['model', 'view', 'projection', 'rotation', 'color', 'light', 'sky', 'lightColor', 'ambient', 'lamp', 'lampColor', 'lampReach', 'fogFrom', 'skin', 'skinned', 'repeated', 'lightView', 'sunDepth', 'casting']) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  // The shadow pass: its own small program, and a texture the size of a
  // postage stamp that the sun draws the world onto before the eye does.
  const shadowProgram = link(gl, SHADOW_VERTEX, SHADOW_FRAGMENT);
  const shadow = { size: 1024, ready: false };
  if (shadowProgram) {
    shadow.attributes = { position: gl.getAttribLocation(shadowProgram, 'position') };
    shadow.uniforms = {
      model: gl.getUniformLocation(shadowProgram, 'model'),
      lightView: gl.getUniformLocation(shadowProgram, 'lightView')
    };
    shadow.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadow.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadow.size, shadow.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    shadow.depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, shadow.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadow.size, shadow.size);
    shadow.frame = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.frame);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadow.texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadow.depth);
    shadow.ready = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // A picture becomes a texture once, however many things wear it, and only
  // once the browser has finished loading it - until then the thing is its
  // plain colour, which is what it would have been anyway.
  const skins = new Map();
  const skinFor = (image) => {
    if (!image || !image.complete || !image.naturalWidth) return null;
    const found = skins.get(image);
    if (found) return found;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    // Tiling needs sides that are a power of two. Anything else can still
    // be worn, it just cannot repeat, so it is clamped instead of refused.
    const twos = isTwos(image.naturalWidth) && isTwos(image.naturalHeight);
    if (twos) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    skins.set(image, { texture, twos });
    return skins.get(image);
  };

  const meshes = {
    cube: upload(gl, cubeMesh()),
    ball: upload(gl, sphereMesh(18, 12)),
    floor: upload(gl, cubeMesh()),
    post: upload(gl, cylinderMesh(20)),
    cone: upload(gl, coneMesh(20))
  };

  // A model is a mesh that arrives later: parsed and uploaded the first
  // frame its text is here, drawn as nothing at all until then - a thing
  // has no stand-in shape, because a crate pretending to be a castle is
  // worse than a castle a moment late.
  const models = new Map();
  const meshFor = (body) => {
    if (body.shape !== 'model') return meshes[body.shape] || meshes.cube;
    const named = body.model || '';
    if (models.has(named)) return models.get(named);
    if (!body._modelText) return null;
    const made = objMesh(body._modelText);
    models.set(named, made ? upload(gl, made) : null);
    return models.get(named);
  };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  const matricesFor = (body) => {
    const rotation = multiply(
      multiply(rotateY(body.turnY * Math.PI / 180), rotateX(body.turnX * Math.PI / 180)),
      rotateZ(body.turnZ * Math.PI / 180)
    );
    const model = multiply(
      multiply(translate(body.x, body.y, body.z), rotation),
      scale(body.width, body.height, body.depth)
    );
    return { rotation, model };
  };

  // Where the sun stands: far along its own direction, looking at the
  // middle of things, seeing a fixed box of the world. Fixed because a
  // shadow map that chases the camera shimmers, and a beginner's world
  // fits in a box a hundred metres across.
  const sunView = (world) => {
    const along = norm([world.light.x, world.light.y, world.light.z]);
    const eye = [along[0] * 80, along[1] * 80, along[2] * 80];
    const look = lookAt(eye, [0, 0, 0], Math.abs(along[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
    return multiply(orthographic(60, 60, 1, 220), look);
  };

  return {
    gl,
    draw(world) {
      const width = canvas.width, height = canvas.height;
      const sky = toRGB(world.sky);

      // Pass one: the world as the sun sees it, kept as distances.
      const casting = !!world.castShadows && shadow.ready;
      let lightView = null;
      if (casting) {
        lightView = sunView(world);
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.frame);
        gl.viewport(0, 0, shadow.size, shadow.size);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(shadowProgram);
        gl.uniformMatrix4fv(shadow.uniforms.lightView, false, lightView);
        for (const body of world.bodies) {
          if (body.hidden || body.gone) continue;
          const mesh = meshFor(body);
          if (!mesh) continue;
          gl.uniformMatrix4fv(shadow.uniforms.model, false, matricesFor(body).model);
          drawMesh(gl, mesh, shadow.attributes);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }

      gl.viewport(0, 0, width, height);
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);

      const projection = perspective(60 * Math.PI / 180, width / Math.max(1, height), 0.1, 500);
      const camera = world.camera;
      const view = lookAt(
        [camera.x, camera.y, camera.z],
        [camera.atX, camera.atY, camera.atZ],
        [0, 1, 0]
      );
      gl.uniformMatrix4fv(uniforms.projection, false, projection);
      gl.uniformMatrix4fv(uniforms.view, false, view);
      gl.uniform3f(uniforms.light, world.light.x, world.light.y, world.light.z);
      const sun = world.lightColor || { r: 1, g: 1, b: 1 };
      gl.uniform3f(uniforms.lightColor, sun.r, sun.g, sun.b);
      gl.uniform1f(uniforms.ambient, world.ambient === undefined ? 0.42 : world.ambient);
      const lamp = world.lamp;
      gl.uniform3f(uniforms.lamp, lamp ? lamp.x : 0, lamp ? lamp.y : 0, lamp ? lamp.z : 0);
      gl.uniform3f(uniforms.lampColor, lamp ? lamp.r : 0, lamp ? lamp.g : 0, lamp ? lamp.b : 0);
      gl.uniform1f(uniforms.lampReach, lamp ? lamp.reach : 0);
      gl.uniform1f(uniforms.fogFrom, world.fog === undefined ? 0.75 : world.fog);
      gl.uniform3f(uniforms.sky, sky[0], sky[1], sky[2]);
      gl.uniform1f(uniforms.casting, casting ? 1 : 0);
      if (casting) {
        gl.uniformMatrix4fv(uniforms.lightView, false, lightView);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, shadow.texture);
        gl.uniform1i(uniforms.sunDepth, 1);
      }

      for (const body of world.bodies) {
        if (body.hidden || body.gone) continue;
        const mesh = meshFor(body);
        if (!mesh) continue;
        const { rotation, model } = matricesFor(body);
        const color = toRGB(body.color);
        gl.uniformMatrix4fv(uniforms.model, false, model);
        gl.uniformMatrix4fv(uniforms.rotation, false, rotation);
        gl.uniform3f(uniforms.color, color[0], color[1], color[2]);

        const worn = skinFor(body._skinImage);
        if (worn) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, worn.texture);
          gl.uniform1i(uniforms.skin, 0);
          gl.uniform1f(uniforms.skinned, 1);
          gl.uniform1f(uniforms.repeated, worn.twos ? (body.skinRepeat || 1) : 1);
        } else {
          gl.uniform1f(uniforms.skinned, 0);
        }
        drawMesh(gl, mesh, attributes);
      }
    }
  };
}

function isTwos(n) { return (n & (n - 1)) === 0 && n > 0; }

// ------------------------------------------------------------------- models
//
// A wavefront .obj file, the plainest model format there is: v lines are
// corners, f lines are faces. Faces may name normals (v//vn) or not; a
// face with more than three corners becomes a fan of triangles; a file
// with no normals gets flat ones worked out from each triangle. The whole
// shape is scaled into a one-unit box and centred, so "sized 3" means the
// same thing for a model as for a cube.
export function objMesh(text) {
  const corners = [];
  const normals = [];
  const outPositions = [];
  const outNormals = [];

  const lines = String(text).split(/\r?\n/);
  const faces = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') corners.push([+parts[1], +parts[2], +parts[3]]);
    else if (parts[0] === 'vn') normals.push([+parts[1], +parts[2], +parts[3]]);
    else if (parts[0] === 'f') faces.push(parts.slice(1));
  }
  if (!corners.length || !faces.length) return null;

  // Into a one-unit box, centred - worked out before any triangle is laid.
  let least = [Infinity, Infinity, Infinity], most = [-Infinity, -Infinity, -Infinity];
  for (const c of corners) for (let axis = 0; axis < 3; axis++) {
    if (c[axis] < least[axis]) least[axis] = c[axis];
    if (c[axis] > most[axis]) most[axis] = c[axis];
  }
  const middle = [0, 1, 2].map(axis => (least[axis] + most[axis]) / 2);
  const size = Math.max(most[0] - least[0], most[1] - least[1], most[2] - least[2]) || 1;
  const placed = corners.map(c => [0, 1, 2].map(axis => (c[axis] - middle[axis]) / size));

  const cornerOf = (piece) => {
    const [v, , vn] = piece.split('/');
    let at = Number(v);
    at = at < 0 ? placed.length + at : at - 1;   // negative counts from the end
    let n = vn === undefined || vn === '' ? null : Number(vn);
    if (n !== null) n = n < 0 ? normals.length + n : n - 1;
    return { place: placed[at], normal: n === null ? null : normals[n] };
  };

  for (const face of faces) {
    // A fan: corner 0 with each neighbouring pair.
    for (let third = 2; third < face.length; third++) {
      const three = [cornerOf(face[0]), cornerOf(face[third - 1]), cornerOf(face[third])];
      let flat = null;
      if (three.some(one => !one.normal)) {
        const [a, b, c] = three.map(one => one.place);
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        flat = [
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0]
        ];
        const length = Math.hypot(flat[0], flat[1], flat[2]) || 1;
        flat = flat.map(part => part / length);
      }
      for (const one of three) {
        outPositions.push(...one.place);
        outNormals.push(...(one.normal || flat));
      }
    }
  }
  return { positions: new Float32Array(outPositions), normals: new Float32Array(outNormals), count: outPositions.length / 3 };
}

function norm(v) {
  const size = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / size, v[1] / size, v[2] / size];
}

// A box of space, not a cone of it: the sun is so far away its rays are
// parallel, which is what an orthographic projection is.
export function orthographic(width, height, near, far) {
  return new Float32Array([
    2 / width, 0, 0, 0,
    0, 2 / height, 0, 0,
    0, 0, -2 / (far - near), 0,
    0, 0, -(far + near) / (far - near), 1
  ]);
}

// ------------------------------------------------------------------ shaders

function link(gl, vertexSource, fragmentSource) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Plain 3D: ' + gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Plain 3D: ' + gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function upload(gl, mesh) {
  const positions = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positions);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
  const normals = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normals);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);
  return { positions, normals, count: mesh.positions.length / 3 };
}

function drawMesh(gl, mesh, attributes) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positions);
  gl.enableVertexAttribArray(attributes.position);
  gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 0, 0);
  // The shadow pass has no use for normals and its program has no slot for
  // them. Binding to a slot that is not there is not an error that throws -
  // it is a silent one that draws nothing, which is worse.
  if (attributes.normal !== undefined && attributes.normal !== -1) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normals);
    gl.enableVertexAttribArray(attributes.normal);
    gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 0, 0);
  }
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

// ------------------------------------------------------------------- meshes
// Every mesh is one unit across and centred, so a body's width/height/depth
// scale it directly.

export function cubeMesh() {
  const positions = [];
  const normals = [];
  const faces = [
    { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { normal: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { normal: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
  ];
  for (const face of faces) {
    const [a, b, c, d] = face.corners.map(p => p.map(v => v / 2));
    for (const point of [a, b, c, a, c, d]) {
      positions.push(...point);
      normals.push(...face.normal);
    }
  }
  return { positions, normals };
}

export function sphereMesh(columns = 18, rows = 12) {
  const positions = [];
  const normals = [];
  const point = (column, row) => {
    const theta = (column / columns) * Math.PI * 2;
    const phi = (row / rows) * Math.PI;
    return [
      Math.sin(phi) * Math.cos(theta) / 2,
      Math.cos(phi) / 2,
      Math.sin(phi) * Math.sin(theta) / 2
    ];
  };
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = point(column, row);
      const b = point(column + 1, row);
      const c = point(column + 1, row + 1);
      const d = point(column, row + 1);
      for (const p of [a, d, c, a, c, b]) {
        positions.push(...p);
        const length = Math.hypot(...p) || 1;
        normals.push(p[0] / length, p[1] / length, p[2] / length);
      }
    }
  }
  return { positions, normals };
}

export function cylinderMesh(sides = 20) {
  const positions = [];
  const normals = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const b = ((i + 1) / sides) * Math.PI * 2;
    const ax = Math.cos(a) / 2, az = Math.sin(a) / 2;
    const bx = Math.cos(b) / 2, bz = Math.sin(b) / 2;
    // side
    for (const [x, y, z, nx, nz] of [
      [ax, -0.5, az, Math.cos(a), Math.sin(a)], [bx, -0.5, bz, Math.cos(b), Math.sin(b)], [bx, 0.5, bz, Math.cos(b), Math.sin(b)],
      [ax, -0.5, az, Math.cos(a), Math.sin(a)], [bx, 0.5, bz, Math.cos(b), Math.sin(b)], [ax, 0.5, az, Math.cos(a), Math.sin(a)]
    ]) {
      positions.push(x, y, z);
      normals.push(nx, 0, nz);
    }
    // top and bottom caps
    positions.push(0, 0.5, 0, ax, 0.5, az, bx, 0.5, bz);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    positions.push(0, -0.5, 0, bx, -0.5, bz, ax, -0.5, az);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
  }
  return { positions, normals };
}

export function coneMesh(sides = 20) {
  const positions = [];
  const normals = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const b = ((i + 1) / sides) * Math.PI * 2;
    const ax = Math.cos(a) / 2, az = Math.sin(a) / 2;
    const bx = Math.cos(b) / 2, bz = Math.sin(b) / 2;
    positions.push(0, 0.5, 0, ax, -0.5, az, bx, -0.5, bz);
    const nx = Math.cos((a + b) / 2), nz = Math.sin((a + b) / 2);
    for (let k = 0; k < 3; k++) normals.push(nx, 0.5, nz);
    positions.push(0, -0.5, 0, bx, -0.5, bz, ax, -0.5, az);
    for (let k = 0; k < 3; k++) normals.push(0, -1, 0);
  }
  return { positions, normals };
}

// ----------------------------------------------------------------- matrices
// Column major, the order WebGL wants.

export function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

export function translate(x, y, z) {
  const out = identity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function scale(x, y, z) {
  const out = identity();
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

export function rotateY(angle) {
  const out = identity();
  const s = Math.sin(angle), c = Math.cos(angle);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

export function rotateX(angle) {
  const out = identity();
  const s = Math.sin(angle), c = Math.cos(angle);
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

export function rotateZ(angle) {
  const out = identity();
  const s = Math.sin(angle), c = Math.cos(angle);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
  return out;
}

export function perspective(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function lookAt(eye, at, up) {
  const z = normalise(subtract(eye, at));
  const x = normalise(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
  ]);
}

function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalise(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

// ------------------------------------------------------------------- colour

const NAMED = {
  white: '#ffffff', black: '#000000', red: '#e5484d', green: '#3ba55d', blue: '#4c8dff',
  yellow: '#ffd166', orange: '#ff8c42', purple: '#a970ff', pink: '#ff7ab6', brown: '#8b5e3c',
  grey: '#9aa0aa', gray: '#9aa0aa', cyan: '#31c8c0', sand: '#d9c39a', sky: '#7ec8ff'
};

export function toRGB(color) {
  let value = String(color || '#cccccc').trim().toLowerCase();
  if (NAMED[value]) value = NAMED[value];
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const number = parseInt(hex, 16);
    if (!Number.isNaN(number) && hex.length === 6) {
      return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
    }
  }
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(',').map(p => parseFloat(p.trim()));
    return [(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255];
  }
  return [0.8, 0.8, 0.8];
}

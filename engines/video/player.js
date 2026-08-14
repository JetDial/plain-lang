// Plain - the video studio in the browser.
// Preview, scrub, drag clips around, and export. When the page was opened
// with `plain edit`, Save writes the timeline back out as Plain sentences.

import { buildWebM } from './webm.js';

const STYLE = `
body { margin: 0; background: #0c0d12; color: #e9ecf3;
       font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.studio { max-width: 1180px; margin: 0 auto; padding: 22px 20px 60px; }
.studio h1 { font-size: 19px; margin: 0 0 16px; font-weight: 600; letter-spacing: .2px; }
.studio h1 span { color: #7d8496; font-weight: 400; }
.screen { background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.screen canvas { display: block; width: 100%; height: auto; }
.bar { display: flex; align-items: center; gap: 14px; margin: 14px 0 6px; }
.bar button, .panel button {
  appearance: none; border: 1px solid #2b3040; background: #171b25; color: #e9ecf3;
  font: inherit; padding: 8px 14px; border-radius: 9px; cursor: pointer;
}
.bar button:hover, .panel button:hover { border-color: #465070; background: #1d2230; }
.bar button.main { background: #4c8dff; border-color: #4c8dff; color: #08101f; font-weight: 600; }
.bar .time { font: 13px ui-monospace, Consolas, monospace; color: #97a0b5; min-width: 108px; }
.bar input[type=range] { flex: 1; accent-color: #4c8dff; }
.timeline { display: flex; gap: 3px; height: 62px; margin: 12px 0 4px;
  background: #12141c; border: 1px solid #232838; border-radius: 10px; padding: 5px; overflow-x: auto; }
.block { position: relative; min-width: 26px; border-radius: 7px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  font-size: 12px; color: #06080e; font-weight: 600; padding: 0 6px; text-align: center;
  border: 2px solid transparent; }
.block.chosen { border-color: #ffffff; }
.block .grip { position: absolute; right: 0; top: 0; bottom: 0; width: 8px; cursor: ew-resize;
  background: rgba(0,0,0,.28); }
.panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px;
  background: #12141c; border: 1px solid #232838; border-radius: 10px; padding: 16px; margin-top: 12px; }
.panel label { display: block; font-size: 12px; color: #97a0b5; margin-bottom: 5px; }
.panel input, .panel select {
  width: 100%; font: inherit; color: #e9ecf3; background: #0d0f16;
  border: 1px solid #2b3040; border-radius: 8px; padding: 7px 9px; }
.panel .actions { display: flex; gap: 8px; align-items: flex-end; }
.note { color: #7d8496; font-size: 13px; margin-top: 12px; }
.saved { color: #7ee787; }
`;

export function startStudio(studio, doc, win) {
  ensureStyle(doc, STYLE);
  doc.title = studio.title;

  const editable = Boolean(win.__plainEditable);
  const state = { time: 0, playing: false, chosen: 0, saved: '' };

  const root = doc.createElement('div');
  root.className = 'studio';
  root.innerHTML = `
    <h1>${escapeHTML(studio.title)} <span>${studio.width}x${studio.height}, ${studio.fps} frames a second</span></h1>
    <div class="screen"><canvas></canvas></div>
    <div class="bar">
      <button class="main" data-play>Play</button>
      <span class="time" data-time>0.0 / 0.0 s</span>
      <input type="range" data-scrub min="0" max="1000" value="0">
      <button data-export>Export</button>
      <button data-fast>Export fast</button>
      ${editable ? '<button data-save>Save</button>' : ''}
    </div>
    <div class="timeline" data-timeline></div>
    <div data-panel></div>
    <p class="note" data-note></p>`;
  doc.body.appendChild(root);

  const canvas = root.querySelector('canvas');
  canvas.width = studio.width;
  canvas.height = studio.height;
  const ctx = canvas.getContext('2d');

  const timeLabel = root.querySelector('[data-time]');
  const scrub = root.querySelector('[data-scrub]');
  const timeline = root.querySelector('[data-timeline]');
  const panel = root.querySelector('[data-panel]');
  const note = root.querySelector('[data-note]');
  const playButton = root.querySelector('[data-play]');

  const media = new Map();   // source -> <video> or <img>
  const music = new Map();   // source -> <audio>
  let mixer = null;          // where every sound is joined together

  // ------------------------------------------------------------- media

  function mediaFor(clip) {
    if (!clip.source) return null;
    if (media.has(clip.source)) return media.get(clip.source);
    let element;
    if (clip.kind === 'video') {
      element = doc.createElement('video');
      element.src = clip.source;
      element.playsInline = true;
      element.preload = 'auto';
      element.crossOrigin = 'anonymous';
      element.volume = clip.volume ?? 1;
    } else {
      element = doc.createElement('img');
      element.src = clip.source;
    }
    element.addEventListener('error', () => { element.failed = true; draw(); });
    media.set(clip.source, element);
    return element;
  }

  function musicFor(track) {
    if (music.has(track.source)) return music.get(track.source);
    const audio = doc.createElement('audio');
    audio.src = track.source;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.volume = track.volume ?? 1;
    audio.addEventListener('error', () => { audio.failed = true; });
    music.set(track.source, audio);
    return audio;
  }

  // One WebAudio graph fed by every sound, so the recorder can be handed a
  // single mixed audio track alongside the picture.
  function mixerFor() {
    if (mixer) return mixer;
    const Context = win.AudioContext || win.webkitAudioContext;
    if (!Context) return null;
    try {
      const context = new Context();
      const out = context.createMediaStreamDestination();
      mixer = { context, out, joined: new WeakSet() };
      return mixer;
    } catch {
      return null;
    }
  }

  // An element can only be joined to the graph once, and once joined it no
  // longer reaches the speakers on its own, so we send it on to both.
  function joinToMixer(element) {
    const made = mixerFor();
    if (!made || made.joined.has(element)) return;
    try {
      const source = made.context.createMediaElementSource(element);
      source.connect(made.out);
      source.connect(made.context.destination);
      made.joined.add(element);
    } catch { /* some sources refuse; they still play on their own */ }
  }

  function musicAt(seconds, playing) {
    for (const track of studio.music) {
      const audio = musicFor(track);
      if (audio.failed) continue;
      const into = seconds - (track.start || 0);
      if (into < 0 || (audio.duration && into > audio.duration)) {
        if (!audio.paused) audio.pause();
        continue;
      }
      if (Math.abs(audio.currentTime - into) > 0.25) audio.currentTime = into;
      if (playing && audio.paused) audio.play().catch(() => {});
      if (!playing && !audio.paused) audio.pause();
    }
  }

  function silenceMusic() {
    for (const audio of music.values()) { if (audio.pause) audio.pause(); }
  }

  // ------------------------------------------------------------ drawing

  function drawCover(element, width, height) {
    const sourceWidth = element.videoWidth || element.naturalWidth || 0;
    const sourceHeight = element.videoHeight || element.naturalHeight || 0;
    if (!sourceWidth || !sourceHeight) return false;
    const factor = Math.max(width / sourceWidth, height / sourceHeight);
    const w = sourceWidth * factor, h = sourceHeight * factor;
    ctx.drawImage(element, (width - w) / 2, (height - h) / 2, w, h);
    return true;
  }

  function draw() {
    const width = studio.width, height = studio.height;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const placed = studio.clipAt(state.time) || (state.time >= studio.length ? null : null);
    if (!placed) {
      ctx.fillStyle = '#5a6172';
      ctx.font = `${Math.round(height / 22)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(studio.clips.length ? 'end' : 'no clips yet', width / 2, height / 2);
      ctx.restore();
      return;
    }

    const clip = placed.clip;
    const into = state.time - placed.start;
    let alpha = 1;
    if (clip.fadeIn > 0 && into < clip.fadeIn) alpha = into / clip.fadeIn;
    if (clip.fadeOut > 0 && placed.finish - state.time < clip.fadeOut) {
      alpha = Math.min(alpha, (placed.finish - state.time) / clip.fadeOut);
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    if (clip.kind === 'video' || clip.kind === 'picture') {
      const element = mediaFor(clip);
      const shown = element && !element.failed && drawCover(element, width, height);
      if (!shown) {
        ctx.fillStyle = '#191c26';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#7d8496';
        ctx.font = `${Math.round(height / 26)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(element && element.failed ? `missing: ${clip.source}` : `loading ${clip.source}`, width / 2, height / 2);
      }
    } else if (clip.kind === 'colour') {
      ctx.fillStyle = clip.color;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = clip.color;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = clip.textColor;
      ctx.font = `600 ${Math.round(height / 9)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      wrapText(ctx, clip.text, width / 2, height / 2, width * 0.8, height / 8);
    }

    if (clip.overlay) {
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      const barHeight = Math.round(height / 7);
      ctx.fillRect(0, height - barHeight, width, barHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(height / 16)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(clip.overlay, width / 2, height - barHeight / 2);
    }

    drawOverlays(width, height);
    ctx.restore();
  }

  // The second track, drawn over whatever the clips put down.
  function drawOverlays(width, height) {
    for (const one of studio.overlaysAt(state.time)) {
      let alpha = 1;
      if (one.fade > 0) {
        const into = state.time - one.start;
        const left = one.finish - state.time;
        alpha = Math.min(1, into / one.fade, left / one.fade);
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      const middle = one.where === 'top' ? height / 6
        : one.where === 'middle' ? height / 2
        : height - height / 7 / 2;

      if (one.kind === 'picture') {
        const element = mediaFor({ kind: 'picture', source: one.source });
        if (element && !element.failed && (element.naturalWidth || 0) > 0) {
          const wide = Math.min(width * 0.4, element.naturalWidth);
          const tall = wide * (element.naturalHeight / element.naturalWidth);
          ctx.drawImage(element, (width - wide) / 2, middle - tall / 2, wide, tall);
        }
        continue;
      }

      ctx.font = `600 ${Math.round(height / 14)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const measured = ctx.measureText(one.text).width;
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      const padding = height / 40;
      ctx.fillRect((width - measured) / 2 - padding, middle - height / 22 - padding,
        measured + padding * 2, height / 11 + padding * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(one.text, width / 2, middle);
    }
  }

  // --------------------------------------------------------- the clock

  function syncMedia() {
    for (const element of media.values()) {
      if (element.tagName === 'VIDEO' && !element.paused) element.pause();
    }
    musicAt(state.time, state.playing);

    const placed = studio.clipAt(state.time);
    if (!placed || placed.clip.kind !== 'video') return;
    const element = mediaFor(placed.clip);
    if (!element || element.failed || !element.duration) return;
    element.volume = (placed.clip.volume ?? 1) * studio.volume;
    const wanted = placed.clip.from + (state.time - placed.start);
    if (Math.abs(element.currentTime - wanted) > 0.2) element.currentTime = Math.min(wanted, element.duration - 0.01);
    if (state.playing && element.paused) element.play().catch(() => {});
  }

  let last = null;
  function tick(now) {
    if (state.playing) {
      const step = last === null ? 0 : Math.min(0.25, (now - last) / 1000);
      state.time += step;
      if (state.time >= studio.length) { state.time = studio.length; setPlaying(false); }
      syncMedia();
      refreshTime();
      draw();
    }
    last = now;
    win.requestAnimationFrame(tick);
  }

  function setPlaying(playing) {
    state.playing = playing && studio.length > 0;
    playButton.textContent = state.playing ? 'Pause' : 'Play';
    if (!state.playing) {
      for (const element of media.values()) if (element.pause) element.pause();
      silenceMusic();
    } else {
      syncMedia();
    }
  }

  function refreshTime() {
    timeLabel.textContent = `${state.time.toFixed(1)} / ${studio.length.toFixed(1)} s`;
    scrub.value = String(studio.length ? Math.round((state.time / studio.length) * 1000) : 0);
  }

  function seek(seconds) {
    state.time = Math.max(0, Math.min(studio.length, seconds));
    syncMedia();
    refreshTime();
    draw();
  }

  // -------------------------------------------------------- the timeline

  const COLORS = { video: '#79c0ff', picture: '#7ee787', title: '#ffd166', colour: '#ff9ec4' };

  function buildTimeline() {
    timeline.textContent = '';
    const total = Math.max(0.1, studio.length);
    studio.layout().forEach((placed, index) => {
      const block = doc.createElement('div');
      block.className = 'block' + (index === state.chosen ? ' chosen' : '');
      block.style.flex = `${placed.clip.length / total} 1 0`;
      block.style.background = COLORS[placed.clip.kind] || '#9aa0aa';
      block.textContent = label(placed.clip);
      block.title = `${label(placed.clip)} - ${placed.clip.length.toFixed(1)}s`;
      block.addEventListener('click', () => { state.chosen = index; seek(placed.start + 0.01); buildTimeline(); buildPanel(); });
      if (editable) {
        const grip = doc.createElement('div');
        grip.className = 'grip';
        grip.title = 'Drag to change how long this clip lasts';
        grip.addEventListener('mousedown', event => startDrag(event, index));
        block.appendChild(grip);
      }
      timeline.appendChild(block);
    });
  }

  function startDrag(event, index) {
    event.preventDefault();
    event.stopPropagation();
    const clip = studio.clips[index];
    const startX = event.clientX;
    const startLength = clip.length;
    const perPixel = Math.max(0.02, studio.length / Math.max(1, timeline.clientWidth));
    const move = moveEvent => {
      clip.length = Math.max(0.1, round(startLength + (moveEvent.clientX - startX) * perPixel));
      buildTimeline();
      buildPanel();
      refreshTime();
      draw();
    };
    const stop = () => {
      win.removeEventListener('mousemove', move);
      win.removeEventListener('mouseup', stop);
    };
    win.addEventListener('mousemove', move);
    win.addEventListener('mouseup', stop);
  }

  function label(clip) {
    if (clip.kind === 'title') return clip.text || 'title';
    if (clip.kind === 'colour') return clip.color;
    return clip.source.split('/').pop();
  }

  // ---------------------------------------------------------- the panel

  function buildPanel() {
    const clip = studio.clips[state.chosen];
    if (!clip) { panel.textContent = ''; return; }
    panel.innerHTML = `
      <div class="panel">
        <div>
          <label>Kind</label>
          <input value="${escapeHTML(clip.kind)}" disabled>
        </div>
        <div>
          <label>${clip.kind === 'title' ? 'Words' : 'File'}</label>
          <input data-field="${clip.kind === 'title' ? 'text' : 'source'}"
                 value="${escapeHTML(clip.kind === 'title' ? clip.text : clip.source)}" ${editable ? '' : 'disabled'}>
        </div>
        <div>
          <label>Seconds</label>
          <input data-field="length" type="number" step="0.1" min="0.1" value="${round(clip.length)}" ${editable ? '' : 'disabled'}>
        </div>
        <div>
          <label>Fade in / out</label>
          <div style="display:flex;gap:8px">
            <input data-field="fadeIn" type="number" step="0.1" min="0" value="${round(clip.fadeIn)}" ${editable ? '' : 'disabled'}>
            <input data-field="fadeOut" type="number" step="0.1" min="0" value="${round(clip.fadeOut)}" ${editable ? '' : 'disabled'}>
          </div>
        </div>
        <div>
          <label>Words on top</label>
          <input data-field="overlay" value="${escapeHTML(clip.overlay)}" ${editable ? '' : 'disabled'}>
        </div>
        ${editable ? `<div class="actions">
          <button data-move="-1">&lt;</button>
          <button data-move="1">&gt;</button>
          <button data-delete>Delete</button>
        </div>` : ''}
      </div>`;

    for (const input of panel.querySelectorAll('[data-field]')) {
      input.addEventListener('input', () => {
        const field = input.dataset.field;
        clip[field] = input.type === 'number' ? Math.max(field === 'length' ? 0.1 : 0, Number(input.value) || 0) : input.value;
        buildTimeline();
        refreshTime();
        draw();
      });
    }
    for (const button of panel.querySelectorAll('[data-move]')) {
      button.addEventListener('click', () => {
        const to = state.chosen + Number(button.dataset.move);
        if (to < 0 || to >= studio.clips.length) return;
        const [moved] = studio.clips.splice(state.chosen, 1);
        studio.clips.splice(to, 0, moved);
        state.chosen = to;
        buildTimeline(); buildPanel(); draw();
      });
    }
    const remove = panel.querySelector('[data-delete]');
    if (remove) remove.addEventListener('click', () => {
      studio.clips.splice(state.chosen, 1);
      state.chosen = Math.max(0, state.chosen - 1);
      buildTimeline(); buildPanel(); refreshTime(); draw();
    });
  }

  // --------------------------------------------------- export, quickly

  // Encode every frame ourselves instead of playing the film into a
  // recorder. A two minute film then takes seconds rather than two minutes.
  // It has no sound: mixing that in needs the slower way.
  async function exportFast(button) {
    if (typeof win.VideoEncoder === 'undefined') {
      note.textContent = 'This browser cannot encode on its own, so use Export instead.';
      return;
    }
    const wasPlaying = state.playing;
    setPlaying(false);
    button.disabled = true;

    const frames = [];
    const perFrame = 1 / studio.fps;
    const total = Math.max(1, Math.round(studio.length * studio.fps));
    let codec = 'V_VP8';

    const encoder = new win.VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        frames.push({ data, keyframe: chunk.type === 'key', at: chunk.timestamp / 1000 });
      },
      error: (error) => { note.textContent = 'The encoder stopped: ' + error.message; }
    });

    const settings = {
      codec: 'vp8',
      width: studio.width,
      height: studio.height,
      bitrate: 4_000_000,
      framerate: studio.fps
    };
    try {
      const supported = await win.VideoEncoder.isConfigSupported({ ...settings, codec: 'vp09.00.10.08' });
      if (supported && supported.supported) { settings.codec = 'vp09.00.10.08'; codec = 'V_VP9'; }
    } catch { /* vp8 it is */ }
    encoder.configure(settings);

    const wasAt = state.time;
    for (let number = 0; number < total; number++) {
      state.time = number * perFrame;
      await readyForFrame();
      draw();
      const picture = new win.VideoFrame(canvas, {
        timestamp: Math.round(number * perFrame * 1_000_000),
        duration: Math.round(perFrame * 1_000_000)
      });
      encoder.encode(picture, { keyFrame: number % Math.round(studio.fps * 2) === 0 });
      picture.close();
      if (number % 10 === 0) {
        button.textContent = `${Math.round((number / total) * 100)}%`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    await encoder.flush();
    encoder.close();

    const file = buildWebM({
      width: studio.width,
      height: studio.height,
      codec,
      frames,
      milliseconds: studio.length * 1000,
      framesASecond: studio.fps
    });
    saveFile(new Blob([file], { type: 'video/webm' }));

    state.time = wasAt;
    refreshTime();
    draw();
    button.disabled = false;
    button.textContent = 'Export fast';
    note.textContent = `Wrote ${total} frames without playing them. This way has no sound - use Export for that.`;
    if (wasPlaying) setPlaying(true);
  }

  // A video clip has to be seeked before its frame can be drawn.
  function readyForFrame() {
    const placed = studio.clipAt(state.time);
    if (!placed || placed.clip.kind !== 'video') return Promise.resolve();
    const element = mediaFor(placed.clip);
    if (!element || element.failed || !element.duration) return Promise.resolve();
    const wanted = Math.min(placed.clip.from + (state.time - placed.start), element.duration - 0.01);
    if (Math.abs(element.currentTime - wanted) < 0.005) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => { element.removeEventListener('seeked', done); resolve(); };
      element.addEventListener('seeked', done);
      element.currentTime = wanted;
      setTimeout(done, 200);            // never hang on a file that will not seek
    });
  }

  // Hand the finished file to the person. Named apart from the Save that
  // writes the timeline back to disk - they are different jobs.
  function saveFile(blob) {
    const link = doc.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${studio.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.webm`;
    doc.body.appendChild(link);
    link.click();
    link.remove();
  }

  // -------------------------------------------------------------- export

  async function exportVideo(button) {
    if (!canvas.captureStream || typeof win.MediaRecorder === 'undefined') {
      note.textContent = 'This browser cannot record the canvas, so there is nothing to export here.';
      return;
    }
    button.disabled = true;
    button.textContent = 'Recording...';
    const stream = canvas.captureStream(studio.fps);

    // Join every sound to one mixed track and record it with the picture.
    let mixed = false;
    const made = mixerFor();
    if (made) {
      if (made.context.state === 'suspended') { try { await made.context.resume(); } catch { /* ignore */ } }
      for (const track of studio.music) joinToMixer(musicFor(track));
      for (const clip of studio.clips) {
        if (clip.kind === 'video' && (clip.volume ?? 1) > 0) joinToMixer(mediaFor(clip));
      }
      for (const track of made.out.stream.getAudioTracks()) { stream.addTrack(track); mixed = true; }
    }

    const chunks = [];
    const kind = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(t => win.MediaRecorder.isTypeSupported(t)) || 'video/webm';
    const recorder = new win.MediaRecorder(stream, { mimeType: kind });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };

    const done = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    seek(0);
    setPlaying(true);
    await new Promise(resolve => {
      const watch = () => (state.playing ? win.requestAnimationFrame(watch) : resolve());
      watch();
    });
    recorder.stop();
    await done;

    saveFile(new Blob(chunks, { type: kind }));
    button.disabled = false;
    button.textContent = 'Export';
    note.textContent = mixed
      ? 'Exported as .webm, with the music and clip sound mixed in.'
      : 'Exported the picture as .webm. This browser would not give me an audio track.';
  }

  // ---------------------------------------------------------------- save

  async function save(button) {
    button.disabled = true;
    try {
      const response = await fetch('/source', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: studio.toPlainSource()
      });
      note.innerHTML = response.ok
        ? '<span class="saved">Saved. Your Plain file now matches this timeline.</span>'
        : 'I could not save that.';
    } catch {
      note.textContent = 'I could not reach the Plain server to save.';
    }
    button.disabled = false;
  }

  // --------------------------------------------------------------- wiring

  playButton.addEventListener('click', () => setPlaying(!state.playing));
  scrub.addEventListener('input', () => seek((Number(scrub.value) / 1000) * studio.length));
  root.querySelector('[data-export]').addEventListener('click', event => exportVideo(event.currentTarget));
  root.querySelector('[data-fast]').addEventListener('click', event => exportFast(event.currentTarget));
  const saveButton = root.querySelector('[data-save]');
  if (saveButton) saveButton.addEventListener('click', event => save(event.currentTarget));
  win.addEventListener('keydown', event => {
    if (event.key === ' ') { event.preventDefault(); setPlaying(!state.playing); }
  });

  note.textContent = editable
    ? 'Drag the right edge of a clip to change its length, then press Save.'
    : 'Opened with plain play. Use "plain edit" to change the timeline and save it.';

  buildTimeline();
  buildPanel();
  refreshTime();
  draw();
  win.requestAnimationFrame(tick);

  return { studio, seek, draw, state };
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  const top = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((text, index) => ctx.fillText(text, x, top + index * lineHeight));
}

function ensureStyle(doc, css) {
  const style = doc.createElement('style');
  style.textContent = css;
  doc.head.appendChild(style);
}

function escapeHTML(text) {
  return String(text ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function round(n) { return Math.round(n * 100) / 100; }

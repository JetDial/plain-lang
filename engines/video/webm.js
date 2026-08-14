// Plain - writing a .webm file.
//
// Recording a film by playing it takes as long as the film. To go faster we
// encode each frame ourselves (WebCodecs) and put the pieces into a file by
// hand. That file format is Matroska, which is a tree of numbered elements,
// each one written as: an id, a length, and the contents.
//
// This writes the smallest tree a player will accept for video: a header,
// what the file is, one track, and the frames in clusters.

const ID = {
  EBML: 0x1A45DFA3,
  EBMLVersion: 0x4286,
  EBMLReadVersion: 0x42F7,
  EBMLMaxIDLength: 0x42F2,
  EBMLMaxSizeLength: 0x42F3,
  DocType: 0x4282,
  DocTypeVersion: 0x4287,
  DocTypeReadVersion: 0x4285,

  Segment: 0x18538067,
  Info: 0x1549A966,
  TimecodeScale: 0x2AD7B1,
  MuxingApp: 0x4D80,
  WritingApp: 0x5741,
  Duration: 0x4489,

  Tracks: 0x1654AE6B,
  TrackEntry: 0xAE,
  TrackNumber: 0xD7,
  TrackUID: 0x73C5,
  TrackType: 0x83,
  FlagLacing: 0x9C,
  CodecID: 0x86,
  DefaultDuration: 0x23E383,
  Video: 0xE0,
  PixelWidth: 0xB0,
  PixelHeight: 0xBA,

  Cluster: 0x1F43B675,
  Timecode: 0xE7,
  SimpleBlock: 0xA3
};

// An element id is written as the bytes it is made of.
function idBytes(id) {
  const out = [];
  let shift = id > 0xFFFFFF ? 24 : id > 0xFFFF ? 16 : id > 0xFF ? 8 : 0;
  for (; shift >= 0; shift -= 8) out.push((id >> shift) & 0xFF);
  return Uint8Array.from(out);
}

// A length is written with a marker bit saying how many bytes it takes.
export function sizeBytes(size) {
  for (let length = 1; length <= 8; length++) {
    const room = 2 ** (7 * length) - 1;
    if (size < room) {
      const out = new Uint8Array(length);
      let left = size;
      for (let at = length - 1; at >= 0; at--) {
        out[at] = left & 0xFF;
        left = Math.floor(left / 256);
      }
      out[0] |= 1 << (8 - length);      // the marker
      return out;
    }
  }
  throw new Error('that is too big for one element');
}

function join(pieces) {
  let total = 0;
  for (const piece of pieces) total += piece.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const piece of pieces) { out.set(piece, at); at += piece.length; }
  return out;
}

export function element(id, contents) {
  const body = contents instanceof Uint8Array ? contents : join(contents);
  return join([idBytes(id), sizeBytes(body.length), body]);
}

export function whole(value) {
  if (value === 0) return Uint8Array.from([0]);
  const out = [];
  let left = value;
  while (left > 0) { out.unshift(left & 0xFF); left = Math.floor(left / 256); }
  return Uint8Array.from(out);
}

export function words(text) {
  return new TextEncoder().encode(text);
}

export function decimal(value) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value);
  return out;
}

// One frame, inside a cluster that started at `clusterAt` milliseconds.
export function simpleBlock(frame, sinceCluster) {
  const head = new Uint8Array(4);
  head[0] = 0x81;                                    // track 1
  new DataView(head.buffer).setInt16(1, sinceCluster);
  head[3] = frame.keyframe ? 0x80 : 0x00;
  return element(ID.SimpleBlock, join([head, frame.data]));
}

// `frames` are { data: Uint8Array, keyframe: boolean, at: milliseconds }.
export function buildWebM({ width, height, codec = 'V_VP8', frames, milliseconds, framesASecond = 30 }) {
  const header = element(ID.EBML, [
    element(ID.EBMLVersion, whole(1)),
    element(ID.EBMLReadVersion, whole(1)),
    element(ID.EBMLMaxIDLength, whole(4)),
    element(ID.EBMLMaxSizeLength, whole(8)),
    element(ID.DocType, words('webm')),
    element(ID.DocTypeVersion, whole(2)),
    element(ID.DocTypeReadVersion, whole(2))
  ]);

  const info = element(ID.Info, [
    element(ID.TimecodeScale, whole(1000000)),        // one tick is a millisecond
    element(ID.MuxingApp, words('Plain')),
    element(ID.WritingApp, words('Plain')),
    element(ID.Duration, decimal(milliseconds))
  ]);

  const tracks = element(ID.Tracks, [
    element(ID.TrackEntry, [
      element(ID.TrackNumber, whole(1)),
      element(ID.TrackUID, whole(1)),
      element(ID.TrackType, whole(1)),                // 1 means pictures
      element(ID.FlagLacing, whole(0)),
      element(ID.CodecID, words(codec)),
      element(ID.DefaultDuration, whole(Math.round(1000000000 / framesASecond))),
      element(ID.Video, [
        element(ID.PixelWidth, whole(width)),
        element(ID.PixelHeight, whole(height))
      ])
    ])
  ]);

  // A cluster holds a run of frames close together in time. Timestamps
  // inside one are 16 bit, so a new cluster starts every few seconds and
  // whenever a keyframe comes along.
  const clusters = [];
  let holding = [];
  let clusterAt = 0;

  const flush = () => {
    if (!holding.length) return;
    clusters.push(element(ID.Cluster, [
      element(ID.Timecode, whole(clusterAt)),
      ...holding.map(frame => simpleBlock(frame, Math.round(frame.at - clusterAt)))
    ]));
    holding = [];
  };

  for (const frame of frames) {
    const wouldStretch = holding.length && (frame.at - clusterAt > 30000 || frame.at - clusterAt > 32000);
    if (!holding.length || (frame.keyframe && wouldStretch) || frame.at - clusterAt > 30000) {
      flush();
      clusterAt = Math.round(frame.at);
    }
    holding.push(frame);
  }
  flush();

  const segment = element(ID.Segment, [info, tracks, ...clusters]);
  return join([header, segment]);
}

export { ID };

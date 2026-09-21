#!/usr/bin/env node
// Convert a binary FBX (v7.x) static mesh into a GLB, optionally embedding a
// PNG texture. Handles the subset that low-poly kit assets use: one or more
// Geometry nodes with polygons, per-polygon-vertex normals and UVs, a single
// material, and the Model node's local translation / rotation / scaling.
//
//   node fbx2glb.mjs input.fbx output.glb [--texture atlas.png] [--name Knife]

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('usage: fbx2glb.mjs input.fbx output.glb [--texture file.png] [--name Name]');
  process.exit(1);
}
const [input, output] = args;
const opt = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const texturePath = opt('--texture');
const meshName = opt('--name') ?? 'mesh';

// ------------------------------------------------------------ FBX parsing
const buf = readFileSync(input);
if (buf.toString('latin1', 0, 20) !== 'Kaydara FBX Binary  ') throw new Error('not a binary FBX');
const version = buf.readUInt32LE(23);
const wide = version >= 7500; // 7.5+ uses 64-bit offsets

function readNode(offset) {
  let p = offset;
  const endOffset = wide ? Number(buf.readBigUInt64LE(p)) : buf.readUInt32LE(p); p += wide ? 8 : 4;
  const numProps = wide ? Number(buf.readBigUInt64LE(p)) : buf.readUInt32LE(p); p += wide ? 8 : 4;
  const propLen = wide ? Number(buf.readBigUInt64LE(p)) : buf.readUInt32LE(p); p += wide ? 8 : 4;
  const nameLen = buf.readUInt8(p); p += 1;
  if (endOffset === 0) return { node: null, next: p + nameLen }; // null record
  const name = buf.toString('latin1', p, p + nameLen); p += nameLen;
  const props = [];
  for (let i = 0; i < numProps; i++) {
    const r = readProp(p); props.push(r.value); p = r.next;
  }
  const children = [];
  while (p < endOffset) {
    const r = readNode(p);
    if (r.node) children.push(r.node);
    p = r.next;
  }
  return { node: { name, props, children }, next: endOffset };
}

function readProp(p) {
  const type = String.fromCharCode(buf[p]); p += 1;
  switch (type) {
    case 'Y': return { value: buf.readInt16LE(p), next: p + 2 };
    case 'C': return { value: Boolean(buf[p]), next: p + 1 };
    case 'I': return { value: buf.readInt32LE(p), next: p + 4 };
    case 'F': return { value: buf.readFloatLE(p), next: p + 4 };
    case 'D': return { value: buf.readDoubleLE(p), next: p + 8 };
    case 'L': return { value: Number(buf.readBigInt64LE(p)), next: p + 8 };
    case 'S': case 'R': {
      const len = buf.readUInt32LE(p); p += 4;
      const bytes = buf.subarray(p, p + len);
      return { value: type === 'S' ? bytes.toString('latin1') : bytes, next: p + len };
    }
    case 'f': case 'd': case 'l': case 'i': case 'b': {
      const count = buf.readUInt32LE(p); const encoding = buf.readUInt32LE(p + 4); const compLen = buf.readUInt32LE(p + 8); p += 12;
      let data = buf.subarray(p, p + compLen);
      if (encoding === 1) data = inflateSync(data);
      const out = [];
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      for (let i = 0; i < count; i++) {
        if (type === 'f') out.push(dv.getFloat32(i * 4, true));
        else if (type === 'd') out.push(dv.getFloat64(i * 8, true));
        else if (type === 'i') out.push(dv.getInt32(i * 4, true));
        else if (type === 'l') out.push(Number(dv.getBigInt64(i * 8, true)));
        else out.push(Boolean(data[i]));
      }
      return { value: out, next: p + compLen };
    }
    default: throw new Error(`unknown property type ${type} at ${p - 1}`);
  }
}

const root = [];
let pos = 27;
while (pos < buf.length) {
  const r = readNode(pos);
  if (!r.node) break;
  root.push(r.node);
  pos = r.next;
}
const find = (list, name) => list.filter((n) => n.name === name);
const first = (list, name) => list.find((n) => n.name === name);
const objects = first(root, 'Objects');
const connections = first(root, 'Connections')?.children ?? [];

// Model transforms (Properties70 -> Lcl Translation / Rotation / Scaling)
const models = new Map();
for (const m of find(objects.children, 'Model')) {
  const p70 = first(m.children, 'Properties70')?.children ?? [];
  const get = (key, def) => {
    const p = p70.find((x) => x.props[0] === key);
    return p ? [p.props[4], p.props[5], p.props[6]] : def;
  };
  models.set(m.props[0], {
    id: m.props[0], name: String(m.props[1]).split('\0')[0],
    t: get('Lcl Translation', [0, 0, 0]), r: get('Lcl Rotation', [0, 0, 0]), s: get('Lcl Scaling', [1, 1, 1]),
  });
}
const geomToModel = new Map();
for (const c of connections) {
  if (c.props[0] === 'OO' && models.has(c.props[2])) geomToModel.set(c.props[1], models.get(c.props[2]));
}
const unitScale = (() => {
  const gs = first(root, 'GlobalSettings');
  const p = first(gs?.children ?? [], 'Properties70')?.children.find((x) => x.props[0] === 'UnitScaleFactor');
  return p ? p.props[4] : 1;
})();

// ------------------------------------------------------------ geometry
const positions = [], normals = [], uvs = [], indices = [];
const deg = Math.PI / 180;
function rotXYZ([x, y, z]) {
  // FBX default rotation order XYZ (applied X first)
  const cx = Math.cos(x * deg), sx = Math.sin(x * deg), cy = Math.cos(y * deg), sy = Math.sin(y * deg), cz = Math.cos(z * deg), sz = Math.sin(z * deg);
  // R = Rz * Ry * Rx
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}
function apply(m, v) { return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]]; }

let vertexBase = 0;
for (const g of find(objects.children, 'Geometry')) {
  const verts = first(g.children, 'Vertices')?.props[0];
  const polys = first(g.children, 'PolygonVertexIndex')?.props[0];
  if (!verts || !polys) continue;
  const model = geomToModel.get(g.props[0]) ?? { t: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] };
  const R = rotXYZ(model.r);
  const cm = unitScale / 100; // FBX cm -> metres

  const ln = first(g.children, 'LayerElementNormal');
  const nData = first(ln?.children ?? [], 'Normals')?.props[0];
  const nMap = first(ln?.children ?? [], 'MappingInformationType')?.props[0];
  const nRef = first(ln?.children ?? [], 'ReferenceInformationType')?.props[0];
  const nIdx = first(ln?.children ?? [], 'NormalsIndex')?.props[0];

  const lu = first(g.children, 'LayerElementUV');
  const uData = first(lu?.children ?? [], 'UV')?.props[0];
  const uMap = first(lu?.children ?? [], 'MappingInformationType')?.props[0];
  const uRef = first(lu?.children ?? [], 'ReferenceInformationType')?.props[0];
  const uIdx = first(lu?.children ?? [], 'UVIndex')?.props[0];

  const getNormal = (pv, vi) => {
    if (!nData) return null;
    let i = nMap === 'ByVertice' || nMap === 'ByVertex' ? vi : pv;
    if (nRef === 'IndexToDirect' && nIdx) i = nIdx[i];
    return [nData[i * 3], nData[i * 3 + 1], nData[i * 3 + 2]];
  };
  const getUV = (pv, vi) => {
    if (!uData) return [0, 0];
    let i = uMap === 'ByVertice' || uMap === 'ByVertex' ? vi : pv;
    if (uRef === 'IndexToDirect' && uIdx) i = uIdx[i];
    return [uData[i * 2], 1 - uData[i * 2 + 1]]; // flip V for glTF
  };

  // unroll polygons -> triangles, one vertex per polygon-vertex (flat)
  let poly = [];
  const emit = (pv) => {
    const raw = polys[pv];
    const vi = raw < 0 ? ~raw : raw;
    const p = [verts[vi * 3], verts[vi * 3 + 1], verts[vi * 3 + 2]];
    const scaled = [p[0] * model.s[0], p[1] * model.s[1], p[2] * model.s[2]];
    const rotated = apply(R, scaled);
    positions.push((rotated[0] + model.t[0]) * cm, (rotated[1] + model.t[1]) * cm, (rotated[2] + model.t[2]) * cm);
    const n = getNormal(pv, vi);
    if (n) { const rn = apply(R, n); const l = Math.hypot(...rn) || 1; normals.push(rn[0] / l, rn[1] / l, rn[2] / l); }
    uvs.push(...getUV(pv, vi));
    return vertexBase++;
  };
  for (let pv = 0; pv < polys.length; pv++) {
    poly.push(pv);
    if (polys[pv] < 0) {
      const ids = poly.map(emit);
      for (let k = 1; k + 1 < ids.length; k++) indices.push(ids[0], ids[k], ids[k + 1]);
      poly = [];
    }
  }
}
if (!positions.length) throw new Error('no geometry found');
const vertexCount = positions.length / 3;
console.log(`${input}: ${vertexCount} vertices, ${indices.length / 3} triangles, unit scale ${unitScale}`);

// ------------------------------------------------------------ GLB writing
const chunks = [];
let binLength = 0;
function addBuffer(typed, target) {
  const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const view = { buffer: 0, byteOffset: binLength, byteLength: bytes.length };
  if (target) view.target = target;
  chunks.push(bytes);
  binLength += bytes.length;
  const pad = (4 - (binLength % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); binLength += pad; }
  return view;
}
const bufferViews = [];
const accessors = [];
const posArr = new Float32Array(positions);
const minmax = (arr, n) => {
  const min = Array(n).fill(Infinity), max = Array(n).fill(-Infinity);
  for (let i = 0; i < arr.length; i += n) for (let c = 0; c < n; c++) { min[c] = Math.min(min[c], arr[i + c]); max[c] = Math.max(max[c], arr[i + c]); }
  return { min, max };
};
bufferViews.push(addBuffer(posArr, 34962));
accessors.push({ bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', ...minmax(posArr, 3) });
const attributes = { POSITION: 0 };
if (normals.length === positions.length) {
  bufferViews.push(addBuffer(new Float32Array(normals), 34962));
  accessors.push({ bufferView: bufferViews.length - 1, componentType: 5126, count: vertexCount, type: 'VEC3' });
  attributes.NORMAL = accessors.length - 1;
}
bufferViews.push(addBuffer(new Float32Array(uvs), 34962));
accessors.push({ bufferView: bufferViews.length - 1, componentType: 5126, count: vertexCount, type: 'VEC2' });
attributes.TEXCOORD_0 = accessors.length - 1;
const idxArr = vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
bufferViews.push(addBuffer(idxArr, 34963));
accessors.push({ bufferView: bufferViews.length - 1, componentType: vertexCount > 65535 ? 5125 : 5123, count: indices.length, type: 'SCALAR' });
const indicesAccessor = accessors.length - 1;

const material = { name: `${meshName}_mat`, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9 } };
const json = {
  asset: { generator: 'fbx2glb.mjs (fluffy-tribble)', version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: meshName, mesh: 0 }],
  meshes: [{ name: meshName, primitives: [{ attributes, indices: indicesAccessor, material: 0, mode: 4 }] }],
  materials: [material],
  accessors, bufferViews,
  buffers: [{ byteLength: 0 }],
};
if (texturePath) {
  const png = readFileSync(texturePath);
  bufferViews.push(addBuffer(new Uint8Array(png)));
  json.images = [{ bufferView: bufferViews.length - 1, mimeType: 'image/png', name: texturePath.split('/').pop() }];
  json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  json.textures = [{ sampler: 0, source: 0 }];
  material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
}
json.buffers[0].byteLength = binLength;

let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
const jpad = (4 - (jsonBytes.length % 4)) % 4;
if (jpad) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jpad, 0x20)]);
const bin = Buffer.concat(chunks);
const header = Buffer.alloc(12);
header.write('glTF', 0, 'latin1'); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + bin.length, 8);
const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(jsonBytes.length, 0); jsonHeader.write('JSON', 4, 'latin1');
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
writeFileSync(output, Buffer.concat([header, jsonHeader, jsonBytes, binHeader, bin]));
console.log(`wrote ${output} (${(12 + 16 + jsonBytes.length + bin.length)} bytes)`);

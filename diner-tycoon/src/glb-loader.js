// Minimal glTF 2.0 loader for static, textured meshes (.glb and .gltf).
//
// Supports: node hierarchy with TRS or matrix, meshes with multiple triangle
// primitives, indexed and non-indexed geometry, POSITION / NORMAL / TEXCOORD_0 /
// COLOR_0 attributes, PBR metallic-roughness materials with base color,
// metallic-roughness, normal, emissive and occlusion textures, embedded images
// (buffer views and data URIs) and external .bin / image files.
//
// Also supports skinned meshes (JOINTS_0 / WEIGHTS_0 + skins) and node
// animations (translation / rotation / scale, LINEAR and STEP; CUBICSPLINE
// keys are read as linear). Clips are returned on `root.animations`.
//
// Not supported: morph targets, Draco or meshopt compression,
// KHR_texture_transform, sparse accessors. Anything unknown is skipped
// rather than throwing, so a model still shows up.

import * as THREE from 'three';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENT_TYPES = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const ATTRIBUTE_NAMES = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', COLOR_0: 'color', TANGENT: 'tangent', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' };
const WRAP = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
const FILTER = {
  9728: THREE.NearestFilter, 9729: THREE.LinearFilter, 9984: THREE.NearestMipmapNearestFilter,
  9985: THREE.LinearMipmapNearestFilter, 9986: THREE.NearestMipmapLinearFilter, 9987: THREE.LinearMipmapLinearFilter,
};

export async function loadGLTF(url, { onProgress } = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const data = await res.arrayBuffer();
  const baseUrl = new URL('.', new URL(url, location.href)).href;
  return parseGLTF(data, { baseUrl, onProgress });
}

export async function parseGLTF(arrayBuffer, { baseUrl = '' } = {}) {
  let json;
  let bin = null;
  const view = new DataView(arrayBuffer);
  if (arrayBuffer.byteLength >= 12 && view.getUint32(0, true) === GLB_MAGIC) {
    const length = view.getUint32(8, true);
    let offset = 12;
    while (offset < length) {
      const chunkLength = view.getUint32(offset, true);
      const chunkType = view.getUint32(offset + 4, true);
      const chunk = arrayBuffer.slice(offset + 8, offset + 8 + chunkLength);
      if (chunkType === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(chunk));
      else if (chunkType === CHUNK_BIN && !bin) bin = chunk;
      offset += 8 + chunkLength;
    }
  } else {
    json = JSON.parse(new TextDecoder().decode(arrayBuffer));
  }
  if (!json) throw new Error('No JSON chunk in glTF');
  if (json.asset?.version && !String(json.asset.version).startsWith('2')) {
    throw new Error(`Unsupported glTF version ${json.asset.version}`);
  }
  const ctx = new Context(json, bin, baseUrl);
  return ctx.buildScene();
}

class Context {
  constructor(json, bin, baseUrl) {
    this.json = json;
    this.bin = bin;
    this.baseUrl = baseUrl;
    this.cache = { buffers: [], accessors: [], textures: [], materials: [], images: [] };
    this.nodeObjects = [];   // index -> Object3D, filled by buildScene
    this.skinnedMeshes = []; // { mesh, skinIndex }
    this.jointSet = new Set((json.skins ?? []).flatMap((s) => s.joints));
  }

  async loadBuffer(index) {
    if (this.cache.buffers[index]) return this.cache.buffers[index];
    const def = this.json.buffers[index];
    let promise;
    if (def.uri == null) promise = Promise.resolve(this.bin);
    else promise = fetch(resolveUri(def.uri, this.baseUrl)).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch buffer ${def.uri}`);
      return r.arrayBuffer();
    });
    this.cache.buffers[index] = promise;
    return promise;
  }

  async loadBufferView(index) {
    const bv = this.json.bufferViews[index];
    const buffer = await this.loadBuffer(bv.buffer);
    return { buffer, byteOffset: bv.byteOffset ?? 0, byteLength: bv.byteLength, byteStride: bv.byteStride };
  }

  async loadAccessor(index) {
    if (this.cache.accessors[index]) return this.cache.accessors[index];
    const promise = (async () => {
      const acc = this.json.accessors[index];
      const TypedArray = COMPONENT_TYPES[acc.componentType];
      const itemSize = TYPE_SIZES[acc.type];
      if (!TypedArray || !itemSize) throw new Error(`Unsupported accessor ${index}`);
      if (acc.bufferView == null) {
        // all zeros (sparse accessors without base data are treated as zeros)
        return new THREE.BufferAttribute(new TypedArray(acc.count * itemSize), itemSize, Boolean(acc.normalized));
      }
      const bv = await this.loadBufferView(acc.bufferView);
      const elementBytes = TypedArray.BYTES_PER_ELEMENT;
      const start = bv.byteOffset + (acc.byteOffset ?? 0);
      const stride = bv.byteStride;
      if (stride && stride !== itemSize * elementBytes) {
        // Interleaved: de-interleave into a tight array so the rest is simple.
        const out = new TypedArray(acc.count * itemSize);
        const dv = new DataView(bv.buffer);
        const read = readerFor(dv, acc.componentType);
        for (let i = 0; i < acc.count; i++) {
          for (let c = 0; c < itemSize; c++) out[i * itemSize + c] = read(start + i * stride + c * elementBytes);
        }
        return new THREE.BufferAttribute(out, itemSize, Boolean(acc.normalized));
      }
      // Typed arrays need aligned offsets; copy when misaligned.
      let array;
      if (start % elementBytes === 0) array = new TypedArray(bv.buffer, start, acc.count * itemSize);
      else array = new TypedArray(bv.buffer.slice(start, start + acc.count * itemSize * elementBytes));
      return new THREE.BufferAttribute(array, itemSize, Boolean(acc.normalized));
    })();
    this.cache.accessors[index] = promise;
    return promise;
  }

  async loadImage(index) {
    if (this.cache.images[index]) return this.cache.images[index];
    const promise = (async () => {
      const def = this.json.images[index];
      let blob;
      if (def.bufferView != null) {
        const bv = await this.loadBufferView(def.bufferView);
        blob = new Blob([new Uint8Array(bv.buffer, bv.byteOffset, bv.byteLength)], { type: def.mimeType ?? 'image/png' });
      } else {
        const r = await fetch(resolveUri(def.uri, this.baseUrl));
        if (!r.ok) throw new Error(`Failed to fetch image ${def.uri}`);
        blob = await r.blob();
      }
      if (typeof createImageBitmap === 'function') {
        try {
          return await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        } catch { /* fall through to <img> */ }
      }
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Could not decode image ${index}`));
          img.src = objectUrl;
        });
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    })();
    this.cache.images[index] = promise;
    return promise;
  }

  async loadTexture(index, { srgb }) {
    const key = `${index}:${srgb ? 's' : 'l'}`;
    if (this.cache.textures[key]) return this.cache.textures[key];
    const promise = (async () => {
      const def = this.json.textures[index];
      const image = await this.loadImage(def.source);
      const tex = new THREE.Texture(image);
      const sampler = def.sampler != null ? this.json.samplers[def.sampler] : {};
      tex.wrapS = WRAP[sampler.wrapS] ?? THREE.RepeatWrapping;
      tex.wrapT = WRAP[sampler.wrapT] ?? THREE.RepeatWrapping;
      tex.magFilter = FILTER[sampler.magFilter] ?? THREE.LinearFilter;
      tex.minFilter = FILTER[sampler.minFilter] ?? THREE.LinearMipmapLinearFilter;
      tex.flipY = false; // glTF UV origin is top-left
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.needsUpdate = true;
      return tex;
    })();
    this.cache.textures[key] = promise;
    return promise;
  }

  async loadMaterial(index) {
    if (index == null) return defaultMaterial();
    if (this.cache.materials[index]) return this.cache.materials[index];
    const promise = (async () => {
      const def = this.json.materials[index];
      const pbr = def.pbrMetallicRoughness ?? {};
      const mat = new THREE.MeshStandardMaterial({ name: def.name ?? `material_${index}` });
      const [r, g, b, a] = pbr.baseColorFactor ?? [1, 1, 1, 1];
      mat.color.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
      mat.opacity = a;
      mat.metalness = pbr.metallicFactor ?? 1;
      mat.roughness = pbr.roughnessFactor ?? 1;
      const jobs = [];
      if (pbr.baseColorTexture) jobs.push(this.loadTexture(pbr.baseColorTexture.index, { srgb: true }).then((t) => { mat.map = t; }));
      if (pbr.metallicRoughnessTexture) jobs.push(this.loadTexture(pbr.metallicRoughnessTexture.index, { srgb: false }).then((t) => { mat.metalnessMap = t; mat.roughnessMap = t; }));
      if (def.normalTexture) jobs.push(this.loadTexture(def.normalTexture.index, { srgb: false }).then((t) => {
        mat.normalMap = t;
        const s = def.normalTexture.scale ?? 1;
        mat.normalScale.set(s, s);
      }));
      if (def.occlusionTexture) jobs.push(this.loadTexture(def.occlusionTexture.index, { srgb: false }).then((t) => {
        mat.aoMap = t;
        mat.aoMapIntensity = def.occlusionTexture.strength ?? 1;
      }));
      if (def.emissiveTexture) jobs.push(this.loadTexture(def.emissiveTexture.index, { srgb: true }).then((t) => { mat.emissiveMap = t; }));
      if (def.emissiveFactor) {
        const [er, eg, eb] = def.emissiveFactor;
        mat.emissive.setRGB(er, eg, eb, THREE.LinearSRGBColorSpace);
      } else if (def.emissiveTexture) {
        mat.emissive.set(0xffffff);
      }
      mat.side = def.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
      if (def.alphaMode === 'BLEND') {
        mat.transparent = true;
        mat.depthWrite = false;
      } else if (def.alphaMode === 'MASK') {
        mat.alphaTest = def.alphaCutoff ?? 0.5;
      }
      await Promise.all(jobs.map((j) => j.catch((err) => console.warn('[glb-loader] texture skipped:', err.message))));
      mat.needsUpdate = true;
      return mat;
    })();
    this.cache.materials[index] = promise;
    return promise;
  }

  async buildMesh(index, skinIndex = null) {
    const def = this.json.meshes[index];
    const group = new THREE.Group();
    group.name = def.name ?? `mesh_${index}`;
    for (const prim of def.primitives) {
      const mode = prim.mode ?? 4;
      if (mode !== 4 && mode !== 5 && mode !== 6) {
        console.warn(`[glb-loader] skipping primitive with mode ${mode}`);
        continue;
      }
      const geometry = new THREE.BufferGeometry();
      for (const [semantic, accIndex] of Object.entries(prim.attributes)) {
        const name = ATTRIBUTE_NAMES[semantic];
        if (!name) continue;
        geometry.setAttribute(name, await this.loadAccessor(accIndex));
      }
      if (prim.indices != null) geometry.setIndex(await this.loadAccessor(prim.indices));
      if (mode === 5 || mode === 6) {
        // Convert strips/fans to plain triangles so BufferGeometry can draw them.
        const idx = geometry.getIndex()?.array ?? Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i);
        const tris = [];
        for (let i = 2; i < idx.length; i++) {
          if (mode === 5) tris.push(idx[i - 2], i % 2 ? idx[i] : idx[i - 1], i % 2 ? idx[i - 1] : idx[i]);
          else tris.push(idx[0], idx[i - 1], idx[i]);
        }
        geometry.setIndex(tris);
      }
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      const material = await this.loadMaterial(prim.material);
      if (geometry.getAttribute('color')) material.vertexColors = true;
      const skinned = skinIndex != null && geometry.getAttribute('skinIndex') && geometry.getAttribute('skinWeight');
      const mesh = skinned ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
      if (skinned) {
        // glTF weights may be normalized ints; three wants floats in [0,1]
        const w = geometry.getAttribute('skinWeight');
        if (w.normalized || !(w.array instanceof Float32Array)) {
          const f = new Float32Array(w.count * w.itemSize);
          for (let i = 0; i < f.length; i++) f[i] = w.normalized ? w.array[i] / (w.array instanceof Uint8Array ? 255 : 65535) : w.array[i];
          geometry.setAttribute('skinWeight', new THREE.BufferAttribute(f, w.itemSize));
        }
        mesh.frustumCulled = false;
        this.skinnedMeshes.push({ mesh, skinIndex });
      }
      mesh.name = group.name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    // A single-primitive mesh does not need a wrapper group.
    if (group.children.length === 1) {
      const only = group.children[0];
      group.remove(only);
      return only;
    }
    return group;
  }

  async buildNode(index) {
    const def = this.json.nodes[index];
    let obj;
    if (def.mesh != null) {
      obj = await this.buildMesh(def.mesh, def.skin ?? null);
      if (this.jointSet.has(index)) {
        // A node that is both a joint and a mesh carrier: wrap so the bone stays a Bone.
        const bone = new THREE.Bone();
        bone.add(obj);
        obj = bone;
      }
    } else if (this.jointSet.has(index)) {
      obj = new THREE.Bone();
    } else {
      obj = new THREE.Group();
    }
    obj.name = def.name ?? obj.name ?? `node_${index}`;
    this.nodeObjects[index] = obj;
    if (def.matrix) {
      const m = new THREE.Matrix4().fromArray(def.matrix);
      m.decompose(obj.position, obj.quaternion, obj.scale);
    } else {
      if (def.translation) obj.position.fromArray(def.translation);
      if (def.rotation) obj.quaternion.fromArray(def.rotation);
      if (def.scale) obj.scale.fromArray(def.scale);
    }
    for (const child of def.children ?? []) obj.add(await this.buildNode(child));
    return obj;
  }

  async buildScene() {
    this.syncAccessors = {};
    for (const anim of this.json.animations ?? []) {
      for (const s of anim.samplers) {
        this.syncAccessors[s.input] = await this.loadAccessor(s.input);
        this.syncAccessors[s.output] = await this.loadAccessor(s.output);
      }
    }
    const sceneDef = this.json.scenes?.[this.json.scene ?? 0];
    const root = new THREE.Group();
    root.name = sceneDef?.name ?? 'gltf-scene';
    const nodeIndices = sceneDef?.nodes ?? (this.json.nodes ?? []).map((_, i) => i);
    for (const n of nodeIndices) root.add(await this.buildNode(n));
    root.updateMatrixWorld(true);
    await this.bindSkins();
    root.animations = this.buildAnimations();
    return root;
  }

  async bindSkins() {
    for (const { mesh, skinIndex } of this.skinnedMeshes) {
      const skin = this.json.skins[skinIndex];
      const bones = skin.joints.map((j) => this.nodeObjects[j]);
      if (bones.some((b) => !b)) {
        console.warn('[glb-loader] skin references a node outside the scene; skipping bind');
        continue;
      }
      let inverses;
      if (skin.inverseBindMatrices != null) {
        const acc = await this.loadAccessor(skin.inverseBindMatrices);
        inverses = bones.map((_, i) => new THREE.Matrix4().fromArray(acc.array, i * 16));
      }
      const skeleton = new THREE.Skeleton(bones, inverses);
      // glTF: the skinned mesh node's own transform is ignored; joints and
      // inverse bind matrices alone place the vertices. Bind with identity.
      mesh.bind(skeleton, new THREE.Matrix4());
    }
  }

  buildAnimations() {
    const clips = [];
    for (const [ai, anim] of (this.json.animations ?? []).entries()) {
      const tracks = [];
      for (const ch of anim.channels) {
        const target = this.nodeObjects[ch.target.node];
        const sampler = anim.samplers[ch.sampler];
        if (!target || !sampler) continue;
        const input = this.syncAccessor(sampler.input);
        const output = this.syncAccessor(sampler.output);
        if (!input || !output) continue;
        const path = ch.target.path;
        let TrackType, prop;
        if (path === 'translation') { TrackType = THREE.VectorKeyframeTrack; prop = 'position'; }
        else if (path === 'rotation') { TrackType = THREE.QuaternionKeyframeTrack; prop = 'quaternion'; }
        else if (path === 'scale') { TrackType = THREE.VectorKeyframeTrack; prop = 'scale'; }
        else continue; // morph weights not supported
        const times = Array.from(input.array);
        let values = normalizedValues(output);
        if (sampler.interpolation === 'CUBICSPLINE') {
          // keys are [inTangent, value, outTangent] triples: keep the values
          const size = output.itemSize;
          const picked = new Float32Array(times.length * size);
          for (let k = 0; k < times.length; k++) for (let c = 0; c < size; c++) picked[k * size + c] = values[(k * 3 + 1) * size + c];
          values = picked;
        }
        const track = new TrackType(`${target.uuid}.${prop}`, times, values);
        track.setInterpolation(sampler.interpolation === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear);
        tracks.push(track);
      }
      if (tracks.length) clips.push(new THREE.AnimationClip(anim.name ?? `animation_${ai}`, -1, tracks));
    }
    return clips;
  }

  /** Accessor already loaded by loadAccessor during a pre-pass (see preloadAnimationAccessors). */
  syncAccessor(index) {
    return this.syncAccessors?.[index] ?? null;
  }
}

function normalizedValues(attr) {
  if (attr.array instanceof Float32Array) return attr.array;
  const out = new Float32Array(attr.array.length);
  const A = attr.array;
  const scale = A instanceof Int8Array ? 127 : A instanceof Uint8Array ? 255 : A instanceof Int16Array ? 32767 : A instanceof Uint16Array ? 65535 : 1;
  for (let i = 0; i < A.length; i++) out[i] = attr.normalized ? Math.max(A[i] / scale, -1) : A[i];
  return out;
}

function readerFor(dv, componentType) {
  switch (componentType) {
    case 5120: return (o) => dv.getInt8(o);
    case 5121: return (o) => dv.getUint8(o);
    case 5122: return (o) => dv.getInt16(o, true);
    case 5123: return (o) => dv.getUint16(o, true);
    case 5125: return (o) => dv.getUint32(o, true);
    default: return (o) => dv.getFloat32(o, true);
  }
}

function resolveUri(uri, baseUrl) {
  if (/^data:/.test(uri)) return uri;
  return new URL(uri, baseUrl || location.href).href;
}

/** Set every bone to keyframe 0 of the clip with the most tracks. */
export function applyClipPose(root, clips, clipName = null) {
  const clip = clipName ? clips.find((c) => c.name === clipName) : clips.reduce((a, b) => (b.tracks.length > a.tracks.length ? b : a));
  if (!clip) return;
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const uuid = track.name.slice(0, dot), prop = track.name.slice(dot + 1);
    const obj = root.getObjectByProperty('uuid', uuid);
    if (!obj || !obj[prop]) continue;
    obj[prop].fromArray(track.values, 0);
  }
}

let sharedDefault = null;
function defaultMaterial() {
  if (!sharedDefault) sharedDefault = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 1 });
  return sharedDefault;
}

/**
 * Convenience: load a model, center it on the ground (min y = 0, centered in
 * x/z) and scale it so its tallest dimension equals `height` world units.
 */
export async function loadModelFitted(url, { height = 1, center = true } = {}) {
  const root = await loadGLTF(url);
  return fitModel(root, { height, center });
}

/** Wrap an already-parsed model so it stands on y=0, centered, `height` tall. */
export function fitModel(root, { height = 1, center = true, poseFromClip = true } = {}) {
  // Some rigs (FBX exports especially) store a rest pose that differs from
  // every animation, e.g. lying on their back until a clip rotates the root
  // bone. Posing the skeleton at frame 0 of the richest clip first gives a
  // sensible default pose and a correct bounding box.
  if (poseFromClip && root.animations?.length) applyClipPose(root, root.animations);
  root.updateMatrixWorld(true);
  // SkinnedMesh.computeBoundingBox is skin-aware, so rigged characters are
  // measured in their bind pose here rather than in raw mesh space.
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = height / maxDim;
  const wrapper = new THREE.Group();
  wrapper.add(root);
  root.scale.setScalar(s);
  if (center) {
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  }
  wrapper.userData.size = size.multiplyScalar(s);
  wrapper.animations = root.animations ?? [];
  wrapper.userData.model = root;
  return wrapper;
}

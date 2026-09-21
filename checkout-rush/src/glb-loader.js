// Minimal glTF 2.0 loader for static, textured meshes (.glb and .gltf).
//
// Supports: node hierarchy with TRS or matrix, meshes with multiple triangle
// primitives, indexed and non-indexed geometry, POSITION / NORMAL / TEXCOORD_0 /
// COLOR_0 attributes, PBR metallic-roughness materials with base color,
// metallic-roughness, normal, emissive and occlusion textures, embedded images
// (buffer views and data URIs) and external .bin / image files.
//
// Not supported: skins, animations, morph targets, Draco or meshopt
// compression, KHR_texture_transform, sparse accessors. Anything unknown is
// skipped rather than throwing, so a model still shows up.

import * as THREE from 'three';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENT_TYPES = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const ATTRIBUTE_NAMES = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', COLOR_0: 'color', TANGENT: 'tangent' };
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

  async buildMesh(index) {
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
      const mesh = new THREE.Mesh(geometry, material);
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
    if (def.mesh != null) obj = await this.buildMesh(def.mesh);
    else obj = new THREE.Group();
    obj.name = def.name ?? obj.name ?? `node_${index}`;
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
    const sceneDef = this.json.scenes?.[this.json.scene ?? 0];
    const root = new THREE.Group();
    root.name = sceneDef?.name ?? 'gltf-scene';
    const nodeIndices = sceneDef?.nodes ?? (this.json.nodes ?? []).map((_, i) => i);
    for (const n of nodeIndices) root.add(await this.buildNode(n));
    return root;
  }
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
  return wrapper;
}

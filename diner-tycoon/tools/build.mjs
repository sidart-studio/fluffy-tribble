#!/usr/bin/env node
// Builds the playable pages from page.html + src/ + models/.
//
//   node tools/build.mjs
//
// Outputs:
//   index.html                  dev page: separate modules, vendored three, fetches models/
//   dist/short-order-tycoon.html   single file for double-clicking (three inlined, models embedded)
//   dist/artifact.html          single file fragment for claude.ai artifacts (three from jsdelivr)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const page = read('page.html');
const manifest = JSON.parse(read('models/manifest.json'));

// ---- dev index.html -------------------------------------------------------
const styleAndTitle = page.slice(0, page.indexOf('<canvas'));
const body = page.slice(page.indexOf('<canvas'));
const devIndex = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${styleAndTitle.trim()}
</head>
<body>
${body.trim()}
<script type="importmap">{ "imports": { "three": "./vendor/three/three.module.js", "three/addons/": "./vendor/three/addons/" } }</script>
<script type="module">
  import { Game } from './src/game.js';
  const manifest = await (await fetch('models/manifest.json')).json();
  const game = new Game({ canvas: document.getElementById('c'), manifest });
  window.__tycoon = game;
  game.load();
</script>
</body>
</html>
`;
writeFileSync(path.join(root, 'index.html'), devIndex);

// ---- bundle our modules into one script -----------------------------------
// Order matters: dependencies first. OrbitControls imports named symbols from
// 'three'; we rewrite those to destructure from the single THREE namespace.
const modules = [
  'vendor/three/addons/controls/OrbitControls.js',
  'src/glb-loader.js',
  'src/audio.js',
  'src/config.js',
  'src/world.js',
  'src/game.js',
];
function stripModule(code) {
  // named imports from 'three' -> destructuring
  code = code.replace(/import\s*\{([^}]*)\}\s*from\s*['"]three['"];?/g, (_, names) => `const {${names}} = THREE;`);
  code = code.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?/g, '');
  // local imports are already concatenated
  code = code.replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\/[^'"]+['"];?/g, '');
  code = code.replace(/import\s*\{[^}]*\}\s*from\s*['"]three\/addons\/[^'"]+['"];?/g, '');
  // exports become plain declarations
  code = code.replace(/^export\s+(const|let|class|function|async function)\s/gm, '$1 ');
  code = code.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  return code;
}
const bundled = modules.map((m) => `// ---- ${m}\n${stripModule(read(m))}`).join('\n\n');

// models as base64
const modelData = {};
for (const [, e] of Object.entries(manifest.models)) {
  modelData[e.file] = readFileSync(path.join(root, 'models', e.file)).toString('base64');
}
const boot = `
const MANIFEST = ${JSON.stringify(manifest)};
const MODEL_B64 = ${JSON.stringify(modelData)};
function b64ToBuffer(b64) {
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
const modelBytes = Object.fromEntries(Object.entries(MODEL_B64).map(([k, v]) => [k, b64ToBuffer(v)]));
const game = new Game({ canvas: document.getElementById('c'), manifest: MANIFEST, modelBytes });
window.__tycoon = game;
game.load();
`;

function singleFile({ threeSpecifier, wrapDocument }) {
  const importMap = `<script type="importmap">{ "imports": { "three": ${JSON.stringify(threeSpecifier)} } }</script>`;
  const script = `<script type="module">\nimport * as THREE from 'three';\n${bundled}\n${boot}\n</script>`;
  const inner = `${styleAndTitle.trim()}\n${body.trim()}\n${importMap}\n${script}\n`;
  if (!wrapDocument) return inner;
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${inner}</body>\n</html>\n`;
}

mkdirSync(path.join(root, 'dist'), { recursive: true });
// standalone: three.js inlined as a data: URL module so it works from file://
const threeSrc = read('vendor/three/three.module.js');
const threeData = `data:text/javascript;base64,${Buffer.from(threeSrc, 'utf8').toString('base64')}`;
const standalone = singleFile({ threeSpecifier: threeData, wrapDocument: true });
writeFileSync(path.join(root, 'dist/short-order-tycoon.html'), standalone);
// artifact: three from jsdelivr (allowed by the artifact CSP), no document wrapper
const artifact = singleFile({ threeSpecifier: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', wrapDocument: false });
writeFileSync(path.join(root, 'dist/artifact.html'), artifact);
// artifact-local: same as artifact but three vendored, for testing the fragment locally
writeFileSync(path.join(root, 'dist/artifact-local-test.html'), singleFile({ threeSpecifier: '../vendor/three/three.module.js', wrapDocument: true }));

const kb = (p) => `${(readFileSync(path.join(root, p)).length / 1024).toFixed(0)} KB`;
console.log(`index.html (dev)                 ${kb('index.html')}`);
console.log(`dist/short-order-tycoon.html     ${kb('dist/short-order-tycoon.html')}`);
console.log(`dist/artifact.html               ${kb('dist/artifact.html')}`);

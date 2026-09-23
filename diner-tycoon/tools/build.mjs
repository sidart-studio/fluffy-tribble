#!/usr/bin/env node
// Builds the playable pages from page.html + src/ + models/.
//
//   node tools/build.mjs
//
// Outputs:
//   index.html                  dev page: separate modules, vendored three, fetches models/
//   dist/short-order-tycoon.html   single file for double-clicking (three inlined, models embedded)
//   dist/artifact.html          same page as a fragment for claude.ai artifacts (no doctype/html wrapper)

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
  'src/fx.js',
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

// Three.js inlined as one namespace object: the module's trailing
// `export { ... }` becomes `return { ... }` inside an IIFE, so nothing is
// fetched at runtime and three's internal names cannot collide with ours.
const threeSrc = read('vendor/three/three.module.js');
const exportMatch = threeSrc.match(/export\s*\{([\s\S]*?)\};?\s*$/);
if (!exportMatch) throw new Error('could not find the export list in three.module.js');
const exportNames = exportMatch[1].split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
  const m = x.match(/^(\S+)\s+as\s+(\S+)$/);
  return m ? `${m[2]}: ${m[1]}` : x;
});
const threeInline = `const THREE = (() => {\n${threeSrc.slice(0, exportMatch.index)}\nreturn { ${exportNames.join(', ')} };\n})();`;

function singleFile({ wrapDocument }) {
  const script = `<script type="module">\n${threeInline}\n${bundled}\n${boot}\n</script>`;
  const inner = `${styleAndTitle.trim()}\n${body.trim()}\n${script}\n`;
  if (!wrapDocument) return inner;
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${inner}</body>\n</html>\n`;
}

mkdirSync(path.join(root, 'dist'), { recursive: true });
// standalone: a complete document, works from file://
writeFileSync(path.join(root, 'dist/short-order-tycoon.html'), singleFile({ wrapDocument: true }));
// artifact: the same page without the document wrapper (claude.ai adds its own)
writeFileSync(path.join(root, 'dist/artifact.html'), singleFile({ wrapDocument: false }));

const kb = (p) => `${(readFileSync(path.join(root, p)).length / 1024).toFixed(0)} KB`;
console.log(`index.html (dev)                 ${kb('index.html')}`);
console.log(`dist/short-order-tycoon.html     ${kb('dist/short-order-tycoon.html')}`);
console.log(`dist/artifact.html               ${kb('dist/artifact.html')}`);

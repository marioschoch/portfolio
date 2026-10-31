/**
 * Builds public/models/learnanatomy.glb, the small model on the learnanatomy project page, from the
 * built assets of the learnanatomy.org repository: one mesh each for bones, nerves and muscles.
 *
 *   node scripts/anatomy-model.mjs ~/Desktop/Projekte/learnanatomy.org
 *
 * The atlas repository must have run `npm install` and `npm run assets:build` (its
 * public/models/). glTF Transform and meshoptimizer are loaded from its node_modules, so this
 * site needs no extra dependencies.
 *
 * Kept: every bone except the sinus and air-cell surfaces; brain, spinal cord and nerves (no
 * sense organs, no meninges, no non-commercial parts); muscles and tendons (no fasciae, bursae or
 * tendon sheaths, and nothing the atlas hides by default). Each layer is joined into one mesh,
 * simplified, quantized and meshopt-compressed. The model is a modified version of Z-Anatomy and
 * stays under CC BY-SA 4.0 (credit on the project page).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const atlas = resolve(process.argv[2] ?? '');
const OUT = 'public/models/learnanatomy.glb';
/** Share of triangles kept per layer, and the largest allowed deviation (fraction of body height). */
const LAYERS = [
  { system: 'skeletal', name: 'bones', ratio: 0.25 },
  { system: 'nervous', name: 'nerves', ratio: 0.12 },
  { system: 'muscular', name: 'muscles', ratio: 0.1 },
];
const MAX_ERROR = 0.0015;

const require = createRequire(join(atlas, 'package.json'));
const load = (name) => import(pathToFileURL(require.resolve(name)).href);
const { Document, NodeIO } = await load('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = await load('@gltf-transform/extensions');
const fn = await load('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await load('meshoptimizer');

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const models = join(atlas, 'public/models');
const manifest = JSON.parse(readFileSync(join(models, 'manifest.json'), 'utf8'));
const hiddenByDefault = new Set(manifest.defaultHiddenIds);

/** Structures of a system, each with the chain of group ids above it. */
function structures(system) {
  const data = JSON.parse(readFileSync(join(models, 'structures', `${system}.json`), 'utf8'));
  const groups = new Map(data.groups.map((g) => [g.id, g]));
  return data.structures.map((s) => {
    const chain = [];
    for (let id = s.parentId; id && groups.has(id); id = groups.get(id).parentId) chain.push(id);
    return { ...s, chain };
  });
}

// Nervous structures without a group are mostly nerves, plus a few parts of the eye and ear.
const NERVOUS_NAME =
  /nerve|branch|gangli|nucleus|plexus|trunk|root|tract|gyrus|olive|chorda|division|cord|lobe|sulcus|cortex|fasciculus|lemniscus|peduncle|colliculus|thalamus|pons|medulla/i;
const keep = {
  skeletal: (s) => !/^Sinus of|cells of ethmoid/.test(s.names.en),
  nervous: (s) =>
    !s.nonCommercial &&
    !s.chain.includes('g-sense-organs') &&
    !s.chain.includes('g-meninges') &&
    (s.chain.length > 0 || NERVOUS_NAME.test(s.names.en)),
  muscular: (s) =>
    !hiddenByDefault.has(s.id) &&
    !['g-fasciae', 'g-synovial-bursae', 'g-tendon-sheaths'].some((g) => s.chain.includes(g)),
};

const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);

const target = new Document();
const buffer = target.createBuffer();
const scene = target.createScene('anatomy');

for (const layer of LAYERS) {
  const doc = await io.read(join(models, `${layer.system}.glb`));
  const root = doc.getRoot();
  const kept = new Set(
    structures(layer.system)
      .filter(keep[layer.system])
      .map((s) => s.nodeName),
  );
  for (const node of root.listNodes()) if (!kept.has(node.getName())) node.dispose();
  await doc.transform(fn.prune(), fn.dequantize());

  // Bake every structure into world space, strip the atlas's own attributes, one material.
  const material = doc.createMaterial(layer.name);
  const group = doc.createNode(layer.name);
  for (const node of root.listNodes()) {
    if (node === group) continue;
    fn.clearNodeTransform(node);
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      for (const semantic of prim.listSemantics()) {
        if (semantic !== 'POSITION' && semantic !== 'NORMAL') prim.setAttribute(semantic, null);
      }
      prim.setMaterial(material);
    }
    group.addChild(node);
  }
  for (const s of root.listScenes()) s.dispose();
  doc.createScene().addChild(group);

  const before = triangles(doc);
  await doc.transform(
    fn.join({ keepNamed: false }),
    fn.weld(),
    fn.simplify({ simplifier: MeshoptSimplifier, ratio: layer.ratio, error: MAX_ERROR }),
    fn.prune(),
  );
  console.log(`${layer.name}: ${kept.size} structures, ${before} → ${triangles(doc)} triangles`);

  // After join() the layer is one primitive somewhere under its group node; move it to a new node.
  const map = fn.mergeDocuments(target, doc);
  const merged = map.get(doc.getRoot().listScenes()[0]);
  const nodes = merged.listChildren().flatMap((n) => [n, ...n.listChildren()]);
  const meshes = nodes.map((n) => n.getMesh()).filter(Boolean);
  const prim = meshes.flatMap((m) => m.listPrimitives())[0];
  scene.addChild(
    target.createNode(layer.name).setMesh(target.createMesh(layer.name).addPrimitive(prim)),
  );
  for (const m of meshes) m.removePrimitive(prim).dispose();
  for (const n of nodes) n.dispose();
  merged.dispose();
}

// mergeDocuments brings one buffer per source; a GLB holds one.
for (const accessor of target.getRoot().listAccessors()) accessor.setBuffer(buffer);
target.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
  method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
});
await target.transform(
  fn.prune(),
  fn.reorder({ encoder: MeshoptEncoder }),
  fn.quantize({ quantizePosition: 14, quantizeNormal: 8 }),
);
await io.write(OUT, target);
console.log(`${OUT}: ${triangles(target)} triangles`);

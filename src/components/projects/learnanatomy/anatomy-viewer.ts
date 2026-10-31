/**
 * The 3D figure on the learnanatomy project page: bones, nerves and muscles from
 * public/models/learnanatomy.glb (built by scripts/anatomy-model.mjs), drawn with three.js.
 * The muscles are cut by a horizontal plane: below it they are shown, above it only bones and
 * nerves remain. The page moves the plane (a height in metres) and turns the figure; this module
 * only draws and reports where a height lands on the screen, so the page can place its overlay.
 *
 * Model space: metres, +Y up, feet at y = 0, the body faces +Z (the atlas's coordinates).
 */
import {
  Box3,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type Layer = 'bones' | 'nerves' | 'muscles';

/** Field of view and margin; the poster image is rendered with the same framing. */
export const FOV = 18;
export const MARGIN = 0.06;

export interface AnatomyViewer {
  /** Body height in metres. */
  height: number;
  setColours(colours: Record<Layer, string>): void;
  setVisible(layer: Layer, visible: boolean): void;
  /** Muscles are drawn up to this height (metres). */
  setCut(y: number): void;
  /** Turns the figure about its vertical axis (radians, 0 = facing the viewer). */
  setYaw(yaw: number): void;
  /** Screen position (px from the top of the canvas) of a height on the body's axis, and back. */
  toScreen(y: number): number;
  fromScreen(px: number): number;
  resize(): void;
}

/**
 * Camera distance that fits a box of the given width and height into the view, with MARGIN on
 * every side. Shared with the poster render, so poster and live figure line up.
 */
export function fitDistance(width: number, height: number, aspect: number) {
  const tan = Math.tan(MathUtils.degToRad(FOV / 2));
  const h = height / (1 - 2 * MARGIN) / 2;
  const w = width / (1 - 2 * MARGIN) / 2;
  return Math.max(h / tan, w / (tan * aspect));
}

export async function createAnatomyViewer(
  canvas: HTMLCanvasElement,
  src: string,
): Promise<AnatomyViewer> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.localClippingEnabled = true;

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x8a877f, 1.6));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(-1.5, 2.5, 3);
  const rim = new DirectionalLight(0xffffff, 0.8);
  rim.position.set(2, 1, -2);
  scene.add(key, rim);

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(src);
  // Keeps what lies below `constant` (metres); starts above the head.
  const cut = new Plane(new Vector3(0, -1, 0), 10);
  const materials = {} as Record<Layer, MeshStandardMaterial>;
  const meshes = {} as Record<Layer, Mesh>;
  gltf.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const layer = object.name as Layer;
    // Muscles are cut open, so their inside must be drawn too.
    const material = new MeshStandardMaterial({
      roughness: layer === 'nerves' ? 0.5 : 0.75,
      metalness: 0,
      side: layer === 'muscles' ? DoubleSide : FrontSide,
      clippingPlanes: layer === 'muscles' ? [cut] : [],
    });
    object.material = material;
    materials[layer] = material;
    meshes[layer] = object;
  });

  // Centre the body on the vertical axis; keep the feet at y = 0.
  const box = new Box3().setFromObject(gltf.scene);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  gltf.scene.position.set(-centre.x, -box.min.y, -centre.z);
  const figure = new Group().add(gltf.scene);
  scene.add(figure);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  let frame = 0;
  const render = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      renderer.render(scene, camera);
    });
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the widest the figure gets while turning (arms out, seen from the front).
    camera.position.set(0, size.y / 2, fitDistance(size.x, size.y, camera.aspect));
    camera.lookAt(0, size.y / 2, 0);
    camera.updateProjectionMatrix();
    render();
  };
  resize();

  const point = new Vector3();
  return {
    height: size.y,
    setColours(colours) {
      for (const layer of Object.keys(materials) as Layer[]) {
        materials[layer].color = new Color(colours[layer]);
      }
      render();
    },
    setVisible(layer, visible) {
      meshes[layer].visible = visible;
      render();
    },
    setCut(y) {
      cut.constant = y;
      render();
    },
    setYaw(yaw) {
      figure.rotation.y = yaw;
      render();
    },
    toScreen(y) {
      point.set(0, y, 0).project(camera);
      return ((1 - point.y) / 2) * canvas.clientHeight;
    },
    fromScreen(px) {
      // The camera looks straight ahead, so heights on the body's axis map linearly.
      const ndc = 1 - (2 * px) / canvas.clientHeight;
      const tan = Math.tan(MathUtils.degToRad(FOV / 2));
      return camera.position.y + ndc * tan * camera.position.z;
    },
    resize,
  };
}

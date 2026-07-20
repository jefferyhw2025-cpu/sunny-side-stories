import * as THREE from "three";

import type {
  Character,
  CharacterGrounding,
  CharacterProfile,
  CharacterState,
} from "./characters";

const ATLAS_URL = "art/resident-sprite-atlas-v1.png";
const ATLAS_ROWS = 3;
const ATLAS_COLUMNS = 5;
const CELL_WIDTH = 384;
const CELL_HEIGHT = 426;
const DISPLAY_HEIGHT = 3.02;
const PIXEL_SCALE = DISPLAY_HEIGHT / (CELL_HEIGHT * 0.94);
const GRID_COLUMNS = 48;
const GRID_ROWS = 56;

export type ResidentPuppetPartName =
  | "head"
  | "neck"
  | "torso"
  | "leftArm"
  | "leftForearm"
  | "rightArm"
  | "rightForearm"
  | "leftLeg"
  | "leftShin"
  | "leftFoot"
  | "rightLeg"
  | "rightShin"
  | "rightFoot";

type Point = readonly [x: number, y: number];

type PuppetLayout = {
  readonly ground: number;
  readonly hip: Point;
  readonly torso: Point;
  readonly neck: Point;
  readonly head: Point;
  readonly leftArm: Point;
  readonly leftForearm: Point;
  readonly rightArm: Point;
  readonly rightForearm: Point;
  readonly leftLeg: Point;
  readonly leftShin: Point;
  readonly leftFoot: Point;
  readonly rightLeg: Point;
  readonly rightShin: Point;
  readonly rightFoot: Point;
  readonly leftSole: Point;
  readonly rightSole: Point;
};

export interface ResidentPuppetPack {
  /** Alpha-cleaned, front-facing source cell for each approved resident. */
  readonly cells: readonly HTMLCanvasElement[];
}

export interface ResidentPuppetPart {
  readonly joint: THREE.Bone;
  readonly basePosition: THREE.Vector3;
}

export interface ResidentPuppetRuntime {
  readonly character: Character;
  readonly profile: CharacterProfile;
  readonly group: THREE.Group;
  readonly visualRoot: THREE.Group;
  readonly figureRoot: THREE.Bone;
  readonly hips: THREE.Bone;
  readonly skeleton: THREE.Skeleton;
  /** One continuous deforming surface for the whole painted resident. */
  readonly mesh: THREE.SkinnedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly texture: THREE.CanvasTexture;
  readonly parts: Readonly<Record<ResidentPuppetPartName, ResidentPuppetPart>>;
  readonly leftSoleMarker: THREE.Object3D;
  readonly rightSoleMarker: THREE.Object3D;
  readonly shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  state: CharacterState;
  stateStartedAt: number;
  disposed: boolean;
  grounding: CharacterGrounding;
}

type HiddenObject = {
  readonly object: THREE.Object3D;
  readonly visible: boolean;
};

type InternalRuntime = ResidentPuppetRuntime & {
  readonly hiddenObjects: readonly HiddenObject[];
};

const BASE_LAYOUT: PuppetLayout = {
  ground: 0.955,
  hip: [0.5, 0.69],
  torso: [0.5, 0.455],
  neck: [0.5, 0.445],
  head: [0.5, 0.455],
  leftArm: [0.355, 0.47],
  leftForearm: [0.305, 0.59],
  rightArm: [0.645, 0.47],
  rightForearm: [0.695, 0.59],
  leftLeg: [0.425, 0.695],
  leftShin: [0.415, 0.805],
  leftFoot: [0.405, 0.91],
  rightLeg: [0.575, 0.695],
  rightShin: [0.585, 0.805],
  rightFoot: [0.595, 0.91],
  leftSole: [0.405, 0.948],
  rightSole: [0.595, 0.948],
};

const SKIRT_LAYOUT: PuppetLayout = {
  ...BASE_LAYOUT,
  hip: [0.5, 0.725],
  leftLeg: [0.425, 0.73],
  leftShin: [0.415, 0.825],
  leftFoot: [0.405, 0.915],
  rightLeg: [0.575, 0.73],
  rightShin: [0.585, 0.825],
  rightFoot: [0.595, 0.915],
  leftSole: [0.405, 0.95],
  rightSole: [0.595, 0.95],
};

const BONE_INDEX = {
  root: 0,
  hips: 1,
  torso: 2,
  neck: 3,
  head: 4,
  leftArm: 5,
  leftForearm: 6,
  rightArm: 7,
  rightForearm: 8,
  leftLeg: 9,
  leftShin: 10,
  leftFoot: 11,
  rightLeg: 12,
  rightShin: 13,
  rightFoot: 14,
} as const;

let packPromise: Promise<ResidentPuppetPack> | null = null;
let loadedPack: ResidentPuppetPack | null = null;

const worldPosition = new THREE.Vector3();
const secondWorldPosition = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
const worldScale = new THREE.Vector3();
const parentQuaternion = new THREE.Quaternion();
const targetQuaternion = new THREE.Quaternion();
const localQuaternion = new THREE.Quaternion();

function spriteRow(profile: CharacterProfile): number {
  if (String(profile.id) === "2") return 0;
  if (String(profile.id) === "1") return 1;
  if (String(profile.id) === "3") return 2;
  const hair = Number(profile.hairStyle);
  const outfit = Number(profile.outfitStyle);
  if (outfit === 3 || hair === 1 || hair === 10) return 2;
  if (hair === 4 || hair === 5 || hair === 6 || hair === 7) return 1;
  return 0;
}

function chromaAlpha(red: number, green: number, blue: number): number {
  const distance = Math.hypot(red, 255 - green, blue);
  if (distance <= 62) return 0;
  if (distance >= 154) return 1;
  const value = (distance - 62) / 92;
  return value * value * (3 - 2 * value);
}

function alphaCleanCell(
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  row: number,
): HTMLCanvasElement {
  const sourceX = 0;
  const sourceY = Math.round(row * imageHeight / ATLAS_ROWS);
  const sourceRight = Math.round(imageWidth / ATLAS_COLUMNS);
  const sourceBottom = Math.round((row + 1) * imageHeight / ATLAS_ROWS);
  const canvas = document.createElement("canvas");
  canvas.width = CELL_WIDTH;
  canvas.height = CELL_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D canvas is unavailable for resident puppet assets");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceRight - sourceX,
    sourceBottom - sourceY,
    0,
    0,
    CELL_WIDTH,
    CELL_HEIGHT,
  );
  const pixels = context.getImageData(0, 0, CELL_WIDTH, CELL_HEIGHT);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const red = pixels.data[offset];
    const green = pixels.data[offset + 1];
    const blue = pixels.data[offset + 2];
    const alpha = chromaAlpha(red, green, blue);
    pixels.data[offset + 3] = Math.round(pixels.data[offset + 3] * alpha);
    if (alpha < 1) {
      pixels.data[offset + 1] = Math.min(green, Math.round(Math.max(red, blue) * 1.08));
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function loadPack(): Promise<ResidentPuppetPack> {
  if (typeof document === "undefined") {
    throw new Error("Resident puppets can only be preloaded in a browser");
  }
  const source = await new THREE.TextureLoader().loadAsync(ATLAS_URL);
  const image = source.image as CanvasImageSource & {
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
  };
  const width = image.naturalWidth ?? image.width ?? 0;
  const height = image.naturalHeight ?? image.height ?? 0;
  if (width < ATLAS_COLUMNS || height < ATLAS_ROWS) {
    source.dispose();
    throw new Error("Resident puppet atlas has invalid dimensions");
  }
  const cells = Array.from({ length: ATLAS_ROWS }, (_, row) =>
    alphaCleanCell(image, width, height, row),
  );
  source.dispose();
  return { cells };
}

/** Preload and alpha-clean the approved painted resident artwork once. */
export function preloadResidentPuppets(): Promise<ResidentPuppetPack> {
  packPromise ??= loadPack().then((pack) => {
    loadedPack = pack;
    return pack;
  }).catch((error) => {
    packPromise = null;
    loadedPack = null;
    throw error;
  });
  return packPromise;
}

function isBuiltInProfile(profile: CharacterProfile): boolean {
  return ["1", "2", "3"].includes(String(profile.id));
}

function safeColour(value: string, fallback: string): THREE.Color {
  try {
    return new THREE.Color(value);
  } catch {
    return new THREE.Color(fallback);
  }
}

function shadePixel(
  pixels: Uint8ClampedArray,
  offset: number,
  target: THREE.Color,
  luminance: number,
  reference: number,
): void {
  const ratio = THREE.MathUtils.clamp(luminance / reference, 0.48, 1.55);
  const channels = [target.r * 255, target.g * 255, target.b * 255] as const;
  if (ratio <= 1) {
    const shade = 0.54 + ratio * 0.46;
    pixels[offset] = Math.round(channels[0] * shade);
    pixels[offset + 1] = Math.round(channels[1] * shade);
    pixels[offset + 2] = Math.round(channels[2] * shade);
    return;
  }
  const highlight = Math.min(0.52, (ratio - 1) * 0.58);
  pixels[offset] = Math.round(THREE.MathUtils.lerp(channels[0], 255, highlight));
  pixels[offset + 1] = Math.round(THREE.MathUtils.lerp(channels[1], 255, highlight));
  pixels[offset + 2] = Math.round(THREE.MathUtils.lerp(channels[2], 255, highlight));
}

function profileCell(
  source: HTMLCanvasElement,
  profile: CharacterProfile,
  row: number,
): HTMLCanvasElement {
  if (isBuiltInProfile(profile)) return source;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const skin = safeColour(profile.skin, "#efb18e");
  const hair = safeColour(profile.hair, "#5f392b");
  const shirt = safeColour(profile.shirt, row === 0 ? "#6f8f43" : row === 1 ? "#e3ad3f" : "#7ca9d6");

  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] < 12) continue;
    const pixel = offset / 4;
    const x = pixel % canvas.width;
    const y = Math.floor(pixel / canvas.width);
    const nx = x / canvas.width;
    const ny = y / canvas.height;
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const saturation = maximum - minimum;
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const upperHead = ny < 0.54 && nx > 0.12 && nx < 0.88;
    const brownHair = row < 2 && upperHead && red > green * 1.08 && green > blue * 1.05 && luminance < 145;
    // Blonde hair and warm skin share red/yellow channels. Protect the broad,
    // lower-saturation face oval while still tinting the fringe crossing it.
    const blondeFaceCore = nx > 0.24 && nx < 0.76 && ny > 0.21 && ny < 0.57;
    const blondeHair = row === 2
      && upperHead
      && red > 145
      && red > blue * 1.38
      && green > blue * 1.18
      && !(blondeFaceCore && saturation < 150);
    const hairPixel = brownHair || blondeHair;
    const greenGarment = row === 0 && ny > 0.42 && green > blue * 1.35 && green > red * 0.86 && luminance < 175;
    const orangeGarment = row === 1 && ny > 0.42 && red > 125 && red > green * 1.2 && blue < 105 && saturation > 72;
    const blueGarment = row === 2 && ny > 0.42 && blue > red * 0.94 && blue > green * 0.96 && luminance > 80;
    const garmentPixel = greenGarment || orangeGarment || blueGarment;
    const skinPixel = !hairPixel
      && !garmentPixel
      && red > 125
      && green > 72
      && blue > 42
      && red > green * 1.04
      && green > blue * 1.04
      && saturation < 135;

    if (hairPixel) shadePixel(image.data, offset, hair, luminance, row === 2 ? 196 : 74);
    else if (garmentPixel) shadePixel(image.data, offset, shirt, luminance, row === 0 ? 96 : row === 1 ? 154 : 170);
    else if (skinPixel) shadePixel(image.data, offset, skin, luminance, 185);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function gaussian(value: number, center: number, radius: number): number {
  const distance = (value - center) / radius;
  return Math.exp(-0.5 * distance * distance);
}

function segmentScore(
  x: number,
  y: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  radius: number,
): number {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared > 0
    ? THREE.MathUtils.clamp(((x - startX) * dx + (y - startY) * dy) / lengthSquared, 0, 1)
    : 0;
  const closestX = startX + dx * amount;
  const closestY = startY + dy * amount;
  const distance = Math.hypot(x - closestX, y - closestY) / radius;
  return Math.exp(-0.5 * distance * distance);
}

function smoothGate(value: number, from: number, to: number): number {
  return THREE.MathUtils.smoothstep(value, from, to);
}

/**
 * Continuous vertex weights replace the old cut-out planes. Four strongest
 * influences are retained at every grid point, so shoulders, neck and hips
 * bend through shared vertices without opening seams.
 */
function skinInfluences(x: number, y: number, skirt: boolean): readonly (readonly [number, number])[] {
  const headGate = 1 - smoothGate(y, 0.43, 0.57);
  // The skirt itself must travel with the pelvis. Leg influence only starts
  // once the painted legs emerge below the hem, otherwise the continuous
  // dress texture splits down the middle during a stride.
  const legGate = smoothGate(y, skirt ? 0.79 : 0.63, skirt ? 0.86 : 0.755);
  const armGate = smoothGate(y, 0.39, 0.47) * (1 - smoothGate(y, 0.69, 0.79));
  const centerGate = gaussian(x, 0.5, skirt ? 0.23 : 0.205);
  const leftSide = 1 - smoothGate(x, 0.455, 0.535);
  const rightSide = smoothGate(x, 0.465, 0.545);
  const neckGate = gaussian(x, 0.5, 0.14) * gaussian(y, 0.46, 0.055);
  const kneeY = skirt ? 0.825 : 0.805;
  const ankleY = skirt ? 0.915 : 0.91;
  const leftLegMask = skirt ? gaussian(x, 0.425, 0.082) * leftSide : leftSide;
  const rightLegMask = skirt ? gaussian(x, 0.575, 0.082) * rightSide : rightSide;
  const shinGate = smoothGate(y, kneeY - 0.035, kneeY + 0.018);
  const footGate = smoothGate(y, ankleY - 0.035, ankleY + 0.012);
  const skirtBody = skirt
    ? gaussian(x, 0.5, 0.25) * (1 - smoothGate(y, 0.785, 0.845))
    : 0;

  // Grounding reads markers parented to each foot bone. Keep the actual shoe
  // sole pixels on the same bone so a diagnostic zero gap also means the
  // painted shoe is visibly on the street, not hovering above or through it.
  if (y >= 0.92) {
    const leftSoleMask = gaussian(x, 0.405, 0.072) * leftSide;
    const rightSoleMask = gaussian(x, 0.595, 0.072) * rightSide;
    if (leftSoleMask > 0.16 || rightSoleMask > 0.16) {
      return leftSoleMask >= rightSoleMask
        ? [[BONE_INDEX.leftFoot, 0.9], [BONE_INDEX.leftShin, 0.1]] as const
        : [[BONE_INDEX.rightFoot, 0.9], [BONE_INDEX.rightShin, 0.1]] as const;
    }
  }
  const scores: Array<readonly [number, number]> = [
    [BONE_INDEX.root, 0.008],
    [BONE_INDEX.hips, 1.35 * gaussian(x, 0.5, 0.24) * gaussian(y, skirt ? 0.72 : 0.685, 0.105) + 2.25 * skirtBody],
    [BONE_INDEX.torso, 2.15 * centerGate * gaussian(y, 0.56, skirt ? 0.22 : 0.185) * (1 - legGate * 0.65)],
    [BONE_INDEX.neck, 2.4 * neckGate],
    [BONE_INDEX.head, 3.25 * gaussian(x, 0.5, 0.32) * gaussian(y, 0.27, 0.245) * headGate],
    [BONE_INDEX.leftArm, 2.75 * segmentScore(x, y, 0.355, 0.46, 0.305, 0.59, 0.105) * armGate * leftSide],
    [BONE_INDEX.leftForearm, 2.75 * segmentScore(x, y, 0.305, 0.59, 0.255, 0.72, 0.1) * armGate * leftSide],
    [BONE_INDEX.rightArm, 2.75 * segmentScore(x, y, 0.645, 0.46, 0.695, 0.59, 0.105) * armGate * rightSide],
    [BONE_INDEX.rightForearm, 2.75 * segmentScore(x, y, 0.695, 0.59, 0.745, 0.72, 0.1) * armGate * rightSide],
    [BONE_INDEX.leftLeg, 2.8 * segmentScore(x, y, 0.425, skirt ? 0.72 : 0.685, 0.415, kneeY, 0.1) * legGate * leftLegMask * (1 - footGate * 0.78)],
    [BONE_INDEX.leftShin, 2.85 * segmentScore(x, y, 0.415, kneeY, 0.405, ankleY, 0.09) * legGate * leftLegMask * shinGate],
    [BONE_INDEX.leftFoot, 2.9 * segmentScore(x, y, 0.405, ankleY, 0.39, 0.955, 0.085) * legGate * leftLegMask * footGate],
    [BONE_INDEX.rightLeg, 2.8 * segmentScore(x, y, 0.575, skirt ? 0.72 : 0.685, 0.585, kneeY, 0.1) * legGate * rightLegMask * (1 - footGate * 0.78)],
    [BONE_INDEX.rightShin, 2.85 * segmentScore(x, y, 0.585, kneeY, 0.595, ankleY, 0.09) * legGate * rightLegMask * shinGate],
    [BONE_INDEX.rightFoot, 2.9 * segmentScore(x, y, 0.595, ankleY, 0.61, 0.955, 0.085) * legGate * rightLegMask * footGate],
  ];
  const strongest = scores.sort((left, right) => right[1] - left[1]).slice(0, 4);
  const total = strongest.reduce((sum, entry) => sum + entry[1], 0) || 1;
  return strongest.map(([index, weight]) => [index, weight / total] as const);
}

function makeSkinnedGeometry(layout: PuppetLayout, skirt: boolean): THREE.PlaneGeometry {
  const width = CELL_WIDTH * PIXEL_SCALE;
  const height = CELL_HEIGHT * PIXEL_SCALE;
  const geometry = new THREE.PlaneGeometry(width, height, GRID_COLUMNS, GRID_ROWS);
  geometry.translate(0, (layout.ground - 0.5) * height, 0);
  const uv = geometry.getAttribute("uv");
  const vertexCount = uv.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const x = uv.getX(vertex);
    const y = 1 - uv.getY(vertex);
    const influences = skinInfluences(x, y, skirt);
    for (let slot = 0; slot < 4; slot += 1) {
      const influence = influences[slot] ?? [BONE_INDEX.root, 0] as const;
      skinIndices[vertex * 4 + slot] = influence[0];
      skinWeights[vertex * 4 + slot] = influence[1];
    }
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeTexture(source: HTMLCanvasElement, row: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(source);
  texture.name = `sunny-continuous-resident-${row}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.premultiplyAlpha = true;
  texture.needsUpdate = true;
  return texture;
}

function makeShadow(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable for puppet shadow");
  const gradient = context.createRadialGradient(64, 32, 2, 64, 32, 58);
  gradient.addColorStop(0, "rgba(58, 48, 35, 0.32)");
  gradient.addColorStop(0.55, "rgba(58, 48, 35, 0.16)");
  gradient.addColorStop(1, "rgba(58, 48, 35, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.62), material);
  mesh.name = "resident-contact-shadow";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  mesh.renderOrder = 3;
  return mesh;
}

function absolutePoint(point: Point, layout: PuppetLayout): THREE.Vector3 {
  return new THREE.Vector3(
    (point[0] - 0.5) * CELL_WIDTH * PIXEL_SCALE,
    (layout.ground - point[1]) * CELL_HEIGHT * PIXEL_SCALE,
    0,
  );
}

function runtimeFor(target: Character | ResidentPuppetRuntime): InternalRuntime | null {
  if ("visualRoot" in target) return target as InternalRuntime;
  return (target.group.userData.residentPuppetRuntime as InternalRuntime | undefined) ?? null;
}

function part(joint: THREE.Bone): ResidentPuppetPart {
  return { joint, basePosition: joint.position.clone() };
}

/**
 * Attach one continuous, smoothly skinned painted resident to the character's
 * movement/collision root. Call `preloadResidentPuppets` first, or pass its
 * result explicitly.
 */
export function attachResidentPuppet(
  character: Character,
  profile: CharacterProfile = character.profile,
  pack: ResidentPuppetPack | null = loadedPack,
): ResidentPuppetRuntime {
  if (!pack) throw new Error("Resident puppet assets are not loaded; call preloadResidentPuppets() first");
  const previous = runtimeFor(character);
  if (previous) disposeResidentPuppet(previous);

  const row = spriteRow(profile);
  const skirt = row === 2;
  const layout = skirt ? SKIRT_LAYOUT : BASE_LAYOUT;
  const source = profileCell(pack.cells[row] ?? pack.cells[0], profile, row);
  const hiddenObjects: HiddenObject[] = [];
  character.group.traverse((object) => {
    if ((object instanceof THREE.Mesh || object instanceof THREE.Sprite) && object.visible) {
      hiddenObjects.push({ object, visible: object.visible });
      object.visible = false;
    }
  });

  const group = new THREE.Group();
  group.name = "resident-puppet-container";
  const visualRoot = new THREE.Group();
  visualRoot.name = "resident-puppet-billboard";
  group.add(visualRoot);

  const figureRoot = new THREE.Bone();
  figureRoot.name = "puppet-root";
  const hips = new THREE.Bone();
  hips.name = "puppet-hips";
  const torso = new THREE.Bone();
  torso.name = "puppet-torso";
  const neck = new THREE.Bone();
  neck.name = "puppet-neck";
  const head = new THREE.Bone();
  head.name = "puppet-head";
  const leftArm = new THREE.Bone();
  leftArm.name = "puppet-left-arm";
  const leftForearm = new THREE.Bone();
  leftForearm.name = "puppet-left-forearm";
  const rightArm = new THREE.Bone();
  rightArm.name = "puppet-right-arm";
  const rightForearm = new THREE.Bone();
  rightForearm.name = "puppet-right-forearm";
  const leftLeg = new THREE.Bone();
  leftLeg.name = "puppet-left-leg";
  const leftShin = new THREE.Bone();
  leftShin.name = "puppet-left-shin";
  const leftFoot = new THREE.Bone();
  leftFoot.name = "puppet-left-foot";
  const rightLeg = new THREE.Bone();
  rightLeg.name = "puppet-right-leg";
  const rightShin = new THREE.Bone();
  rightShin.name = "puppet-right-shin";
  const rightFoot = new THREE.Bone();
  rightFoot.name = "puppet-right-foot";
  figureRoot.add(hips);
  hips.add(torso, leftLeg, rightLeg);
  torso.add(neck, leftArm, rightArm);
  neck.add(head);
  leftArm.add(leftForearm);
  rightArm.add(rightForearm);
  leftLeg.add(leftShin);
  leftShin.add(leftFoot);
  rightLeg.add(rightShin);
  rightShin.add(rightFoot);

  const hipPosition = absolutePoint(layout.hip, layout);
  const torsoPosition = absolutePoint(layout.torso, layout);
  const neckPosition = absolutePoint(layout.neck, layout);
  const headPosition = absolutePoint(layout.head, layout);
  const leftArmPosition = absolutePoint(layout.leftArm, layout);
  const leftForearmPosition = absolutePoint(layout.leftForearm, layout);
  const rightArmPosition = absolutePoint(layout.rightArm, layout);
  const rightForearmPosition = absolutePoint(layout.rightForearm, layout);
  const leftLegPosition = absolutePoint(layout.leftLeg, layout);
  const leftShinPosition = absolutePoint(layout.leftShin, layout);
  const leftFootPosition = absolutePoint(layout.leftFoot, layout);
  const rightLegPosition = absolutePoint(layout.rightLeg, layout);
  const rightShinPosition = absolutePoint(layout.rightShin, layout);
  const rightFootPosition = absolutePoint(layout.rightFoot, layout);
  hips.position.copy(hipPosition);
  torso.position.copy(torsoPosition).sub(hipPosition);
  neck.position.copy(neckPosition).sub(torsoPosition);
  head.position.copy(headPosition).sub(neckPosition);
  leftArm.position.copy(leftArmPosition).sub(torsoPosition);
  leftForearm.position.copy(leftForearmPosition).sub(leftArmPosition);
  rightArm.position.copy(rightArmPosition).sub(torsoPosition);
  rightForearm.position.copy(rightForearmPosition).sub(rightArmPosition);
  leftLeg.position.copy(leftLegPosition).sub(hipPosition);
  leftShin.position.copy(leftShinPosition).sub(leftLegPosition);
  leftFoot.position.copy(leftFootPosition).sub(leftShinPosition);
  rightLeg.position.copy(rightLegPosition).sub(hipPosition);
  rightShin.position.copy(rightShinPosition).sub(rightLegPosition);
  rightFoot.position.copy(rightFootPosition).sub(rightShinPosition);

  const leftSoleMarker = new THREE.Object3D();
  leftSoleMarker.name = "puppet-left-sole";
  leftSoleMarker.position.copy(absolutePoint(layout.leftSole, layout)).sub(leftFootPosition);
  leftFoot.add(leftSoleMarker);
  const rightSoleMarker = new THREE.Object3D();
  rightSoleMarker.name = "puppet-right-sole";
  rightSoleMarker.position.copy(absolutePoint(layout.rightSole, layout)).sub(rightFootPosition);
  rightFoot.add(rightSoleMarker);

  const texture = makeTexture(source, row);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.04,
    depthTest: true,
    // One depth-writing surface per resident avoids the old six-plane sort
    // ambiguity while retaining the soft antialiased painted edge.
    depthWrite: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  material.premultipliedAlpha = true;
  const geometry = makeSkinnedGeometry(layout, skirt);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "continuous-painted-resident";
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  const skeleton = new THREE.Skeleton([
    figureRoot,
    hips,
    torso,
    neck,
    head,
    leftArm,
    leftForearm,
    rightArm,
    rightForearm,
    leftLeg,
    leftShin,
    leftFoot,
    rightLeg,
    rightShin,
    rightFoot,
  ]);
  visualRoot.add(mesh, figureRoot);
  visualRoot.updateMatrixWorld(true);
  mesh.bind(skeleton);
  mesh.normalizeSkinWeights();

  const shadow = makeShadow();
  group.add(shadow);
  character.group.add(group);
  const parts: Record<ResidentPuppetPartName, ResidentPuppetPart> = {
    head: part(head),
    neck: part(neck),
    torso: part(torso),
    leftArm: part(leftArm),
    leftForearm: part(leftForearm),
    rightArm: part(rightArm),
    rightForearm: part(rightForearm),
    leftLeg: part(leftLeg),
    leftShin: part(leftShin),
    leftFoot: part(leftFoot),
    rightLeg: part(rightLeg),
    rightShin: part(rightShin),
    rightFoot: part(rightFoot),
  };
  const runtime: InternalRuntime = {
    character,
    profile,
    group,
    visualRoot,
    figureRoot,
    hips,
    skeleton,
    mesh,
    texture,
    parts,
    leftSoleMarker,
    rightSoleMarker,
    shadow,
    state: "idle",
    stateStartedAt: 0,
    disposed: false,
    grounding: { grounded: true, leftGap: 0, rightGap: 0, minimumGap: 0 },
    hiddenObjects,
  };
  character.group.userData.residentPuppetRuntime = runtime;
  character.group.userData.characterSource = "sunny-continuous-skinned-resident-v3";
  character.group.userData.residentPuppetBoneCount = skeleton.bones.length;
  character.group.userData.displayHeight = DISPLAY_HEIGHT;
  return runtime;
}

function damp(current: number, target: number, speed: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
}

type PuppetPose = {
  rootX: number;
  rootY: number;
  hipsZ: number;
  torsoX: number;
  torsoZ: number;
  neckX: number;
  neckZ: number;
  headX: number;
  headZ: number;
  leftArmZ: number;
  rightArmZ: number;
  leftForearmX: number;
  rightForearmX: number;
  leftForearmZ: number;
  rightForearmZ: number;
  leftLegZ: number;
  rightLegZ: number;
  leftShinX: number;
  rightShinX: number;
  leftShinZ: number;
  rightShinZ: number;
  leftFootX: number;
  rightFootX: number;
  leftFootZ: number;
  rightFootZ: number;
  leftLegX: number;
  rightLegX: number;
  leftLegY: number;
  rightLegY: number;
  torsoScaleY: number;
  headScaleY: number;
  shadowScale: number;
};

function poseFor(state: CharacterState, elapsed: number): PuppetPose {
  const pose: PuppetPose = {
    rootX: 0,
    rootY: 0,
    hipsZ: 0,
    torsoX: 0,
    torsoZ: 0,
    neckX: 0,
    neckZ: 0,
    headX: 0,
    headZ: 0,
    leftArmZ: 0,
    rightArmZ: 0,
    leftForearmX: 0,
    rightForearmX: 0,
    leftForearmZ: 0,
    rightForearmZ: 0,
    leftLegZ: 0,
    rightLegZ: 0,
    leftShinX: 0,
    rightShinX: 0,
    leftShinZ: 0,
    rightShinZ: 0,
    leftFootX: 0,
    rightFootX: 0,
    leftFootZ: 0,
    rightFootZ: 0,
    leftLegX: 0,
    rightLegX: 0,
    leftLegY: 0,
    rightLegY: 0,
    torsoScaleY: 1,
    headScaleY: 1,
    shadowScale: 1,
  };
  if (state === "walk" || state === "run") {
    const running = state === "run";
    const cadence = running ? 11.2 : 7.15;
    const swing = Math.sin(elapsed * cadence);
    const doubleStep = Math.abs(Math.cos(elapsed * cadence));
    const leftLift = Math.max(0, swing);
    const rightLift = Math.max(0, -swing);
    const stride = running ? 0.32 : 0.22;
    pose.rootY = doubleStep * (running ? 0.075 : 0.038);
    pose.rootX = Math.sin(elapsed * cadence * 0.5) * (running ? 0.025 : 0.012);
    pose.hipsZ = swing * (running ? 0.055 : 0.035);
    pose.torsoX = running ? -0.09 : 0;
    pose.torsoZ = -swing * (running ? 0.045 : 0.025);
    pose.neckX = running ? 0.025 : -doubleStep * 0.006;
    pose.neckZ = swing * (running ? 0.012 : 0.008);
    pose.headX = running ? 0.055 : -doubleStep * 0.012;
    pose.headZ = swing * (running ? 0.018 : 0.01);
    pose.leftArmZ = swing * stride;
    pose.rightArmZ = -swing * stride;
    pose.leftForearmX = leftLift * (running ? 0.18 : 0.08);
    pose.rightForearmX = rightLift * (running ? 0.18 : 0.08);
    pose.leftForearmZ = -0.035 - leftLift * (running ? 0.075 : 0.04);
    pose.rightForearmZ = 0.035 + rightLift * (running ? 0.075 : 0.04);
    pose.leftLegZ = -swing * (running ? 0.26 : 0.17);
    pose.rightLegZ = swing * (running ? 0.26 : 0.17);
    // Knee bend happens mainly out of the picture plane. This shortens the
    // lifted leg naturally without stretching the continuous painted skin.
    pose.leftShinX = leftLift * (running ? 0.42 : 0.26);
    pose.rightShinX = rightLift * (running ? 0.42 : 0.26);
    pose.leftShinZ = swing * (running ? 0.07 : 0.045);
    pose.rightShinZ = -swing * (running ? 0.07 : 0.045);
    pose.leftFootX = -leftLift * (running ? 0.24 : 0.15) + rightLift * 0.04;
    pose.rightFootX = -rightLift * (running ? 0.24 : 0.15) + leftLift * 0.04;
    pose.leftFootZ = -swing * (running ? 0.055 : 0.035);
    pose.rightFootZ = swing * (running ? 0.055 : 0.035);
    pose.leftLegX = -swing * (running ? 0.04 : 0.018);
    pose.rightLegX = swing * (running ? 0.04 : 0.018);
    pose.leftLegY = leftLift * (running ? 0.075 : 0.038);
    pose.rightLegY = rightLift * (running ? 0.075 : 0.038);
    pose.shadowScale = 1 - doubleStep * (running ? 0.11 : 0.045);
    return pose;
  }

  const breath = Math.sin(elapsed * 2.05);
  pose.rootY = breath * 0.008;
  pose.torsoScaleY = 1 + breath * 0.009;
  pose.neckX = -breath * 0.003;
  pose.headX = -breath * 0.007;
  pose.headScaleY = 1 - breath * 0.0025;
  if (state === "talk") {
    const gesture = Math.sin(elapsed * 5.1);
    pose.rootY += Math.sin(elapsed * 2.55) * 0.009;
    pose.torsoZ = Math.sin(elapsed * 1.7) * 0.025;
    pose.neckX = Math.sin(elapsed * 4.4) * 0.012;
    pose.neckZ = Math.sin(elapsed * 2.6) * 0.012;
    pose.headX = Math.sin(elapsed * 4.4) * 0.023;
    pose.headZ = Math.sin(elapsed * 2.6) * 0.023;
    // A continuous painted skin should flex rather than fold through itself.
    // Keep gestures inside a soft anatomical range and let the torso/head
    // carry the expression instead of stretching the arm artwork into a strip.
    pose.rightArmZ = 0.28 + gesture * 0.1;
    pose.rightForearmZ = 0.14 + gesture * 0.065;
    pose.leftArmZ = -0.055 - gesture * 0.035;
    pose.leftForearmZ = -0.025;
  } else if (state === "happy") {
    const bounce = Math.abs(Math.sin(elapsed * 5.5));
    pose.rootY = bounce * 0.105;
    pose.torsoZ = Math.sin(elapsed * 5.5) * 0.045;
    pose.leftArmZ = -0.34 + Math.sin(elapsed * 5.5) * 0.08;
    pose.rightArmZ = 0.34 - Math.sin(elapsed * 5.5) * 0.08;
    pose.leftForearmZ = -0.16;
    pose.rightForearmZ = 0.16;
    pose.leftLegZ = -0.055;
    pose.rightLegZ = 0.055;
    pose.headZ = Math.sin(elapsed * 5.5) * 0.065;
    pose.shadowScale = 1 - bounce * 0.14;
  } else if (state === "sad") {
    pose.rootY = -0.025;
    pose.torsoX = 0.06;
    pose.headX = 0.12;
    pose.headZ = -0.04;
    pose.leftArmZ = 0.08;
    pose.rightArmZ = -0.08;
    pose.leftForearmZ = 0.035;
    pose.rightForearmZ = -0.035;
  } else if (state === "eat") {
    const bite = Math.sin(elapsed * 4.4) * 0.5 + 0.5;
    pose.headX = 0.07 + bite * 0.055;
    pose.leftArmZ = -0.25 - bite * 0.07;
    pose.rightArmZ = 0.25 + bite * 0.07;
    pose.leftForearmZ = -0.16 - bite * 0.06;
    pose.rightForearmZ = 0.16 + bite * 0.06;
  } else if (state === "sit") {
    pose.rootY = -0.24;
    pose.torsoX = 0.03;
    pose.leftLegZ = -0.26;
    pose.rightLegZ = 0.26;
    pose.leftShinX = 0.38;
    pose.rightShinX = 0.38;
    pose.leftFootX = -0.16;
    pose.rightFootX = -0.16;
    pose.leftLegY = 0.13;
    pose.rightLegY = 0.13;
  }
  return pose;
}

/** Animate the continuous surface through its real bone hierarchy. */
export function updateResidentPuppet(
  target: Character | ResidentPuppetRuntime,
  state: CharacterState,
  time: number,
  delta: number,
): void {
  const runtime = runtimeFor(target);
  if (!runtime || runtime.disposed) return;
  const dt = THREE.MathUtils.clamp(Number.isFinite(delta) ? delta : 1 / 60, 0, 0.1);
  if (runtime.state !== state) {
    runtime.state = state;
    runtime.stateStartedAt = time;
  }
  const elapsed = Math.max(0, time - runtime.stateStartedAt);
  const pose = poseFor(state, elapsed);
  const { parts } = runtime;

  runtime.figureRoot.position.x = damp(runtime.figureRoot.position.x, pose.rootX, 14, dt);
  runtime.figureRoot.position.y = damp(runtime.figureRoot.position.y, pose.rootY, 18, dt);
  runtime.hips.rotation.z = damp(runtime.hips.rotation.z, pose.hipsZ, 15, dt);
  parts.torso.joint.rotation.x = damp(parts.torso.joint.rotation.x, pose.torsoX, 13, dt);
  parts.torso.joint.rotation.z = damp(parts.torso.joint.rotation.z, pose.torsoZ, 15, dt);
  parts.neck.joint.rotation.x = damp(parts.neck.joint.rotation.x, pose.neckX, 14, dt);
  parts.neck.joint.rotation.z = damp(parts.neck.joint.rotation.z, pose.neckZ, 14, dt);
  parts.head.joint.rotation.x = damp(parts.head.joint.rotation.x, pose.headX, 14, dt);
  parts.head.joint.rotation.z = damp(parts.head.joint.rotation.z, pose.headZ, 14, dt);
  parts.leftArm.joint.rotation.z = damp(parts.leftArm.joint.rotation.z, pose.leftArmZ, 18, dt);
  parts.rightArm.joint.rotation.z = damp(parts.rightArm.joint.rotation.z, pose.rightArmZ, 18, dt);
  parts.leftForearm.joint.rotation.x = damp(parts.leftForearm.joint.rotation.x, pose.leftForearmX, 19, dt);
  parts.rightForearm.joint.rotation.x = damp(parts.rightForearm.joint.rotation.x, pose.rightForearmX, 19, dt);
  parts.leftForearm.joint.rotation.z = damp(parts.leftForearm.joint.rotation.z, pose.leftForearmZ, 19, dt);
  parts.rightForearm.joint.rotation.z = damp(parts.rightForearm.joint.rotation.z, pose.rightForearmZ, 19, dt);
  parts.leftLeg.joint.rotation.z = damp(parts.leftLeg.joint.rotation.z, pose.leftLegZ, 20, dt);
  parts.rightLeg.joint.rotation.z = damp(parts.rightLeg.joint.rotation.z, pose.rightLegZ, 20, dt);
  parts.leftShin.joint.rotation.x = damp(parts.leftShin.joint.rotation.x, pose.leftShinX, 21, dt);
  parts.rightShin.joint.rotation.x = damp(parts.rightShin.joint.rotation.x, pose.rightShinX, 21, dt);
  parts.leftShin.joint.rotation.z = damp(parts.leftShin.joint.rotation.z, pose.leftShinZ, 21, dt);
  parts.rightShin.joint.rotation.z = damp(parts.rightShin.joint.rotation.z, pose.rightShinZ, 21, dt);
  parts.leftFoot.joint.rotation.x = damp(parts.leftFoot.joint.rotation.x, pose.leftFootX, 22, dt);
  parts.rightFoot.joint.rotation.x = damp(parts.rightFoot.joint.rotation.x, pose.rightFootX, 22, dt);
  parts.leftFoot.joint.rotation.z = damp(parts.leftFoot.joint.rotation.z, pose.leftFootZ, 22, dt);
  parts.rightFoot.joint.rotation.z = damp(parts.rightFoot.joint.rotation.z, pose.rightFootZ, 22, dt);

  const leftLegBase = parts.leftLeg.basePosition;
  const rightLegBase = parts.rightLeg.basePosition;
  parts.leftLeg.joint.position.x = damp(parts.leftLeg.joint.position.x, leftLegBase.x + pose.leftLegX, 19, dt);
  parts.rightLeg.joint.position.x = damp(parts.rightLeg.joint.position.x, rightLegBase.x + pose.rightLegX, 19, dt);
  parts.leftLeg.joint.position.y = damp(parts.leftLeg.joint.position.y, leftLegBase.y + pose.leftLegY, 19, dt);
  parts.rightLeg.joint.position.y = damp(parts.rightLeg.joint.position.y, rightLegBase.y + pose.rightLegY, 19, dt);
  parts.torso.joint.scale.y = damp(parts.torso.joint.scale.y, pose.torsoScaleY, 11, dt);
  parts.head.joint.scale.y = damp(parts.head.joint.scale.y, pose.headScaleY, 11, dt);
  runtime.shadow.scale.x = damp(runtime.shadow.scale.x, pose.shadowScale, 14, dt);
  runtime.shadow.scale.y = damp(runtime.shadow.scale.y, pose.shadowScale, 14, dt);
}

/** Keep the continuous character surface facing the camera as its root turns. */
export function faceResidentPuppetToCamera(
  target: Character | ResidentPuppetRuntime,
  camera: THREE.Camera,
  delta = 1 / 60,
): void {
  const runtime = runtimeFor(target);
  if (!runtime || runtime.disposed || !runtime.visualRoot.parent) return;
  runtime.visualRoot.getWorldPosition(worldPosition);
  camera.getWorldPosition(cameraPosition);
  const yaw = Math.atan2(
    cameraPosition.x - worldPosition.x,
    cameraPosition.z - worldPosition.z,
  );
  targetQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
  runtime.visualRoot.parent.getWorldQuaternion(parentQuaternion);
  localQuaternion.copy(parentQuaternion).invert().multiply(targetQuaternion);
  const amount = 1 - Math.exp(-16 * THREE.MathUtils.clamp(delta, 0, 0.1));
  runtime.visualRoot.quaternion.slerp(localQuaternion, amount);
}

/** Keep the lower animated sole on the world ground without moving collision. */
export function groundResidentPuppet(
  target: Character | ResidentPuppetRuntime,
  groundY?: number,
): CharacterGrounding | null {
  const runtime = runtimeFor(target);
  if (!runtime || runtime.disposed) return null;
  runtime.character.group.updateWorldMatrix(true, true);
  const planeY = typeof groundY === "number" && Number.isFinite(groundY)
    ? groundY
    : runtime.character.group.getWorldPosition(worldPosition).y;
  const leftY = runtime.leftSoleMarker.getWorldPosition(worldPosition).y;
  const rightY = runtime.rightSoleMarker.getWorldPosition(secondWorldPosition).y;
  const lowestY = Math.min(leftY, rightY);
  const scaleY = Math.max(0.0001, Math.abs(runtime.visualRoot.getWorldScale(worldScale).y));
  if (Number.isFinite(lowestY)) {
    runtime.visualRoot.position.y += (planeY - lowestY) / scaleY;
    runtime.character.group.updateWorldMatrix(true, true);
  }
  const nextLeft = runtime.leftSoleMarker.getWorldPosition(worldPosition).y;
  const nextRight = runtime.rightSoleMarker.getWorldPosition(secondWorldPosition).y;
  const leftGap = nextLeft - planeY;
  const rightGap = nextRight - planeY;
  const minimumGap = Math.min(leftGap, rightGap);
  const grounding = {
    grounded: Number.isFinite(minimumGap) && Math.abs(minimumGap) <= 0.006,
    leftGap,
    rightGap,
    minimumGap,
  };
  runtime.grounding = grounding;
  return grounding;
}

/** Remove the puppet and release its per-resident GPU resources. */
export function disposeResidentPuppet(target: Character | ResidentPuppetRuntime): void {
  const runtime = runtimeFor(target);
  if (!runtime || runtime.disposed) return;
  runtime.disposed = true;
  runtime.group.removeFromParent();
  runtime.skeleton.dispose();
  runtime.mesh.geometry.dispose();
  runtime.mesh.material.dispose();
  runtime.texture.dispose();
  runtime.shadow.geometry.dispose();
  runtime.shadow.material.map?.dispose();
  runtime.shadow.material.dispose();
  runtime.hiddenObjects.forEach(({ object, visible }) => {
    object.visible = visible;
  });
  if (runtime.character.group.userData.residentPuppetRuntime === runtime) {
    delete runtime.character.group.userData.residentPuppetRuntime;
    delete runtime.character.group.userData.residentPuppetBoneCount;
  }
}

export const preload = preloadResidentPuppets;
export const attach = attachResidentPuppet;
export const update = updateResidentPuppet;
export const faceCamera = faceResidentPuppetToCamera;
export const ground = groundResidentPuppet;
export const dispose = disposeResidentPuppet;

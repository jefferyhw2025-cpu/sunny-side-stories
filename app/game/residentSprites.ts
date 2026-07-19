import * as THREE from "three";

import type {
  Character,
  CharacterGrounding,
  CharacterProfile,
  CharacterState,
} from "./characters";

const ATLAS_URL = "art/resident-sprite-atlas-v1.png";
const ROWS = 3;
const COLUMNS = 5;
const CELL_WIDTH = 384;
const CELL_HEIGHT = 426;

export type ResidentSpritePack = {
  readonly textures: readonly (readonly THREE.CanvasTexture[])[];
};

type ResidentSpriteRuntime = {
  readonly sprite: THREE.Sprite;
  readonly material: THREE.SpriteMaterial;
  readonly frames: readonly THREE.CanvasTexture[];
  frame: number;
};

let spritePackPromise: Promise<ResidentSpritePack> | null = null;
const recolouredFrameCache = new Map<string, readonly THREE.CanvasTexture[]>();

function chromaAlpha(red: number, green: number, blue: number): number {
  const distance = Math.hypot(red, 255 - green, blue);
  if (distance <= 62) return 0;
  if (distance >= 154) return 1;
  const value = (distance - 62) / 92;
  return value * value * (3 - 2 * value);
}

function makeCellTexture(
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  row: number,
  column: number,
): THREE.CanvasTexture {
  const sourceX = Math.round(column * imageWidth / COLUMNS);
  const sourceY = Math.round(row * imageHeight / ROWS);
  const nextX = Math.round((column + 1) * imageWidth / COLUMNS);
  const nextY = Math.round((row + 1) * imageHeight / ROWS);
  const canvas = document.createElement("canvas");
  canvas.width = CELL_WIDTH;
  canvas.height = CELL_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D canvas is unavailable for resident sprites");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    nextX - sourceX,
    nextY - sourceY,
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
    if (alpha < 1) {
      pixels.data[offset + 3] = Math.round(pixels.data[offset + 3] * alpha);
      // Remove the green fringe produced by antialiasing against the key
      // colour.  This keeps hair and skin edges clean against a bright sky.
      const neutralGreen = Math.max(red, blue) * 1.08;
      pixels.data[offset + 1] = Math.min(green, Math.round(neutralGreen));
    }
  }
  context.putImageData(pixels, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `sunny-resident-${row}-${column}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.userData.sharedCharacterAsset = true;
  texture.needsUpdate = true;
  return texture;
}

async function loadSpritePack(): Promise<ResidentSpritePack> {
  const source = await new THREE.TextureLoader().loadAsync(ATLAS_URL);
  const image = source.image as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const width = image.naturalWidth ?? image.width ?? 0;
  const height = image.naturalHeight ?? image.height ?? 0;
  if (width < COLUMNS || height < ROWS) {
    source.dispose();
    throw new Error("Resident sprite atlas has invalid dimensions");
  }
  const textures = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLUMNS }, (_, column) =>
      makeCellTexture(image, width, height, row, column),
    ),
  );
  source.dispose();
  return { textures };
}

export function preloadResidentSprites(): Promise<ResidentSpritePack> {
  spritePackPromise ??= loadSpritePack();
  return spritePackPromise;
}

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

function colourKey(value: string, fallback: string): THREE.Color {
  try {
    return new THREE.Color(value);
  } catch {
    return new THREE.Color(fallback);
  }
}

function applyShadedColour(
  pixels: Uint8ClampedArray,
  offset: number,
  target: THREE.Color,
  luminance: number,
  reference: number,
): void {
  const ratio = THREE.MathUtils.clamp(luminance / reference, 0.48, 1.55);
  const base = [target.r * 255, target.g * 255, target.b * 255] as const;
  if (ratio <= 1) {
    const shade = 0.54 + ratio * 0.46;
    pixels[offset] = Math.round(base[0] * shade);
    pixels[offset + 1] = Math.round(base[1] * shade);
    pixels[offset + 2] = Math.round(base[2] * shade);
    return;
  }
  const highlight = Math.min(0.52, (ratio - 1) * 0.58);
  pixels[offset] = Math.round(THREE.MathUtils.lerp(base[0], 255, highlight));
  pixels[offset + 1] = Math.round(THREE.MathUtils.lerp(base[1], 255, highlight));
  pixels[offset + 2] = Math.round(THREE.MathUtils.lerp(base[2], 255, highlight));
}

function recolourFrame(
  source: THREE.CanvasTexture,
  profile: CharacterProfile,
  row: number,
  frame: number,
): THREE.CanvasTexture {
  const sourceCanvas = source.image as HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(sourceCanvas, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const skin = colourKey(profile.skin, "#efb18e");
  const hair = colourKey(profile.hair, "#5f392b");
  const shirt = colourKey(profile.shirt, row === 0 ? "#6f8f43" : row === 1 ? "#e3ad3f" : "#7ca9d6");

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
    const darkBrownHair = row < 2 && upperHead && red > green * 1.08 && green > blue * 1.05 && luminance < 145;
    const blondeHair = row === 2 && upperHead && red > 145 && red > blue * 1.38 && green > blue * 1.18;
    const hairPixel = darkBrownHair || blondeHair;
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

    if (hairPixel) {
      applyShadedColour(image.data, offset, hair, luminance, row === 2 ? 196 : 74);
    } else if (garmentPixel) {
      applyShadedColour(image.data, offset, shirt, luminance, row === 0 ? 96 : row === 1 ? 154 : 170);
    } else if (skinPixel) {
      applyShadedColour(image.data, offset, skin, luminance, 185);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `sunny-resident-custom-${row}-${frame}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.userData.sharedCharacterAsset = true;
  return texture;
}

function profileFrames(
  profile: CharacterProfile,
  pack: ResidentSpritePack,
  row: number,
): readonly THREE.CanvasTexture[] {
  const key = [row, profile.skin, profile.hair, profile.shirt].join(":").toLowerCase();
  const cached = recolouredFrameCache.get(key);
  if (cached) return cached;
  const source = pack.textures[row] ?? pack.textures[0];
  const frames = source.map((texture, frame) => recolourFrame(texture, profile, row, frame));
  recolouredFrameCache.set(key, frames);
  return frames;
}

function runtimeFor(character: Character): ResidentSpriteRuntime | null {
  return (character.group.userData.residentSpriteRuntime as ResidentSpriteRuntime | undefined) ?? null;
}

/**
 * Replace the visible placeholder primitives with the approved illustrated
 * resident while retaining the real movement skeleton and collision root.
 * The sprite lives in the same 3D scene, depth-sorts with the town and is
 * anchored at the character's ground point.
 */
export function attachResidentSprite(
  character: Character,
  pack: ResidentSpritePack,
): ResidentSpriteRuntime {
  character.group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.visible = false;
  });
  const row = spriteRow(character.profile);
  const frames = profileFrames(character.profile, pack, row);
  const material = new THREE.SpriteMaterial({
    map: frames[0],
    transparent: true,
    alphaTest: 0.055,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  material.userData.residentSpriteMaterial = true;
  const sprite = new THREE.Sprite(material);
  sprite.name = "approved-illustrated-resident";
  sprite.center.set(0.5, 0.035);
  sprite.position.set(0, 0.02, 0);
  sprite.scale.set(2.66, 3.0, 1);
  sprite.renderOrder = 5;
  character.group.add(sprite);
  const runtime: ResidentSpriteRuntime = { sprite, material, frames, frame: 0 };
  character.group.userData.residentSpriteRuntime = runtime;
  character.group.userData.characterSource = "sunny-illustrated-atlas-v1";
  character.group.userData.authoredVariant = `illustrated-${row}`;
  character.group.userData.displayHeight = 3.08;
  return runtime;
}

export function updateResidentSprite(
  character: Character,
  state: CharacterState,
  elapsed: number,
): void {
  const runtime = runtimeFor(character);
  if (!runtime) return;
  const moving = state === "walk" || state === "run";
  const cadence = state === "run" ? 8.5 : 5.6;
  const idleFrame = Number(character.group.userData.residentSpriteIdleFrame) || 0;
  const frame = moving ? 3 + (Math.floor(elapsed * cadence) % 2) : idleFrame;
  if (runtime.frame === frame) return;
  runtime.frame = frame;
  runtime.material.map = runtime.frames[frame];
  runtime.material.needsUpdate = true;
}

export function setResidentSpriteView(character: Character, yaw: number): void {
  const runtime = runtimeFor(character);
  if (!runtime) return;
  const angle = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  const absolute = Math.abs(angle);
  const frame = absolute < Math.PI * 0.25
    ? 0
    : absolute > Math.PI * 0.75
      ? 2
      : 1;
  character.group.userData.residentSpriteIdleFrame = frame;
  runtime.sprite.scale.x = (angle < 0 && frame === 1 ? -1 : 1) * 2.66;
}

export function groundIllustratedResident(character: Character): CharacterGrounding | null {
  const runtime = runtimeFor(character);
  if (!runtime) return null;
  character.joints.root.position.y = 0;
  return { grounded: true, leftGap: 0, rightGap: 0, minimumGap: 0 };
}

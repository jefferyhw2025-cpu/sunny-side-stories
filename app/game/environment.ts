import * as THREE from "three";
import type { CircularObstacle } from "./worldSystems";
import type {
  AuthoredEnvironmentAssetId,
  AuthoredEnvironmentAssets,
} from "./environmentAssets";

export type TownActivityKind =
  | "home"
  | "cafe"
  | "shop"
  | "fountain"
  | "garden"
  | "lookout";

export type TownSceneName = "home" | "plaza" | "cafe" | "shop" | "interior";

export interface TownActivityPoint {
  id: string;
  label: string;
  kind: TownActivityKind;
  position: THREE.Vector3;
  radius: number;
}

export interface TownEnvironment {
  group: THREE.Group;
  activityPoints: TownActivityPoint[];
  benches: THREE.Group[];
  obstacles?: CircularObstacle[];
  visualSource?: "authored" | "procedural";
  update: (time: number) => void;
}

type JetDrop = {
  mesh: THREE.Mesh;
  angle: number;
  phase: number;
};

type TreeCrown = {
  group: THREE.Group;
  phase: number;
};

type GrassTuft = {
  position: THREE.Vector3;
  yaw: number;
  scale: number;
  phase: number;
};

type GrassDetails = {
  mesh: THREE.InstancedMesh;
  tufts: GrassTuft[];
};

type AuthoredWindObject = {
  object: THREE.Object3D;
  baseX: number;
  baseZ: number;
  amplitude: number;
  phase: number;
  speed: number;
};

const COLORS = {
  ink: 0x344b4f,
  grass: 0x79c866,
  grassLight: 0xa0dc82,
  grassDark: 0x4f9f55,
  road: 0xd8d3c7,
  roadEdge: 0xb8b1a2,
  paving: 0xe8ddcb,
  pavingLight: 0xf7ecda,
  cream: 0xfff3d9,
  white: 0xfffbec,
  wood: 0x966344,
  darkWood: 0x674536,
  water: 0x61d3f2,
  waterLight: 0xd0f9ff,
  stone: 0xd8d4c9,
  stoneDark: 0xaaa99f,
  leaf: 0x4da75c,
  leafLight: 0x70c768,
  leafDark: 0x34784b,
  gold: 0xffce57,
} as const;

type EnvironmentSurface =
  | "paint"
  | "grass"
  | "leaf"
  | "wood"
  | "stone"
  | "road"
  | "metal";

type TexturePattern =
  | "grass"
  | "leaf"
  | "wood"
  | "stucco"
  | "roof"
  | "road"
  | "paving"
  | "water"
  | "fabric";

const sharedMaterials = new Map<string, THREE.Material>();
const sharedTextures = new Map<TexturePattern, THREE.Texture>();
const sharedPbrTextures = new Map<string, THREE.Texture>();
const AUTHORED_TEXTURE_SIZE = { width: 418, height: 627 } as const;

const AUTHORED_TEXTURE_ASSETS: Partial<Record<TexturePattern, string>> = {
  grass: "textures/v2-grass.png",
  wood: "textures/v2-wood.png",
  stucco: "textures/v2-stucco.png",
  roof: "textures/v2-roof.png",
  paving: "textures/v2-stone.png",
};

type PbrCompanionKind = "normal" | "roughness" | "ao";

const V4_PBR_ASSETS: Partial<
  Record<TexturePattern, Partial<Record<PbrCompanionKind, string>>>
> = {
  grass: {
    normal: "textures/v4-grass-normal.png",
    roughness: "textures/v4-grass-roughness.png",
    ao: "textures/v4-grass-ao.png",
  },
  wood: {
    normal: "textures/v4-wood-normal.png",
    roughness: "textures/v4-wood-roughness.png",
    ao: "textures/v4-wood-ao.png",
  },
  stucco: {
    normal: "textures/v4-stucco-normal.png",
    roughness: "textures/v4-stucco-roughness.png",
    ao: "textures/v4-stucco-ao.png",
  },
  roof: {
    normal: "textures/v4-roof-normal.png",
    roughness: "textures/v4-roof-roughness.png",
    ao: "textures/v4-roof-ao.png",
  },
  road: {
    normal: "textures/v4-stone-normal.png",
    roughness: "textures/v4-stone-roughness.png",
    ao: "textures/v4-stone-ao.png",
  },
  paving: {
    normal: "textures/v4-stone-normal.png",
    roughness: "textures/v4-stone-roughness.png",
    ao: "textures/v4-stone-ao.png",
  },
  water: {
    normal: "textures/v4-water-normal.png",
    roughness: "textures/v4-water-roughness.png",
    ao: "textures/v4-water-ao.png",
  },
};

const PATTERN_REPEAT: Record<TexturePattern, readonly [number, number]> = {
  grass: [8, 8],
  leaf: [4, 4],
  wood: [3, 6],
  stucco: [5, 5],
  roof: [5, 5],
  road: [4, 10],
  paving: [7, 7],
  water: [3, 8],
  fabric: [5, 5],
};

function randomFactory(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function fallbackPatternTexture(pattern: TexturePattern): THREE.DataTexture {
  const random = randomFactory(pattern.length * 9137);
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const variation = Math.round(224 + random() * 28);
    data[index * 4] = variation;
    data[index * 4 + 1] = variation;
    data[index * 4 + 2] = variation;
    data[index * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Small hand-drawn repeat tiles give broad procedural surfaces visible grain
 * and brush variation without shipping external or generated image assets.
 */
function proceduralTexture(pattern: TexturePattern): THREE.Texture {
  const cached = sharedTextures.get(pattern);
  if (cached) return cached;

  let texture: THREE.Texture;
  if (typeof document === "undefined") {
    texture = fallbackPatternTexture(pattern);
  } else {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      texture = fallbackPatternTexture(pattern);
    } else {
      const random = randomFactory(pattern.length * 1289 + 41);
      context.fillStyle = pattern === "water" ? "#d9f2f3" : "#eeeae1";
      context.fillRect(0, 0, size, size);
      context.lineCap = "round";

      if (pattern === "grass" || pattern === "leaf") {
        const marks = pattern === "grass" ? 360 : 230;
        for (let index = 0; index < marks; index += 1) {
          const x = random() * size;
          const y = random() * size;
          const length = 1.5 + random() * (pattern === "grass" ? 5 : 2.8);
          context.strokeStyle = random() > 0.48 ? "rgba(75,105,70,.18)" : "rgba(255,255,232,.24)";
          context.lineWidth = 0.55 + random() * 0.8;
          context.beginPath();
          context.moveTo(x, y);
          context.quadraticCurveTo(x + random() * 2 - 1, y - length * 0.6, x + random() * 3 - 1.5, y - length);
          context.stroke();
        }
      } else if (pattern === "wood") {
        for (let x = 0; x < size; x += 16) {
          context.fillStyle = x % 32 === 0 ? "rgba(135,85,55,.09)" : "rgba(255,250,225,.11)";
          context.fillRect(x, 0, 15, size);
          context.strokeStyle = "rgba(91,57,39,.18)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x + 15.5, 0);
          context.lineTo(x + 15.5, size);
          context.stroke();
        }
        for (let index = 0; index < 36; index += 1) {
          const x = random() * size;
          const y = random() * size;
          context.strokeStyle = "rgba(104,65,40,.13)";
          context.beginPath();
          context.ellipse(x, y, 1.5 + random() * 5, 0.6 + random(), random() * 0.25, 0, Math.PI * 2);
          context.stroke();
        }
      } else if (pattern === "stucco") {
        for (let index = 0; index < 520; index += 1) {
          const tone = random() > 0.52 ? 255 : 145;
          context.fillStyle = `rgba(${tone},${tone},${tone},${0.035 + random() * 0.055})`;
          const radius = 0.35 + random() * 1.15;
          context.fillRect(random() * size, random() * size, radius, radius);
        }
        context.strokeStyle = "rgba(255,255,255,.14)";
        context.lineWidth = 1.1;
        for (let y = 8; y < size; y += 23) {
          context.beginPath();
          context.moveTo(0, y + random() * 3);
          context.bezierCurveTo(34, y - 2, 89, y + 3, size, y);
          context.stroke();
        }
      } else if (pattern === "roof") {
        context.strokeStyle = "rgba(86,57,52,.2)";
        context.lineWidth = 1.4;
        for (let y = 0; y <= size; y += 16) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(size, y);
          context.stroke();
          for (let x = (y / 16) % 2 === 0 ? 0 : -8; x < size; x += 16) {
            context.beginPath();
            context.arc(x + 8, y, 8, 0, Math.PI);
            context.stroke();
          }
        }
      } else if (pattern === "paving") {
        context.strokeStyle = "rgba(104,94,78,.17)";
        context.lineWidth = 1.2;
        for (let y = 0; y <= size; y += 18) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(size, y);
          context.stroke();
          const offset = (y / 18) % 2 === 0 ? 0 : 15;
          for (let x = offset; x < size; x += 30) {
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x, y + 18);
            context.stroke();
          }
        }
      } else if (pattern === "road") {
        for (let index = 0; index < 420; index += 1) {
          const tone = Math.round(118 + random() * 90);
          context.fillStyle = `rgba(${tone},${tone},${tone},${0.04 + random() * 0.07})`;
          const radius = 0.35 + random() * 1.25;
          context.beginPath();
          context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
          context.fill();
        }
        context.strokeStyle = "rgba(71,72,76,.11)";
        for (let index = 0; index < 7; index += 1) {
          const x = random() * size;
          const y = random() * size;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + random() * 12 - 6, y + 5 + random() * 11);
          context.stroke();
        }
      } else if (pattern === "water") {
        context.strokeStyle = "rgba(255,255,255,.47)";
        context.lineWidth = 1.4;
        for (let y = 7; y < size; y += 13) {
          for (let x = -12; x < size; x += 28) {
            context.beginPath();
            context.bezierCurveTo(x, y, x + 6, y - 3, x + 13, y);
            context.bezierCurveTo(x + 18, y + 2, x + 22, y + 2, x + 27, y - 1);
            context.stroke();
          }
        }
      } else if (pattern === "fabric") {
        context.strokeStyle = "rgba(79,69,63,.11)";
        context.lineWidth = 0.65;
        for (let line = -size; line < size * 2; line += 7) {
          context.beginPath();
          context.moveTo(line, 0);
          context.lineTo(line - size, size);
          context.stroke();
          context.beginPath();
          context.moveTo(line, 0);
          context.lineTo(line + size, size);
          context.stroke();
        }
      }
      texture = new THREE.CanvasTexture(canvas);
    }
  }

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...PATTERN_REPEAT[pattern]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.shared = true;
  texture.userData.pattern = pattern;
  texture.needsUpdate = true;
  sharedTextures.set(pattern, texture);
  return texture;
}

/**
 * Loads the V2 hand-painted texture set generated for this project. Relative
 * URLs intentionally resolve from document.baseURI so the same build works at
 * the Sites root and under the GitHub Pages sub-directory. Procedural tiles
 * remain the deterministic fallback for SSR, slow networks and patterns that
 * do not need authored art.
 */
function surfaceTexture(pattern: TexturePattern): THREE.Texture {
  const cached = sharedTextures.get(pattern);
  if (cached) return cached;
  const asset = AUTHORED_TEXTURE_ASSETS[pattern];
  if (typeof document === "undefined" || !asset) return proceduralTexture(pattern);

  // TextureLoader's empty texture samples as black until the network image is
  // decoded. Start from a warm neutral pixel so first-time GitHub visitors see
  // the material colour immediately, then replace it with the authored tile.
  const placeholder = document.createElement("canvas");
  // All authored V2/V4 tiles share this size. Matching the eventual GPU
  // allocation avoids WebGL2 texSubImage overflow errors on ANGLE when the
  // asynchronous image replaces the placeholder.
  placeholder.width = AUTHORED_TEXTURE_SIZE.width;
  placeholder.height = AUTHORED_TEXTURE_SIZE.height;
  const placeholderContext = placeholder.getContext("2d");
  if (placeholderContext) {
    placeholderContext.fillStyle = "#f4f1e8";
    placeholderContext.fillRect(0, 0, placeholder.width, placeholder.height);
  }
  const texture: THREE.Texture = new THREE.TextureLoader().load(
    new URL(asset, document.baseURI).href,
    (loaded) => {
      loaded.needsUpdate = true;
    },
    undefined,
    () => {
      // Keep the neutral placeholder: material colour, roughness and geometry
      // remain fully readable even if the authored tile cannot be downloaded.
    },
  );
  // TextureLoader will replace this image automatically when its request
  // finishes. Assigning it synchronously prevents the default black sample.
  texture.image = placeholder;
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...PATTERN_REPEAT[pattern]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.shared = true;
  texture.userData.pattern = pattern;
  sharedTextures.set(pattern, texture);
  return texture;
}

function neutralPbrTexture(kind: PbrCompanionKind): THREE.Texture {
  const pixel = kind === "normal" ? [128, 128, 255, 255] : kind === "ao" ? [255, 255, 255, 255] : [220, 220, 220, 255];
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = AUTHORED_TEXTURE_SIZE.width;
    canvas.height = AUTHORED_TEXTURE_SIZE.height;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
  const texture = new THREE.DataTexture(new Uint8Array(pixel), 1, 1, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Loads V4 tangent detail maps with a deterministic neutral pixel as the
 * immediate and failure state. A missing optional file can therefore never
 * turn the scene black or make a material unexpectedly glossy.
 */
function pbrTexture(pattern: TexturePattern, kind: PbrCompanionKind): THREE.Texture {
  const key = `${pattern}:${kind}`;
  const cached = sharedPbrTextures.get(key);
  if (cached) return cached;

  const asset = V4_PBR_ASSETS[pattern]?.[kind];
  const neutral = neutralPbrTexture(kind);
  if (typeof document === "undefined" || !asset) {
    neutral.userData.shared = true;
    neutral.userData.pbrPattern = key;
    sharedPbrTextures.set(key, neutral);
    return neutral;
  }

  const texture: THREE.Texture = new THREE.TextureLoader().load(
    new URL(asset, document.baseURI).href,
    (loaded) => {
      loaded.needsUpdate = true;
    },
    undefined,
    () => {
      // The neutral texture assigned below is intentionally retained.
    },
  );
  texture.image = neutral.image;
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...PATTERN_REPEAT[pattern]);
  texture.anisotropy = 4;
  texture.channel = 0;
  texture.userData.shared = true;
  texture.userData.pbrPattern = key;
  sharedPbrTextures.set(key, texture);
  return texture;
}

function pbrCompanions(pattern: TexturePattern): THREE.MeshStandardMaterialParameters {
  if (!V4_PBR_ASSETS[pattern]) return {};
  return {
    normalMap: pbrTexture(pattern, "normal"),
    normalScale: pattern === "stucco"
      ? new THREE.Vector2(0.1, 0.1)
      : pattern === "roof" || pattern === "paving"
        ? new THREE.Vector2(0.24, 0.24)
        : new THREE.Vector2(0.2, 0.2),
    roughnessMap: pbrTexture(pattern, "roughness"),
    aoMap: pbrTexture(pattern, "ao"),
    aoMapIntensity: pattern === "stucco" ? 0.26 : 0.38,
  };
}

function defaultPatternForSurface(surface: EnvironmentSurface): TexturePattern | undefined {
  switch (surface) {
    case "grass":
      return "grass";
    case "leaf":
      return "leaf";
    case "wood":
      return "wood";
    case "stone":
      return "paving";
    case "road":
      return "road";
    default:
      return undefined;
  }
}

function inferSurface(color: THREE.ColorRepresentation): EnvironmentSurface {
  const value = new THREE.Color(color).getHex();
  if (([COLORS.grass, COLORS.grassLight, COLORS.grassDark] as number[]).includes(value)) return "grass";
  if (([COLORS.leaf, COLORS.leafLight, COLORS.leafDark, 0x83d36d] as number[]).includes(value)) return "leaf";
  if (([COLORS.wood, COLORS.darkWood, 0xa96e48, 0xb7754d, 0xb16c43] as number[]).includes(value)) return "wood";
  if (([COLORS.stone, COLORS.stoneDark, COLORS.paving, COLORS.pavingLight] as number[]).includes(value)) return "stone";
  if (([COLORS.road, COLORS.roadEdge] as number[]).includes(value)) return "road";
  if (([COLORS.ink, 0x43565a, 0x44565d, 0x3d5057] as number[]).includes(value)) return "metal";
  return "paint";
}

function surfaceProperties(surface: EnvironmentSurface): Pick<
  THREE.MeshStandardMaterialParameters,
  "roughness" | "metalness"
> {
  switch (surface) {
    case "grass":
      return { roughness: 0.96, metalness: 0 };
    case "leaf":
      return { roughness: 0.78, metalness: 0 };
    case "wood":
      return { roughness: 0.68, metalness: 0 };
    case "stone":
      return { roughness: 0.86, metalness: 0 };
    case "road":
      return { roughness: 0.98, metalness: 0 };
    case "metal":
      return { roughness: 0.42, metalness: 0.36 };
    default:
      return { roughness: 0.74, metalness: 0 };
  }
}

function materialKey(
  family: string,
  color: THREE.ColorRepresentation,
  options: THREE.MeshStandardMaterialParameters,
): string {
  const emissive = options.emissive ? new THREE.Color(options.emissive).getHexString() : "none";
  const mapName = (options.map?.userData.pattern as string | undefined) ?? "none";
  const normalName = (options.normalMap?.userData.pbrPattern as string | undefined) ?? "none";
  const roughnessName = (options.roughnessMap?.userData.pbrPattern as string | undefined) ?? "none";
  const aoName = (options.aoMap?.userData.pbrPattern as string | undefined) ?? "none";
  return [
    family,
    new THREE.Color(color).getHexString(),
    options.roughness,
    options.metalness,
    options.opacity ?? 1,
    options.transparent ? 1 : 0,
    options.emissiveIntensity ?? 0,
    emissive,
    options.side ?? THREE.FrontSide,
    mapName,
    normalName,
    roughnessName,
    aoName,
    options.vertexColors ? 1 : 0,
  ].join(":");
}

/**
 * Kept under the old helper name so the scene builders stay concise. Unlike
 * the original flat toon shader, this creates a restrained, tactile surface
 * with material-specific roughness. Shared materials are marked so the scene
 * owner can keep them alive between scene transitions.
 */
function toon(
  color: THREE.ColorRepresentation,
  options: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const surface = inferSurface(color);
  const baseOptions: THREE.MeshStandardMaterialParameters = {
    ...surfaceProperties(surface),
    ...(options.map || !defaultPatternForSurface(surface)
      ? {}
      : { map: surfaceTexture(defaultPatternForSurface(surface) as TexturePattern) }),
    ...options,
  };
  const materialPattern = baseOptions.map?.userData.pattern as TexturePattern | undefined;
  const resolvedOptions: THREE.MeshStandardMaterialParameters = {
    ...(materialPattern ? pbrCompanions(materialPattern) : {}),
    ...baseOptions,
  };
  const key = materialKey("standard", color, resolvedOptions);
  const cached = sharedMaterials.get(key);
  if (cached instanceof THREE.MeshStandardMaterial) return cached;

  const result = new THREE.MeshStandardMaterial({ color, ...resolvedOptions });
  result.userData.shared = true;
  sharedMaterials.set(key, result);
  return result;
}

function patternedMaterial(
  color: THREE.ColorRepresentation,
  pattern: TexturePattern,
  options: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return toon(color, { map: surfaceTexture(pattern), ...options });
}

function glassMaterial(
  color: THREE.ColorRepresentation = 0x86cddd,
  warmInterior = false,
): THREE.MeshPhysicalMaterial {
  const key = `glass:${new THREE.Color(color).getHexString()}:${warmInterior ? 1 : 0}`;
  const cached = sharedMaterials.get(key);
  if (cached instanceof THREE.MeshPhysicalMaterial) return cached;
  const result = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.14,
    metalness: 0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    transparent: true,
    opacity: 0.78,
    emissive: warmInterior ? 0xffba68 : 0x174758,
    emissiveIntensity: warmInterior ? 0.16 : 0.035,
  });
  result.userData.shared = true;
  sharedMaterials.set(key, result);
  return result;
}

function waterMaterial(color: THREE.ColorRepresentation): THREE.MeshPhysicalMaterial {
  const key = `water:${new THREE.Color(color).getHexString()}`;
  const cached = sharedMaterials.get(key);
  if (cached instanceof THREE.MeshPhysicalMaterial) return cached;
  const result = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.13,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    transparent: true,
    opacity: 0.91,
    emissive: 0x1599c8,
    emissiveIntensity: 0.055,
    map: surfaceTexture("water"),
    ...pbrCompanions("water"),
    normalScale: new THREE.Vector2(0.24, 0.24),
  });
  result.userData.shared = true;
  sharedMaterials.set(key, result);
  return result;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number] = [0, 0, 0],
  rotation: readonly [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const uv = geometry.getAttribute("uv");
  if (uv && !geometry.getAttribute("uv1")) geometry.setAttribute("uv1", uv.clone());
  // Keep uv2 as a compatibility alias for WebGL renderers predating Three's
  // uv1 naming while using the same primary repeat coordinates.
  if (uv && !geometry.getAttribute("uv2")) geometry.setAttribute("uv2", uv.clone());
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function prepareInstancedGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
  const uv = geometry.getAttribute("uv");
  if (uv && !geometry.getAttribute("uv1")) geometry.setAttribute("uv1", uv.clone());
  if (uv && !geometry.getAttribute("uv2")) geometry.setAttribute("uv2", uv.clone());
  return geometry;
}

function roundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.08,
): THREE.ExtrudeGeometry {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corner = Math.min(radius, halfWidth * 0.36, halfHeight * 0.36);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + corner);
  shape.lineTo(halfWidth, halfHeight - corner);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - corner, halfHeight);
  shape.lineTo(-halfWidth + corner, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - corner);
  shape.lineTo(-halfWidth, -halfHeight + corner);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + corner, -halfHeight);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - corner * 0.7),
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: corner * 0.34,
    bevelThickness: corner * 0.34,
  });
  geometry.translate(0, 0, -depth / 2 + corner * 0.35);
  geometry.computeVertexNormals();
  return geometry;
}

function roundedBox(
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  color: THREE.ColorRepresentation,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  radius = 0.08,
  pattern?: TexturePattern,
): THREE.Mesh {
  const material = pattern
    ? patternedMaterial(color, pattern, { roughness: pattern === "stucco" ? 0.94 : 0.82 })
    : toon(color);
  const result = addMesh(parent, roundedBoxGeometry(...size, radius), material, position, rotation);
  result.castShadow = Math.max(...size) > 0.8;
  result.receiveShadow = Math.max(...size) > 1.1;
  return result;
}

function addEdges(
  mesh: THREE.Mesh,
  color: THREE.ColorRepresentation = COLORS.ink,
  opacity = 0.11,
  thresholdAngle = 38,
): THREE.LineSegments {
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, thresholdAngle),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  lines.renderOrder = 2;
  mesh.add(lines);
  return lines;
}

function box(
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  color: THREE.ColorRepresentation,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  outlined = false,
): THREE.Mesh {
  const result = addMesh(
    parent,
    new THREE.BoxGeometry(...size),
    toon(color),
    position,
    rotation,
  );
  const longestSide = Math.max(...size);
  result.castShadow = longestSide >= 0.82;
  result.receiveShadow = longestSide >= 1.1;
  if (outlined) addEdges(result);
  return result;
}

function cylinder(
  parent: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  color: THREE.ColorRepresentation,
  position: readonly [number, number, number],
  outlined = false,
): THREE.Mesh {
  const result = addMesh(
    parent,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    toon(color),
    position,
  );
  result.castShadow = height >= 0.72 || Math.max(radiusTop, radiusBottom) >= 0.72;
  result.receiveShadow = height >= 0.72 || Math.max(radiusTop, radiusBottom) >= 0.92;
  if (outlined) addEdges(result);
  return result;
}

function sphere(
  parent: THREE.Object3D,
  radius: number,
  color: THREE.ColorRepresentation,
  position: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
  outlined = false,
): THREE.Mesh {
  const result = addMesh(
    parent,
    new THREE.SphereGeometry(radius, 20, 12),
    toon(color),
    position,
  );
  result.scale.set(...scale);
  result.castShadow = radius >= 0.42;
  result.receiveShadow = false;
  if (outlined) addEdges(result, COLORS.ink, 0.09, 42);
  return result;
}

function branch(
  parent: THREE.Object3D,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  radiusBottom: number,
  radiusTop: number,
): THREE.Mesh {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const result = addMesh(
    parent,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, direction.length(), 10),
    toon(COLORS.wood),
  );
  result.position.copy(start).add(end).multiplyScalar(0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  result.castShadow = true;
  return result;
}

function gableRoofGeometry(width: number, depth: number, rise: number): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -halfWidth, 0, -halfDepth,
        halfWidth, 0, -halfDepth,
        0, rise, -halfDepth,
        -halfWidth, 0, halfDepth,
        halfWidth, 0, halfDepth,
        0, rise, halfDepth,
      ],
      3,
    ),
  );
  geometry.setIndex([
    0, 2, 1,
    3, 4, 5,
    0, 3, 5,
    0, 5, 2,
    1, 2, 5,
    1, 5, 4,
    0, 1, 4,
    0, 4, 3,
  ]);
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      [
        0, 0,
        1, 0,
        0.5, 1,
        0, 0,
        1, 0,
        0.5, 1,
      ],
      2,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function timberBeam(
  parent: THREE.Object3D,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  thickness = 0.15,
  depth = 0.16,
  color: THREE.ColorRepresentation = 0x7d5137,
): THREE.Mesh {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const beam = addMesh(
    parent,
    roundedBoxGeometry(thickness, direction.length(), depth, Math.min(0.045, thickness * 0.24)),
    patternedMaterial(color, "wood", { roughness: 0.78 }),
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.castShadow = true;
  return beam;
}

function createTiledGableRoof(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  rise: number,
  baseY: number,
  roofColor: THREE.ColorRepresentation,
  gableColor: THREE.ColorRepresentation,
): THREE.Mesh {
  const roof = addMesh(
    parent,
    gableRoofGeometry(width, depth, rise),
    patternedMaterial(roofColor, "roof", {
      roughness: 0.78,
      side: THREE.DoubleSide,
    }),
    [0, baseY, 0],
  );
  roof.castShadow = true;

  // Cover the solid red end caps with a pale plaster gable. The roof then
  // reads as two tiled slopes sitting on a real timber-framed wall.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-width / 2 + 0.12, 0.04);
  gableShape.lineTo(width / 2 - 0.12, 0.04);
  gableShape.lineTo(0, rise - 0.12);
  gableShape.closePath();
  const gableMaterial = patternedMaterial(gableColor, "stucco", {
    roughness: 0.94,
    side: THREE.DoubleSide,
  });
  for (const z of [-depth / 2 - 0.025, depth / 2 + 0.025]) {
    const gable = addMesh(
      parent,
      new THREE.ShapeGeometry(gableShape, 3),
      gableMaterial,
      [0, baseY, z],
    );
    gable.castShadow = false;
  }

  // A single instanced draw creates the repeated rounded terracotta ridges.
  const rowCount = 18;
  const rows = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.068, 0.075, depth + 0.22, 9),
    toon(new THREE.Color(roofColor).lerp(new THREE.Color(0xf28a5f), 0.32).getHex(), {
      roughness: 0.72,
    }),
    rowCount * 2 + 1,
  );
  rows.name = "Terracotta roof ridges";
  rows.castShadow = false;
  rows.receiveShadow = false;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const scale = new THREE.Vector3(1, 1, 1);
  let instance = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < rowCount; row += 1) {
      const progress = (row + 0.62) / (rowCount + 0.25);
      const position = new THREE.Vector3(
        side * (width / 2) * progress,
        baseY + rise * (1 - progress) + 0.075,
        0,
      );
      matrix.compose(position, rotation, scale);
      rows.setMatrixAt(instance, matrix);
      instance += 1;
    }
  }
  matrix.compose(new THREE.Vector3(0, baseY + rise + 0.075, 0), rotation, scale);
  rows.setMatrixAt(instance, matrix);
  rows.instanceMatrix.needsUpdate = true;
  parent.add(rows);

  // A scalloped eave row catches light independently from the broad roof
  // plane. This is the small silhouette cue that makes terracotta roofs read
  // as layered ceramic pieces instead of a single red prism.
  const eaveCount = Math.max(12, Math.ceil(width / 0.27));
  const eaveTiles = new THREE.InstancedMesh(
    prepareInstancedGeometry(new THREE.CylinderGeometry(0.105, 0.115, width / eaveCount + 0.045, 9)),
    toon(new THREE.Color(roofColor).lerp(new THREE.Color(0xf29165), 0.3).getHex(), {
      roughness: 0.76,
      normalMap: pbrTexture("roof", "normal"),
      roughnessMap: pbrTexture("roof", "roughness"),
    }),
    eaveCount * 2,
  );
  eaveTiles.name = "Layered terracotta eaves";
  const eaveRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const z = sideIndex === 0 ? depth / 2 + 0.13 : -depth / 2 - 0.13;
    for (let tile = 0; tile < eaveCount; tile += 1) {
      const px = -width / 2 + ((tile + 0.5) / eaveCount) * width;
      matrix.compose(new THREE.Vector3(px, baseY + 0.035, z), eaveRotation, scale);
      eaveTiles.setMatrixAt(sideIndex * eaveCount + tile, matrix);
    }
  }
  eaveTiles.instanceMatrix.needsUpdate = true;
  eaveTiles.castShadow = false;
  parent.add(eaveTiles);

  const frontZ = depth / 2 + 0.11;
  const backZ = -depth / 2 - 0.11;
  for (const z of [frontZ, backZ]) {
    timberBeam(parent, [-width / 2, baseY, z], [0, baseY + rise, z], 0.15, 0.14);
    timberBeam(parent, [0, baseY + rise, z], [width / 2, baseY, z], 0.15, 0.14);
    timberBeam(parent, [0, baseY + 0.08, z], [0, baseY + rise - 0.08, z], 0.14, 0.14);
  }
  box(parent, [0.2, 0.22, depth + 0.34], 0x7b5038, [-width / 2, baseY, 0]);
  box(parent, [0.2, 0.22, depth + 0.34], 0x7b5038, [width / 2, baseY, 0]);
  return roof;
}

/**
 * A shallow tiled canopy gives the lower floor a second, human-scale roofline.
 * The target village relies on this repeated terracotta silhouette much more
 * than on large flat coloured slabs, so the detail is instanced and cheap.
 */
function createTerracottaCanopy(
  parent: THREE.Object3D,
  width: number,
  y: number,
  z: number,
  roofColor: THREE.ColorRepresentation,
): void {
  const clayColor = new THREE.Color(roofColor)
    .lerp(new THREE.Color(0xe6784d), 0.72)
    .getHex();
  const canopy = roundedBox(
    parent,
    [width, 0.16, 1.02],
    clayColor,
    [0, y, z],
    [-0.16, 0, 0],
    0.055,
    "roof",
  );
  canopy.castShadow = true;

  const tileCount = Math.max(10, Math.ceil(width / 0.28));
  const eaveTiles = new THREE.InstancedMesh(
    prepareInstancedGeometry(
      new THREE.CylinderGeometry(0.09, 0.105, width / tileCount + 0.035, 9),
    ),
    toon(new THREE.Color(clayColor).lerp(new THREE.Color(0xf29a68), 0.24).getHex(), {
      roughness: 0.8,
    }),
    tileCount,
  );
  eaveTiles.name = "Rounded residential canopy tiles";
  eaveTiles.castShadow = false;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  const scale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < tileCount; index += 1) {
    const x = -width / 2 + ((index + 0.5) / tileCount) * width;
    matrix.compose(new THREE.Vector3(x, y - 0.08, z + 0.52), rotation, scale);
    eaveTiles.setMatrixAt(index, matrix);
  }
  eaveTiles.instanceMatrix.needsUpdate = true;
  parent.add(eaveTiles);

  for (const x of [-width / 2 + 0.28, width / 2 - 0.28]) {
    timberBeam(parent, [x, y - 0.12, z - 0.32], [x, y - 0.58, z + 0.28], 0.09, 0.1);
  }
}

function createWindowPlanter(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  width = 1.1,
): void {
  const planter = box(parent, [width, 0.3, 0.38], 0xa96542, [x, y, z]);
  planter.material = patternedMaterial(0xa96542, "wood", { roughness: 0.8 });
  box(parent, [width - 0.12, 0.07, 0.29], 0x574b35, [x, y + 0.18, z]);
  for (const [offset, color] of [
    [-0.34, 0xf37988],
    [0, 0xffcf55],
    [0.34, 0x8d7bd2],
  ] as const) {
    sphere(parent, 0.13, COLORS.leafDark, [x + offset, y + 0.31, z], [1.15, 0.8, 0.8]);
    sphere(parent, 0.085, color, [x + offset, y + 0.43, z + 0.035], [1.1, 0.68, 0.7]);
  }
}

function addStoneFoundationFace(
  parent: THREE.Object3D,
  width: number,
  z: number,
  y = 0.36,
): void {
  const count = Math.max(5, Math.floor(width / 0.52));
  for (let index = 0; index < count; index += 1) {
    const segmentWidth = width / count - 0.025;
    const x = -width / 2 + segmentWidth / 2 + index * (width / count);
    const height = 0.32 + (index % 3) * 0.07;
    box(
      parent,
      [segmentWidth, height, 0.08],
      index % 2 === 0 ? 0xc8c2b4 : 0xadaea7,
      [x, y + (height - 0.32) / 2, z],
    ).castShadow = false;
  }
}

function addWindow(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  width = 0.78,
  height = 0.92,
): void {
  // A dark recess and warm inner panel make the window read as a real opening,
  // rather than a blue sticker sitting on the facade.
  box(parent, [width + 0.26, height + 0.26, 0.15], 0x7c5b43, [x, y, z - 0.015]);
  const interior = addMesh(
    parent,
    new THREE.BoxGeometry(width - 0.08, height - 0.08, 0.035),
    toon(0xffd18b, { emissive: 0xffa53d, emissiveIntensity: 0.12 }),
    [x, y, z + 0.075],
  );
  interior.castShadow = false;
  const pane = addMesh(
    parent,
    new THREE.BoxGeometry(width, height, 0.055),
    glassMaterial(0x80c8d8, true),
    [x, y, z + 0.125],
  );
  pane.castShadow = false;
  box(parent, [0.065, height + 0.08, 0.1], COLORS.white, [x, y, z + 0.18]);
  box(parent, [width + 0.08, 0.065, 0.1], COLORS.white, [x, y, z + 0.18]);
  box(parent, [width + 0.3, 0.13, 0.28], 0xa6654c, [x, y - height / 2 - 0.15, z + 0.15]);
  // Slim upper trim catches the sun and gives the casing a layered profile.
  box(parent, [width + 0.32, 0.08, 0.22], COLORS.white, [x, y + height / 2 + 0.13, z + 0.12]);
}

function archedPanelGeometry(width: number, height: number, segments = 12): THREE.ShapeGeometry {
  const radius = width / 2;
  const shoulder = Math.max(height - radius, height * 0.46);
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, shoulder);
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI;
    shape.lineTo(Math.cos(angle) * radius, shoulder + Math.sin(angle) * radius);
  }
  shape.lineTo(-radius, 0);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 4);
}

function addArchedWindow(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  width = 0.92,
  height = 1.34,
  planter = true,
): void {
  const baseY = y - height / 2;
  const recess = addMesh(
    parent,
    archedPanelGeometry(width + 0.28, height + 0.22),
    toon(0x715642, { roughness: 0.82, side: THREE.DoubleSide }),
    [x, baseY - 0.08, z],
  );
  recess.castShadow = false;
  const warmBacking = addMesh(
    parent,
    archedPanelGeometry(width, height),
    toon(0xffcf88, { emissive: 0xffaa54, emissiveIntensity: 0.12, side: THREE.DoubleSide }),
    [x, baseY, z + 0.075],
  );
  warmBacking.castShadow = false;
  const glass = addMesh(
    parent,
    archedPanelGeometry(width - 0.08, height - 0.08),
    glassMaterial(0x63b8cf, true),
    [x, baseY + 0.04, z + 0.12],
  );
  glass.castShadow = false;
  const archRadius = width / 2 + 0.05;
  const shoulder = baseY + Math.max(height - width / 2, height * 0.46);
  const archTrim = addMesh(
    parent,
    new THREE.TorusGeometry(archRadius, 0.055, 7, 18, Math.PI),
    toon(COLORS.white, { roughness: 0.76 }),
    [x, shoulder, z + 0.18],
  );
  archTrim.castShadow = false;
  box(parent, [0.08, height - width / 2, 0.11], COLORS.white, [x - archRadius, baseY + (height - width / 2) / 2, z + 0.18]);
  box(parent, [0.08, height - width / 2, 0.11], COLORS.white, [x + archRadius, baseY + (height - width / 2) / 2, z + 0.18]);
  box(parent, [0.06, height - 0.14, 0.1], COLORS.white, [x, baseY + (height - 0.14) / 2, z + 0.2]);
  box(parent, [width + 0.12, 0.065, 0.1], COLORS.white, [x, baseY + height * 0.46, z + 0.2]);
  box(parent, [width + 0.38, 0.14, 0.3], 0xa6654c, [x, baseY - 0.1, z + 0.17]);
  if (planter) createWindowPlanter(parent, x, baseY - 0.26, z + 0.34, width + 0.28);
}

function createFabricAwning(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  width: number,
  color: THREE.ColorRepresentation = 0x4a99ba,
): void {
  const segmentCount = Math.max(5, Math.round(width / 0.36));
  const segmentWidth = width / segmentCount;
  for (let index = 0; index < segmentCount; index += 1) {
    const stripe = index % 2 === 0
      ? new THREE.Color(color).lerp(new THREE.Color(0xe7f6ed), 0.08).getHex()
      : new THREE.Color(color).lerp(new THREE.Color(0x2d6f91), 0.18).getHex();
    const offsetX = -width / 2 + segmentWidth / 2 + index * segmentWidth;
    const canopy = roundedBox(
      parent,
      [segmentWidth + 0.025, 0.09, 1.02],
      stripe,
      [x + offsetX, y, z + 0.39],
      [-0.2, 0, 0],
      0.035,
      "fabric",
    );
    canopy.castShadow = false;
    const scallop = sphere(parent, segmentWidth * 0.5, stripe, [x + offsetX, y - 0.12, z + 0.91], [1, 0.58, 0.55]);
    scallop.material = patternedMaterial(stripe, "fabric", { roughness: 0.94 });
    scallop.castShadow = false;
  }
  box(parent, [width + 0.16, 0.1, 0.12], 0x735039, [x, y + 0.08, z - 0.08]);
}

function createFlowerBalcony(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  width = 2.7,
): void {
  const timber = 0x765039;
  const deck = roundedBox(parent, [width, 0.18, 0.72], 0x996344, [x, y, z], [0, 0, 0], 0.06, "wood");
  deck.castShadow = true;
  for (const offsetX of [-width / 2 + 0.1, -width / 4, 0, width / 4, width / 2 - 0.1]) {
    cylinder(parent, 0.035, 0.045, 0.65, 7, timber, [x + offsetX, y + 0.36, z + 0.31]);
  }
  box(parent, [width, 0.08, 0.08], timber, [x, y + 0.69, z + 0.31]);
  createWindowPlanter(parent, x - width * 0.25, y + 0.18, z + 0.43, width * 0.43);
  createWindowPlanter(parent, x + width * 0.25, y + 0.18, z + 0.43, width * 0.43);
}

function addDoor(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: THREE.ColorRepresentation,
): void {
  roundedBox(parent, [1.16, 2.55, 0.18], COLORS.white, [x, y, z], [0, 0, 0], 0.12);
  roundedBox(parent, [0.94, 2.33, 0.13], color, [x, y, z + 0.12], [0, 0, 0], 0.1, "wood");
  // Four recessed panels break up the tall slab and better establish scale.
  for (const panelY of [y - 0.57, y + 0.54]) {
    box(parent, [0.66, 0.72, 0.035], 0x6c5948, [x, panelY, z + 0.2]);
  }
  sphere(parent, 0.066, COLORS.gold, [x + 0.33, y, z + 0.23], [1, 1, 0.55]);
  box(parent, [1.32, 0.16, 0.64], 0xd6c9b1, [x, 0.11, z + 0.28]);
}

function createHouse(
  parent: THREE.Object3D,
  x: number,
  z: number,
  bodyColor: THREE.ColorRepresentation,
  roofColor: THREE.ColorRepresentation,
  yaw = 0,
  scale = 1,
): THREE.Group {
  const house = new THREE.Group();
  house.position.set(x, 0, z);
  house.rotation.y = yaw;
  // A broad, slightly lower silhouette reads as a believable two-storey home
  // beside the residents instead of a narrow toy tower.
  house.scale.set(scale * 1.14, scale * 0.9, scale * 1.04);
  parent.add(house);

  const wallColor = new THREE.Color(bodyColor).lerp(new THREE.Color(0xfff4df), 0.84).getHex();
  const tileColor = new THREE.Color(roofColor).lerp(new THREE.Color(0xd9694e), 0.82).getHex();
  const foundation = roundedBox(house, [4.24, 0.62, 3.18], 0xb9b5aa, [0, 0.3, 0], [0, 0, 0], 0.11, "paving");
  foundation.receiveShadow = true;
  addStoneFoundationFace(house, 4.06, 1.635, 0.33);

  const body = roundedBox(house, [4.06, 6.22, 3.02], wallColor, [0, 3.42, 0], [0, 0, 0], 0.09, "stucco");
  addEdges(body, 0x8d745e, 0.065, 44);

  const frontZ = 1.57;
  const timber = 0x7e5238;
  for (const corner of [-1, 1]) {
    box(house, [0.18, 6.02, 0.17], timber, [corner * 1.94, 3.5, frontZ]);
    box(house, [0.18, 6.02, 0.17], timber, [corner * 1.94, 3.5, -frontZ]);
  }
  for (const beamY of [0.72, 3.58, 6.36]) {
    box(house, [3.94, 0.17, 0.17], timber, [0, beamY, frontZ]);
  }
  timberBeam(house, [-1.88, 3.65, frontZ + 0.02], [-0.74, 5.95, frontZ + 0.02], 0.13, 0.16, timber);
  timberBeam(house, [1.88, 3.65, frontZ + 0.02], [0.74, 5.95, frontZ + 0.02], 0.13, 0.16, timber);

  createTiledGableRoof(house, 4.72, 3.62, 2.82, 6.48, tileColor, wallColor);

  addDoor(house, 0, 1.51, 1.62, 0x3e7f78);
  addWindow(house, -1.28, 2.12, 1.6, 0.76, 1.05);
  addWindow(house, 1.28, 2.12, 1.6, 0.76, 1.05);
  addArchedWindow(house, -1.1, 5.08, 1.6, 0.9, 1.3, false);
  addArchedWindow(house, 1.1, 5.08, 1.6, 0.9, 1.3, false);
  createFlowerBalcony(house, 0, 3.83, 1.93, 2.75);

  const sideFacade = new THREE.Group();
  sideFacade.position.x = 2.04;
  sideFacade.rotation.y = Math.PI / 2;
  house.add(sideFacade);
  addWindow(sideFacade, 0.25, 4.72, 0, 0.82, 1.04);

  // A tiled porch, substantial posts and a stone step establish human scale.
  createFabricAwning(house, 0, 3.06, 1.63, 1.78, 0x438faf);
  for (const postX of [-0.75, 0.75]) {
    box(house, [0.11, 2.48, 0.11], timber, [postX, 1.64, 2.22]);
  }
  box(house, [1.58, 0.17, 0.72], 0xcac4b5, [0, 0.14, 1.96]);

  box(house, [0.42, 1.72, 0.4], 0x9a6047, [1.3, 7.88, -0.45]);
  box(house, [0.6, 0.2, 0.6], 0x754737, [1.3, 8.77, -0.45]);

  house.userData.kind = "house";
  house.userData.height = 9.35 * scale * 0.9;
  return house;
}

function addStorefrontWindow(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  mullions: number,
): void {
  box(parent, [width + 0.24, height + 0.22, 0.16], 0x52656a, [x, y, z - 0.03]);
  const warmInterior = addMesh(
    parent,
    new THREE.BoxGeometry(width - 0.08, height - 0.08, 0.04),
    toon(0xffc77e, { emissive: 0xff9c42, emissiveIntensity: 0.16 }),
    [x, y, z + 0.075],
  );
  warmInterior.castShadow = false;
  const glass = addMesh(
    parent,
    new THREE.BoxGeometry(width, height, 0.055),
    glassMaterial(0x70bfd2, true),
    [x, y, z + 0.13],
  );
  glass.castShadow = false;
  for (let index = 1; index < mullions; index += 1) {
    const offset = -width / 2 + (index / mullions) * width;
    box(parent, [0.065, height + 0.08, 0.09], COLORS.white, [x + offset, y, z + 0.19]);
  }
  box(parent, [width + 0.08, 0.07, 0.09], COLORS.white, [x, y, z + 0.19]);
  box(parent, [width + 0.3, 0.14, 0.27], 0x8a654d, [x, y - height / 2 - 0.15, z + 0.14]);
}

function createCafe(parent: THREE.Object3D, x: number, z: number): THREE.Group {
  const cafe = new THREE.Group();
  cafe.position.set(x, 0, z);
  parent.add(cafe);

  const wallColor = 0xfff0d7;
  const tileColor = 0xd66c50;
  const timber = 0x765039;
  const cafeFoundation = roundedBox(cafe, [5.62, 0.62, 3.78], 0xb9b6ad, [0, 0.3, 0], [0, 0, 0], 0.11, "paving");
  cafeFoundation.receiveShadow = true;
  addStoneFoundationFace(cafe, 5.38, 1.94, 0.33);
  const cafeBody = roundedBox(cafe, [5.4, 6.06, 3.55], wallColor, [0, 3.34, 0], [0, 0, 0], 0.09, "stucco");
  addEdges(cafeBody, 0x8b725d, 0.065, 44);

  const frontZ = 1.83;
  for (const corner of [-1, 1]) {
    box(cafe, [0.19, 5.84, 0.18], timber, [corner * 2.6, 3.44, frontZ]);
    box(cafe, [0.19, 5.84, 0.18], timber, [corner * 2.6, 3.44, -frontZ]);
  }
  for (const beamY of [0.72, 3.52, 6.27]) {
    box(cafe, [5.24, 0.18, 0.18], timber, [0, beamY, frontZ]);
  }
  createTiledGableRoof(cafe, 6.02, 4.05, 2.9, 6.34, tileColor, wallColor);

  for (let index = -2; index <= 2; index += 1) {
    box(
      cafe,
      [1.02, 0.13, 1.05],
      index % 2 === 0 ? 0xd96855 : COLORS.white,
      [index * 1.02, 3.1, 2.18],
      [-0.16, 0, 0],
      false,
    );
  }

  addStorefrontWindow(cafe, -1.18, 1.94, 1.82, 2.7, 1.86, 3);
  addDoor(cafe, 1.55, 1.51, 1.84, 0x4f8f77);
  addWindow(cafe, -1.48, 4.84, 1.82, 1, 1.14);
  addWindow(cafe, 1.22, 4.84, 1.82, 1, 1.14);
  createWindowPlanter(cafe, -1.48, 4.02, 2.04, 1.28);
  createWindowPlanter(cafe, 1.22, 4.02, 2.04, 1.28);

  timberBeam(cafe, [-2.5, 3.68, frontZ + 0.02], [-1.78, 5.9, frontZ + 0.02], 0.14, 0.16, timber);
  timberBeam(cafe, [2.5, 3.68, frontZ + 0.02], [1.78, 5.9, frontZ + 0.02], 0.14, 0.16, timber);

  const sign = cylinder(cafe, 0.68, 0.68, 0.16, 20, COLORS.cream, [0, 5.62, 1.98]);
  sign.rotation.x = Math.PI / 2;
  const cup = cylinder(cafe, 0.27, 0.22, 0.37, 12, 0x6e4536, [0, 5.61, 2.1], false);
  cup.rotation.x = Math.PI / 2;
  const handle = addMesh(
    cafe,
    new THREE.TorusGeometry(0.2, 0.055, 8, 14, Math.PI * 1.5),
    toon(0x6e4536),
    [0.3, 5.61, 2.14],
    [0, 0, -Math.PI / 2],
  );
  handle.castShadow = false;
  for (const sx of [-0.14, 0.05, 0.24]) {
    const steam = addMesh(
      cafe,
      new THREE.TorusGeometry(0.12, 0.022, 6, 12, Math.PI),
      toon(0xffffff),
      [sx, 5.95 + sx * 0.22, 2.15],
      [0, 0, sx > 0.1 ? 0.1 : -0.12],
    );
    steam.castShadow = false;
  }

  const terrace = box(cafe, [5.9, 0.14, 2.05], COLORS.pavingLight, [0, 0.08, 2.55]);
  terrace.material = patternedMaterial(COLORS.pavingLight, "paving", { roughness: 0.98 });
  terrace.receiveShadow = true;
  for (const tableX of [-1.5, 1.5]) {
    cylinder(cafe, 0.62, 0.62, 0.12, 16, 0xfaf1d0, [tableX, 0.9, 2.7]);
    cylinder(cafe, 0.09, 0.13, 0.82, 8, COLORS.darkWood, [tableX, 0.45, 2.7]);
    cylinder(cafe, 0.95, 0.08, 0.72, 12, tableX < 0 ? 0xf56f69 : 0x5bb5a0, [tableX, 2.1, 2.7]);
    cylinder(cafe, 0.07, 0.07, 1.35, 8, COLORS.darkWood, [tableX, 1.38, 2.7]);
  }

  cafe.userData.kind = "cafe";
  cafe.userData.height = 9.28;
  return cafe;
}

function createShop(parent: THREE.Object3D, x: number, z: number): THREE.Group {
  const shop = new THREE.Group();
  shop.position.set(x, 0, z);
  parent.add(shop);

  const wallColor = 0xfff2d9;
  const tileColor = 0xce664e;
  const timber = 0x785039;
  const shopFoundation = roundedBox(shop, [5.12, 0.62, 3.58], 0xb8b5ac, [0, 0.3, 0], [0, 0, 0], 0.11, "paving");
  shopFoundation.receiveShadow = true;
  addStoneFoundationFace(shop, 4.9, 1.84, 0.33);
  const shopBody = roundedBox(shop, [4.9, 5.94, 3.36], wallColor, [0, 3.28, 0], [0, 0, 0], 0.09, "stucco");
  addEdges(shopBody, 0x8c735e, 0.065, 44);
  const frontZ = 1.73;
  for (const corner of [-1, 1]) {
    box(shop, [0.18, 5.72, 0.18], timber, [corner * 2.35, 3.37, frontZ]);
    box(shop, [0.18, 5.72, 0.18], timber, [corner * 2.35, 3.37, -frontZ]);
  }
  for (const beamY of [0.72, 3.45, 6.15]) {
    box(shop, [4.72, 0.18, 0.18], timber, [0, beamY, frontZ]);
  }
  createTiledGableRoof(shop, 5.52, 3.88, 2.95, 6.18, tileColor, wallColor);

  box(shop, [4.68, 0.72, 0.22], 0x6b8d78, [0, 3.06, 1.78]);
  for (const stripe of [-2, -1, 0, 1, 2]) {
    box(
      shop,
      [0.92, 0.15, 0.98],
      stripe % 2 === 0 ? 0x6f9b83 : COLORS.white,
      [stripe * 0.92, 2.56, 2.05],
      [-0.17, 0, 0],
      false,
    );
  }
  createFabricAwning(shop, -0.78, 3.03, 1.74, 2.95, 0x498eae);

  addStorefrontWindow(shop, -0.78, 1.88, 1.72, 2.65, 1.76, 2);
  addDoor(shop, 1.5, 1.51, 1.74, 0x5d8f78);
  addWindow(shop, -1.35, 4.76, 1.72, 0.94, 1.08);
  addWindow(shop, 1.18, 4.76, 1.72, 0.94, 1.08);
  createWindowPlanter(shop, -1.35, 3.98, 1.94, 1.2);
  createWindowPlanter(shop, 1.18, 3.98, 1.94, 1.2);

  const badge = cylinder(shop, 0.58, 0.58, 0.14, 10, COLORS.cream, [0, 5.53, 1.94]);
  badge.rotation.x = Math.PI / 2;
  const bag = box(shop, [0.5, 0.44, 0.1], 0xef7a6d, [0, 5.49, 2.04], [0, 0, 0], false);
  addEdges(bag, COLORS.ink, 0.14);
  const bagHandle = addMesh(
    shop,
    new THREE.TorusGeometry(0.17, 0.035, 6, 12, Math.PI),
    toon(0xef7a6d),
    [0, 5.74, 2.05],
  );
  bagHandle.castShadow = false;

  const crateColors = [0xe85d62, 0x76b957, 0xf1a44a];
  for (let index = 0; index < 3; index += 1) {
    box(shop, [1.05, 0.45, 0.78], 0xb16c43, [-1.45 + index * 1.45, 0.3, 2.25]);
    for (let fruit = 0; fruit < 5; fruit += 1) {
      sphere(
        shop,
        0.15,
        crateColors[index],
        [-1.78 + index * 1.45 + (fruit % 3) * 0.31, 0.61 + Math.floor(fruit / 3) * 0.18, 2.28],
      );
    }
  }

  shop.userData.kind = "shop";
  shop.userData.height = 9.16;
  return shop;
}

function createTree(
  parent: THREE.Object3D,
  crowns: TreeCrown[],
  x: number,
  z: number,
  scale = 1,
  phase = 0,
): THREE.Group {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  parent.add(tree);

  const trunk = cylinder(tree, 0.18, 0.34, 2.25, 12, COLORS.wood, [0, 1.08, 0]);
  trunk.material = toon(COLORS.wood, { roughness: 0.72 });
  const root = new THREE.Group();
  root.position.y = 1.62;
  tree.add(root);

  branch(root, [0, -0.48, 0], [-0.62, 0.72, 0.08], 0.14, 0.075);
  branch(root, [0.02, -0.35, 0], [0.7, 0.58, -0.12], 0.13, 0.07);
  branch(root, [0, -0.22, 0], [0.18, 1.02, 0.24], 0.12, 0.06);

  const crownData: ReadonlyArray<
    readonly [number, number, number, number, number, number, number, THREE.ColorRepresentation]
  > = [
    [-0.46, 0.92, 0.02, 0.76, 1.04, 0.96, 0.94, COLORS.leaf],
    [0.48, 0.9, -0.08, 0.74, 1.02, 0.98, 0.94, COLORS.leafLight],
    [0, 1.5, -0.02, 0.78, 1.02, 1, 0.96, 0x83d36d],
    [0.02, 0.76, 0.48, 0.62, 1.08, 0.9, 0.86, COLORS.leafDark],
  ];
  crownData.forEach(([cx, cy, cz, radius, sx, sy, sz, color], index) => {
    const leaves = addMesh(
      root,
      new THREE.SphereGeometry(radius, 16, 10),
      toon(color, { map: null, roughness: 0.8 }),
      [cx, cy, cz],
      [phase * 0.035, index * 0.17, phase * 0.025 - index * 0.03],
    );
    leaves.scale.set(sx, sy, sz);
    leaves.castShadow = index < 3;
    leaves.receiveShadow = false;
  });

  // Fine leaf puffs are instanced: the crown gains a hand-pruned silhouette
  // and small-scale detail for one draw call instead of dozens of meshes.
  const leafCount = 112;
  const leafPuffs = new THREE.InstancedMesh(
    prepareInstancedGeometry(new THREE.SphereGeometry(0.105, 8, 6)),
    toon(0xffffff, {
      roughness: 0.82,
    }),
    leafCount,
  );
  leafPuffs.name = "Small leaf clusters";
  leafPuffs.castShadow = false;
  leafPuffs.receiveShadow = false;
  const leafMatrix = new THREE.Matrix4();
  const leafRotation = new THREE.Quaternion();
  const leafScale = new THREE.Vector3();
  const leafPalette = [0x3e8f4d, 0x51a457, 0x66b85f, 0x7bc669];
  const lobeCenters = [
    new THREE.Vector3(-0.5, 1.1, 0.04),
    new THREE.Vector3(0.5, 1.06, -0.08),
    new THREE.Vector3(0, 1.63, -0.03),
    new THREE.Vector3(0.02, 0.86, 0.47),
  ];
  for (let index = 0; index < leafCount; index += 1) {
    const lobe = lobeCenters[index % lobeCenters.length];
    const ringIndex = Math.floor(index / lobeCenters.length);
    const vertical = 1 - (2 * (ringIndex + 0.5)) / Math.ceil(leafCount / lobeCenters.length);
    const radial = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    const angle = ringIndex * 2.399963 + index * 0.43 + phase;
    const position = new THREE.Vector3(
      lobe.x + Math.cos(angle) * radial * 0.72,
      lobe.y + vertical * 0.66,
      lobe.z + Math.sin(angle) * radial * 0.6,
    );
    leafRotation.setFromEuler(new THREE.Euler(angle * 0.2, angle, vertical * 0.18));
    const variation = 0.8 + (index % 7) * 0.04;
    leafScale.set(variation * 1.12, variation * 0.68, variation);
    leafMatrix.compose(position, leafRotation, leafScale);
    leafPuffs.setMatrixAt(index, leafMatrix);
    leafPuffs.setColorAt(index, new THREE.Color(leafPalette[(index + Math.floor(phase * 3)) % leafPalette.length]));
  }
  leafPuffs.instanceMatrix.needsUpdate = true;
  if (leafPuffs.instanceColor) leafPuffs.instanceColor.needsUpdate = true;
  root.add(leafPuffs);
  crowns.push({ group: root, phase });
  return tree;
}

function createBush(
  parent: THREE.Object3D,
  x: number,
  z: number,
  scale: number,
): void {
  const bush = new THREE.Group();
  bush.position.set(x, 0, z);
  parent.add(bush);
  const clusters: ReadonlyArray<readonly [number, number, number, number, THREE.ColorRepresentation]> = [
    [-0.52, 0.46, 0.03, 0.62, COLORS.leafDark],
    [0.04, 0.56, -0.12, 0.72, COLORS.leaf],
    [0.58, 0.42, 0.06, 0.56, COLORS.leafLight],
    [0.04, 0.8, 0.12, 0.48, 0x83d36d],
  ];
  clusters.forEach(([cx, cy, cz, radius, color], index) => {
    const leaves = addMesh(
      bush,
      new THREE.IcosahedronGeometry(radius, 1),
      toon(color, { roughness: 0.8 }),
      [cx * scale, cy * scale, cz * scale],
      [index * 0.18, index * 0.54, index * -0.12],
    );
    leaves.scale.set(scale * 1.05, scale * 0.76, scale * 0.9);
    leaves.castShadow = index < 2;
  });

  const detailCount = 18;
  const detail = new THREE.InstancedMesh(
    prepareInstancedGeometry(new THREE.SphereGeometry(0.13, 8, 6)),
    toon(0xffffff, { roughness: 0.86 }),
    detailCount,
  );
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const detailScale = new THREE.Vector3();
  const palette = [0x347c45, 0x47954d, 0x5eac55, 0x78be61, 0x8dcc70];
  for (let index = 0; index < detailCount; index += 1) {
    const angle = index * 2.399963;
    const heightBand = (index % 5) / 5;
    const radius = (0.46 + (index % 4) * 0.08) * scale;
    const position = new THREE.Vector3(
      Math.cos(angle) * radius,
      (0.42 + heightBand * 0.55) * scale,
      Math.sin(angle) * radius * 0.66,
    );
    rotation.setFromEuler(new THREE.Euler(index * 0.14, angle, index * -0.08));
    const variation = scale * (0.78 + (index % 3) * 0.11);
    detailScale.set(variation * 1.1, variation * 0.78, variation);
    matrix.compose(position, rotation, detailScale);
    detail.setMatrixAt(index, matrix);
    detail.setColorAt(index, new THREE.Color(palette[index % palette.length]));
  }
  detail.instanceMatrix.needsUpdate = true;
  if (detail.instanceColor) detail.instanceColor.needsUpdate = true;
  detail.castShadow = false;
  bush.add(detail);
}

function createFlowerPatch(
  parent: THREE.Object3D,
  centerX: number,
  centerZ: number,
  count: number,
  seed: number,
): void {
  const flowerColors = [0xff6f91, 0xffd45f, 0xf7f2ff, 0x8b78d0, 0xf48a62];
  const stems = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.018, 0.025, 0.28, 5),
    toon(COLORS.grassDark, { roughness: 0.96 }),
    count,
  );
  const petals = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.075, 8, 5),
    // Instanced colors are multiplied separately by Three.js. Enabling the
    // geometry vertex-color path without a color attribute rendered petals
    // as black on some WebGL implementations.
    toon(0xffffff, { roughness: 0.8 }),
    count * 5,
  );
  const centers = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.055, 8, 5),
    toon(COLORS.gold, { roughness: 0.72 }),
    count,
  );
  stems.name = "Flower stems";
  petals.name = "Flower petals";
  centers.name = "Flower centers";
  stems.castShadow = false;
  petals.castShadow = false;
  centers.castShadow = false;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const stemScale = new THREE.Vector3(1, 1, 1);
  const petalScale = new THREE.Vector3(1.2, 0.55, 1);
  let petalIndex = 0;
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399 + seed;
    const distance = 0.3 + ((index * 47 + seed * 31) % 17) * 0.075;
    const x = centerX + Math.cos(angle) * distance;
    const z = centerZ + Math.sin(angle) * distance * 0.7;
    const blossomY = 0.38 + (index % 3) * 0.035;
    matrix.compose(new THREE.Vector3(x, 0.2, z), rotation, stemScale);
    stems.setMatrixAt(index, matrix);
    const color = flowerColors[(index + seed) % flowerColors.length];
    for (let petal = 0; petal < 5; petal += 1) {
      const petalAngle = (petal / 5) * Math.PI * 2;
      matrix.compose(
        new THREE.Vector3(
          x + Math.cos(petalAngle) * 0.09,
          blossomY,
          z + Math.sin(petalAngle) * 0.09,
        ),
        rotation,
        petalScale,
      );
      petals.setMatrixAt(petalIndex, matrix);
      petals.setColorAt(petalIndex, new THREE.Color(color));
      petalIndex += 1;
    }
    matrix.compose(new THREE.Vector3(x, blossomY + 0.025, z), rotation, stemScale);
    centers.setMatrixAt(index, matrix);
  }
  stems.instanceMatrix.needsUpdate = true;
  petals.instanceMatrix.needsUpdate = true;
  centers.instanceMatrix.needsUpdate = true;
  if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
  parent.add(stems, petals, centers);
}

function createBench(
  parent: THREE.Object3D,
  x: number,
  z: number,
  yaw: number,
): THREE.Group {
  const bench = new THREE.Group();
  bench.position.set(x, 0, z);
  bench.rotation.y = yaw;
  parent.add(bench);

  for (const xOffset of [-0.84, 0.84]) {
    box(bench, [0.14, 0.68, 0.52], 0x43565a, [xOffset, 0.38, 0], [0, 0, 0], false);
    box(bench, [0.14, 0.98, 0.14], 0x43565a, [xOffset, 0.75, 0.29], [0, 0, -0.05], false);
  }
  for (const zOffset of [-0.22, 0, 0.22]) {
    box(bench, [2.05, 0.13, 0.17], COLORS.wood, [0, 0.72, zOffset], [0, 0, 0], true);
  }
  for (const yOffset of [1.04, 1.3, 1.56]) {
    box(bench, [2.05, 0.14, 0.16], 0xa96e48, [0, yOffset, 0.38], [-0.06, 0, 0], true);
  }

  const sitLocal = new THREE.Vector3(0, 0.78, -0.03);
  const sitWorld = sitLocal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(bench.position);
  bench.userData.kind = "bench";
  bench.userData.sitPosition = sitWorld;
  bench.userData.sitYaw = yaw;
  bench.userData.interactionRadius = 1.45;
  return bench;
}

function createLamp(parent: THREE.Object3D, x: number, z: number): THREE.Group {
  const lamp = new THREE.Group();
  lamp.position.set(x, 0, z);
  parent.add(lamp);
  cylinder(lamp, 0.22, 0.31, 0.22, 10, 0x3c4a4e, [0, 0.11, 0]);
  cylinder(lamp, 0.12, 0.18, 0.2, 10, 0x536064, [0, 0.3, 0]);
  cylinder(lamp, 0.055, 0.09, 2.8, 10, 0x3c4a4e, [0, 1.75, 0]);
  cylinder(lamp, 0.105, 0.105, 0.13, 10, 0x536064, [0, 2.55, 0]);
  const arm = addMesh(
    lamp,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 2.88, 0),
        new THREE.Vector3(0.2, 3.2, 0),
        new THREE.Vector3(0.58, 3.3, 0),
        new THREE.Vector3(0.82, 3.02, 0),
      ]),
      14,
      0.052,
      8,
      false,
    ),
    toon(0x3c4a4e, { roughness: 0.38, metalness: 0.45 }),
  );
  arm.castShadow = false;
  cylinder(lamp, 0.035, 0.035, 0.25, 8, 0x3c4a4e, [0.82, 2.94, 0]);

  const lantern = new THREE.Group();
  lantern.position.set(0.82, 2.56, 0);
  lamp.add(lantern);
  const glass = cylinder(lantern, 0.23, 0.23, 0.52, 6, 0xffe29a, [0, 0, 0]);
  glass.material = glassMaterial(0xffd679, true);
  glass.castShadow = false;
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    cylinder(lantern, 0.018, 0.024, 0.58, 5, 0x354449, [Math.cos(angle) * 0.23, 0, Math.sin(angle) * 0.23]);
  }
  cylinder(lantern, 0.28, 0.28, 0.07, 10, 0x354449, [0, -0.31, 0]);
  const hood = cylinder(lantern, 0.09, 0.36, 0.28, 8, 0x354449, [0, 0.4, 0]);
  hood.castShadow = false;
  sphere(lantern, 0.07, COLORS.gold, [0, 0.59, 0], [0.85, 1.25, 0.85]).castShadow = false;
  return lamp;
}

function createFountain(parent: THREE.Object3D, x: number, z: number, droplets: JetDrop[]): THREE.Group {
  const fountain = new THREE.Group();
  fountain.position.set(x, 0, z);
  parent.add(fountain);

  cylinder(fountain, 2.3, 2.48, 0.52, 24, COLORS.stoneDark, [0, 0.28, 0]);
  cylinder(fountain, 2.03, 2.03, 0.3, 24, COLORS.water, [0, 0.58, 0], false).material = waterMaterial(
    COLORS.water,
  );
  cylinder(fountain, 0.48, 0.72, 2.1, 10, COLORS.stone, [0, 1.45, 0]);
  cylinder(fountain, 1.05, 0.7, 0.3, 16, COLORS.stoneDark, [0, 2.32, 0]);
  cylinder(fountain, 0.25, 0.38, 0.74, 10, COLORS.stone, [0, 2.75, 0]);
  sphere(fountain, 0.35, COLORS.waterLight, [0, 3.22, 0], [0.85, 1.15, 0.85], false).material = toon(
    COLORS.waterLight,
    { emissive: 0x3cb9df, emissiveIntensity: 0.14 },
  );

  const dropMaterial = toon(COLORS.waterLight, {
    transparent: true,
    opacity: 0.9,
    emissive: 0x3cb9df,
    emissiveIntensity: 0.08,
  });
  for (let jet = 0; jet < 6; jet += 1) {
    const angle = (jet / 6) * Math.PI * 2;
    for (let dropIndex = 0; dropIndex < 4; dropIndex += 1) {
      const drop = addMesh(
        fountain,
        new THREE.OctahedronGeometry(0.105, 0),
        dropMaterial,
        [0, 3.2, 0],
      );
      drop.scale.y = 1.55;
      drop.castShadow = false;
      droplets.push({ mesh: drop, angle, phase: dropIndex / 4 + jet * 0.037 });
    }
  }

  fountain.userData.kind = "fountain";
  return fountain;
}

function createRoadNetwork(parent: THREE.Object3D): void {
  const pathMaterial = patternedMaterial(0xe2ded2, "paving", { roughness: 0.99 });
  const roadVertical = addMesh(parent, new THREE.BoxGeometry(5.9, 0.065, 46), pathMaterial, [1, 0.028, 0]);
  const roadHorizontal = addMesh(parent, new THREE.BoxGeometry(46, 0.065, 5.9), pathMaterial, [0, 0.031, 2]);
  roadVertical.receiveShadow = true;
  roadHorizontal.receiveShadow = true;

  // Low irregular-coloured curbs frame a pedestrian lane without road paint,
  // zebra crossings or the visual weight of asphalt.
  for (const x of [-2.08, 4.08]) {
    const curb = box(parent, [0.28, 0.13, 46], x < 0 ? 0xbcb8ae : 0xcac5b9, [x, 0.075, 0]);
    curb.material = patternedMaterial(x < 0 ? 0xbcb8ae : 0xcac5b9, "paving", { roughness: 1 });
  }
  for (const z of [-1.08, 5.08]) {
    const curb = box(parent, [46, 0.13, 0.28], z < 0 ? 0xc8c3b7 : 0xbab6ad, [0, 0.075, z]);
    curb.material = patternedMaterial(z < 0 ? 0xc8c3b7 : 0xbab6ad, "paving", { roughness: 1 });
  }

  const crossing = addMesh(
    parent,
    new THREE.CircleGeometry(4.05, 32),
    patternedMaterial(0xeee8dc, "paving", { roughness: 1, side: THREE.DoubleSide }),
    [1, 0.071, 2],
    [-Math.PI / 2, 0, 0],
  );
  crossing.receiveShadow = true;

  // A broad, pale stone forecourt places residents on a readable pedestrian
  // stage in front of the home instead of scattering them through the lawn.
  const homeCourtyard = addMesh(
    parent,
    new THREE.CircleGeometry(3.7, 40),
    patternedMaterial(0xeee8dc, "paving", { roughness: 1, side: THREE.DoubleSide }),
    [-6.4, 0.07, 7.05],
    [-Math.PI / 2, 0, 0],
  );
  homeCourtyard.scale.y = 0.68;
  homeCourtyard.receiveShadow = true;
  const foregroundCourtyard = addMesh(
    parent,
    new THREE.CircleGeometry(3.45, 40),
    patternedMaterial(0xeee8dc, "paving", { roughness: 1, side: THREE.DoubleSide }),
    [-3.9, 0.071, 10.15],
    [-Math.PI / 2, 0, 0],
  );
  foregroundCourtyard.scale.y = 0.68;
  foregroundCourtyard.receiveShadow = true;

  const doorstepPaths: ReadonlyArray<
    readonly [number, number, number, number, number]
  > = [
    [-9.8, 3.72, 3, 1.3, 0],
    [7.9, -0.42, 1.35, 1.45, 0],
    [8.4, 7.12, 4, 1.35, 0],
  ];
  for (const [x, z, length, width, yaw] of doorstepPaths) {
    const path = box(parent, [width, 0.055, length], 0xeee6d5, [x, 0.055, z], [0, yaw, 0]);
    path.material = patternedMaterial(0xeee6d5, "paving", { roughness: 1 });
    path.receiveShadow = true;
  }

  // Individual, softly irregular foreground setts break the hero courtyard
  // into readable stones. The geometry is instanced so the close-up gains
  // depth and contact shadows without turning the entire road into hundreds
  // of draw calls.
  const cobbleGeometry = prepareInstancedGeometry(new THREE.CylinderGeometry(0.28, 0.31, 0.026, 12));
  const cobbles = new THREE.InstancedMesh(
    cobbleGeometry,
    toon(0xffffff, {
      map: surfaceTexture("paving"),
      roughness: 0.98,
      normalMap: pbrTexture("paving", "normal"),
      roughnessMap: pbrTexture("paving", "roughness"),
      aoMap: pbrTexture("paving", "ao"),
      aoMapIntensity: 0.62,
    }),
    198,
  );
  cobbles.name = "Hero courtyard stone setts";
  cobbles.castShadow = false;
  cobbles.receiveShadow = true;
  const cobbleMatrix = new THREE.Matrix4();
  const cobbleRotation = new THREE.Quaternion();
  const cobbleScale = new THREE.Vector3();
  const cobblePalette = [0xe1d8c8, 0xc9c2b6, 0xeee4d2, 0xbebcb4, 0xd5cbbb];
  let cobbleIndex = 0;
  for (let row = 0; row < 11; row += 1) {
    for (let column = 0; column < 18; column += 1) {
      const stagger = row % 2 === 0 ? 0 : 0.23;
      const x = -9.15 + column * 0.48 + stagger + Math.sin((row + 1) * (column + 2)) * 0.032;
      const z = 5.95 + row * 0.5 + Math.cos(column * 1.71 + row) * 0.03;
      const ellipseDistance = Math.hypot((x + 5.25) / 4.55, (z - 8.55) / 3.25);
      cobbleRotation.setFromEuler(new THREE.Euler(0, (column * 0.31 + row * 0.43) % Math.PI, 0));
      const variation = 0.86 + ((row * 13 + column * 7) % 9) * 0.022;
      cobbleScale.set(variation * (ellipseDistance > 1 ? 0.78 : 1), 1, variation * (0.78 + (column % 3) * 0.06));
      cobbleMatrix.compose(new THREE.Vector3(x, 0.082, z), cobbleRotation, cobbleScale);
      cobbles.setMatrixAt(cobbleIndex, cobbleMatrix);
      cobbles.setColorAt(cobbleIndex, new THREE.Color(cobblePalette[(row + column) % cobblePalette.length]));
      cobbleIndex += 1;
    }
  }
  cobbles.instanceMatrix.needsUpdate = true;
  if (cobbles.instanceColor) cobbles.instanceColor.needsUpdate = true;
  parent.add(cobbles);
}

function createPlaza(parent: THREE.Object3D, droplets: JetDrop[]): void {
  const plazaBase = cylinder(parent, 7.25, 7.25, 0.18, 40, COLORS.paving, [-7.7, 0.12, -5.2]);
  plazaBase.material = patternedMaterial(COLORS.paving, "paving", { roughness: 1 });
  const plazaInset = cylinder(parent, 6.1, 6.1, 0.06, 40, 0xeee6d6, [-7.7, 0.24, -5.2], false);
  plazaInset.material = patternedMaterial(0xeee6d6, "paving", { roughness: 1 });
  for (let ring = 0; ring < 3; ring += 1) {
    const ringMesh = addMesh(
      parent,
      new THREE.TorusGeometry(3.1 + ring * 1.15, 0.042, 5, 40),
      toon(ring % 2 === 0 ? 0xc6bca9 : 0xd9ceba, { roughness: 1 }),
      [-7.7, 0.3, -5.2],
      [Math.PI / 2, 0, 0],
    );
    ringMesh.castShadow = false;
  }
  createFountain(parent, -7.7, -5.2, droplets);
}

function createParkPond(parent: THREE.Object3D): THREE.Group {
  const park = new THREE.Group();
  park.name = "Lily pond garden";
  parent.add(park);
  const pond = addMesh(
    park,
    new THREE.CylinderGeometry(2.7, 2.95, 0.18, 28),
    waterMaterial(0x63d5f0),
    [-8.5, 0.17, 10.2],
  );
  pond.scale.z = 0.68;
  pond.receiveShadow = false;
  for (const angle of [0.3, 1.35, 2.5, 3.7, 5.1]) {
    const x = -8.5 + Math.cos(angle) * 2.65;
    const z = 10.2 + Math.sin(angle) * 1.75;
    cylinder(park, 0.24, 0.28, 0.12, 10, 0x5eae5c, [x, 0.34, z], false);
    sphere(park, 0.09, 0xff8ba5, [x, 0.46, z], [1, 0.45, 1]);
  }
  const bridge = new THREE.Group();
  bridge.position.set(-8.5, 0.42, 10.2);
  park.add(bridge);
  for (let plank = -5; plank <= 5; plank += 1) {
    const y = 0.08 + Math.cos((plank / 5) * Math.PI / 2) * 0.35;
    box(bridge, [0.43, 0.14, 1.65], 0xb7754d, [plank * 0.4, y, 0]);
  }
  for (const side of [-1, 1]) {
    for (const x of [-2, -1, 0, 1, 2]) {
      cylinder(bridge, 0.04, 0.05, 0.76, 6, COLORS.darkWood, [x, 0.62, side * 0.76], false);
    }
    box(bridge, [4.3, 0.08, 0.08], COLORS.darkWood, [0, 0.9, side * 0.76], [0, 0, 0], false);
  }
  return park;
}

function canalShape(widthOffset = 0): THREE.Shape {
  const shape = new THREE.Shape();
  const samples = 14;
  const left: Array<readonly [number, number]> = [];
  const right: Array<readonly [number, number]> = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const z = -20.5 + progress * 41;
    const drift = Math.sin(progress * Math.PI * 3.2) * 0.55 + Math.sin(progress * 9.7) * 0.18;
    left.push([-25.8 + drift - widthOffset, -z]);
    right.push([-20.2 + drift * 0.72 + widthOffset, -z]);
  }
  shape.moveTo(...left[0]);
  for (let index = 1; index < left.length; index += 1) shape.lineTo(...left[index]);
  for (let index = right.length - 1; index >= 0; index -= 1) shape.lineTo(...right[index]);
  shape.closePath();
  return shape;
}

function createCanal(parent: THREE.Object3D): THREE.Mesh {
  const bank = addMesh(
    parent,
    new THREE.ShapeGeometry(canalShape(0.58), 4),
    patternedMaterial(0xc8c1b2, "paving", { roughness: 1, side: THREE.DoubleSide }),
    [0, 0.025, 0],
    [-Math.PI / 2, 0, 0],
  );
  bank.receiveShadow = true;

  const water = addMesh(
    parent,
    new THREE.ShapeGeometry(canalShape(), 4),
    waterMaterial(0x65d9f5),
    [0, 0.062, 0],
    [-Math.PI / 2, 0, 0],
  );
  water.name = "Animated canal water";
  water.renderOrder = 1;

  // Both banks use instanced irregular stones, giving a readable shoreline
  // while keeping the full river edge to one draw call.
  const stoneCount = 46;
  const stones = new THREE.InstancedMesh(
    prepareInstancedGeometry(new THREE.SphereGeometry(0.3, 10, 6)),
    toon(0xffffff, {
      map: surfaceTexture("paving"),
      roughness: 1,
    }),
    stoneCount,
  );
  stones.name = "Canal stone banks";
  stones.castShadow = false;
  stones.receiveShadow = true;
  const stoneMatrix = new THREE.Matrix4();
  const stoneRotation = new THREE.Quaternion();
  const stoneScale = new THREE.Vector3();
  const bankColors = [0xb7b3aa, 0xd0c9ba, 0xa9aaa5, 0xdcd3c2];
  for (let index = 0; index < stoneCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const sequence = Math.floor(index / 2);
    const progress = sequence / (stoneCount / 2 - 1);
    const z = -19.5 + progress * 39;
    const drift = Math.sin(progress * Math.PI * 3.2) * 0.55 + Math.sin(progress * 9.7) * 0.18;
    const x = side < 0 ? -26.08 + drift : -19.92 + drift * 0.72;
    stoneRotation.setFromEuler(new THREE.Euler(index * 0.13, index * 0.47, index * 0.09));
    const variation = 0.86 + (index % 4) * 0.08;
    stoneScale.set(1.28 * variation, 0.52 + (index % 3) * 0.06, 0.9 * variation);
    stoneMatrix.compose(new THREE.Vector3(x, 0.18, z), stoneRotation, stoneScale);
    stones.setMatrixAt(index, stoneMatrix);
    stones.setColorAt(index, new THREE.Color(bankColors[index % bankColors.length]));
  }
  stones.instanceMatrix.needsUpdate = true;
  if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
  parent.add(stones);

  const reedCount = 34;
  const reeds = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.018, 0.028, 0.62, 5),
    toon(0x73a74e, { roughness: 1 }),
    reedCount,
  );
  reeds.castShadow = false;
  reeds.receiveShadow = false;
  const reedMatrix = new THREE.Matrix4();
  const reedRotation = new THREE.Quaternion();
  const reedScale = new THREE.Vector3();
  for (let index = 0; index < reedCount; index += 1) {
    const progress = index / (reedCount - 1);
    const z = -18.7 + progress * 37.4 + Math.sin(index * 1.7) * 0.22;
    const drift = Math.sin(progress * Math.PI * 3.2) * 0.55 + Math.sin(progress * 9.7) * 0.18;
    const side = index % 4 === 0 ? -1 : 1;
    const x = side < 0 ? -25.55 + drift : -20.42 + drift * 0.72;
    reedRotation.setFromEuler(new THREE.Euler(0, index * 0.4, Math.sin(index) * 0.08));
    const height = 0.75 + (index % 4) * 0.08;
    reedScale.set(1, height, 1);
    reedMatrix.compose(new THREE.Vector3(x, 0.31 * height, z), reedRotation, reedScale);
    reeds.setMatrixAt(index, reedMatrix);
  }
  reeds.instanceMatrix.needsUpdate = true;
  parent.add(reeds);

  const mooringPosts: THREE.Vector3[] = [];
  for (let index = 0; index < 8; index += 1) {
    const progress = index / 7;
    const z = -17.5 + progress * 35;
    const drift = Math.sin(progress * Math.PI * 3.2) * 0.55 + Math.sin(progress * 9.7) * 0.18;
    const x = -19.7 + drift * 0.72;
    cylinder(parent, 0.09, 0.12, 1.15, 9, 0x755038, [x, 0.58, z]);
    sphere(parent, 0.13, 0x8c6244, [x, 1.17, z], [1, 0.55, 1]).castShadow = false;
    mooringPosts.push(new THREE.Vector3(x, 1.03, z));
  }
  for (let index = 0; index < mooringPosts.length - 1; index += 1) {
    const start = mooringPosts[index];
    const end = mooringPosts[index + 1];
    const middle = start.clone().lerp(end, 0.5);
    middle.y -= 0.34;
    const rope = addMesh(
      parent,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([start, middle, end]),
        10,
        0.025,
        5,
        false,
      ),
      toon(0xaa8555, { roughness: 1 }),
    );
    rope.castShadow = false;
  }

  const boardwalk = new THREE.Group();
  boardwalk.position.set(-23, 0.22, -6.5);
  boardwalk.rotation.y = -0.03;
  parent.add(boardwalk);
  const plankCount = 15;
  const planks = new THREE.InstancedMesh(
    prepareInstancedGeometry(new THREE.BoxGeometry(0.43, 0.12, 2.45)),
    patternedMaterial(0xa96e48, "wood", { roughness: 0.8 }),
    plankCount,
  );
  planks.castShadow = true;
  planks.receiveShadow = true;
  const plankMatrix = new THREE.Matrix4();
  const plankRotation = new THREE.Quaternion();
  const plankScale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < plankCount; index += 1) {
    const normalized = (index - (plankCount - 1) / 2) / ((plankCount - 1) / 2);
    const px = (index - (plankCount - 1) / 2) * 0.44;
    const py = 0.06 + Math.cos(normalized * Math.PI * 0.5) * 0.3;
    plankMatrix.compose(new THREE.Vector3(px, py, 0), plankRotation, plankScale);
    planks.setMatrixAt(index, plankMatrix);
  }
  planks.instanceMatrix.needsUpdate = true;
  boardwalk.add(planks);
  for (const side of [-1, 1]) {
    for (const x of [-3, -2, -1, 0, 1, 2, 3]) {
      cylinder(boardwalk, 0.045, 0.055, 0.78, 7, COLORS.darkWood, [x, 0.41, side * 1.08]);
    }
    box(boardwalk, [6.45, 0.08, 0.08], COLORS.darkWood, [0, 0.8, side * 1.08]);
  }
  return water;
}

function createFence(
  parent: THREE.Object3D,
  x: number,
  z: number,
  length: number,
  yaw: number,
): void {
  const fence = new THREE.Group();
  fence.position.set(x, 0, z);
  fence.rotation.y = yaw;
  parent.add(fence);
  const postCount = Math.max(2, Math.ceil(length / 1.5));
  for (let index = 0; index <= postCount; index += 1) {
    const px = -length / 2 + (index / postCount) * length;
    box(fence, [0.13, 0.92, 0.13], 0xf7e7bd, [px, 0.47, 0]);
    box(fence, [0.2, 0.1, 0.2], COLORS.white, [px, 0.98, 0]);
  }
  for (const y of [0.38, 0.72]) {
    box(fence, [length, 0.11, 0.08], 0xe3c995, [0, y, 0]);
  }
}

function createMailbox(
  parent: THREE.Object3D,
  x: number,
  z: number,
  color: THREE.ColorRepresentation,
): void {
  const mailbox = new THREE.Group();
  mailbox.position.set(x, 0, z);
  parent.add(mailbox);
  cylinder(mailbox, 0.07, 0.1, 1.05, 8, COLORS.darkWood, [0, 0.52, 0]);
  box(mailbox, [0.68, 0.5, 0.48], color, [0, 1.08, 0]);
  const lid = cylinder(mailbox, 0.34, 0.34, 0.48, 16, color, [0, 1.33, 0]);
  lid.rotation.x = Math.PI / 2;
  box(mailbox, [0.055, 0.52, 0.055], 0xc95450, [0.38, 1.2, 0]);
  box(mailbox, [0.28, 0.06, 0.08], 0xc95450, [0.49, 1.43, 0]);
}

function createTownSign(parent: THREE.Object3D, x: number, z: number): void {
  const sign = new THREE.Group();
  sign.position.set(x, 0, z);
  sign.rotation.y = -0.12;
  parent.add(sign);
  for (const px of [-0.72, 0.72]) {
    cylinder(sign, 0.075, 0.1, 1.5, 8, COLORS.darkWood, [px, 0.75, 0]);
  }
  const board = box(sign, [1.85, 0.86, 0.18], 0xf5d796, [0, 1.25, 0]);
  addEdges(board, COLORS.darkWood, 0.16, 35);
  box(sign, [1.4, 0.08, 0.04], 0x6c8f67, [0, 1.43, 0.12]);
  box(sign, [0.98, 0.07, 0.04], 0xd97766, [0, 1.16, 0.12]);
  for (const xOffset of [-0.3, 0, 0.3]) {
    sphere(sign, 0.06, COLORS.leafDark, [xOffset, 0.96, 0.13], [1.2, 0.7, 0.65]);
  }
}

function createGrassDetails(parent: THREE.Object3D): GrassDetails {
  const maximum = 190;
  const geometry = new THREE.ConeGeometry(0.052, 0.25, 3);
  // Keep the base of every tuft on the local origin. Rotating an instance can
  // then bend the blade without lifting its foot away from the terrain.
  geometry.translate(0, 0.125, 0);
  const grass = new THREE.InstancedMesh(geometry, toon(COLORS.grassDark, { roughness: 1 }), maximum);
  grass.name = "Fine grass tufts";
  grass.castShadow = false;
  grass.receiveShadow = false;
  grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  const tufts: GrassTuft[] = [];
  let placed = 0;

  for (let candidate = 0; candidate < 520 && placed < maximum; candidate += 1) {
    const angle = candidate * 2.399963 + 0.37;
    const normalizedRadius = ((candidate * 73) % 521) / 521;
    const radius = 3.8 + Math.sqrt(normalizedRadius) * 22.5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const onVerticalRoad = Math.abs(x - 1) < 3.75;
    const onHorizontalRoad = Math.abs(z - 2) < 3.75;
    const nearPlaza = Math.hypot(x + 7.7, z + 5.2) < 7.7;
    const nearPond = Math.hypot((x + 8.5) / 1.45, z - 10.2) < 3.1;
    if (onVerticalRoad || onHorizontalRoad || nearPlaza || nearPond) continue;

    const yaw = angle * 1.7;
    const phase = (candidate * 1.61803398875 + normalizedRadius * Math.PI * 2) % (Math.PI * 2);
    const variation = 0.72 + ((candidate * 29) % 37) / 92;
    position.set(x, 0.005, z);
    euler.set(0, yaw, 0, "YXZ");
    rotation.setFromEuler(euler);
    scale.set(variation, variation, variation);
    matrix.compose(position, rotation, scale);
    grass.setMatrixAt(placed, matrix);
    tufts.push({ position: position.clone(), yaw, scale: variation, phase });
    placed += 1;
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  parent.add(grass);
  return { mesh: grass, tufts };
}

function createDistantScenery(parent: THREE.Object3D): THREE.Group[] {
  const clouds: THREE.Group[] = [];
  const background = new THREE.Group();
  background.name = "Distant scenery";
  parent.add(background);

  const hillData: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-22, -17, 8, 4.3, 0x72a96a],
    [-11, -23, 10, 5.8, 0x659c64],
    [4, -25, 12, 6.4, 0x5d9663],
    [18, -20, 9, 5.3, 0x76aa68],
    [25, -8, 8, 4.4, 0x6ca265],
    [-25, 9, 10, 5.2, 0x78ad69],
  ];
  for (const [x, z, width, height, color] of hillData) {
    const hill = addMesh(
      background,
      new THREE.SphereGeometry(2.4, 28, 16),
      toon(color, { roughness: 0.94 }),
      [x, height * 0.32 - 0.3, z],
    );
    hill.scale.set(width / 4.6, height / 4.6, width / 5.2);
    hill.castShadow = false;
    hill.receiveShadow = true;
  }

  const skylineColors = [0xffeed6, 0xf8e5d4, 0xe7eee0, 0xf2e8cf, 0xeee4dc];
  for (let index = 0; index < 11; index += 1) {
    const angle = Math.PI * (1.04 + index * 0.087);
    const distance = 19 + (index % 3) * 1.1;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const building = new THREE.Group();
    building.position.set(x, 0, z);
    building.rotation.y = -angle + Math.PI / 2;
    background.add(building);
    const distantHeight = 3.1 + (index % 3) * 0.48;
    const distantBody = box(
      building,
      [2.25, distantHeight, 1.75],
      skylineColors[index % skylineColors.length],
      [0, distantHeight / 2, 0],
    );
    distantBody.material = patternedMaterial(skylineColors[index % skylineColors.length], "stucco", {
      roughness: 0.95,
    });
    const roof = addMesh(
      building,
      gableRoofGeometry(2.65, 2.05, 0.82),
      patternedMaterial(index % 2 === 0 ? 0xc7614d : 0xd47755, "roof", {
        roughness: 0.82,
        side: THREE.DoubleSide,
      }),
      [0, distantHeight, 0],
    );
    addEdges(roof, 0x81513e, 0.07, 34);
    box(building, [0.12, distantHeight - 0.3, 0.08], 0x7b543d, [0, distantHeight / 2, 0.91]);
    box(building, [2.08, 0.12, 0.08], 0x7b543d, [0, distantHeight * 0.52, 0.91]);
    box(building, [0.52, 0.68, 0.06], 0x8ed5e1, [0.62, 1.5, 0.91], [0, 0, 0], false);
  }

  const windmill = new THREE.Group();
  windmill.position.set(15, 0, -18);
  background.add(windmill);
  cylinder(windmill, 0.8, 1.35, 4.6, 10, COLORS.cream, [0, 2.25, 0]);
  cylinder(windmill, 1.02, 1.02, 1.5, 10, 0xc85e52, [0, 4.65, 0]);
  const hub = cylinder(windmill, 0.28, 0.28, 0.38, 10, COLORS.darkWood, [0, 4.15, 1.03]);
  hub.rotation.x = Math.PI / 2;
  const sails = new THREE.Group();
  sails.position.set(0, 4.15, 1.25);
  sails.name = "Windmill sails";
  windmill.add(sails);
  for (let blade = 0; blade < 4; blade += 1) {
    const bladeGroup = new THREE.Group();
    bladeGroup.rotation.z = (blade / 4) * Math.PI * 2;
    sails.add(bladeGroup);
    box(bladeGroup, [0.28, 2.45, 0.1], COLORS.white, [0, 1.3, 0], [0, 0, -0.08], false);
    for (let rung = 0; rung < 4; rung += 1) {
      box(bladeGroup, [0.68, 0.055, 0.12], COLORS.darkWood, [0.08, 0.55 + rung * 0.48, 0.02], [0, 0, 0], false);
    }
  }

  const cloudData: ReadonlyArray<readonly [number, number, number, number]> = [
    [-15, 10, -17, 1.2],
    [8, 12, -23, 1.45],
    [22, 9, -10, 0.9],
    [-24, 8, 5, 1.05],
  ];
  for (const [x, y, z, scale] of cloudData) {
    const cloud = new THREE.Group();
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    background.add(cloud);
    sphere(cloud, 1, 0xfff7df, [0, 0, 0], [1.6, 0.72, 0.8]).castShadow = false;
    sphere(cloud, 0.82, 0xffffff, [-0.9, -0.08, 0], [1.2, 0.7, 0.82]).castShadow = false;
    sphere(cloud, 0.9, 0xffffff, [0.92, -0.12, 0], [1.3, 0.64, 0.82]).castShadow = false;
    cloud.userData.basePosition = cloud.position.clone();
    clouds.push(cloud);
  }

  return clouds;
}

type PendantFixture = {
  shade: THREE.Group;
  light: THREE.PointLight;
};

function createRoomShell(
  group: THREE.Group,
  wallColor: THREE.ColorRepresentation,
  accentColor: THREE.ColorRepresentation,
): void {
  const floor = addMesh(
    group,
    new THREE.BoxGeometry(14.4, 0.18, 10.5),
    patternedMaterial(0xb9825d, "wood", { roughness: 0.74 }),
    [0, -0.1, 0],
  );
  floor.receiveShadow = true;

  const backWall = box(group, [14.4, 5.6, 0.22], wallColor, [0, 2.7, -5.15]);
  backWall.material = patternedMaterial(wallColor, "stucco", { roughness: 0.94 });
  backWall.receiveShadow = true;
  const leftWall = box(group, [0.22, 5.6, 10.5], wallColor, [-7.1, 2.7, 0]);
  leftWall.material = patternedMaterial(wallColor, "stucco", { roughness: 0.94 });
  leftWall.receiveShadow = true;
  // The right wall ends halfway forward so an angled camera can look into the room.
  const rightWall = box(group, [0.22, 5.6, 5.6], wallColor, [7.1, 2.7, -2.45]);
  rightWall.material = patternedMaterial(wallColor, "stucco", { roughness: 0.94 });
  rightWall.receiveShadow = true;

  box(group, [14.2, 0.52, 0.18], accentColor, [0, 0.35, -5]);
  box(group, [0.18, 0.52, 10.2], accentColor, [-6.98, 0.35, 0]);
  box(group, [0.18, 0.52, 5.4], accentColor, [6.98, 0.35, -2.45]);
  box(group, [14.2, 0.16, 0.18], COLORS.cream, [0, 5.25, -5]);
  box(group, [0.18, 0.16, 10.2], COLORS.cream, [-6.98, 5.25, 0]);
  box(group, [0.18, 0.16, 5.4], COLORS.cream, [6.98, 5.25, -2.45]);

  // Open ceiling beams give an interior silhouette without hiding the room.
  for (const x of [-6.7, -3.35, 0, 3.35, 6.7]) {
    box(group, [0.14, 0.14, 10], 0xe6c99d, [x, 5.28, -0.05]);
  }

  // Two deep windows with exterior sky, mullions, sill, and fabric curtains.
  for (const x of [-3.7, 3.4]) {
    box(group, [2.55, 2.35, 0.16], 0x596869, [x, 3.15, -5.01]);
    const sky = addMesh(
      group,
      new THREE.BoxGeometry(2.24, 2.06, 0.05),
      glassMaterial(0x8bd0e3, false),
      [x, 3.15, -4.88],
    );
    sky.castShadow = false;
    box(group, [0.08, 2.12, 0.09], COLORS.white, [x, 3.15, -4.81]);
    box(group, [2.3, 0.08, 0.09], COLORS.white, [x, 3.15, -4.81]);
    box(group, [2.72, 0.16, 0.4], 0xd5ad7a, [x, 1.94, -4.76]);
    for (const side of [-1, 1]) {
      const curtain = box(
        group,
        [0.42, 2.42, 0.12],
        accentColor,
        [x + side * 1.36, 3.13, -4.7],
        [0, 0, side * 0.035],
      );
      curtain.material = patternedMaterial(accentColor, "fabric", { roughness: 0.98 });
      for (const fold of [-0.13, 0, 0.13]) {
        box(group, [0.035, 2.2, 0.07], COLORS.cream, [x + side * 1.36 + fold, 3.13, -4.61]);
      }
    }
  }
}

function createPendant(
  parent: THREE.Object3D,
  x: number,
  z: number,
  color: THREE.ColorRepresentation,
): PendantFixture {
  const shade = new THREE.Group();
  shade.position.set(x, 0, z);
  parent.add(shade);
  cylinder(shade, 0.025, 0.025, 1.35, 6, 0x515358, [0, 4.7, 0]);
  const canopy = cylinder(shade, 0.16, 0.22, 0.18, 12, 0x515358, [0, 5.22, 0]);
  canopy.rotation.z = Math.PI;
  const hood = cylinder(shade, 0.72, 0.22, 0.48, 24, color, [0, 3.95, 0]);
  hood.rotation.z = Math.PI;
  const bulb = sphere(shade, 0.19, 0xffe3a1, [0, 3.7, 0], [0.85, 1.08, 0.85]);
  bulb.material = toon(0xffe3a1, { emissive: 0xffad52, emissiveIntensity: 0.7, roughness: 0.25 });
  bulb.castShadow = false;
  const light = new THREE.PointLight(0xffb866, 0.72, 8.5, 2);
  light.position.set(0, 3.65, 0);
  light.castShadow = false;
  shade.add(light);
  return { shade, light };
}

function createIndoorSeat(
  parent: THREE.Object3D,
  x: number,
  z: number,
  yaw: number,
  color: THREE.ColorRepresentation,
): THREE.Group {
  const chair = new THREE.Group();
  chair.position.set(x, 0, z);
  chair.rotation.y = yaw;
  parent.add(chair);
  const seat = box(chair, [1.1, 0.22, 1.05], color, [0, 0.68, 0]);
  seat.material = patternedMaterial(color, "fabric", { roughness: 0.94 });
  const back = box(chair, [1.1, 1.18, 0.2], color, [0, 1.25, -0.45], [-0.08, 0, 0]);
  back.material = patternedMaterial(color, "fabric", { roughness: 0.94 });
  for (const px of [-0.43, 0.43]) {
    cylinder(chair, 0.045, 0.06, 0.62, 8, COLORS.darkWood, [px, 0.31, -0.34]);
    cylinder(chair, 0.045, 0.06, 0.62, 8, COLORS.darkWood, [px, 0.31, 0.34]);
  }
  const sitPosition = new THREE.Vector3(0, 0.79, 0.05)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .add(chair.position);
  chair.userData.kind = "bench";
  chair.userData.sitPosition = sitPosition;
  chair.userData.sitYaw = yaw;
  chair.userData.interactionRadius = 1.25;
  return chair;
}

function createSofa(
  parent: THREE.Object3D,
  x: number,
  z: number,
  yaw: number,
  color: THREE.ColorRepresentation,
): THREE.Group {
  const sofa = new THREE.Group();
  sofa.position.set(x, 0, z);
  sofa.rotation.y = yaw;
  parent.add(sofa);
  const fabric = patternedMaterial(color, "fabric", { roughness: 0.96 });
  const base = box(sofa, [3.25, 0.42, 1.22], color, [0, 0.48, 0]);
  base.material = fabric;
  const back = box(sofa, [3.25, 1.38, 0.36], color, [0, 1.18, -0.5], [-0.07, 0, 0]);
  back.material = fabric;
  for (const side of [-1, 1]) {
    const arm = box(sofa, [0.35, 0.72, 1.3], color, [side * 1.48, 0.88, 0]);
    arm.material = fabric;
  }
  for (const cx of [-0.73, 0, 0.73]) {
    const cushion = box(sofa, [0.68, 0.23, 0.86], 0xf2d0a4, [cx, 0.8, 0.12], [-0.04, 0, 0]);
    cushion.material = patternedMaterial(0xf2d0a4, "fabric", { roughness: 0.98 });
  }
  for (const px of [-1.28, 1.28]) {
    cylinder(sofa, 0.055, 0.07, 0.32, 8, COLORS.darkWood, [px, 0.16, -0.38]);
    cylinder(sofa, 0.055, 0.07, 0.32, 8, COLORS.darkWood, [px, 0.16, 0.38]);
  }
  const sitPosition = new THREE.Vector3(0, 0.91, 0.12)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .add(sofa.position);
  sofa.userData.kind = "bench";
  sofa.userData.sitPosition = sitPosition;
  sofa.userData.sitYaw = yaw;
  sofa.userData.interactionRadius = 1.7;
  return sofa;
}

function createShelf(
  parent: THREE.Object3D,
  x: number,
  z: number,
  yaw: number,
  width: number,
  productPalette: readonly number[],
): THREE.Group {
  const shelf = new THREE.Group();
  shelf.position.set(x, 0, z);
  shelf.rotation.y = yaw;
  parent.add(shelf);
  const frameMaterial = patternedMaterial(0x936343, "wood", { roughness: 0.76 });
  const backing = box(shelf, [width, 3.45, 0.14], 0xd9b98b, [0, 1.76, -0.33]);
  backing.material = patternedMaterial(0xd9b98b, "wood", { roughness: 0.82 });
  for (const px of [-width / 2, width / 2]) {
    const upright = box(shelf, [0.13, 3.65, 0.72], 0x936343, [px, 1.82, 0]);
    upright.material = frameMaterial;
  }
  for (let row = 0; row < 4; row += 1) {
    const y = 0.48 + row * 0.9;
    const board = box(shelf, [width + 0.15, 0.12, 0.86], 0x936343, [0, y, 0]);
    board.material = frameMaterial;
    if (row === 3) continue;
    const items = Math.max(3, Math.floor(width / 0.58));
    for (let item = 0; item < items; item += 1) {
      const px = -width / 2 + 0.34 + (item / Math.max(1, items - 1)) * (width - 0.68);
      const color = productPalette[(item + row * 2) % productPalette.length];
      if ((item + row) % 3 === 0) {
        cylinder(shelf, 0.16, 0.18, 0.42, 12, color, [px, y + 0.27, 0.02]);
        cylinder(shelf, 0.1, 0.1, 0.055, 10, COLORS.cream, [px, y + 0.51, 0.02]);
      } else {
        box(shelf, [0.34, 0.45 + (item % 2) * 0.12, 0.34], color, [px, y + 0.29, 0.02]);
        box(shelf, [0.22, 0.055, 0.04], COLORS.cream, [px, y + 0.28, 0.22]);
      }
    }
  }
  return shelf;
}

function createDisplayTable(parent: THREE.Object3D, x: number, z: number): void {
  const display = new THREE.Group();
  display.position.set(x, 0, z);
  parent.add(display);
  box(display, [3.2, 0.22, 1.5], 0xbe8156, [0, 1.03, 0]);
  for (const px of [-1.32, 1.32]) {
    box(display, [0.16, 0.98, 1.26], COLORS.darkWood, [px, 0.5, 0]);
  }
  const baskets = [0xea6f5f, 0x6eb990, 0xe9b34e];
  for (let index = 0; index < 3; index += 1) {
    box(display, [0.82, 0.23, 1.05], 0x9d6948, [-1.02 + index * 1.02, 1.22, 0]);
    for (let item = 0; item < 6; item += 1) {
      sphere(
        display,
        0.13,
        baskets[(index + item) % baskets.length],
        [-1.28 + index * 1.02 + (item % 3) * 0.25, 1.43 + Math.floor(item / 3) * 0.14, -0.2 + (item % 2) * 0.37],
      );
    }
  }
}

function createShopInterior(): TownEnvironment {
  const group = new THREE.Group();
  group.name = "Sunny Side Market Interior";
  group.userData.kind = "town-environment";
  group.userData.sceneName = "shop";
  createRoomShell(group, 0xffe6b4, 0x76aa85);

  createShelf(group, -5.55, -1.45, Math.PI / 2, 3.6, [0xef735e, 0xf2c85b, 0x78b7a0, 0x6e91c5]);
  createShelf(group, -2.15, -4.62, 0, 3.25, [0xd46f87, 0xf0a65f, 0x7aa865, 0x8d75b8]);
  createShelf(group, 2.15, -4.62, 0, 3.25, [0xf08a5c, 0x7cb9ae, 0xe2bd51, 0x6f89bb]);
  createDisplayTable(group, -0.75, -0.75);

  const counter = new THREE.Group();
  counter.position.set(3.75, 0, 1.35);
  group.add(counter);
  const counterFront = box(counter, [4.15, 1.15, 1.12], 0x5f9a79, [0, 0.58, 0]);
  counterFront.material = patternedMaterial(0x5f9a79, "wood", { roughness: 0.8 });
  box(counter, [4.38, 0.18, 1.35], 0xe9c490, [0, 1.2, 0]);
  for (const px of [-1.55, -0.52, 0.52, 1.55]) {
    box(counter, [0.055, 0.72, 0.04], 0xf5ddb4, [px, 0.61, 0.58]);
  }
  const register = box(counter, [0.72, 0.45, 0.62], 0x4f6266, [0.72, 1.5, -0.02], [-0.15, 0, 0]);
  register.material = toon(0x4f6266, { roughness: 0.38, metalness: 0.18 });
  box(counter, [0.52, 0.25, 0.04], 0x9fe2d7, [0.72, 1.6, 0.31], [-0.15, 0, 0]);
  cylinder(counter, 0.27, 0.21, 0.44, 14, 0xd96e61, [-0.65, 1.48, 0]);
  sphere(counter, 0.07, COLORS.leafDark, [-0.65, 1.74, 0]);

  const freezer = new THREE.Group();
  freezer.position.set(5.7, 0, -2.9);
  group.add(freezer);
  box(freezer, [1.75, 2.75, 0.72], 0xe9e8df, [0, 1.38, 0]);
  const freezerGlass = addMesh(
    freezer,
    new THREE.BoxGeometry(1.5, 2.2, 0.07),
    glassMaterial(0x92cbd5, true),
    [0, 1.55, 0.4],
  );
  freezerGlass.castShadow = false;
  box(freezer, [0.08, 2.25, 0.08], 0x64787a, [0, 1.55, 0.47]);
  for (const side of [-1, 1]) {
    box(freezer, [0.08, 0.72, 0.08], 0x64787a, [side * 0.57, 1.55, 0.49]);
  }

  const sign = new THREE.Group();
  sign.position.set(0, 0, 0);
  sign.name = "Indoor market sign";
  group.add(sign);
  box(sign, [3.4, 0.72, 0.17], 0xf0c45c, [0, 4.28, -4.74]);
  box(sign, [2.45, 0.08, 0.04], 0x496f62, [0, 4.4, -4.62]);
  for (const x of [-0.75, -0.25, 0.25, 0.75]) {
    sphere(sign, 0.075, x < 0 ? 0xed756a : 0x69aa7c, [x, 4.14, -4.6], [1.3, 0.7, 0.7]);
  }

  const benches = [
    createIndoorSeat(group, 4.65, 3.65, Math.PI, 0xe5b867),
    createIndoorSeat(group, -4.6, 3.55, Math.PI, 0x77a9a1),
  ];
  const pendants = [
    createPendant(group, -2.5, -0.8, 0x5d9f83),
    createPendant(group, 1.5, -0.8, 0xf1ad62),
    createPendant(group, 4.4, 1.2, 0xd66f67),
  ];
  const activityPoints: TownActivityPoint[] = [
    {
      id: "market-checkout",
      label: "杂货铺收银台",
      kind: "shop",
      position: new THREE.Vector3(3.4, 0, 2.35),
      radius: 1.55,
    },
    {
      id: "market-pantry",
      label: "生活杂货架",
      kind: "shop",
      position: new THREE.Vector3(-4.5, 0, -1.15),
      radius: 1.65,
    },
    {
      id: "market-produce",
      label: "今日鲜货",
      kind: "shop",
      position: new THREE.Vector3(-0.75, 0, 0.5),
      radius: 1.55,
    },
  ];
  group.userData.activeActivityId = "market-checkout";
  group.userData.activityPoints = activityPoints;
  group.userData.benches = benches;
  return {
    group,
    activityPoints,
    benches,
    update: (time: number) => {
      if (!Number.isFinite(time)) return;
      pendants.forEach((fixture, index) => {
        fixture.light.intensity = 0.68 + Math.sin(time * 1.1 + index * 1.7) * 0.025;
      });
      sign.rotation.z = Math.sin(time * 0.55) * 0.006;
    },
  };
}

function createKitchen(parent: THREE.Object3D): void {
  const kitchen = new THREE.Group();
  kitchen.position.set(3.65, 0, -3.55);
  parent.add(kitchen);
  for (let cabinet = 0; cabinet < 4; cabinet += 1) {
    const x = -1.8 + cabinet * 1.2;
    box(kitchen, [1.1, 1.05, 0.72], 0x7eaa91, [x, 0.54, 0]);
    box(kitchen, [0.84, 0.74, 0.04], 0x9bc0a8, [x, 0.55, 0.38]);
    box(kitchen, [0.08, 0.035, 0.05], COLORS.gold, [x + 0.31, 0.55, 0.43]);
  }
  box(kitchen, [5.02, 0.16, 0.95], 0xe8d2aa, [0, 1.12, 0.02]);
  const stove = box(kitchen, [1.02, 0.05, 0.68], 0x4f5b5c, [0.56, 1.22, 0.03]);
  stove.material = toon(0x4f5b5c, { metalness: 0.35, roughness: 0.35 });
  for (const x of [0.27, 0.82]) {
    for (const z of [-0.16, 0.22]) {
      const ring = addMesh(kitchen, new THREE.TorusGeometry(0.14, 0.025, 6, 14), toon(0x222a2b), [x, 1.27, z], [Math.PI / 2, 0, 0]);
      ring.castShadow = false;
    }
  }
  const sink = addMesh(
    kitchen,
    new THREE.BoxGeometry(0.82, 0.06, 0.55),
    toon(0xaebbb8, { metalness: 0.42, roughness: 0.32 }),
    [-0.75, 1.24, 0.03],
  );
  sink.castShadow = false;
  const faucet = addMesh(
    kitchen,
    new THREE.TorusGeometry(0.24, 0.035, 7, 14, Math.PI),
    toon(0x7b8a8b, { metalness: 0.55, roughness: 0.28 }),
    [-0.75, 1.48, -0.24],
  );
  faucet.rotation.z = Math.PI / 2;
  box(kitchen, [1.18, 2.3, 0.83], 0xf0eee5, [2.42, 1.18, 0]);
  box(kitchen, [0.82, 0.05, 0.05], 0x83908e, [2.42, 1.53, 0.44]);
  box(kitchen, [0.82, 0.05, 0.05], 0x83908e, [2.42, 0.74, 0.44]);
  for (const x of [-1.7, -0.5, 0.7]) {
    box(kitchen, [1.05, 0.82, 0.42], 0x8bb59c, [x, 2.7, -0.23]);
    box(kitchen, [0.82, 0.56, 0.04], 0xa8ccb5, [x, 2.7, 0]);
  }
}

function createHomeInterior(): TownEnvironment {
  const group = new THREE.Group();
  group.name = "Rose Cottage Interior";
  group.userData.kind = "town-environment";
  group.userData.sceneName = "interior";
  createRoomShell(group, 0xf7e4cc, 0xd88979);

  const rug = addMesh(
    group,
    new THREE.CircleGeometry(2.8, 40),
    patternedMaterial(0x7aa8a0, "fabric", { roughness: 0.98, side: THREE.DoubleSide }),
    [-2.3, 0.015, -0.45],
    [-Math.PI / 2, 0, 0],
  );
  rug.scale.y = 0.68;
  rug.receiveShadow = true;
  const sofa = createSofa(group, -2.9, -2.65, 0, 0xd97b72);
  box(group, [2.65, 0.2, 1.25], 0xb47b51, [-2.45, 0.74, -0.22]);
  for (const px of [-1.05, 1.05]) {
    cylinder(group, 0.07, 0.09, 0.68, 8, COLORS.darkWood, [-2.45 + px, 0.35, -0.65]);
    cylinder(group, 0.07, 0.09, 0.68, 8, COLORS.darkWood, [-2.45 + px, 0.35, 0.22]);
  }
  cylinder(group, 0.32, 0.27, 0.18, 18, COLORS.cream, [-2.75, 0.95, -0.22]);
  cylinder(group, 0.08, 0.1, 0.2, 12, 0xe28a65, [-2.75, 1.13, -0.22]);
  sphere(group, 0.08, COLORS.leafDark, [-2.75, 1.27, -0.22]);

  createKitchen(group);
  const diningTable = new THREE.Group();
  diningTable.position.set(2.65, 0, 1.55);
  group.add(diningTable);
  cylinder(diningTable, 1.25, 1.25, 0.16, 28, 0xd7ad7b, [0, 0.92, 0]);
  cylinder(diningTable, 0.16, 0.28, 0.88, 10, COLORS.darkWood, [0, 0.45, 0]);
  const tableFlower = cylinder(diningTable, 0.18, 0.14, 0.35, 14, 0x86b8c2, [0, 1.2, 0]);
  tableFlower.castShadow = false;
  for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    sphere(diningTable, 0.1, 0xf28a93, [Math.cos(angle) * 0.13, 1.43, Math.sin(angle) * 0.13]);
  }
  const diningChair = createIndoorSeat(group, 2.65, 3.45, Math.PI, 0x6e9d91);

  const bookcase = new THREE.Group();
  bookcase.position.set(-5.78, 0, -2.35);
  bookcase.rotation.y = Math.PI / 2;
  group.add(bookcase);
  box(bookcase, [3.1, 3.9, 0.42], 0x8b6046, [0, 1.96, 0]);
  for (let row = 0; row < 4; row += 1) {
    box(bookcase, [2.8, 0.12, 0.68], 0xb27d55, [0, 0.45 + row * 1.03, 0.18]);
    for (let item = 0; item < 7; item += 1) {
      const colors = [0xcf6d66, 0x6a9da0, 0xe2b85f, 0x7c72a6, 0x7da56f];
      box(bookcase, [0.23, 0.55 + (item % 3) * 0.08, 0.3], colors[(item + row) % colors.length], [-1.05 + item * 0.35, 0.8 + row * 1.03, 0.42]);
    }
  }

  // Framed art and plants make the room feel inhabited rather than staged.
  for (const [x, y, color] of [
    [-1.05, 3.75, 0xf0b55e],
    [0.15, 3.45, 0x6ca89a],
  ] as const) {
    box(group, [0.95, 1.18, 0.12], COLORS.darkWood, [x, y, -4.76]);
    box(group, [0.73, 0.95, 0.04], color, [x, y, -4.67]);
    sphere(group, 0.17, COLORS.cream, [x, y + 0.08, -4.62], [1.2, 0.72, 0.4]);
  }
  cylinder(group, 0.42, 0.32, 0.58, 18, 0xd18768, [5.75, 0.28, 2.55]);
  for (const angle of [-0.75, -0.2, 0.35, 0.9]) {
    const leaf = sphere(group, 0.42, angle > 0.3 ? COLORS.leafLight : COLORS.leaf, [5.75 + Math.sin(angle) * 0.44, 0.93 + Math.cos(angle) * 0.25, 2.55], [0.45, 1.45, 0.55]);
    leaf.rotation.z = angle;
  }

  const pendants = [
    createPendant(group, -2.4, -0.5, 0xd5756c),
    createPendant(group, 2.7, 1.5, 0x6f9e91),
  ];
  const benches = [sofa, diningChair];
  const activityPoints: TownActivityPoint[] = [
    {
      id: "home-living-room",
      label: "温暖客厅",
      kind: "home",
      position: new THREE.Vector3(-2.45, 0, 0.65),
      radius: 1.8,
    },
    {
      id: "home-kitchen",
      label: "小屋厨房",
      kind: "cafe",
      position: new THREE.Vector3(3.5, 0, -2.1),
      radius: 1.65,
    },
    {
      id: "home-bookshelf",
      label: "故事书架",
      kind: "home",
      position: new THREE.Vector3(-4.75, 0, -2.2),
      radius: 1.4,
    },
  ];
  group.userData.activeActivityId = "home-living-room";
  group.userData.activityPoints = activityPoints;
  group.userData.benches = benches;
  return {
    group,
    activityPoints,
    benches,
    update: (time: number) => {
      if (!Number.isFinite(time)) return;
      pendants.forEach((fixture, index) => {
        fixture.light.intensity = 0.7 + Math.sin(time * 0.86 + index * 2.3) * 0.02;
        fixture.shade.rotation.z = Math.sin(time * 0.32 + index) * 0.0035;
      });
    },
  };
}

type CompactFacilityKind = "cafe" | "market" | "community";

/**
 * A compact resident home used by the opening town.  Its clean painted walls,
 * broad tiled roof and oversized readable windows deliberately avoid the tall
 * timber-frame silhouette used in the older exploration scenes.
 */
function createCompactResidentHome(
  parent: THREE.Object3D,
  x: number,
  z: number,
  bodyColor: THREE.ColorRepresentation,
  roofColor: THREE.ColorRepresentation,
  doorColor: THREE.ColorRepresentation,
  yaw = 0,
  variant = 0,
): THREE.Group {
  const house = new THREE.Group();
  house.name = `Colourful resident home ${variant + 1}`;
  house.position.set(x, 0, z);
  house.rotation.y = yaw;
  parent.add(house);

  const foundation = roundedBox(
    house,
    [4.5, 0.38, 3.55],
    0xd1cbbb,
    [0, 0.19, 0],
    [0, 0, 0],
    0.035,
    "paving",
  );
  foundation.receiveShadow = true;
  const plasterColor = new THREE.Color(bodyColor)
    .lerp(new THREE.Color(0xfff1d8), 0.76)
    .getHex();
  const clayRoofColor = new THREE.Color(roofColor)
    .lerp(new THREE.Color(0xdf704d), 0.82)
    .getHex();
  const body = roundedBox(
    house,
    [4.16, 4.32, 3.22],
    plasterColor,
    [0, 2.48, 0],
    [0, 0, 0],
    0.035,
    "stucco",
  );
  body.castShadow = true;
  body.receiveShadow = true;

  const trimColor = new THREE.Color(plasterColor).lerp(new THREE.Color(0xfff8e9), 0.68).getHex();
  const timberColor = new THREE.Color(0x855638)
    .lerp(new THREE.Color(doorColor), 0.08)
    .getHex();
  const frontZ = 1.67;
  addStoneFoundationFace(house, 4.12, frontZ + 0.025, 0.31);
  box(house, [4.08, 0.19, 0.17], timberColor, [0, 0.62, frontZ]);
  box(house, [4.08, 0.15, 0.17], timberColor, [0, 4.47, frontZ]);
  box(house, [4.08, 0.15, 0.17], timberColor, [0, 2.94, frontZ]);
  for (const side of [-1, 1]) {
    box(house, [0.17, 4.02, 0.17], timberColor, [side * 1.98, 2.48, frontZ]);
  }

  createTiledGableRoof(house, 4.85, 3.78, 1.72, 4.57, clayRoofColor, plasterColor);
  createTerracottaCanopy(house, 4.26, 2.98, frontZ + 0.42, clayRoofColor);

  const doorX = variant % 2 === 0 ? -0.8 : 0.8;
  roundedBox(house, [0.96, 2.12, 0.17], trimColor, [doorX, 1.49, frontZ + 0.04], [0, 0, 0], 0.045);
  roundedBox(house, [0.78, 1.94, 0.12], doorColor, [doorX, 1.49, frontZ + 0.16], [0, 0, 0], 0.035);
  sphere(house, 0.055, COLORS.gold, [doorX + (doorX < 0 ? 0.25 : -0.25), 1.47, frontZ + 0.27], [1, 1, 0.55]);
  roundedBox(house, [1.2, 0.16, 0.7], 0xcfc6b3, [doorX, 0.13, frontZ + 0.28], [0, 0, 0], 0.06, "paving");

  const lowerWindowX = -doorX * 0.88;
  addWindow(house, lowerWindowX, 1.75, frontZ + 0.02, 1.22, 1.28);
  createWindowPlanter(house, lowerWindowX, 0.86, frontZ + 0.29, 1.42);
  addArchedWindow(house, 0, 3.72, frontZ + 0.02, 1.02, 1.22, true);

  const sideWindow = new THREE.Group();
  sideWindow.position.x = variant % 2 === 0 ? 2.12 : -2.12;
  sideWindow.rotation.y = variant % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
  house.add(sideWindow);
  addWindow(sideWindow, 0, 2.25, 0, 0.9, 1.02);

  if (variant % 3 === 0) {
    box(house, [0.42, 1.08, 0.42], 0xe8dfce, [1.22, 5.3, -0.5]);
    box(house, [0.58, 0.14, 0.58], clayRoofColor, [1.22, 5.9, -0.5]);
  }

  house.userData.kind = "house";
  house.userData.height = 6.4;
  return house;
}

function createCompactFacility(
  parent: THREE.Object3D,
  x: number,
  z: number,
  kind: CompactFacilityKind,
  yaw = 0,
): THREE.Group {
  const facility = new THREE.Group();
  facility.name = `Neighbourhood ${kind}`;
  facility.position.set(x, 0, z);
  facility.rotation.y = yaw;
  parent.add(facility);

  const palette: Record<CompactFacilityKind, readonly [number, number, number, number]> = {
    cafe: [0xffe8cb, 0xdd6b49, 0x4f9b8c, 0xfff6e3],
    market: [0xf7ead1, 0xe07a4d, 0xd99445, 0xfff7e5],
    community: [0xeee5d2, 0xcf6549, 0x5a8eb4, 0xfff8ea],
  };
  const [wallColor, roofColor, accentColor, trimColor] = palette[kind];
  const frontZ = 1.84;
  const timberColor = kind === "community" ? 0x775540 : 0x815239;
  const foundation = roundedBox(facility, [5.45, 0.4, 3.9], 0xcec8b8, [0, 0.2, 0], [0, 0, 0], 0.035, "paving");
  foundation.receiveShadow = true;
  addStoneFoundationFace(facility, 5.12, frontZ + 0.03, 0.31);
  const body = roundedBox(facility, [5.14, 3.92, 3.58], wallColor, [0, 2.34, 0], [0, 0, 0], 0.035, "stucco");
  body.castShadow = true;
  for (const side of [-1, 1]) {
    box(facility, [0.18, 3.72, 0.18], timberColor, [side * 2.45, 2.37, frontZ]);
  }
  box(facility, [5.02, 0.18, 0.18], timberColor, [0, 0.66, frontZ]);
  box(facility, [5.02, 0.16, 0.18], timberColor, [0, 4.25, frontZ]);
  createTiledGableRoof(facility, 5.82, 4.18, 1.86, 4.3, roofColor, wallColor);
  roundedBox(facility, [4.86, 0.74, 0.24], accentColor, [0, 3.63, frontZ], [0, 0, 0], 0.12);
  createFabricAwning(facility, -0.72, 3.08, frontZ + 0.05, 3.1, accentColor);
  addStorefrontWindow(facility, -0.72, 1.8, frontZ + 0.02, 2.82, 1.74, 3);
  roundedBox(facility, [1.04, 2.28, 0.18], trimColor, [1.72, 1.52, frontZ + 0.04], [0, 0, 0], 0.12);
  roundedBox(facility, [0.82, 2.08, 0.13], accentColor, [1.72, 1.52, frontZ + 0.17], [0, 0, 0], 0.1);
  sphere(facility, 0.055, COLORS.gold, [1.46, 1.5, frontZ + 0.28], [1, 1, 0.55]);
  roundedBox(facility, [1.34, 0.14, 0.74], 0xcfc6b4, [1.72, 0.12, frontZ + 0.3], [0, 0, 0], 0.06, "paving");

  // A large physical icon makes each facility legible from the roaming camera.
  const badge = cylinder(facility, 0.65, 0.65, 0.16, 20, trimColor, [0, 3.68, frontZ + 0.16]);
  badge.rotation.x = Math.PI / 2;
  if (kind === "cafe") {
    const cup = roundedBox(facility, [0.48, 0.36, 0.12], accentColor, [0, 3.65, frontZ + 0.28], [0, 0, 0], 0.08);
    cup.castShadow = false;
    const handle = addMesh(
      facility,
      new THREE.TorusGeometry(0.15, 0.045, 7, 14, Math.PI * 1.55),
      toon(accentColor),
      [0.27, 3.68, frontZ + 0.31],
      [0, 0, -Math.PI / 2],
    );
    handle.castShadow = false;
  } else if (kind === "market") {
    roundedBox(facility, [0.58, 0.42, 0.12], accentColor, [0, 3.62, frontZ + 0.29], [0, 0, 0], 0.08);
    const handle = addMesh(
      facility,
      new THREE.TorusGeometry(0.22, 0.04, 6, 14, Math.PI),
      toon(accentColor),
      [0, 3.86, frontZ + 0.31],
    );
    handle.castShadow = false;
  } else {
    for (const offset of [-0.23, 0, 0.23]) {
      box(facility, [0.12, 0.56 - Math.abs(offset), 0.11], accentColor, [offset, 3.64, frontZ + 0.29]);
    }
    box(facility, [0.72, 0.1, 0.11], accentColor, [0, 3.38, frontZ + 0.29]);
  }

  const planterColors = kind === "market" ? [0xf28b4b, 0xf4cf52, 0x68b764] : [0xf37f8f, 0xffc955, 0x8a7bd2];
  for (let index = 0; index < 3; index += 1) {
    roundedBox(facility, [0.82, 0.38, 0.58], 0xa96b45, [-1.55 + index * 1.02, 0.27, 2.18], [0, 0, 0], 0.06, "wood");
    for (let item = 0; item < 3; item += 1) {
      sphere(facility, 0.12, planterColors[index], [-1.79 + index * 1.02 + item * 0.23, 0.55, 2.2]);
    }
  }

  facility.userData.kind = kind === "cafe" ? "cafe" : kind === "market" ? "shop" : "house";
  facility.userData.height = 6.2;
  return facility;
}

function createHomeRoadNetwork(parent: THREE.Object3D): void {
  // The opening scene is a pedestrian village, so use warm irregular stone
  // throughout instead of an asphalt crossroad.  This also unifies the road,
  // doorsteps and building foundations under the same material language.
  const laneMaterial = patternedMaterial(0xe1d4bf, "paving", {
    roughness: 0.99,
    normalScale: new THREE.Vector2(0.2, 0.2),
  });
  const vertical = addMesh(parent, new THREE.BoxGeometry(5.15, 0.035, 47), laneMaterial, [1, -0.008, 0]);
  const horizontal = addMesh(parent, new THREE.BoxGeometry(47, 0.035, 5.15), laneMaterial, [0, -0.008, 2]);
  vertical.receiveShadow = true;
  horizontal.receiveShadow = true;

  const sidewalkMaterial = patternedMaterial(0xf0e7d7, "paving", { roughness: 1 });
  for (const x of [-2.08, 4.08]) {
    const sidewalk = addMesh(parent, new THREE.BoxGeometry(0.98, 0.04, 47), sidewalkMaterial, [x, -0.01, 0]);
    sidewalk.receiveShadow = true;
    box(parent, [0.11, 0.08, 47], 0xc3b8a5, [x + (x < 0 ? 0.5 : -0.5), -0.03, 0]);
  }
  for (const z of [-1.08, 5.08]) {
    const sidewalk = addMesh(parent, new THREE.BoxGeometry(47, 0.04, 0.98), sidewalkMaterial, [0, -0.01, z]);
    sidewalk.receiveShadow = true;
    box(parent, [47, 0.08, 0.11], 0xc3b8a5, [0, -0.03, z + (z < 0 ? 0.5 : -0.5)]);
  }

  const crossingInset = addMesh(
    parent,
    new THREE.CircleGeometry(3.45, 40),
    patternedMaterial(0xeee3d1, "paving", { roughness: 1, side: THREE.DoubleSide }),
    [1, 0.012, 2],
    [-Math.PI / 2, 0, 0],
  );
  crossingInset.receiveShadow = true;
  const crossingRing = addMesh(
    parent,
    new THREE.RingGeometry(3.2, 3.43, 40),
    toon(0xc8baa4, { roughness: 1, side: THREE.DoubleSide }),
    [1, 0.014, 2],
    [-Math.PI / 2, 0, 0],
  );
  crossingRing.receiveShadow = true;

  // A single instanced layer of lightly irregular setts gives close shots
  // readable joints while retaining one draw call for the whole intersection.
  const settRows = 15;
  const settColumns = 9;
  const setts = new THREE.InstancedMesh(
    prepareInstancedGeometry(new THREE.BoxGeometry(0.5, 0.012, 0.38)),
    toon(0xffffff, { map: surfaceTexture("paving"), roughness: 1 }),
    settRows * settColumns,
  );
  setts.name = "Warm village intersection setts";
  setts.castShadow = false;
  setts.receiveShadow = true;
  const settMatrix = new THREE.Matrix4();
  const settRotation = new THREE.Quaternion();
  const settScale = new THREE.Vector3();
  const settPalette = [0xdacdb8, 0xe7dbc6, 0xcdbfa9, 0xeee1cc];
  let settIndex = 0;
  for (let row = 0; row < settRows; row += 1) {
    for (let column = 0; column < settColumns; column += 1) {
      const sx = 1 + (column - (settColumns - 1) / 2) * 0.55 + (row % 2) * 0.25;
      const sz = 2 + (row - (settRows - 1) / 2) * 0.44;
      if (Math.hypot(sx - 1, sz - 2) > 3.05) continue;
      settRotation.setFromEuler(new THREE.Euler(0, ((row * 7 + column * 3) % 5 - 2) * 0.018, 0));
      const variation = 0.91 + ((row * 11 + column * 5) % 7) * 0.018;
      settScale.set(variation, 1, 0.92 + ((row + column) % 4) * 0.025);
      settMatrix.compose(new THREE.Vector3(sx, 0.02, sz), settRotation, settScale);
      setts.setMatrixAt(settIndex, settMatrix);
      setts.setColorAt(settIndex, new THREE.Color(settPalette[(row + column) % settPalette.length]));
      settIndex += 1;
    }
  }
  setts.count = settIndex;
  setts.instanceMatrix.needsUpdate = true;
  if (setts.instanceColor) setts.instanceColor.needsUpdate = true;
  parent.add(setts);

  const promenade = roundedBox(
    parent,
    [13.6, 0.035, 5.55],
    0xeee3d1,
    [-7.2, -0.008, 8.15],
    [0, 0, 0],
    0.05,
    "paving",
  );
  promenade.receiveShadow = true;
  roundedBox(parent, [4.9, 0.035, 1.55], 0xeee3d1, [-0.2, -0.008, 8.45], [0, 0, 0], 0.045, "paving");

  const lotPads: ReadonlyArray<readonly [number, number, number, number]> = [
    [-9.8, 3.1, 5.4, 4.55],
    [-15.2, 2.6, 5.2, 4.45],
    [-15.2, -8.9, 5.2, 4.45],
    [-3.1, -12.6, 5.2, 4.45],
    [8.6, -10.5, 5.2, 4.45],
    [14.7, -8.5, 5.2, 4.45],
    [14.5, 9.8, 5.7, 4.8],
    [7.9, -2.2, 6.1, 4.8],
    [8.4, 7.65, 5.9, 4.8],
  ];
  for (let index = 0; index < lotPads.length; index += 1) {
    const [x, z, width, depth] = lotPads[index];
    const pad = roundedBox(
      parent,
      [width, 0.025, depth],
      index % 2 === 0 ? 0x9bd377 : 0x8fcd72,
      [x, -0.003, z],
      [0, 0, 0],
      0.32,
      "grass",
    );
    pad.receiveShadow = true;
  }

  const doorstepPaths: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-9.8, 5.55, 3.2, 1.1, 0],
    [-15.2, 5.15, 2.25, 1.05, 0],
    [-15.2, -6.45, 2.4, 1.05, 0],
    [-3.1, -10.05, 2.45, 1.05, 0],
    [8.6, -7.98, 2.5, 1.05, 0],
    [14.7, -5.95, 2.45, 1.05, 0],
    [14.5, 7.15, 2.35, 1.05, 0],
    [7.9, 0.42, 2.5, 1.25, 0],
    [8.4, 5.15, 2.25, 1.25, 0],
  ];
  for (const [x, z, length, width, yaw] of doorstepPaths) {
    const path = roundedBox(parent, [width, 0.026, length], 0xeee5d5, [x, -0.003, z], [0, yaw, 0], 0.11, "paving");
    path.receiveShadow = true;
  }
}

function createHomePlaza(parent: THREE.Object3D, droplets: JetDrop[]): void {
  const base = cylinder(parent, 4.75, 4.75, 0.045, 40, 0xe3d8c5, [-7.7, -0.012, -5.2]);
  base.material = patternedMaterial(0xe3d8c5, "paving", { roughness: 1 });
  const inset = cylinder(parent, 4.08, 4.08, 0.014, 40, 0xf3e9d7, [-7.7, 0.008, -5.2], false);
  inset.material = patternedMaterial(0xf3e9d7, "paving", { roughness: 1 });
  const ring = addMesh(
    parent,
    new THREE.TorusGeometry(3.25, 0.055, 6, 40),
    toon(0xc6bba9, { roughness: 1 }),
    [-7.7, 0.018, -5.2],
    [Math.PI / 2, 0, 0],
  );
  ring.castShadow = false;
  const fountain = createFountain(parent, -7.7, -5.2, droplets);
  fountain.scale.setScalar(0.75);
}

function createHomeBackdrop(parent: THREE.Object3D): THREE.Group[] {
  const backdrop = new THREE.Group();
  backdrop.name = "Colourful neighbourhood backdrop";
  parent.add(backdrop);
  const clouds: THREE.Group[] = [];

  const hillData: ReadonlyArray<readonly [number, number, number, number]> = [
    [-16, -23, 8.8, 0x8bb784],
    [-3, -25, 10.5, 0x7fab7c],
    [12, -24, 9.2, 0x8fbc88],
    [24, -16, 7.5, 0x84af80],
    [-25, 12, 8.4, 0x94c08a],
  ];
  for (const [x, z, scale, color] of hillData) {
    const hill = sphere(backdrop, 2.4, color, [x, -0.15, z], [scale / 4.6, 0.72, scale / 5]);
    hill.castShadow = false;
    hill.receiveShadow = true;
  }

  const skyline: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-16, -18.4, 0xffe8d1, 0xd96d4e, 0.68],
    [-10.6, -20.1, 0xf1e6d5, 0xcc6749, 0.58],
    [-4.8, -20.7, 0xffedca, 0xdf754d, 0.62],
    [2.2, -21.2, 0xeee8d8, 0xd16b48, 0.6],
    [9.5, -20.1, 0xf8e3d5, 0xe07a53, 0.64],
    [17.5, -17.6, 0xe7e5da, 0xcf684b, 0.58],
  ];
  skyline.forEach(([x, z, wall, roof, scale], index) => {
    const building = new THREE.Group();
    building.position.set(x, 0, z);
    building.scale.setScalar(scale);
    backdrop.add(building);
    roundedBox(building, [4.2, 3.7, 3], wall, [0, 1.94, 0], [0, 0, 0], 0.18, "stucco");
    const roofMesh = addMesh(
      building,
      gableRoofGeometry(4.7, 3.45, 1.55),
      patternedMaterial(roof, "roof", { roughness: 0.8, side: THREE.DoubleSide }),
      [0, 3.82, 0],
    );
    roofMesh.castShadow = false;
    addWindow(building, index % 2 === 0 ? -0.8 : 0.8, 2.05, 1.56, 0.88, 0.94);
  });

  const cloudData: ReadonlyArray<readonly [number, number, number, number]> = [
    [-15, 10.2, -16, 1.12],
    [7, 11.8, -22, 1.36],
    [21, 9.4, -9, 0.92],
    [-23, 8.7, 5, 1.02],
  ];
  for (const [x, y, z, scale] of cloudData) {
    const cloud = new THREE.Group();
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    backdrop.add(cloud);
    sphere(cloud, 1, 0xfff8e8, [0, 0, 0], [1.6, 0.68, 0.82]).castShadow = false;
    sphere(cloud, 0.78, 0xffffff, [-0.92, -0.08, 0], [1.25, 0.68, 0.82]).castShadow = false;
    sphere(cloud, 0.86, 0xffffff, [0.92, -0.1, 0], [1.3, 0.62, 0.82]).castShadow = false;
    cloud.userData.basePosition = cloud.position.clone();
    clouds.push(cloud);
  }
  return clouds;
}

function placeAuthoredAsset(
  parent: THREE.Object3D,
  assets: AuthoredEnvironmentAssets,
  id: AuthoredEnvironmentAssetId,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  scale: readonly [number, number, number] = [1, 1, 1],
): THREE.Group | null {
  const object = assets.clone(id);
  if (!object) return null;
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  parent.add(object);
  return object;
}

function tintAuthoredDoor(door: THREE.Object3D): void {
  door.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = sources.map((source) => {
      const material = source.clone();
      material.userData.sharedEnvironmentAsset = false;
      const standard = material as THREE.MeshStandardMaterial;
      if (standard.isMeshStandardMaterial) {
        if (!standard.name.toLowerCase().includes("glass")) {
          standard.map = null;
          standard.color.set(0x3f815c);
        }
        standard.roughness = 0.84;
      }
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0]!;
  });
}

function createAuthoredHomeDistrict(
  parent: THREE.Object3D,
  assets: AuthoredEnvironmentAssets,
): { wind: AuthoredWindObject[] } | null {
  const district = new THREE.Group();
  district.name = "Authored CC0 arrival district";
  district.userData.sharedEnvironmentAsset = true;
  parent.add(district);

  const house = new THREE.Group();
  house.name = "Authored plaster and terracotta home";
  house.position.set(-9.8, 0, 3.1);
  // The accepted key art has a broad, welcoming facade rather than a tall
  // narrow block. Keep the floor height, but stretch the authored modules
  // horizontally and only slightly in depth.
  house.scale.set(0.98, 0.78, 0.82);
  district.add(house);
  let complete = true;
  const addHouse = (
    id: AuthoredEnvironmentAssetId,
    position: readonly [number, number, number],
    yaw = 0,
    scale: readonly [number, number, number] = [1, 1, 1],
  ) => {
    const object = placeAuthoredAsset(house, assets, id, position, [0, yaw, 0], scale);
    complete &&= Boolean(object);
    return object;
  };

  // A six-metre ground floor with real window/door openings and a narrower,
  // offset upper storey. This replaces the rounded-box facade completely.
  addHouse("Wall_Plaster_Door_Round", [-2, 0, 2]);
  addHouse("Wall_Plaster_Window_Wide_Round", [0, 0, 2]);
  addHouse("Wall_Plaster_Window_Wide_Round", [2, 0, 2]);
  for (const x of [-2, 0, 2]) addHouse("Wall_Plaster_Straight", [x, 0, -2], Math.PI);
  for (const z of [-1, 1]) {
    addHouse("Wall_Plaster_Straight", [-3, 0, z], -Math.PI / 2);
    addHouse("Wall_Plaster_Straight", [3, 0, z], Math.PI / 2);
  }
  const door = addHouse("Door_1_Round", [-2.52, 0.02, 2.13]);
  if (door) tintAuthoredDoor(door);
  addHouse("Window_Wide_Round1", [0, 0, 2.12]);
  addHouse("Window_Wide_Round1", [2, 0, 2.12]);

  const upperLeft = -0.35;
  const upperRight = 1.65;
  const upperY = 3.08;
  addHouse("Wall_Plaster_Window_Wide_Round", [upperLeft, upperY, 2]);
  // An asymmetric timber panel removes the chapel-like row of identical
  // arches and gives the upper floor the lived-in silhouette of the target.
  addHouse("Wall_Plaster_Straight", [upperRight, upperY, 2]);
  addHouse("Window_Wide_Round1", [upperLeft, upperY, 2.12]);
  addHouse("Window_Wide_Round1", [upperRight, upperY + 0.04, 2.13], 0, [0.56, 0.88, 0.92]);
  addHouse("Wall_Plaster_Straight", [upperLeft, upperY, -2], Math.PI);
  addHouse("Wall_Plaster_Straight", [upperRight, upperY, -2], Math.PI);
  for (const z of [-1, 1]) {
    addHouse("Wall_Plaster_Straight", [-1.35, upperY, z], -Math.PI / 2);
    addHouse("Wall_Plaster_Straight", [2.65, upperY, z], Math.PI / 2);
  }
  // Turn the ridge parallel to the facade. The earlier orientation exposed a
  // raw triangular gable and read as an unfinished chapel rather than a home.
  addHouse("Roof_RoundTiles_4x6", [0.65, 6.05, 0], Math.PI / 2, [0.58, 0.72, 0.92]);
  // A shallow tiled skirt between floors is the defining Mediterranean layer
  // in the approved reference and breaks up the previous flat stacked box.
  addHouse("Roof_RoundTiles_4x6", [0, 3.02, 0.08], Math.PI / 2, [0.61, 0.2, 1.04]);
  createFabricAwning(house, 1.04, 2.82, 2.38, 1.72, 0x4e9bd3);
  for (const [x, y, width] of [
    [0, 0.7, 1.42],
    [2, 0.7, 1.42],
    [upperLeft, 3.76, 1.3],
  ] as const) {
    box(house, [width, 0.2, 0.34], 0x8d613f, [x, y, 2.3]);
  }

  // Window boxes use authored flower meshes rather than coloured spheres.
  for (const [x, y, scale] of [
    [0, 0.72, 0.29],
    [2, 0.72, 0.29],
    [upperLeft, 3.78, 0.25],
  ] as const) {
    placeAuthoredAsset(house, assets, "Flower_3_Group", [x, y, 2.36], [0, 0.3, 0], [scale, scale, scale]);
  }

  if (!complete) {
    parent.remove(district);
    return null;
  }

  const wind: AuthoredWindObject[] = [];
  const tree = placeAuthoredAsset(
    district,
    assets,
    "CommonTree_1",
    [-14.1, 0.2, 4.65],
    [0, -0.28, 0],
    [0.72, 0.82, 0.72],
  );
  if (tree) {
    wind.push({ object: tree, baseX: 0, baseZ: 0, amplitude: 0.026, phase: 0.4, speed: 0.72 });
  }

  for (const [x, z, scale, phase] of [
    [-12.2, 5.25, 0.52, 0.1],
    [-7.5, 5.05, 0.46, 1.6],
    [-13.5, 7.25, 0.4, 2.8],
  ] as const) {
    const bush = placeAuthoredAsset(
      district,
      assets,
      "Bush_Common_Flowers",
      [x, 0.18, z],
      [0, phase, 0],
      [scale, scale, scale],
    );
    if (bush) wind.push({ object: bush, baseX: 0, baseZ: 0, amplitude: 0.045, phase, speed: 1.05 });
  }

  // Authored uneven-brick PBR tiles form the full foreground walkable street.
  for (let x = -16; x <= -6; x += 2) {
    for (let z = 7; z <= 11; z += 2) {
      placeAuthoredAsset(
        district,
        assets,
        "Floor_UnevenBrick",
        [x, 0.004, z],
        [0, (Math.abs(x + z) % 4) * Math.PI / 2, 0],
        [1.01, 1, 1.01],
      );
    }
  }

  const grassSpots: ReadonlyArray<readonly [number, number, number, number]> = [
    [-15.3, 6.4, 0.38, 0.2], [-14.8, 6.9, 0.3, 1.1],
    [-13.9, 6.65, 0.34, 2.1], [-12.8, 6.1, 0.28, 0.7],
    [-7.35, 5.8, 0.34, 2.8], [-6.9, 6.3, 0.29, 1.8],
    [-12.4, 4.95, 0.26, 0.9], [-7.7, 4.7, 0.25, 2.4],
  ];
  grassSpots.forEach(([x, z, scale, phase], index) => {
    const grass = placeAuthoredAsset(
      district,
      assets,
      index % 2 === 0 ? "Grass_Common_Short" : "Grass_Wispy_Short",
      [x, 0.03, z],
      [0, phase * 1.7, 0],
      [scale, scale, scale],
    );
    if (grass) wind.push({ object: grass, baseX: 0, baseZ: 0, amplitude: 0.13, phase, speed: 1.7 });
  });

  return { wind };
}

function createSunnyHomeTown(assets?: AuthoredEnvironmentAssets | null): TownEnvironment {
  const group = new THREE.Group();
  group.name = "Sunny Side colourful 3D neighbourhood";
  group.userData.kind = "town-environment";
  group.userData.sceneName = "home";
  group.userData.layoutVersion = "warm-village-v3";

  const treeCrowns: TreeCrown[] = [];
  const droplets: JetDrop[] = [];
  const benches: THREE.Group[] = [];
  const authoredWind: AuthoredWindObject[] = [];
  const ground = cylinder(group, 31, 32, 0.18, 64, COLORS.grass, [0, -0.1, 0]);
  ground.castShadow = false;
  ground.receiveShadow = true;
  addMesh(
    group,
    new THREE.RingGeometry(27.5, 30.7, 64),
    patternedMaterial(COLORS.grassLight, "grass", { roughness: 1 }),
    [0, 0.001, 0],
    [-Math.PI / 2, 0, 0],
  ).receiveShadow = true;

  const distantClouds = createHomeBackdrop(group);
  const canalWater = createCanal(group);
  createHomeRoadNetwork(group);
  createHomePlaza(group, droplets);
  const grassDetails = createGrassDetails(group);
  const authoredDistrict = assets ? createAuthoredHomeDistrict(group, assets) : null;
  if (authoredDistrict) authoredWind.push(...authoredDistrict.wind);

  if (!authoredDistrict) {
    createCompactResidentHome(group, -9.8, 3.1, 0xffd5bf, 0xe16759, 0x438d78, 0.035, 0);
    createCompactResidentHome(group, -15.2, 2.6, 0xd3ebea, 0x5f91bf, 0xe28a58, -0.03, 1);
  }
  createCompactResidentHome(group, -15.2, -8.9, 0xffe6a9, 0xe2874f, 0x5a9a78, 0.06, 2);
  createCompactResidentHome(group, -3.1, -12.6, 0xd9e8fb, 0x6b8fc1, 0xd16d72, -0.03, 3);
  createCompactResidentHome(group, 8.6, -10.5, 0xf6d5e5, 0xa86ea7, 0x557fa5, 0.05, 4);
  createCompactResidentHome(group, 14.7, -8.5, 0xd8efcc, 0x68ac67, 0xdc7b55, -0.06, 5);
  createCompactFacility(group, 14.5, 9.8, "community", Math.PI);
  createCompactFacility(group, 7.9, -2.2, "cafe");
  createCompactFacility(group, 8.4, 7.65, "market");

  if (!authoredDistrict) createFence(group, -12.4, 5.95, 5.4, 0.03);
  createFence(group, -15.2, -6.45, 4.5, -0.03);
  createFence(group, 14.5, 7.35, 4.7, Math.PI);
  if (!authoredDistrict) createMailbox(group, -7.6, 5.45, 0xd76561);
  createMailbox(group, -13.1, -6.1, 0x5e8f84);
  createMailbox(group, 12.3, 7.1, 0xe3a64d);
  createTownSign(group, -2.85, 6.25);

  const treeData: ReadonlyArray<readonly [number, number, number, number]> = [
    [-13.1, 8.65, 1.02, 0.2],
    [-17.8, -3.6, 0.88, 0.7],
    [-12.4, -14.4, 1.02, 1.8],
    [5.7, -14.8, 0.9, 2.6],
    [17.2, -1.2, 0.98, 3.5],
    [18.1, 5.8, 0.86, 0.9],
    [10.8, 14.3, 1, 2.1],
    [5.8, 12.7, 0.84, 3.8],
    [-18.2, 12.6, 0.86, 1.1],
  ];
  for (const [index, [x, z, scale, phase]] of treeData.entries()) {
    if (authoredDistrict && index === 0) continue;
    createTree(group, treeCrowns, x, z, scale, phase);
  }

  if (!authoredDistrict) {
    createFlowerPatch(group, -10.6, 6.55, 18, 1);
    createFlowerPatch(group, -13.4, 7.45, 16, 3);
  }
  createFlowerPatch(group, 6.9, 12.8, 14, 4);
  createFlowerPatch(group, 14.7, 3.1, 15, 7);
  createFlowerPatch(group, -16.5, -3.5, 12, 9);
  for (const [x, z, scale] of [
    [-10.9, -0.15, 0.76],
    [5.4, 5.8, 0.7],
    [11.2, 4.9, 0.8],
    [11.1, -5.1, 0.76],
    [5.3, -5.6, 0.72],
  ] as const) {
    createBush(group, x, z, scale);
  }

  benches.push(createBench(group, -4.3, -4.25, -Math.PI / 2));
  benches.push(createBench(group, -8.1, -0.15, Math.PI));
  benches.push(createBench(group, -11.2, -5.2, Math.PI / 2));
  benches.push(createBench(group, -5.2, 10.25, Math.PI / 2));
  benches.push(createBench(group, -14.1, 10.75, Math.PI));

  for (const [x, z] of [
    [-3.1, -0.1],
    [-3.2, 5.7],
    [5.1, -0.2],
    [5.2, 5.8],
    [-5.1, -1.9],
    [-12.2, -1.8],
    [-14.2, -7.5],
    [-7.7, -11.9],
    [6.1, -6.2],
    [11.4, 5.6],
  ] as const) {
    createLamp(group, x, z);
  }

  const plazaGlow = new THREE.PointLight(0xffcf76, 0.34, 8, 2);
  plazaGlow.position.set(-7.7, 3.1, -5.2);
  plazaGlow.castShadow = false;
  group.add(plazaGlow);
  const cafeGlow = new THREE.PointLight(0xffb56c, 0.24, 7, 2);
  cafeGlow.position.set(7.9, 2.8, 0.2);
  cafeGlow.castShadow = false;
  group.add(cafeGlow);

  const activityPoints: TownActivityPoint[] = [
    { id: "home-rose", label: "晴花小屋", kind: "home", position: new THREE.Vector3(-9.8, 0, 5.25), radius: 1.7 },
    { id: "sunny-cafe", label: "阳光咖啡馆", kind: "cafe", position: new THREE.Vector3(7.9, 0, 1.15), radius: 2.1 },
    { id: "little-market", label: "小小杂货铺", kind: "shop", position: new THREE.Vector3(8.4, 0, 10.1), radius: 1.9 },
    { id: "wish-fountain", label: "许愿喷泉", kind: "fountain", position: new THREE.Vector3(-7.7, 0, -5.2), radius: 3.25 },
    { id: "pond-garden", label: "社区花园", kind: "garden", position: new THREE.Vector3(-8.5, 0, 10.2), radius: 3.2 },
    { id: "windmill-lookout", label: "河畔远眺点", kind: "lookout", position: new THREE.Vector3(13.6, 0, -14.2), radius: 2.4 },
  ];
  group.userData.activeActivityId = "home-rose";
  group.userData.activityPoints = activityPoints;
  group.userData.benches = benches;

  const grassMatrix = new THREE.Matrix4();
  const grassRotation = new THREE.Quaternion();
  const grassScale = new THREE.Vector3();
  const grassEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const update = (time: number): void => {
    if (!Number.isFinite(time)) return;
    for (const drop of droplets) {
      const progress = (time * 0.58 + drop.phase) % 1;
      const distance = 0.28 + progress * 1.72;
      drop.mesh.position.x = Math.cos(drop.angle) * distance;
      drop.mesh.position.z = Math.sin(drop.angle) * distance;
      drop.mesh.position.y = 2.98 + Math.sin(progress * Math.PI) * 1.08 - progress * 0.42;
      drop.mesh.rotation.y = time * 1.8 + drop.phase * Math.PI * 2;
      drop.mesh.visible = progress < 0.94;
    }
    for (const crown of treeCrowns) {
      crown.group.rotation.z = Math.sin(time * 0.72 + crown.phase) * 0.025;
      crown.group.rotation.x = Math.cos(time * 0.54 + crown.phase * 1.3) * 0.016;
    }
    for (const item of authoredWind) {
      const gust = 0.72 + Math.sin(time * 0.31 + item.phase * 1.9) * 0.28;
      item.object.rotation.x = item.baseX
        + Math.sin(time * item.speed + item.phase) * item.amplitude * gust;
      item.object.rotation.z = item.baseZ
        + Math.cos(time * item.speed * 0.78 + item.phase * 1.37) * item.amplitude * 0.72 * gust;
    }
    for (let index = 0; index < grassDetails.tufts.length; index += 1) {
      const tuft = grassDetails.tufts[index];
      const breeze = 0.72 + Math.sin(time * 0.24 + tuft.phase * 0.43) * 0.18;
      grassEuler.set(
        Math.sin(time * 1.28 + tuft.phase) * 0.032 * breeze,
        tuft.yaw,
        Math.cos(time * 1.06 + tuft.phase * 1.37) * 0.021 * breeze,
        "YXZ",
      );
      grassRotation.setFromEuler(grassEuler);
      grassScale.setScalar(tuft.scale);
      grassMatrix.compose(tuft.position, grassRotation, grassScale);
      grassDetails.mesh.setMatrixAt(index, grassMatrix);
    }
    grassDetails.mesh.instanceMatrix.needsUpdate = true;
    const waterMap = canalWater.material instanceof THREE.MeshPhysicalMaterial ? canalWater.material.map : null;
    if (waterMap) {
      waterMap.offset.x = (time * 0.012) % 1;
      waterMap.offset.y = (Math.sin(time * 0.16) * 0.018 + 1) % 1;
    }
    distantClouds.forEach((cloud, index) => {
      const base = cloud.userData.basePosition as THREE.Vector3;
      cloud.position.x = base.x + Math.sin(time * 0.08 + index) * 0.3;
      cloud.position.y = base.y + Math.cos(time * 0.22 + index * 1.7) * 0.08;
    });
    plazaGlow.intensity = 0.32 + Math.sin(time * 1.8) * 0.025;
    cafeGlow.intensity = 0.23 + Math.sin(time * 1.45 + 0.8) * 0.02;
  };

  const obstacles: CircularObstacle[] | undefined = authoredDistrict
    ? [
        { position: [-11.35, 3.1], radius: 1.05 },
        { position: [-9.8, 3.1], radius: 1.05 },
        { position: [-8.25, 3.1], radius: 1.05 },
        { position: [-14.1, 4.65], radius: 0.68 },
        { position: [-15.2, -8.9], radius: 2.15 },
        { position: [-3.1, -12.6], radius: 2.1 },
        { position: [8.6, -10.5], radius: 2.15 },
        { position: [14.7, -8.5], radius: 2.15 },
        { position: [14.5, 9.8], radius: 2.1 },
        { position: [7.9, -2.2], radius: 2.7 },
        { position: [8.4, 7.65], radius: 2.5 },
        { position: [-7.7, -5.2], radius: 1.55 },
      ]
    : undefined;

  return {
    group,
    activityPoints,
    benches,
    obstacles,
    visualSource: authoredDistrict ? "authored" : "procedural",
    update,
  };
}

/**
 * Builds the full Sunny Side town. The caller owns attaching the returned group
 * to its scene, which keeps creation safe for scene transitions.
 *
 * Bench groups expose `sitPosition`, `sitYaw`, and `interactionRadius` through
 * `userData`, while activity points are stable world-space destinations.
 */
export function createTown(
  sceneName: TownSceneName,
  assets?: AuthoredEnvironmentAssets | null,
): TownEnvironment {
  if (sceneName === "shop") return createShopInterior();
  if (sceneName === "interior") return createHomeInterior();
  if (sceneName === "home") return createSunnyHomeTown(assets);

  const group = new THREE.Group();
  group.name = "Sunny Side Town";
  group.userData.kind = "town-environment";
  group.userData.sceneName = sceneName;

  const treeCrowns: TreeCrown[] = [];
  const droplets: JetDrop[] = [];
  const benches: THREE.Group[] = [];

  const ground = cylinder(group, 31, 32, 0.18, 64, COLORS.grass, [0, -0.1, 0]);
  ground.castShadow = false;
  ground.receiveShadow = true;
  addMesh(
    group,
    new THREE.RingGeometry(27.5, 30.7, 64),
    toon(COLORS.grassLight, { roughness: 1 }),
    [0, 0.001, 0],
    [-Math.PI / 2, 0, 0],
  ).receiveShadow = true;

  // Slightly raised meadow layers interrupt the single flat green disk.
  const northMeadow = addMesh(
    group,
    new THREE.CircleGeometry(6.8, 40),
    patternedMaterial(COLORS.grassLight, "grass", { roughness: 1 }),
    [11.4, 0.012, 13.2],
    [-Math.PI / 2, 0, 0],
  );
  northMeadow.scale.y = 0.66;
  northMeadow.receiveShadow = true;
  const westMeadow = addMesh(
    group,
    new THREE.CircleGeometry(5.6, 36),
    patternedMaterial(0x68ae61, "grass", { roughness: 1 }),
    [-13.7, 0.014, -11.6],
    [-Math.PI / 2, 0, 0],
  );
  westMeadow.scale.y = 0.72;
  westMeadow.receiveShadow = true;

  const distantClouds = createDistantScenery(group);
  const canalWater = createCanal(group);
  createRoadNetwork(group);
  createPlaza(group, droplets);
  const parkPond = createParkPond(group);
  // The home scene returns its dedicated compact layout above, so the pond is
  // always available in these plaza/cafe exploration scenes.
  parkPond.visible = true;
  const grassDetails = createGrassDetails(group);

  createHouse(group, -9.8, 3.1, 0xf4d8cb, 0xb95455, 0.04, 1.08);
  createHouse(group, -15.2, 2.6, 0xd8eadf, 0xc96950, -0.03, 1);
  createHouse(group, -15.2, -8.9, 0xf2e4bf, 0xd46f55, 0.06, 1.02);
  createHouse(group, -3.1, -12.6, 0xdde8f1, 0xc96350, -0.03, 1);
  createHouse(group, 8.6, -10.5, 0xf1ddda, 0xcc6852, 0.05, 1.03);
  createHouse(group, 14.7, -8.5, 0xf1e4c8, 0xc8644d, -0.06, 1);
  createHouse(group, 14.5, 9.8, 0xdceade, 0xce6b51, Math.PI, 1);
  createCafe(group, 7.9, -2.2);
  createShop(group, 8.4, 7.65);

  createFence(group, -12.4, 5.95, 5.4, 0.03);
  createFence(group, -15.2, -6.45, 4.5, -0.03);
  createFence(group, 14.5, 7.35, 4.7, Math.PI);
  createMailbox(group, -7.6, 5.45, 0xce665d);
  createMailbox(group, -13.1, -6.1, 0x547f78);
  createMailbox(group, 12.3, 7.1, 0xe6a94e);
  createTownSign(group, -2.85, 6.25);

  const treeData: ReadonlyArray<readonly [number, number, number, number]> = [
    [-13.2, 8.6, 1.08, 0.2],
    [15, -15, 0.88, 1.3],
    [-15.5, 12.7, 0.82, 2.4],
    [18, -12.5, 0.85, 3.1],
    [-17.8, -3.6, 0.92, 0.7],
    [-12.5, -14.4, 1.08, 1.8],
    [5.7, -14.5, 0.94, 2.6],
    [17.1, -1.2, 1.05, 3.5],
    [18.1, 5.8, 0.9, 0.9],
    [10.8, 14.3, 1.08, 2.1],
    [5.8, 12.3, 0.87, 3.8],
    [-18, -12, 0.9, 1.1],
  ];
  for (const [x, z, scale, phase] of treeData) {
    createTree(group, treeCrowns, x, z, scale, phase);
  }

  createFlowerPatch(group, -4.5, -9.3, 14, 1);
  createFlowerPatch(group, -13.4, 7.4, 16, 3);
  createFlowerPatch(group, 6.8, 12.9, 12, 4);
  createFlowerPatch(group, 14.8, 3.2, 15, 7);
  createFlowerPatch(group, -16.5, -3.5, 10, 9);

  const bushData: ReadonlyArray<readonly [number, number, number]> = [
    [-5.3, -0.6, 0.8],
    [-10.4, -0.2, 0.75],
    [5.4, 5.8, 0.72],
    [11.2, 4.9, 0.84],
    [11.1, -5.1, 0.8],
    [5.3, -5.6, 0.76],
  ];
  for (const [x, z, scale] of bushData) {
    createBush(group, x, z, scale);
  }

  benches.push(createBench(group, -4.2, -4.4, -Math.PI / 2));
  benches.push(createBench(group, -8.1, 0.4, Math.PI));
  benches.push(createBench(group, -12.1, -5.2, Math.PI / 2));
  const courtyardBench = createBench(group, -5.2, 10.7, Math.PI / 2);
  courtyardBench.visible = true;
  benches.push(courtyardBench);
  benches.push(createBench(group, -11.2, 8.2, -Math.PI / 2));

  const lampPositions: ReadonlyArray<readonly [number, number]> = [
    [-3.1, -0.1],
    [-3.2, 5.7],
    [5.1, -0.2],
    [5.2, 5.8],
    [-5.1, -1.9],
    [-12.2, -1.8],
    [-14.2, -7.5],
    [-7.7, -12.1],
    [6.1, -6.2],
    [11.4, 5.6],
  ];
  for (const [x, z] of lampPositions) createLamp(group, x, z);

  const plazaGlow = new THREE.PointLight(0xffcf76, 0.34, 8, 2);
  plazaGlow.position.set(-7.7, 3.4, -5.2);
  plazaGlow.castShadow = false;
  group.add(plazaGlow);
  const cafeGlow = new THREE.PointLight(0xffb56c, 0.24, 7, 2);
  cafeGlow.position.set(7.9, 3, 0.2);
  cafeGlow.castShadow = false;
  group.add(cafeGlow);

  const activityPoints: TownActivityPoint[] = [
    {
      id: "home-rose",
      label: "玫瑰小屋",
      kind: "home",
      position: new THREE.Vector3(-9.8, 0, 5.25),
      radius: 1.7,
    },
    {
      id: "sunny-cafe",
      label: "阳光咖啡馆",
      kind: "cafe",
      position: new THREE.Vector3(7.9, 0, 1.15),
      radius: 2.1,
    },
    {
      id: "little-market",
      label: "小小杂货铺",
      kind: "shop",
      position: new THREE.Vector3(8.4, 0, 10.1),
      radius: 1.9,
    },
    {
      id: "wish-fountain",
      label: "许愿喷泉",
      kind: "fountain",
      position: new THREE.Vector3(-7.7, 0, -5.2),
      radius: 3.25,
    },
    {
      id: "pond-garden",
      label: "睡莲花园",
      kind: "garden",
      position: new THREE.Vector3(-8.5, 0, 10.2),
      radius: 3.2,
    },
    {
      id: "windmill-lookout",
      label: "风车远眺点",
      kind: "lookout",
      position: new THREE.Vector3(13.6, 0, -14.2),
      radius: 2.4,
    },
  ];

  const activeActivityId = sceneName === "plaza" ? "wish-fountain" : "sunny-cafe";
  group.userData.activeActivityId = activeActivityId;

  group.userData.activityPoints = activityPoints;
  group.userData.benches = benches;

  const windmillSails = group.getObjectByName("Windmill sails");
  const grassMatrix = new THREE.Matrix4();
  const grassRotation = new THREE.Quaternion();
  const grassScale = new THREE.Vector3();
  const grassEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const update = (time: number): void => {
    if (!Number.isFinite(time)) return;

    for (const drop of droplets) {
      const progress = (time * 0.58 + drop.phase) % 1;
      const distance = 0.28 + progress * 1.72;
      drop.mesh.position.x = Math.cos(drop.angle) * distance;
      drop.mesh.position.z = Math.sin(drop.angle) * distance;
      drop.mesh.position.y = 2.98 + Math.sin(progress * Math.PI) * 1.08 - progress * 0.42;
      drop.mesh.rotation.y = time * 1.8 + drop.phase * Math.PI * 2;
      drop.mesh.visible = progress < 0.94;
    }

    for (const crown of treeCrowns) {
      crown.group.rotation.z = Math.sin(time * 0.72 + crown.phase) * 0.025;
      crown.group.rotation.x = Math.cos(time * 0.54 + crown.phase * 1.3) * 0.016;
    }

    for (let index = 0; index < grassDetails.tufts.length; index += 1) {
      const tuft = grassDetails.tufts[index];
      const breeze = 0.72 + Math.sin(time * 0.24 + tuft.phase * 0.43) * 0.18;
      const tiltX = Math.sin(time * 1.28 + tuft.phase) * 0.032 * breeze;
      const tiltZ = Math.cos(time * 1.06 + tuft.phase * 1.37) * 0.021 * breeze;
      grassEuler.set(tiltX, tuft.yaw, tiltZ, "YXZ");
      grassRotation.setFromEuler(grassEuler);
      grassScale.setScalar(tuft.scale);
      grassMatrix.compose(tuft.position, grassRotation, grassScale);
      grassDetails.mesh.setMatrixAt(index, grassMatrix);
    }
    grassDetails.mesh.instanceMatrix.needsUpdate = true;

    if (windmillSails) windmillSails.rotation.z = -time * 0.22;

    const waterMap = canalWater.material instanceof THREE.MeshPhysicalMaterial
      ? canalWater.material.map
      : null;
    if (waterMap) {
      waterMap.offset.x = (time * 0.012) % 1;
      waterMap.offset.y = (Math.sin(time * 0.16) * 0.018 + 1) % 1;
    }

    distantClouds.forEach((cloud, index) => {
      const base = cloud.userData.basePosition as THREE.Vector3;
      cloud.position.x = base.x + Math.sin(time * 0.08 + index) * 0.3;
      cloud.position.y = base.y + Math.cos(time * 0.22 + index * 1.7) * 0.08;
    });

    plazaGlow.intensity = 0.32 + Math.sin(time * 1.8) * 0.025;
    cafeGlow.intensity = 0.23 + Math.sin(time * 1.45 + 0.8) * 0.02;
  };

  return { group, activityPoints, benches, update };
}

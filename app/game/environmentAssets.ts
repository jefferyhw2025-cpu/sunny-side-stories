import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

export type AuthoredEnvironmentAssetId =
  | "Wall_Plaster_Straight"
  | "Wall_Plaster_Door_Round"
  | "Door_1_Round"
  | "Wall_Plaster_Window_Wide_Round"
  | "Window_Wide_Round1"
  | "Wall_Plaster_WoodGrid"
  | "Roof_RoundTiles_4x6"
  | "Roof_Dormer_RoundTile"
  | "Floor_UnevenBrick"
  | "CommonTree_1"
  | "Bush_Common_Flowers"
  | "Flower_3_Group"
  | "Grass_Common_Short"
  | "Grass_Wispy_Short";

export interface AuthoredEnvironmentAssets {
  clone(id: AuthoredEnvironmentAssetId): THREE.Group | null;
}

const medieval = [
  "Wall_Plaster_Straight",
  "Wall_Plaster_Door_Round",
  "Door_1_Round",
  "Wall_Plaster_Window_Wide_Round",
  "Window_Wide_Round1",
  "Wall_Plaster_WoodGrid",
  "Roof_RoundTiles_4x6",
  "Roof_Dormer_RoundTile",
  "Floor_UnevenBrick",
] as const satisfies readonly AuthoredEnvironmentAssetId[];

const nature = [
  "CommonTree_1",
  "Bush_Common_Flowers",
  "Flower_3_Group",
  "Grass_Common_Short",
  "Grass_Wispy_Short",
] as const satisfies readonly AuthoredEnvironmentAssetId[];

const paths = new Map<AuthoredEnvironmentAssetId, string>([
  ...medieval.map((id) => [id, `models/town/medieval/${id}.glb`] as const),
  ...nature.map((id) => [id, `models/town/nature/${id}.glb`] as const),
]);
const sources = new Map<AuthoredEnvironmentAssetId, GLTF>();
let preloadPromise: Promise<AuthoredEnvironmentAssets | null> | null = null;

function assetUrl(path: string): string {
  if (typeof document === "undefined") return path;
  return new URL(path, document.baseURI).href;
}

function prepareSource(gltf: GLTF): void {
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.userData.sharedEnvironmentAsset = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.userData.sharedEnvironmentAsset = true;
      const standard = material as THREE.MeshStandardMaterial;
      if (standard.isMeshStandardMaterial) {
        standard.roughness = Math.max(standard.roughness, 0.72);
        standard.metalness = Math.min(standard.metalness, 0.08);
        standard.envMapIntensity = 0.62;
        if (standard.map) standard.map.colorSpace = THREE.SRGBColorSpace;
      }
      for (const value of Object.values(material)) {
        if ((value as THREE.Texture | undefined)?.isTexture) {
          (value as THREE.Texture).userData.sharedEnvironmentAsset = true;
        }
      }
    }
  });
}

function cloneSource(id: AuthoredEnvironmentAssetId): THREE.Group | null {
  const source = sources.get(id);
  if (!source) return null;
  const clone = source.scene.clone(true) as THREE.Group;
  clone.name = `Authored ${id}`;
  const clonedMaterials = new Map<THREE.Material, THREE.Material>();
  const cloneMaterial = (sourceMaterial: THREE.Material) => {
    const cached = clonedMaterials.get(sourceMaterial);
    if (cached) return cached;
    const material = sourceMaterial.clone();
    material.userData.sharedEnvironmentAsset = false;
    const standard = material as THREE.MeshStandardMaterial;
    if (standard.isMeshStandardMaterial) {
      const name = standard.name.toLowerCase();
      if (name.includes("plaster")) {
        standard.color.set(0xfffff4);
        standard.emissive.set(0xffedc9);
        standard.emissiveMap = standard.map;
        standard.emissiveIntensity = 0.18;
        standard.roughness = 0.82;
      } else if (name.includes("roundtiles")) {
        standard.color.set(0xff9b61);
        standard.roughness = 0.74;
      } else if (name.includes("woodtrim")) {
        standard.color.set(id === "Window_Wide_Round1" ? 0x4f947a : 0xc28a60);
        standard.roughness = 0.78;
      } else if (name.includes("brick") || name.includes("rock")) {
        standard.color.set(0xffead0);
        standard.emissive.set(0xc99f73);
        standard.emissiveMap = standard.map;
        standard.emissiveIntensity = 0.055;
        standard.roughness = 0.9;
      } else if (name.includes("windowglass")) {
        standard.color.set(0x8abfd0);
        standard.roughness = 0.24;
        standard.metalness = 0.04;
        standard.envMapIntensity = 0.86;
      } else if (name.includes("leaves")) {
        standard.color.set(0xdfffaa);
        standard.emissive.set(0x9bd85f);
        standard.emissiveMap = standard.map;
        standard.emissiveIntensity = 0.32;
        standard.roughness = 0.84;
      } else if (name === "grass" || name.includes("flower")) {
        standard.color.multiplyScalar(1.18);
        standard.emissive.copy(standard.color);
        standard.emissiveMap = standard.map;
        standard.emissiveIntensity = 0.08;
      }
    }
    clonedMaterials.set(sourceMaterial, material);
    return material;
  };
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(cloneMaterial)
      : cloneMaterial(mesh.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.geometry.userData.sharedEnvironmentAsset = true;
  });
  return clone;
}

const assets: AuthoredEnvironmentAssets = {
  clone: cloneSource,
};

/**
 * Preloads the self-contained CC0 town kit. Failed files are omitted and the
 * caller can retain the procedural district as a complete fallback.
 */
export function preloadAuthoredEnvironment(): Promise<AuthoredEnvironmentAssets | null> {
  if (preloadPromise) return preloadPromise;
  if (typeof document === "undefined") return Promise.resolve(null);
  const loader = new GLTFLoader();
  preloadPromise = Promise.allSettled(
    [...paths].map(async ([id, path]) => {
      const gltf = await loader.loadAsync(assetUrl(path));
      prepareSource(gltf);
      sources.set(id, gltf);
    }),
  ).then(() => {
    const required: readonly AuthoredEnvironmentAssetId[] = [
      "Wall_Plaster_Straight",
      "Wall_Plaster_Door_Round",
      "Door_1_Round",
      "Wall_Plaster_Window_Wide_Round",
      "Window_Wide_Round1",
      "Roof_RoundTiles_4x6",
      "Floor_UnevenBrick",
      "CommonTree_1",
    ];
    return required.every((id) => sources.has(id)) ? assets : null;
  });
  return preloadPromise;
}

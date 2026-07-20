"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  createCharacter,
  groundCharacterToPlane,
  updateCharacter,
  type Character,
  type CharacterProfile,
  type CharacterState,
} from "./game/characters";
import { createTown, type TownSceneName } from "./game/environment";
import {
  preloadAuthoredEnvironment,
  type AuthoredEnvironmentAssets,
} from "./game/environmentAssets";
import {
  attachResidentPuppet,
  disposeResidentPuppet,
  faceResidentPuppetToCamera,
  groundResidentPuppet,
  preloadResidentPuppets,
  updateResidentPuppet,
  type ResidentPuppetPack,
  type ResidentPuppetRuntime,
} from "./game/residentPuppet";
import {
  createWorldDirector,
  type CircularObstacle,
  type PointLike,
  type ResidentDefinition,
  type ResidentHandle,
} from "./game/worldSystems";

type Props = {
  scene: string;
  selectedId: string | number;
  residents: CharacterProfile[];
  actionCue?: { kind: "talk" | "food" | "play" | "rest"; token: number } | null;
  timeOfDay?: "day" | "sunset" | "night";
  weatherMode?: "clear" | "rain" | "snow";
  cinematicView?: boolean;
};

type SceneComposition = {
  target: THREE.Vector3;
  camera: THREE.Vector3;
  points: THREE.Vector3[];
  starts: THREE.Vector3[];
};

type TimeOfDay = "day" | "sunset" | "night";
type WeatherMode = "clear" | "rain" | "snow";
type RenderState = "loading" | "ready" | "lost" | "error";
type CameraFocus = { kind: "talk" | "food" | "play" | "rest"; until: number };
type SeatAnchor = { position: THREE.Vector3; yaw: number };
type WorldRuntime = {
  director: ReturnType<typeof createWorldDirector>;
  characters: Character[];
  clock: THREE.Clock;
  focus: CameraFocus | null;
  controlMode: "auto" | "keyboard" | "pointer";
  openingPortraitLocked: boolean;
  seats: SeatAnchor[];
};
type WeatherLayer = { group: THREE.Object3D; update: (time: number) => void };

const SUPPORTING_RESIDENTS: CharacterProfile[] = [
  {
    id: "npc-millet",
    name: "米粒",
    skin: "#f3b58e",
    hair: "#304e58",
    shirt: "#ebba43",
    hairStyle: 1,
    faceShape: 1,
    eyeStyle: 2,
    browStyle: 0,
    noseStyle: 0,
    mouthStyle: 0,
    outfitStyle: 1,
    trait: "好奇开朗",
  },
  {
    id: "npc-yoyo",
    name: "悠悠",
    skin: "#8f573e",
    hair: "#211d21",
    shirt: "#59a985",
    hairStyle: 3,
    faceShape: 0,
    eyeStyle: 0,
    browStyle: 1,
    noseStyle: 1,
    mouthStyle: 0,
    outfitStyle: 2,
    trait: "温柔可靠",
  },
  {
    id: "npc-north",
    name: "小北",
    skin: "#ffd0a6",
    hair: "#8d4e32",
    shirt: "#627fc7",
    hairStyle: 0,
    faceShape: 2,
    eyeStyle: 1,
    browStyle: 2,
    noseStyle: 2,
    mouthStyle: 1,
    outfitStyle: 0,
    trait: "慢热认真",
  },
  {
    id: "npc-lan",
    name: "阿岚",
    skin: "#c9845c",
    hair: "#2d211d",
    shirt: "#df718e",
    hairStyle: 2,
    faceShape: 1,
    eyeStyle: 2,
    browStyle: 1,
    noseStyle: 0,
    mouthStyle: 2,
    outfitStyle: 1,
    trait: "活泼大胆",
  },
  {
    id: "npc-lele",
    name: "乐乐",
    skin: "#5b382c",
    hair: "#17191f",
    shirt: "#e9824f",
    hairStyle: 1,
    faceShape: 0,
    eyeStyle: 0,
    browStyle: 0,
    noseStyle: 1,
    mouthStyle: 0,
    outfitStyle: 2,
    trait: "幽默淘气",
  },
];

const SCENE_COMPOSITIONS: Record<TownSceneName, SceneComposition> = {
  home: {
    // Street portrait: a full home on the right, mature tree on the left and
    // three residents on the cobbled foreground, while remaining a real map.
    target: new THREE.Vector3(-10.7, 2.5, 5.95),
    camera: new THREE.Vector3(-10.7, 5.25, 18.8),
    points: [
      new THREE.Vector3(-10.9, 0, 6.38),
      new THREE.Vector3(-12.75, 0, 6.46),
      new THREE.Vector3(-9.05, 0, 6.42),
      new THREE.Vector3(-3.1, 0, 2.8),
      new THREE.Vector3(-7.8, 0, 0.5),
      new THREE.Vector3(-11.8, 0, 7.6),
      new THREE.Vector3(-6.7, 0, 8.5),
      new THREE.Vector3(-2.8, 0, 8.2),
    ],
    starts: [
      new THREE.Vector3(-12.75, 0, 6.46),
      new THREE.Vector3(-10.9, 0, 6.38),
      new THREE.Vector3(-9.05, 0, 6.42),
      new THREE.Vector3(-3.1, 0, 2.65),
      new THREE.Vector3(-7.6, 0, 0.55),
      new THREE.Vector3(-11.5, 0, 7.5),
      new THREE.Vector3(-6.5, 0, 8.45),
      new THREE.Vector3(-2.9, 0, 8.1),
    ],
  },
  plaza: {
    target: new THREE.Vector3(-7.7, 1.55, -4.5),
    camera: new THREE.Vector3(6.1, 10.1, 10.1),
    points: [
      new THREE.Vector3(-10.9, 0, -5.2),
      new THREE.Vector3(-4.5, 0, -5.2),
      new THREE.Vector3(-7.7, 0, -1.7),
      new THREE.Vector3(-7.7, 0, -8.7),
      new THREE.Vector3(-4.2, 0, -1.8),
      new THREE.Vector3(-11.4, 0, -1.8),
      new THREE.Vector3(-3.1, 0, 0),
      new THREE.Vector3(-12.1, 0, -8.4),
    ],
    starts: [
      new THREE.Vector3(-10.9, 0, -5.15),
      new THREE.Vector3(-10.4, 0, -3.15),
      new THREE.Vector3(-4.8, 0, -5.2),
      new THREE.Vector3(-5.2, 0, -2.1),
      new THREE.Vector3(-7.7, 0, -8.4),
      new THREE.Vector3(-3.2, 0, -0.1),
      new THREE.Vector3(-11.7, 0, -1.7),
      new THREE.Vector3(-12, 0, -8.2),
    ],
  },
  cafe: {
    target: new THREE.Vector3(7.5, 1.75, 1.1),
    camera: new THREE.Vector3(20.8, 9.3, 15.9),
    points: [
      new THREE.Vector3(7.9, 0, 1.2),
      new THREE.Vector3(5.2, 0, -0.1),
      new THREE.Vector3(3, 0, -0.1),
      new THREE.Vector3(8.1, 0, 3.1),
      new THREE.Vector3(11.1, 0, 4.8),
      new THREE.Vector3(8.3, 0, 5.7),
      new THREE.Vector3(5.2, 0, 5.7),
      new THREE.Vector3(12.1, 0, 1.1),
    ],
    starts: [
      new THREE.Vector3(7.9, 0, 1.3),
      new THREE.Vector3(6.2, 0, 1.45),
      new THREE.Vector3(5, 0, -0.1),
      new THREE.Vector3(3.1, 0, 0),
      new THREE.Vector3(8.1, 0, 3.4),
      new THREE.Vector3(11, 0, 4.7),
      new THREE.Vector3(5.1, 0, 5.6),
      new THREE.Vector3(12, 0, 1.2),
    ],
  },
  shop: {
    target: new THREE.Vector3(0, 1.55, -0.7),
    camera: new THREE.Vector3(8.8, 6.8, 11.8),
    points: [
      new THREE.Vector3(-1.6, 0, 2.4),
      new THREE.Vector3(0, 0, 2.8),
      new THREE.Vector3(2, 0, -1.6),
      new THREE.Vector3(2.2, 0, 1.4),
      new THREE.Vector3(-2.4, 0, -1.2),
      new THREE.Vector3(0.2, 0, 0.6),
    ],
    starts: [
      new THREE.Vector3(-1.6, 0, 2.4),
      new THREE.Vector3(0, 0, 2.8),
      new THREE.Vector3(2, 0, -1.6),
      new THREE.Vector3(2.2, 0, 1.4),
      new THREE.Vector3(-2.4, 0, -1.2),
      new THREE.Vector3(0.2, 0, 0.6),
    ],
  },
  interior: {
    target: new THREE.Vector3(0, 1.5, -0.6),
    camera: new THREE.Vector3(8.2, 6.5, 11.2),
    points: [
      new THREE.Vector3(-1.2, 0, 1.7),
      new THREE.Vector3(1, 0, 2.5),
      new THREE.Vector3(0, 0, -1.2),
      new THREE.Vector3(2.3, 0, 0.5),
      new THREE.Vector3(-2.5, 0, -0.4),
      new THREE.Vector3(0.6, 0, 0.8),
    ],
    starts: [
      new THREE.Vector3(-1.2, 0, 1.7),
      new THREE.Vector3(1, 0, 2.5),
      new THREE.Vector3(0, 0, -1.2),
      new THREE.Vector3(2.3, 0, 0.5),
      new THREE.Vector3(-2.5, 0, -0.4),
      new THREE.Vector3(0.6, 0, 0.8),
    ],
  },
};

const CINEMATIC_VIEWS: Partial<
  Record<TownSceneName, { target: THREE.Vector3; camera: THREE.Vector3; fov: number }>
> = {
  home: {
    // Front-facing town portrait: the house stays fully readable behind three
    // evenly spaced residents, matching the accepted key-art composition.
    target: new THREE.Vector3(-10.7, 2.5, 5.95),
    camera: new THREE.Vector3(-10.7, 5.25, 18.8),
    fov: 31,
  },
  plaza: {
    target: new THREE.Vector3(-7.7, 2.5, -4.5),
    camera: new THREE.Vector3(5, 7.2, 6.5),
    fov: 34,
  },
  cafe: {
    target: new THREE.Vector3(7.9, 3, -1.4),
    camera: new THREE.Vector3(8.5, 11, 29),
    fov: 35,
  },
};

const TOWN_OBSTACLES: CircularObstacle[] = [
  { position: [-9.8, 3.1], radius: 2.3 },
  { position: [-15.2, 2.6], radius: 2.15 },
  { position: [-15.2, -8.9], radius: 2.15 },
  { position: [-3.1, -12.6], radius: 2.1 },
  { position: [8.6, -10.5], radius: 2.15 },
  { position: [14.7, -8.5], radius: 2.15 },
  { position: [14.5, 9.8], radius: 2.1 },
  { position: [7.9, -2.2], radius: 2.7 },
  { position: [8.4, 7.65], radius: 2.5 },
  { position: [-7.7, -5.2], radius: 1.55 },
  { position: [-8.5, 10.2], radius: 2.25 },
];

// The current home map replaced the old lily pond with a walkable promenade;
// keep that legacy pond collider only in the plaza/cafe version of the town.
const HOME_OBSTACLES = TOWN_OBSTACLES.slice(0, -1);

const INDOOR_BOUNDS = { minX: -4.1, maxX: 4.1, minZ: -3.2, maxZ: 3.35, y: 0 };
const OUTDOOR_BOUNDS = { minX: -19, maxX: 19, minZ: -16.5, maxZ: 16.5, y: 0 };

function pointXZ(point: PointLike): readonly [number, number] {
  if ("x" in point) return [point.x, point.z];
  return point.length > 2 ? [point[0], point[2]] : [point[0], point[1]];
}

function segmentClearsObstacles(
  start: THREE.Vector3,
  destination: THREE.Vector3,
  obstacles: readonly CircularObstacle[],
  residentRadius: number,
): boolean {
  const segmentX = destination.x - start.x;
  const segmentZ = destination.z - start.z;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  for (const obstacle of obstacles) {
    const [obstacleX, obstacleZ] = pointXZ(obstacle.position);
    const projection = lengthSquared > 0.0001
      ? THREE.MathUtils.clamp(
          ((obstacleX - start.x) * segmentX + (obstacleZ - start.z) * segmentZ) / lengthSquared,
          0,
          1,
        )
      : 0;
    const nearestX = start.x + segmentX * projection;
    const nearestZ = start.z + segmentZ * projection;
    const clearance = Math.max(0, obstacle.radius) + residentRadius + 0.1;
    const dx = nearestX - obstacleX;
    const dz = nearestZ - obstacleZ;
    if (dx * dx + dz * dz < clearance * clearance) return false;
  }
  return true;
}

function minimumCollisionClearance(
  residents: readonly ResidentHandle[],
  obstacles: readonly CircularObstacle[],
): number {
  let minimum = Number.POSITIVE_INFINITY;
  const positions = residents.map((resident) => resident.group.getWorldPosition(new THREE.Vector3()));
  for (let index = 0; index < residents.length; index += 1) {
    const resident = residents[index]!;
    const position = positions[index]!;
    for (const obstacle of obstacles) {
      const [x, z] = pointXZ(obstacle.position);
      minimum = Math.min(
        minimum,
        Math.hypot(position.x - x, position.z - z) - resident.radius - Math.max(0, obstacle.radius) - 0.035,
      );
    }
    for (let otherIndex = index + 1; otherIndex < residents.length; otherIndex += 1) {
      const other = residents[otherIndex]!;
      const otherPosition = positions[otherIndex]!;
      minimum = Math.min(
        minimum,
        Math.hypot(position.x - otherPosition.x, position.z - otherPosition.z) - resident.radius - other.radius - 0.045,
      );
    }
  }
  return minimum;
}

function sceneName(value: string): TownSceneName {
  return value === "plaza" || value === "cafe" || value === "shop" || value === "interior"
    ? value
    : "home";
}

function chooseResidents(
  residents: CharacterProfile[],
  selectedId: string | number,
): CharacterProfile[] {
  const chosen = residents.find((resident) => String(resident.id) === String(selectedId));
  const ordered = chosen
    ? [chosen, ...residents.filter((resident) => resident !== chosen)]
    : [...residents];
  const ids = new Set(ordered.map((resident) => String(resident.id)));
  for (const resident of SUPPORTING_RESIDENTS) {
    if (ordered.length >= 6) break;
    if (!ids.has(String(resident.id))) {
      ordered.push(resident);
      ids.add(String(resident.id));
    }
  }
  return ordered.slice(0, 6);
}

function prepareProfile(profile: CharacterProfile): CharacterProfile {
  const traitKeywords: Record<string, string> = {
    天马行空: "creative music",
    热情冒险: "brave adventure",
    温柔细腻: "gentle caring",
    冷静可靠: "smart curious",
    幽默淘气: "funny playful",
    好奇开朗: "curious bright",
    温柔可靠: "gentle caring",
    慢热认真: "smart thoughtful",
    活泼大胆: "brave active",
  };
  return {
    ...profile,
    trait: `${profile.trait} ${traitKeywords[profile.trait] ?? ""}`.trim(),
  };
}

function createNameTag(name: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.shadowColor = "rgba(38, 54, 65, 0.26)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 10;
    context.fillStyle = "rgba(255, 253, 245, 0.97)";
    context.beginPath();
    context.roundRect(34, 22, 444, 106, 48);
    context.fill();
    context.shadowColor = "transparent";
    context.fillStyle = "#efbd35";
    context.beginPath();
    context.arc(78, 75, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#2f4350";
    context.font = '700 49px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textBaseline = "middle";
    context.fillText(name.slice(0, 8), 110, 77, 330);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = "selected-resident-name";
  sprite.position.set(0, 3.68, 0);
  sprite.scale.set(2.48, 0.76, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function createSelectionRing(): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    color: "#ffe15a",
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32), material);
  ring.name = "selected-resident-ring";
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  ring.renderOrder = 3;
  return ring;
}

function createCharacterContactShadow(): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 30);
    gradient.addColorStop(0, "rgba(43, 48, 38, 0.52)");
    gradient.addColorStop(0.42, "rgba(43, 48, 38, 0.27)");
    gradient.addColorStop(1, "rgba(43, 48, 38, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.28, 0.62),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  shadow.name = "resident-contact-shadow";
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  shadow.renderOrder = 2;
  return shadow;
}

function createAtmosphere(center: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.name = "floating-petals";
  group.position.copy(center);
  const colors = ["#fff6bd", "#ffffff", "#f9a5b9", "#a9e4ef"];
  for (let index = 0; index < 22; index += 1) {
    const petal = new THREE.Mesh(
      new THREE.CircleGeometry(0.045 + (index % 4) * 0.012, 8),
      new THREE.MeshBasicMaterial({
        color: colors[index % colors.length],
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const angle = index * 2.399;
    const radius = 2.4 + (index % 7) * 0.72;
    petal.position.set(Math.cos(angle) * radius, 1.1 + (index % 6) * 0.48, Math.sin(angle) * radius);
    petal.userData.baseY = petal.position.y;
    petal.userData.phase = index * 0.77;
    group.add(petal);
  }
  return group;
}

function createSkyTexture(timeOfDay: TimeOfDay): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    const palette = timeOfDay === "night"
      ? ["#18264c", "#315582", "#7d94b4", "#d8b9a8"]
      : timeOfDay === "sunset"
        ? ["#667fc4", "#e9a37f", "#f6c68c", "#f7e0ba"]
        : ["#3f9fe8", "#78c7f2", "#bce7f7", "#edf7ef"];
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.48, palette[1]);
    gradient.addColorStop(0.78, palette[2]);
    gradient.addColorStop(1, palette[3]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (timeOfDay === "night") {
      context.fillStyle = "rgba(255,255,220,.82)";
      for (let index = 0; index < 34; index += 1) {
        const x = (index * 17) % canvas.width;
        const y = 18 + ((index * 43) % 210);
        context.fillRect(x, y, index % 5 === 0 ? 2 : 1, index % 5 === 0 ? 2 : 1);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createWeatherLayer(
  mode: WeatherMode,
  center: THREE.Vector3,
): WeatherLayer | null {
  if (mode === "clear") return null;

  if (mode === "rain") {
    const count = 320;
    const positions = new Float32Array(count * 6);
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute("position", attribute);
    const material = new THREE.LineBasicMaterial({
      color: "#b8e3ff",
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.name = "rain-layer";
    lines.frustumCulled = false;
    lines.renderOrder = 12;
    const update = (time: number) => {
      for (let index = 0; index < count; index += 1) {
        const angle = index * 2.399963;
        const radius = 1.6 + ((index * 67) % 100) * 0.125;
        const x = center.x + Math.cos(angle) * radius;
        const z = center.z + Math.sin(angle) * radius;
        const speed = 5.8 + (index % 11) * 0.22;
        const y = 8.8 - ((time * speed + index * 0.37) % 10.2);
        const offset = index * 6;
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        positions[offset + 3] = x - 0.08;
        positions[offset + 4] = y - 0.62;
        positions[offset + 5] = z + 0.05;
      }
      attribute.needsUpdate = true;
    };
    update(0);
    return { group: lines, update };
  }

  const count = 420;
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);
  const material = new THREE.PointsMaterial({
    color: "#ffffff",
    size: 0.105,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const snow = new THREE.Points(geometry, material);
  snow.name = "snow-layer";
  snow.frustumCulled = false;
  snow.renderOrder = 12;
  const update = (time: number) => {
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const radius = 1.2 + ((index * 71) % 120) * 0.105;
      const speed = 0.48 + (index % 9) * 0.035;
      const offset = index * 3;
      positions[offset] = center.x + Math.cos(angle) * radius + Math.sin(time * 0.7 + index) * 0.22;
      positions[offset + 1] = 7.8 - ((time * speed + index * 0.19) % 8.2);
      positions[offset + 2] = center.z + Math.sin(angle) * radius + Math.cos(time * 0.45 + index) * 0.18;
    }
    attribute.needsUpdate = true;
  };
  update(0);
  return { group: snow, update };
}

function disposeWorld(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  if (scene.background instanceof THREE.Texture) textures.add(scene.background);
  if (scene.environment instanceof THREE.Texture) textures.add(scene.environment);

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite || object instanceof THREE.Line || object instanceof THREE.Points)) return;
    if (
      object.geometry
      && !object.geometry.userData.sharedCharacterAsset
      && !object.geometry.userData.sharedEnvironmentAsset
    ) {
      geometries.add(object.geometry);
    }
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      if (material) materials.add(material);
    }
  });

  for (const material of materials) {
    if (
      material.userData.shared === true
      || material.userData.sharedCharacterAsset === true
      || material.userData.sharedEnvironmentAsset === true
    ) continue;
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value);
    }
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) {
    if (
      texture.userData.shared !== true
      && texture.userData.sharedCharacterAsset !== true
      && texture.userData.sharedEnvironmentAsset !== true
    ) texture.dispose();
  }
}

export default function World3D({
  scene,
  selectedId,
  residents,
  actionCue,
  timeOfDay = "day",
  weatherMode = "clear",
  cinematicView = false,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [renderState, setRenderState] = useState<RenderState>("loading");
  const [environmentAssetsSettled, setEnvironmentAssetsSettled] = useState(false);
  const [residentPuppetsSettled, setResidentPuppetsSettled] = useState(false);
  const environmentAssetsRef = useRef<AuthoredEnvironmentAssets | null>(null);
  const residentPuppetsRef = useRef<ResidentPuppetPack | null>(null);
  const residentsRef = useRef(residents);
  const runtimeRef = useRef<WorldRuntime | null>(null);
  const residentAppearanceKey = residents
    .map((resident) =>
      [
        resident.id,
        resident.name,
        resident.skin,
        resident.hair,
        resident.shirt,
        resident.hairStyle,
        resident.faceShape,
        resident.eyeStyle,
        resident.browStyle,
        resident.noseStyle,
        resident.mouthStyle,
        resident.outfitStyle,
        resident.trait,
      ].join("~"),
    )
    .join("|");

  useEffect(() => {
    residentsRef.current = residents;
  }, [residents]);

  useEffect(() => {
    let active = true;
    preloadAuthoredEnvironment()
      .then((assets) => {
        environmentAssetsRef.current = assets;
      })
      .finally(() => {
        if (!active) return;
        setEnvironmentAssetsSettled(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    preloadResidentPuppets()
      .then((assets) => {
        residentPuppetsRef.current = assets;
      })
      .catch(() => {
        residentPuppetsRef.current = null;
      })
      .finally(() => {
        if (!active) return;
        setResidentPuppetsSettled(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!environmentAssetsSettled || !residentPuppetsSettled) {
      queueMicrotask(() => setRenderState("loading"));
      return;
    }

    queueMicrotask(() => setRenderState("loading"));

    const location = sceneName(scene);
    const indoor = location === "shop" || location === "interior";
    const composition = SCENE_COMPOSITIONS[location];
    const cinematic = !indoor && cinematicView
      ? CINEMATIC_VIEWS[location]
      : undefined;
    const viewCamera = cinematic?.camera ?? composition.camera;
    const viewTarget = cinematic?.target ?? composition.target;
    const viewFov = cinematic?.fov ?? (location === "home" ? 31 : indoor ? 34 : 33);
    const profiles = chooseResidents(residentsRef.current, selectedId).slice(
      0,
      location === "home" ? 3 : 4,
    );
    const world = new THREE.Scene();
    world.name = "Sunny Side Stories";
    const skyTexture = createSkyTexture(timeOfDay);
    world.background = skyTexture;
    world.environment = skyTexture;
    world.environmentIntensity = indoor ? 0.42 : timeOfDay === "night" ? 0.28 : 0.48;
    const fogColor = timeOfDay === "night" ? "#243653" : timeOfDay === "sunset" ? "#ddb8a8" : "#c9e9f3";
    world.fog = new THREE.Fog(
      fogColor,
      indoor ? 18 : timeOfDay === "night" ? 38 : 42,
      indoor ? 48 : timeOfDay === "night" ? 82 : 110,
    );

    const width = Math.max(1, element.clientWidth);
    const height = Math.max(1, element.clientHeight);
    const camera = new THREE.PerspectiveCamera(viewFov, width / height, 0.1, 140);
    camera.position.copy(viewCamera);
    camera.lookAt(viewTarget);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setRenderState("error"));
      return () => disposeWorld(world);
    }
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral tone mapping keeps the warm plaster, terracotta and spring
    // greens vivid. ACES was compressing this intentionally cheerful palette
    // into the grey/brown cast visible in the previous build.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = timeOfDay === "night"
      ? (indoor ? 1.14 : 1.2)
      : timeOfDay === "sunset"
        ? 1.17
        : 1.25;
    renderer.domElement.style.imageRendering = "auto";
    element.replaceChildren(renderer.domElement);

    const skyLight = new THREE.HemisphereLight(
      timeOfDay === "night" ? "#7894c8" : timeOfDay === "sunset" ? "#ffe1c4" : "#e6f6ff",
      timeOfDay === "night" ? "#18243d" : timeOfDay === "sunset" ? "#806a72" : "#a8bb91",
      indoor ? (timeOfDay === "night" ? 1.02 : 1.25) : timeOfDay === "night" ? 1.16 : timeOfDay === "sunset" ? 1.04 : 1.28,
    );
    world.add(skyLight);
    const sun = new THREE.DirectionalLight(
      timeOfDay === "night" ? "#aac8ff" : timeOfDay === "sunset" ? "#ffb06d" : "#fff1d2",
      indoor ? (timeOfDay === "night" ? 1.02 : 1.42) : timeOfDay === "night" ? 1.08 : timeOfDay === "sunset" ? 2.12 : 2.24,
    );
    sun.position.copy(composition.target).add(
      timeOfDay === "sunset" ? new THREE.Vector3(-24, 12, 10) : new THREE.Vector3(-17, 26, 15),
    );
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    const shadowExtent = indoor ? 8 : 15.5;
    sun.shadow.camera.left = -shadowExtent;
    sun.shadow.camera.right = shadowExtent;
    sun.shadow.camera.top = shadowExtent;
    sun.shadow.camera.bottom = -shadowExtent;
    sun.shadow.radius = 4.5;
    sun.shadow.bias = -0.00018;
    sun.shadow.normalBias = 0.012;
    sun.target.position.copy(composition.target);
    world.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(
      timeOfDay === "night" ? "#5579c2" : timeOfDay === "sunset" ? "#9f8bd5" : "#badff0",
      indoor ? 0.5 : timeOfDay === "night" ? 0.84 : timeOfDay === "sunset" ? 0.44 : 0.48,
    );
    fill.position.copy(composition.target).add(new THREE.Vector3(16, 9, -12));
    world.add(fill);
    const portraitFill = new THREE.DirectionalLight(
      timeOfDay === "night" ? "#ffe5be" : "#fff7e8",
      indoor ? 0.18 : timeOfDay === "night" ? 0.52 : 0.3,
    );
    portraitFill.position.copy(viewCamera);
    portraitFill.target.position.copy(viewTarget);
    world.add(portraitFill, portraitFill.target);
    if (!indoor && timeOfDay !== "day") {
      const lampOffsets = [
        new THREE.Vector3(-3.8, 3.15, 2.8),
        new THREE.Vector3(3.5, 3.05, -1.8),
        new THREE.Vector3(0.4, 2.75, 5.1),
      ];
      for (const offset of lampOffsets) {
        const lampGlow = new THREE.PointLight(
          timeOfDay === "night" ? "#ffd38a" : "#ffca8c",
          timeOfDay === "night" ? 0.72 : 0.34,
          14,
          1.65,
        );
        lampGlow.position.copy(composition.target).add(offset);
        world.add(lampGlow);
      }
    }
    if (!indoor) {
      const softAmbient = new THREE.AmbientLight(
        timeOfDay === "night" ? "#7390c4" : timeOfDay === "sunset" ? "#ffe1c8" : "#fff9e9",
        timeOfDay === "night" ? 0.3 : timeOfDay === "sunset" ? 0.14 : 0.2,
      );
      world.add(softAmbient);
    }
    if (indoor) {
      const roomGlow = new THREE.AmbientLight(timeOfDay === "night" ? "#ffc982" : "#fff0d4", timeOfDay === "night" ? 0.72 : 0.34);
      world.add(roomGlow);
    }

    const town = createTown(location, environmentAssetsRef.current);
    town.group.visible = true;
    world.add(town.group);
    const sceneObstacles = indoor
      ? []
      : town.obstacles ?? (location === "home" ? HOME_OBSTACLES : TOWN_OBSTACLES);

    const characterByGroup = new Map<THREE.Group, Character>();
    const characters: Character[] = profiles.map((profile, index) => {
      const preparedProfile = prepareProfile(profile);
      // V2 rebuild: the modular Sunny resident is the canonical character in
      // both the world and creator. It is built around our life-sim turnaround
      // instead of the mismatched anime GLBs used by the previous prototype.
      const character = createCharacter(preparedProfile);
      const residentPuppetPack = residentPuppetsRef.current;
      if (residentPuppetPack) {
        attachResidentPuppet(character, preparedProfile, residentPuppetPack);
      }
      const start = composition.starts[index % composition.starts.length];
      character.group.position.copy(start);
      const sceneScale = location === "home"
        ? index === 0
          ? 0.88
          : 0.84 + (index % 2) * 0.012
        : index === 0
          ? indoor
            ? 0.56
            : 0.72
          : (indoor ? 0.53 : 0.68) + (index % 3) * 0.006;
      character.group.scale.setScalar(sceneScale);
      if (indoor) character.group.rotation.y = index % 2 === 0 ? 0.18 : -0.28;
      else {
        character.group.lookAt(viewCamera.x, 0, viewCamera.z);
      }
      character.group.userData.isSelected = index === 0;
      if (!residentPuppetPack) character.group.add(createCharacterContactShadow());
      character.group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
          const radius = object.geometry.boundingSphere?.radius ?? 0;
          const material = Array.isArray(object.material) ? object.material[0] : object.material;
          const isSurfaceDetail =
            object.geometry instanceof THREE.CircleGeometry ||
            object.geometry instanceof THREE.TorusGeometry ||
            object.geometry instanceof THREE.PlaneGeometry;
          const isOpaque = !material?.transparent || material.opacity >= 0.96;
          object.castShadow = radius >= 0.16 && !isSurfaceDetail && isOpaque;
          object.receiveShadow = radius >= 0.22 && !isSurfaceDetail;
        }
      });
      world.add(character.group);
      characterByGroup.set(character.group, character);
      return character;
    });
    const openingResidentAnchors = characters.slice(0, 3).map((character) => ({
      position: character.group.position.clone(),
      yaw: character.group.rotation.y,
    }));

    const selected = characters[0];
    const selectionRing = createSelectionRing();
    const nameTag = createNameTag(selected.profile.name);
    const selectedTagHeight = Number(selected.group.userData.displayHeight) || 3.68;
    nameTag.position.y = selectedTagHeight;
    if (selected.assetRuntime) nameTag.scale.set(1.88, 0.58, 1);
    selected.group.add(selectionRing, nameTag);

    const definitions: ResidentDefinition[] = characters.map((character, index) => ({
      id: String(character.profile.id),
      group: character.group,
      initialState: index < 3 ? "idle" : index % 3 === 2 ? "idle" : "walk",
      targetPoints: composition.points,
      walkSpeed: (indoor ? 0.42 : 0.58) + (index % 3) * 0.05,
      runSpeed: (indoor ? 0.78 : 1.15) + (index % 2) * 0.1,
      radius: 0.34,
      turnSpeed: 7.5,
      acceleration: 7,
      durations: {
        idle: [1.4, 3.6],
        walk: [3.8, 7.5],
        run: [2.2, 4.2],
        talk: [4.4, 7.2],
        eat: [3.2, 5.8],
        sit: [3.5, 6.5],
      },
      userData: character,
    }));

    const director = createWorldDirector({
      residents: definitions,
      targetPoints: composition.points as PointLike[],
      bounds: indoor ? INDOOR_BOUNDS : OUTDOOR_BOUNDS,
      obstacles: sceneObstacles,
      arrivalDistance: 0.14,
      avoidancePadding: 0.22,
      avoidanceStrength: 1.7,
      conversationDistance: 1.55,
      conversationRate: 0.3,
      conversationCooldown: 5,
      camera,
      cameraOptions: {
        target: composition.target,
        positionDamping: 2,
        targetDamping: 4,
        minFov: 24,
        maxFov: 43,
      },
      applyAnimation(group, state, elapsed, delta) {
        const character = characterByGroup.get(group);
        if (character) {
          updateCharacter(character, state as CharacterState, elapsed, delta);
          updateResidentPuppet(character, state as CharacterState, elapsed, delta);
        }
      },
    });
    director.camera?.cut(viewCamera, viewTarget, viewFov);
    // The first resident is the player avatar. Keep them at the readable
    // arrival spot until the player gives keyboard or pointer input, while
    // every other resident continues their autonomous town routine.
    director.setControl(selected.group, { direction: [0, 0], run: false });

    if (director.residents[3]) director.setState(director.residents[3], "eat", { duration: 5.6 });
    if (director.residents[4]) director.setState(director.residents[4], "sit", { duration: 6.2 });
    if (director.residents[5]) {
      director.moveTo(director.residents[5], composition.points[2], { run: true, duration: 4.4 });
    }

    const atmosphere = createAtmosphere(composition.target);
    // Keep the reference scene clean and readable. The old floating circles
    // could cross the camera as dark discs on some WebGL drivers.
    atmosphere.visible = false;
    world.add(atmosphere);
    const weather = indoor ? null : createWeatherLayer(weatherMode, composition.target);
    if (weather) world.add(weather.group);

    const clock = new THREE.Clock();
    const seats = town.benches.flatMap((bench): SeatAnchor[] => {
      const position = bench.userData.sitPosition;
      if (!(position instanceof THREE.Vector3)) return [];
      return [{ position: position.clone().setY(0), yaw: Number(bench.userData.sitYaw) || 0 }];
    });
    runtimeRef.current = {
      director,
      characters,
      clock,
      focus: null,
      controlMode: "auto",
      openingPortraitLocked: location === "home",
      seats,
    };
    const pressedKeys = new Set<string>();
    const movementKeys = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowLeft",
      "ArrowDown",
      "ArrowRight",
    ]);
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (movementKeys.has(event.code)) {
        event.preventDefault();
        pressedKeys.add(event.code);
        const runtime = runtimeRef.current;
        if (runtime?.director === director) {
          runtime.controlMode = "keyboard";
          runtime.focus = null;
          runtime.openingPortraitLocked = false;
        }
      } else if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        pressedKeys.add(event.code);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (movementKeys.has(event.code)) event.preventDefault();
      pressedKeys.delete(event.code);
    };
    const handleWindowBlur = () => {
      pressedKeys.clear();
      const runtime = runtimeRef.current;
      if (runtime?.director === director && runtime.controlMode === "keyboard") {
        director.setControl(selected.group, { direction: [0, 0], run: false });
      }
    };
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("blur", handleWindowBlur);

    const navigationBounds = indoor ? INDOOR_BOUNDS : OUTDOOR_BOUNDS;
    const navigationObstacles = sceneObstacles;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const pointerDestination = new THREE.Vector3();
    const pointerStart = new THREE.Vector3();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rectangle = renderer.domElement.getBoundingClientRect();
      if (rectangle.width < 1 || rectangle.height < 1) return;
      pointerNdc.set(
        ((event.clientX - rectangle.left) / rectangle.width) * 2 - 1,
        -((event.clientY - rectangle.top) / rectangle.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointerNdc, camera);
      if (!raycaster.ray.intersectPlane(groundPlane, pointerDestination)) return;
      const selectedResident = director.residents[0];
      if (!selectedResident) return;
      pointerDestination.x = THREE.MathUtils.clamp(
        pointerDestination.x,
        navigationBounds.minX + selectedResident.radius,
        navigationBounds.maxX - selectedResident.radius,
      );
      pointerDestination.z = THREE.MathUtils.clamp(
        pointerDestination.z,
        navigationBounds.minZ + selectedResident.radius,
        navigationBounds.maxZ - selectedResident.radius,
      );
      pointerDestination.y = 0;
      selected.group.getWorldPosition(pointerStart);
      if (!segmentClearsObstacles(
        pointerStart,
        pointerDestination,
        navigationObstacles,
        selectedResident.radius,
      )) return;
      director.setControl(selectedResident, { destination: pointerDestination, run: false });
      const runtime = runtimeRef.current;
      if (runtime?.director === director) {
        runtime.controlMode = "pointer";
        runtime.focus = null;
        runtime.openingPortraitLocked = false;
      }
      renderer.domElement.focus({ preventScroll: true });
    };
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "crosshair";
    renderer.domElement.title = "WASD / 方向键移动，按住 Shift 奔跑，也可点击道路前往";
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    const handlePhoto = () => {
      renderer.domElement.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().replaceAll(":", "-").replace("T", "-").slice(0, 19);
        link.href = downloadUrl;
        link.download = `晴天生活-${location}-${stamp}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
      }, "image/png");
    };
    window.addEventListener("sunny-life:photo", handlePhoto);

    const cameraDrift = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3();
    const focusCamera = new THREE.Vector3();
    const focusTarget = new THREE.Vector3();
    const selectedPosition = new THREE.Vector3();
    const partnerPosition = new THREE.Vector3();
    const focusSide = new THREE.Vector3();
    const actionCameraOffset = new THREE.Vector3(3.45, 1.85, 4.35);
    const restCameraOffset = new THREE.Vector3(3.1, 2.2, 4.1);
    const controlDirection = new THREE.Vector3();
    const controlForward = new THREE.Vector3();
    const controlRight = new THREE.Vector3();
    let frameId = 0;
    let lastDiagnosticAt = Number.NEGATIVE_INFINITY;
    let stopped = false;
    let contextLost = false;
    let hasPresentedFrame = false;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      hasPresentedFrame = false;
      setRenderState("lost");
    };
    const handleContextRestored = () => {
      contextLost = false;
      hasPresentedFrame = false;
      setRenderState("loading");
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);
    const render = () => {
      if (stopped) return;
      if (contextLost) {
        frameId = requestAnimationFrame(render);
        return;
      }
      const delta = Math.min(clock.getDelta(), 0.06);
      const elapsed = clock.elapsedTime;
      town.update(elapsed);
      weather?.update(elapsed);

      const runtime = runtimeRef.current;
      const focus = runtime?.focus;
      const focusActive = Boolean(focus && focus.until > elapsed);
      if (focusActive && focus) {
        selected.group.getWorldPosition(selectedPosition);
        if (focus.kind === "talk" && characters[1]) {
          characters[1].group.getWorldPosition(partnerPosition);
          focusTarget.copy(selectedPosition).lerp(partnerPosition, 0.5);
          focusTarget.y += 1.18;
          focusSide.subVectors(partnerPosition, selectedPosition).setY(0);
          if (focusSide.lengthSq() < 0.001) focusSide.set(1, 0, 0);
          focusSide.normalize().set(-focusSide.z, 0, focusSide.x);
          focusCamera.copy(focusTarget).addScaledVector(focusSide, 3.7);
          focusCamera.y += 1.55;
          focusCamera.z += 0.55;
        } else {
          focusTarget.copy(selectedPosition);
          focusTarget.y += 1.2;
          focusCamera.copy(selectedPosition).add(focus.kind === "rest" ? restCameraOffset : actionCameraOffset);
        }
        director.camera?.moveTo(focusCamera, focusTarget, {
          positionDamping: 4.8,
          targetDamping: 6.5,
          fov: focus.kind === "talk" ? 27 : 25,
        });
      } else {
        if (runtime?.focus) runtime.focus = null;
        if (location === "home" && !cinematicView) {
          // Preserve the authored street portrait until the player actually
          // starts moving. Immediate follow mode used to crop the tree, house
          // and side residents out of the opening frame.
          if (runtime?.openingPortraitLocked) {
            director.camera?.moveTo(viewCamera, viewTarget, {
              duration: 0.25,
              fov: viewFov,
              positionDamping: 7.5,
              targetDamping: 8.5,
            });
          } else {
            director.camera?.follow(selected.group, {
              offset: [1.45, 4.4, 10.5],
              targetOffset: [0, 1.05, -2.4],
              offsetSpace: "world",
              positionDamping: 2.15,
              targetDamping: 5.2,
              fov: 32,
            });
          }
        } else {
          const driftScale = indoor ? 0.38 : 1;
          cameraDrift.set(
            Math.sin(elapsed * 0.12) * 0.32 * driftScale,
            Math.sin(elapsed * 0.18 + 0.8) * 0.12 * driftScale,
            Math.cos(elapsed * 0.1) * 0.22 * driftScale,
          );
          director.camera?.moveTo(
            cameraPosition.copy(viewCamera).add(cameraDrift),
            viewTarget,
            { positionDamping: 1.5, targetDamping: 4.2, fov: viewFov },
          );
        }
      }
      if (runtime?.controlMode === "keyboard") {
        const inputX = (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight") ? 1 : 0)
          - (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft") ? 1 : 0);
        const inputForward = (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp") ? 1 : 0)
          - (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown") ? 1 : 0);
        controlForward.copy(director.camera?.target ?? viewTarget).sub(camera.position).setY(0);
        if (controlForward.lengthSq() < 0.0001) controlForward.set(0, 0, -1);
        else controlForward.normalize();
        controlRight.set(-controlForward.z, 0, controlForward.x);
        controlDirection
          .copy(controlForward)
          .multiplyScalar(inputForward)
          .addScaledVector(controlRight, inputX);
        if (controlDirection.lengthSq() > 1) controlDirection.normalize();
        director.setControl(selected.group, {
          direction: controlDirection,
          run: pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight"),
        });
      }
      director.update(delta, elapsed);

      if (location === "home" && runtime?.openingPortraitLocked && !focusActive) {
        openingResidentAnchors.forEach((anchor, index) => {
          const character = characters[index];
          const resident = director.residents[index];
          if (!character || !resident) return;
          if (resident.state !== "idle") {
            director.setState(resident, "idle", { duration: 2, reason: "opening-portrait" });
          }
          character.group.position.copy(anchor.position);
          character.group.rotation.set(0, anchor.yaw, 0);
          resident.velocity.set(0, 0, 0);
        });
      }

      for (const character of characters) {
        faceResidentPuppetToCamera(character, camera, delta);
      }

      const selectedGrounding = groundResidentPuppet(selected)
        ?? groundCharacterToPlane(selected);
      for (let index = 1; index < characters.length; index += 1) {
        const character = characters[index]!;
        if (!groundResidentPuppet(character)) groundCharacterToPlane(character);
      }

      if (elapsed - lastDiagnosticAt >= 0.12) {
        lastDiagnosticAt = elapsed;
        const selectedResident = director.residents[0];
        if (selectedResident) {
          const selectedPuppet = selected.group.userData.residentPuppetRuntime as
            | ResidentPuppetRuntime
            | undefined;
          const leftLegAngle = selectedPuppet?.parts.leftLeg.joint.rotation.z
            ?? selected.joints.leftLeg.rotation.x;
          const rightLegAngle = selectedPuppet?.parts.rightLeg.joint.rotation.z
            ?? selected.joints.rightLeg.rotation.x;
          selected.group.getWorldPosition(selectedPosition);
          const collisionClearance = minimumCollisionClearance(
            director.residents,
            navigationObstacles,
          );
          element.dataset.selectedState = selectedResident.state;
          element.dataset.selectedPosition = [selectedPosition.x, selectedPosition.y, selectedPosition.z]
            .map((value) => value.toFixed(3))
            .join(",");
          element.dataset.selectedGrounded = String(selectedGrounding.grounded);
          element.dataset.groundClearance = selectedGrounding.minimumGap.toFixed(4);
          element.dataset.selectedFootGap = [selectedGrounding.leftGap, selectedGrounding.rightGap]
            .map((value) => value.toFixed(4))
            .join(",");
          element.dataset.selectedGait = [
            leftLegAngle,
            rightLegAngle,
            selectedPuppet?.parts.leftArm.joint.rotation.z ?? selected.joints.leftArm.rotation.x,
            selectedPuppet?.parts.rightArm.joint.rotation.z ?? selected.joints.rightArm.rotation.x,
          ].map((value) => THREE.MathUtils.radToDeg(value).toFixed(1)).join(",");
          element.dataset.gaitSeparated = String(
            selectedPuppet
              ? selectedPuppet.parts.leftLeg.joint !== selectedPuppet.parts.rightLeg.joint
                && selectedPuppet.parts.leftArm.joint !== selectedPuppet.parts.rightArm.joint
              : selected.joints.leftLeg !== selected.joints.rightLeg
                && selected.joints.leftShin !== selected.joints.rightShin
                && selected.joints.leftFoot !== selected.joints.rightFoot,
          );
          element.dataset.gaitPhase = THREE.MathUtils.radToDeg(
            leftLegAngle - rightLegAngle,
          ).toFixed(1);
          element.dataset.puppetPartCount = selectedPuppet
            ? String(Object.keys(selectedPuppet.parts).length)
            : "0";
          element.dataset.puppetBoneCount = selectedPuppet
            ? String(selectedPuppet.skeleton.bones.length)
            : "0";
          element.dataset.selectedSpeed = selectedResident.velocity.length().toFixed(3);
          element.dataset.playerControl = runtime?.controlMode ?? "auto";
          element.dataset.characterSource = selected.assetRuntime?.source
            ?? String(selected.group.userData.characterSource ?? "sunny-custom-v2");
          element.dataset.characterVariant = String(
            selected.group.userData.authoredVariant ?? "procedural",
          );
          element.dataset.characterAssetDiagnostics = selectedPuppet
            ? "single-surface-jointed-character-v1"
            : "procedural-fallback";
          element.dataset.environmentSource = town.visualSource ?? "procedural";
          const windDiagnostics = town.group.userData.windDiagnostics as
            | {
                time: number;
                gust: number;
                direction: readonly [number, number];
                attachedMeshes: number;
                byKind: Record<string, number>;
              }
            | undefined;
          element.dataset.windAnimated = String(Boolean(windDiagnostics?.attachedMeshes));
          element.dataset.windAttachedMeshes = String(windDiagnostics?.attachedMeshes ?? 0);
          element.dataset.windGust = (windDiagnostics?.gust ?? 0).toFixed(3);
          element.dataset.windDirection = windDiagnostics
            ? windDiagnostics.direction.map((value) => value.toFixed(3)).join(",")
            : "0.000,0.000";
          element.dataset.windKinds = windDiagnostics
            ? Object.entries(windDiagnostics.byKind)
                .map(([kind, count]) => `${kind}:${count}`)
                .join(",")
            : "";
          element.dataset.collisionClearance = Number.isFinite(collisionClearance)
            ? collisionClearance.toFixed(4)
            : "none";
          element.dataset.collisionClear = String(
            !Number.isFinite(collisionClearance) || collisionClearance >= -0.004,
          );
        }
      }

      const pulse = 1 + Math.sin(elapsed * 3.2) * 0.09;
      selectionRing.scale.setScalar(pulse);
      const cleanOpeningPortrait = location === "home" && runtime?.openingPortraitLocked;
      selectionRing.visible = !focusActive && !cleanOpeningPortrait;
      nameTag.visible = !focusActive && !cleanOpeningPortrait;
      nameTag.position.y = selectedTagHeight + Math.sin(elapsed * 2.25) * 0.035;
      atmosphere.children.forEach((petal, index) => {
        const phase = Number(petal.userData.phase) || index;
        const baseY = Number(petal.userData.baseY) || 1;
        petal.position.y = baseY + Math.sin(elapsed * 0.9 + phase) * 0.28;
        petal.rotation.y = elapsed * 0.55 + phase;
        petal.rotation.z = elapsed * 0.35 + phase * 0.6;
      });

      try {
        renderer.render(world, camera);
      } catch {
        stopped = true;
        setRenderState("error");
        return;
      }
      if (!hasPresentedFrame) {
        hasPresentedFrame = true;
        requestAnimationFrame(() => {
          if (!stopped && !contextLost) setRenderState("ready");
        });
      }
      frameId = requestAnimationFrame(render);
    };
    render();

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(1, element.clientWidth);
      const nextHeight = Math.max(1, element.clientHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(nextWidth, nextHeight, false);
    });
    resizeObserver.observe(element);

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      clock.stop();
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("sunny-life:photo", handlePhoto);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      if (runtimeRef.current?.director === director) runtimeRef.current = null;
      characters.forEach((character) => disposeResidentPuppet(character));
      disposeWorld(world);
      renderer.dispose();
      renderer.forceContextLoss();
      element.replaceChildren();
    };
  }, [
    scene,
    selectedId,
    residentAppearanceKey,
    timeOfDay,
    weatherMode,
    cinematicView,
    environmentAssetsSettled,
    residentPuppetsSettled,
  ]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const director = runtime?.director;
    const selected = director?.residents[0];
    if (!runtime || !director || !selected) return;
    if (!actionCue) {
      runtime.focus = null;
      return;
    }

    runtime.controlMode = "auto";
    runtime.openingPortraitLocked = false;
    director.setControl(selected, null);
    const duration = actionCue.kind === "talk" ? 30 : actionCue.kind === "rest" ? 6.4 : 5.2;
    runtime.focus = { kind: actionCue.kind, until: runtime.clock.elapsedTime + duration };

    if (actionCue.kind === "talk" && director.residents[1]) {
      const selectedCharacter = runtime.characters[0];
      const partnerCharacter = runtime.characters[1];
      if (selectedCharacter && partnerCharacter) {
        const distance = selectedCharacter.group.position.distanceTo(partnerCharacter.group.position);
        if (distance > 2.1) {
          partnerCharacter.group.position.copy(selectedCharacter.group.position);
          partnerCharacter.group.position.x += 1.45;
          partnerCharacter.group.position.z += 0.45;
        }
        selectedCharacter.group.rotation.y = Math.atan2(
          partnerCharacter.group.position.x - selectedCharacter.group.position.x,
          partnerCharacter.group.position.z - selectedCharacter.group.position.z,
        );
        partnerCharacter.group.rotation.y = selectedCharacter.group.rotation.y + Math.PI;
      }
      director.startConversation(selected, director.residents[1], 6.5);
    } else if (actionCue.kind === "food") {
      director.setState(selected, "eat", { duration: 5.8, reason: "player-action" });
    } else if (actionCue.kind === "rest") {
      const seat = runtime.seats[0];
      if (seat) {
        selected.group.position.copy(seat.position);
        selected.group.rotation.set(0, seat.yaw, 0);
      }
      director.setState(selected, "sit", { duration: 6.4, reason: "player-action" });
    } else if (actionCue.kind === "play") {
      director.setState(selected, "happy", { duration: 4.2, reason: "player-action" });
    }
  }, [actionCue, residentAppearanceKey, scene, selectedId, timeOfDay, weatherMode]);

  const statusText = renderState === "error"
    ? "当前浏览器无法开启实时小城，请开启硬件加速后刷新重试"
    : renderState === "lost"
      ? "实时画面暂时中断，正在恢复晴天市"
      : "正在进入晴天市";
  return (
    <div
      className="world3d"
      data-render-state={renderState}
      data-scene-mode="3d"
      data-time={timeOfDay}
      aria-label="晴天市实时三维生活场景"
      aria-busy={renderState !== "ready"}
    >
      <div className="world3d-stage" ref={host} aria-hidden={renderState !== "ready"} />
      <div className="world3d-poster" role="status" aria-live="polite">
        <div
          className="world3d-poster-image"
          role="img"
          aria-label="晴天市居民与街道预览"
          style={{
            // Inline relative URLs resolve from the document in both Sites and
            // the GitHub Pages sub-directory; a root CSS URL would miss the
            // repository base path on GitHub.
            backgroundImage:
              'linear-gradient(180deg,rgba(255,255,255,.015) 62%,rgba(26,42,36,.1)),url("v4-loading.webp")',
          }}
        />
        <div className="world3d-loading-status" data-status-kind={renderState}>
          <span aria-hidden="true" />
          <b>{statusText}</b>
        </div>
      </div>
    </div>
  );
}

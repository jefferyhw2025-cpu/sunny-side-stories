"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import {
  createCharacter,
  updateCharacter,
  type Character,
  type CharacterProfile,
  type CharacterState,
} from "./game/characters";
import { createTown, type TownSceneName } from "./game/environment";
import {
  createWorldDirector,
  type CircularObstacle,
  type PointLike,
  type ResidentDefinition,
} from "./game/worldSystems";

type Props = {
  scene: string;
  selectedId: string | number;
  residents: CharacterProfile[];
  actionCue?: { kind: "talk" | "food" | "play" | "rest"; token: number } | null;
};

type SceneComposition = {
  target: THREE.Vector3;
  camera: THREE.Vector3;
  points: THREE.Vector3[];
  starts: THREE.Vector3[];
};

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
    target: new THREE.Vector3(-9, 1.35, 4.7),
    camera: new THREE.Vector3(2.8, 9.3, 18.2),
    points: [
      new THREE.Vector3(-9.8, 0, 5.4),
      new THREE.Vector3(-7.3, 0, 5.7),
      new THREE.Vector3(-4.2, 0, 5.7),
      new THREE.Vector3(-3.1, 0, 2.8),
      new THREE.Vector3(-7.8, 0, 0.5),
      new THREE.Vector3(-11.8, 0, 7.6),
      new THREE.Vector3(-6.7, 0, 8.5),
      new THREE.Vector3(-2.8, 0, 8.2),
    ],
    starts: [
      new THREE.Vector3(-9.7, 0, 5.45),
      new THREE.Vector3(-7.5, 0, 5.65),
      new THREE.Vector3(-4.7, 0, 5.65),
      new THREE.Vector3(-3.1, 0, 2.65),
      new THREE.Vector3(-7.6, 0, 0.55),
      new THREE.Vector3(-11.5, 0, 7.5),
      new THREE.Vector3(-6.5, 0, 8.45),
      new THREE.Vector3(-2.9, 0, 8.1),
    ],
  },
  plaza: {
    target: new THREE.Vector3(-7.7, 1.15, -4.5),
    camera: new THREE.Vector3(5.8, 10.4, 9.5),
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
    target: new THREE.Vector3(7.5, 1.45, 1.1),
    camera: new THREE.Vector3(20.1, 9.1, 15.6),
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

function sceneName(value: string): TownSceneName {
  return value === "plaza" || value === "cafe" ? value : "home";
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

function semanticStyle(value: string | number, options: readonly string[]): string | number {
  const numeric = typeof value === "number" ? value : /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(numeric) && options[numeric] ? options[numeric] : value;
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
    faceShape: semanticStyle(profile.faceShape, ["oval", "round", "long"]),
    eyeStyle: semanticStyle(profile.eyeStyle, ["wide", "closed", "sparkle"]),
    browStyle: semanticStyle(profile.browStyle, ["soft", "arch", "bold"]),
    noseStyle: semanticStyle(profile.noseStyle, ["button", "point", "line"]),
    mouthStyle: semanticStyle(profile.mouthStyle, ["smile", "neutral", "big grin"]),
    outfitStyle: semanticStyle(profile.outfitStyle, ["basic", "overall", "jacket"]),
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
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = "selected-resident-name";
  sprite.position.set(0, 3.8, 0);
  sprite.scale.set(2.75, 0.86, 1);
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
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.67, 0.86, 32), material);
  ring.name = "selected-resident-ring";
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  ring.renderOrder = 3;
  return ring;
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

function disposeWorld(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite || object instanceof THREE.Line)) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      const withMap = material as THREE.Material & { map?: THREE.Texture | null };
      withMap.map?.dispose();
      material.dispose();
    }
  });
}

export default function World3D({ scene, selectedId, residents, actionCue }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const location = sceneName(scene);
    const composition = SCENE_COMPOSITIONS[location];
    const profiles = chooseResidents(residents, selectedId);
    const world = new THREE.Scene();
    world.name = "Sunny Side Stories";
    world.background = new THREE.Color("#91dcf4");
    world.fog = new THREE.Fog("#c7edf2", 26, 72);

    const width = Math.max(1, element.clientWidth);
    const height = Math.max(1, element.clientHeight);
    const camera = new THREE.PerspectiveCamera(37, width / height, 0.1, 140);
    camera.position.copy(composition.camera);
    camera.lookAt(composition.target);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      element.textContent = "当前浏览器暂时无法显示 3D 小城，请开启硬件加速后重试。";
      return;
    }
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    element.replaceChildren(renderer.domElement);

    const outline = new OutlineEffect(renderer, {
      defaultThickness: 0.0022,
      defaultColor: [0.12, 0.16, 0.17],
      defaultAlpha: 0.32,
      defaultKeepAlive: false,
    });

    const skyLight = new THREE.HemisphereLight("#fffdf1", "#72a96c", 2.35);
    world.add(skyLight);
    const sun = new THREE.DirectionalLight("#fff3d1", 3.45);
    sun.position.copy(composition.target).add(new THREE.Vector3(-17, 26, 15));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.00028;
    sun.shadow.normalBias = 0.028;
    sun.target.position.copy(composition.target);
    world.add(sun, sun.target);
    const fill = new THREE.DirectionalLight("#bce9ff", 0.72);
    fill.position.copy(composition.target).add(new THREE.Vector3(16, 9, -12));
    world.add(fill);

    const town = createTown(location);
    world.add(town.group);

    const characterByGroup = new Map<THREE.Group, Character>();
    const characters: Character[] = profiles.map((profile, index) => {
      const character = createCharacter(prepareProfile(profile));
      const start = composition.starts[index % composition.starts.length];
      character.group.position.copy(start);
      character.group.scale.setScalar(index === 0 ? 1.02 : 0.92 + (index % 3) * 0.035);
      character.group.rotation.y = index % 2 === 0 ? 0.18 : -0.28;
      character.group.userData.isSelected = index === 0;
      character.group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      world.add(character.group);
      characterByGroup.set(character.group, character);
      return character;
    });

    const selected = characters[0];
    const selectionRing = createSelectionRing();
    const nameTag = createNameTag(selected.profile.name);
    selected.group.add(selectionRing, nameTag);

    const selectedCueState: CharacterState =
      actionCue?.kind === "talk"
        ? "talk"
        : actionCue?.kind === "food"
          ? "eat"
          : actionCue?.kind === "rest"
            ? "sit"
            : "happy";
    const definitions: ResidentDefinition[] = characters.map((character, index) => ({
      id: String(character.profile.id),
      group: character.group,
      initialState: index === 0 ? selectedCueState : index % 3 === 0 ? "walk" : "idle",
      targetPoints: composition.points,
      walkSpeed: 0.72 + (index % 3) * 0.07,
      runSpeed: 1.52 + (index % 2) * 0.12,
      radius: 0.52,
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
      bounds: { minX: -19, maxX: 19, minZ: -16.5, maxZ: 16.5, y: 0 },
      obstacles: TOWN_OBSTACLES,
      arrivalDistance: 0.18,
      avoidancePadding: 0.3,
      avoidanceStrength: 1.7,
      conversationDistance: 2.2,
      conversationRate: 0.3,
      conversationCooldown: 5,
      camera,
      cameraOptions: {
        target: composition.target,
        positionDamping: 2,
        targetDamping: 4,
        minFov: 32,
        maxFov: 44,
      },
      applyAnimation(group, state, elapsed, delta) {
        const character = characterByGroup.get(group);
        if (character) updateCharacter(character, state as CharacterState, elapsed, delta);
      },
    });
    director.camera?.cut(composition.camera, composition.target, 37);

    if (actionCue?.kind === "talk" && director.residents[0] && director.residents[1]) {
      director.startConversation(director.residents[0], director.residents[1], 6.5);
    } else if (director.residents[1] && director.residents[2]) {
      director.startConversation(director.residents[1], director.residents[2], 6.5);
    }
    if (actionCue?.kind === "food" && director.residents[0]) {
      director.setState(director.residents[0], "eat", { duration: 5.8, reason: "player-action" });
    }
    if (actionCue?.kind === "rest" && director.residents[0]) {
      director.setState(director.residents[0], "sit", { duration: 6.4, reason: "player-action" });
    }
    if (actionCue?.kind === "play" && director.residents[0]) {
      director.setState(director.residents[0], "happy", { duration: 4.2, reason: "player-action" });
    }
    if (director.residents[3]) director.setState(director.residents[3], "eat", { duration: 5.6 });
    if (director.residents[4]) director.setState(director.residents[4], "sit", { duration: 6.2 });
    if (director.residents[5]) {
      director.moveTo(director.residents[5], composition.points[2], { run: true, duration: 4.4 });
    }

    const atmosphere = createAtmosphere(composition.target);
    world.add(atmosphere);

    const clock = new THREE.Clock();
    let frameId = 0;
    let stopped = false;
    const render = () => {
      if (stopped) return;
      const delta = Math.min(clock.getDelta(), 0.06);
      const elapsed = clock.elapsedTime;
      town.update(elapsed);

      const cameraDrift = new THREE.Vector3(
        Math.sin(elapsed * 0.12) * 0.32,
        Math.sin(elapsed * 0.18 + 0.8) * 0.12,
        Math.cos(elapsed * 0.1) * 0.22,
      );
      director.camera?.moveTo(
        composition.camera.clone().add(cameraDrift),
        composition.target,
        { positionDamping: 1.5, targetDamping: 4.2, fov: 37 },
      );
      director.update(delta, elapsed);

      const pulse = 1 + Math.sin(elapsed * 3.2) * 0.09;
      selectionRing.scale.setScalar(pulse);
      nameTag.position.y = 3.78 + Math.sin(elapsed * 2.25) * 0.055;
      atmosphere.children.forEach((petal, index) => {
        const phase = Number(petal.userData.phase) || index;
        const baseY = Number(petal.userData.baseY) || 1;
        petal.position.y = baseY + Math.sin(elapsed * 0.9 + phase) * 0.28;
        petal.rotation.y = elapsed * 0.55 + phase;
        petal.rotation.z = elapsed * 0.35 + phase * 0.6;
      });

      outline.render(world, camera);
      frameId = requestAnimationFrame(render);
    };
    render();

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(1, element.clientWidth);
      const nextHeight = Math.max(1, element.clientHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      outline.setSize(nextWidth, nextHeight);
    });
    resizeObserver.observe(element);

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      clock.stop();
      disposeWorld(world);
      renderer.dispose();
      renderer.forceContextLoss();
      element.replaceChildren();
    };
  }, [scene, selectedId, residents, actionCue]);

  return <div className="world3d" ref={host} aria-label="晴天市实时三维生活场景" />;
}

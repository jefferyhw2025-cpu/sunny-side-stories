import * as THREE from "three";

export type CharacterState =
  | "idle"
  | "walk"
  | "run"
  | "talk"
  | "eat"
  | "sit"
  | "happy"
  | "sad";

/**
 * A serialisable description of one resident. Style fields intentionally stay
 * open strings: authored profiles can introduce new names and gracefully fall
 * back to the closest built-in treatment instead of breaking the renderer.
 */
export interface CharacterProfile {
  id: string | number;
  name: string;
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: string | number;
  faceShape: string | number;
  eyeStyle: string | number;
  browStyle: string | number;
  noseStyle: string | number;
  mouthStyle: string | number;
  outfitStyle: string | number;
  trait: string;
}

export interface CharacterJoints {
  /** Internal motion root. Move the returned `group` to place the character. */
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  /** Director-friendly aliases of leftArm/rightArm. */
  armL: THREE.Group;
  armR: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftHand: THREE.Group;
  rightHand: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  /** Director-friendly aliases of leftLeg/rightLeg. */
  legL: THREE.Group;
  legR: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
  leftFoot: THREE.Group;
  rightFoot: THREE.Group;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  eyes: THREE.Group;
  leftBrow: THREE.Group;
  rightBrow: THREE.Group;
  mouth: THREE.Group;
}

interface CharacterAnimation {
  state: CharacterState;
  stateStartedAt: number;
}

export interface Character {
  group: THREE.Group;
  joints: CharacterJoints;
  profile: CharacterProfile;
  animation: CharacterAnimation;
}

type CharacterMaterial = THREE.MeshStandardMaterial;
type SurfaceFinish = "skin" | "hair" | "fabric" | "leather" | "eye" | "detail";

interface CharacterMaterialOptions {
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  surface?: SurfaceFinish;
}

const FRONT = 0.01;
const DEG = Math.PI / 180;

function styleName(value: string | number): string {
  return String(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function includesAny(value: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function safeColor(value: string, fallback: string): THREE.Color {
  try {
    return new THREE.Color(value);
  } catch {
    return new THREE.Color(fallback);
  }
}

function shiftedColor(value: string, lightness: number, fallback: string): THREE.Color {
  return safeColor(value, fallback).offsetHSL(0, 0, lightness);
}

function material(
  color: THREE.ColorRepresentation,
  options: CharacterMaterialOptions = {},
): CharacterMaterial {
  const base = {
    color,
    side: options.side ?? THREE.FrontSide,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    metalness: 0,
  };

  switch (options.surface ?? "detail") {
    case "skin":
      return new THREE.MeshPhysicalMaterial({
        ...base,
        roughness: 0.66,
        clearcoat: 0.025,
        clearcoatRoughness: 0.9,
        sheen: 0.06,
        sheenColor: color,
        sheenRoughness: 0.94,
      });
    case "fabric":
      return new THREE.MeshPhysicalMaterial({
        ...base,
        roughness: 0.9,
        clearcoat: 0,
        sheen: 0.14,
        sheenColor: new THREE.Color(color).offsetHSL(0, 0, 0.08),
        sheenRoughness: 0.86,
      });
    case "leather":
      return new THREE.MeshPhysicalMaterial({
        ...base,
        roughness: 0.42,
        clearcoat: 0.18,
        clearcoatRoughness: 0.58,
      });
    case "eye":
      return new THREE.MeshPhysicalMaterial({
        ...base,
        roughness: 0.16,
        clearcoat: 0.72,
        clearcoatRoughness: 0.2,
      });
    case "hair":
      return new THREE.MeshStandardMaterial({ ...base, roughness: 0.4 });
    case "detail":
    default:
      return new THREE.MeshStandardMaterial({ ...base, roughness: 0.74 });
  }
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  meshMaterial: THREE.Material,
  position: readonly [number, number, number] = [0, 0, 0],
  scale: readonly [number, number, number] = [1, 1, 1],
  rotation: readonly [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const result = new THREE.Group();
  result.position.set(x, y, z);
  parent.add(result);
  return result;
}

function createEye(
  parent: THREE.Object3D,
  x: number,
  style: string,
  skinMaterial: CharacterMaterial,
): THREE.Group {
  const eye = joint(parent, x, 0.29, 0.535 + FRONT);
  const dark = material("#243044", { surface: "eye" });
  const white = material("#fffdf7", { surface: "eye" });
  const iris = material("#4a6f82", { surface: "eye" });

  if (includesAny(style, ["sleep", "closed", "calm"])) {
    addMesh(eye, new THREE.BoxGeometry(0.16, 0.025, 0.018), dark, [0, 0, 0]);
    addMesh(
      eye,
      new THREE.CircleGeometry(0.045, 16, 0, Math.PI),
      skinMaterial,
      [0, -0.012, 0.011],
      [1.35, 0.55, 1],
      [0, 0, Math.PI],
    );
  } else if (includesAny(style, ["dot", "tiny", "button"])) {
    addMesh(eye, new THREE.CircleGeometry(0.064, 18), dark, [0, 0, 0], [0.82, 1.12, 1]);
    addMesh(eye, new THREE.CircleGeometry(0.015, 12), white, [-0.017, 0.021, 0.012]);
  } else {
    const wide = includesAny(style, ["wide", "round", "sparkle"]);
    addMesh(
      eye,
      new THREE.CircleGeometry(wide ? 0.112 : 0.096, 20),
      white,
      [0, 0, 0],
      [wide ? 0.92 : 0.82, wide ? 1.05 : 0.92, 1],
    );
    addMesh(eye, new THREE.CircleGeometry(wide ? 0.064 : 0.056, 18), iris, [0, -0.004, 0.012]);
    addMesh(eye, new THREE.CircleGeometry(0.029, 16), dark, [0, -0.006, 0.023]);
    addMesh(eye, new THREE.CircleGeometry(0.012, 12), white, [-0.015, 0.018, 0.034]);
  }

  return eye;
}

function createBrow(
  parent: THREE.Object3D,
  x: number,
  style: string,
  hairMaterial: CharacterMaterial,
): THREE.Group {
  const brow = joint(parent, x, 0.46, 0.552 + FRONT);
  const bold = includesAny(style, ["bold", "thick", "strong"]);
  const arch = includesAny(style, ["arch", "curious", "raised"]);
  const soft = includesAny(style, ["soft", "round"]);
  const browMesh = addMesh(
    brow,
    soft ? new THREE.TorusGeometry(0.095, bold ? 0.024 : 0.017, 6, 16, Math.PI) : new THREE.BoxGeometry(0.18, bold ? 0.045 : 0.027, 0.025),
    hairMaterial,
    [0, 0, 0],
    [1, arch ? 1.3 : 1, 1],
  );
  browMesh.rotation.z = (x < 0 ? 1 : -1) * (arch ? 9 * DEG : 3 * DEG);
  return brow;
}

function createNose(parent: THREE.Object3D, style: string, skinShadow: CharacterMaterial): void {
  if (includesAny(style, ["point", "sharp", "long"])) {
    addMesh(
      parent,
      new THREE.ConeGeometry(0.055, 0.16, 8),
      skinShadow,
      [0, 0.2, 0.585],
      [1, 1, 1],
      [90 * DEG, 0, 0],
    );
  } else if (includesAny(style, ["line", "small", "subtle"])) {
    addMesh(parent, new THREE.BoxGeometry(0.035, 0.105, 0.025), skinShadow, [0, 0.2, 0.577], [1, 1, 1], [0, 0, -5 * DEG]);
  } else {
    addMesh(parent, new THREE.SphereGeometry(0.062, 14, 10), skinShadow, [0, 0.19, 0.578], [0.86, 0.72, 0.72]);
  }
}

function createMouth(parent: THREE.Object3D, style: string): THREE.Group {
  const mouth = joint(parent, 0, 0.04, 0.574 + FRONT);
  const lip = material("#9e4051", { surface: "detail" });
  const inside = material("#5a2734", { surface: "detail" });
  const teeth = material("#fff9ed", { surface: "eye" });

  if (includesAny(style, ["grin", "big", "toothy"])) {
    addMesh(mouth, new THREE.CircleGeometry(0.12, 20), inside, [0, 0, 0], [1.35, 0.58, 1]);
    addMesh(mouth, new THREE.BoxGeometry(0.2, 0.045, 0.012), teeth, [0, 0.018, 0.012]);
  } else if (includesAny(style, ["small", "quiet", "neutral"])) {
    addMesh(mouth, new THREE.BoxGeometry(0.13, 0.027, 0.018), lip);
  } else {
    const smile = addMesh(
      mouth,
      new THREE.TorusGeometry(0.105, 0.018, 7, 20, Math.PI),
      lip,
      [0, 0.035, 0],
      [1.15, 0.8, 1],
      [0, 0, Math.PI],
    );
    smile.name = "smile";
  }

  const openMouth = addMesh(mouth, new THREE.CircleGeometry(0.09, 18), inside, [0, -0.018, -0.004], [1, 0.08, 1]);
  openMouth.name = "open-mouth";
  return mouth;
}

function addHair(
  head: THREE.Group,
  profile: CharacterProfile,
  headScale: readonly [number, number, number],
  hairMaterial: CharacterMaterial,
  hairHighlight: CharacterMaterial,
): void {
  const requested = styleName(profile.hairStyle);
  const numericStyles: Record<string, string> = { "0": "crop", "1": "spikes", "2": "pigtails", "3": "bun" };
  const style = numericStyles[requested] ?? requested;

  const cap = addMesh(
    head,
    new THREE.SphereGeometry(0.625, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.6),
    hairMaterial,
    [0, 0.35, -0.01],
    [headScale[0] * 1.035, headScale[1] * 1.02, headScale[2] * 1.035],
  );
  cap.name = "hair-cap";

  const curled = includesAny(style, ["curl", "afro", "cloud"]);
  if (!curled) {
    // Separate locks give the hair a readable cut and part instead of one helmet-like cap.
    const fringe: ReadonlyArray<readonly [number, number, number, number]> = [
      [-0.36, 0.54, -8, 1.02],
      [-0.14, 0.59, -3, 1.14],
      [0.12, 0.58, 4, 1.1],
      [0.35, 0.53, 9, 0.98],
    ];
    for (const [x, y, angle, width] of fringe) {
      addMesh(
        head,
        new THREE.SphereGeometry(0.18, 18, 12),
        x === -0.14 || x === 0.35 ? hairHighlight : hairMaterial,
        [x * headScale[0], y, 0.505 * headScale[2]],
        [width, 0.54, 0.38],
        [0, 0, angle * DEG],
      );
    }
    for (const side of [-1, 1]) {
      addMesh(
        head,
        new THREE.SphereGeometry(0.155, 16, 10),
        hairMaterial,
        [side * 0.55 * headScale[0], 0.25, 0.31],
        [0.5, 1.22, 0.52],
        [0, 0, side * -7 * DEG],
      );
    }
  }

  if (includesAny(style, ["bob", "page", "straight"])) {
    for (const side of [-1, 1]) {
      addMesh(
        head,
        new THREE.CapsuleGeometry(0.115, 0.35, 6, 14),
        hairMaterial,
        [side * 0.53 * headScale[0], 0.16, -0.06],
        [0.82, 1, 1.12],
        [0, 0, side * -4 * DEG],
      );
    }
    addMesh(head, new THREE.SphereGeometry(0.2, 18, 10), hairHighlight, [-0.04, 0.54, 0.49], [1.85, 0.34, 0.4], [0, 0, -2 * DEG]);
  } else if (curled) {
    cap.visible = false;
    const curls: ReadonlyArray<readonly [number, number, number, number]> = [
      [-0.46, 0.5, 0, 0.28], [-0.2, 0.68, 0, 0.29], [0.1, 0.71, -0.01, 0.3],
      [0.4, 0.56, -0.01, 0.28], [-0.51, 0.25, -0.03, 0.27], [0.5, 0.25, -0.04, 0.27],
      [-0.33, 0.32, -0.35, 0.31], [0, 0.43, -0.43, 0.34], [0.34, 0.32, -0.35, 0.31],
    ];
    for (const [x, y, z, radius] of curls) {
      addMesh(head, new THREE.SphereGeometry(radius, 16, 11), hairMaterial, [x * headScale[0], y, z], [1, 0.93, 1]);
    }
  } else if (includesAny(style, ["pony", "tail", "pigtail", "braid"])) {
    const paired = includesAny(style, ["pigtail", "twin"]);
    const sides = paired ? [-1, 1] : [1];
    for (const side of sides) {
      addMesh(head, new THREE.CylinderGeometry(0.1, 0.17, 0.62, 16), hairMaterial, [side * (paired ? 0.56 : 0.28), 0.23, -0.48], [1, 1, 1], [0, 0, side * -13 * DEG]);
      addMesh(head, new THREE.SphereGeometry(0.17, 16, 10), hairHighlight, [side * (paired ? 0.5 : 0.24), 0.51, -0.44], [1, 0.9, 1]);
    }
  } else if (includesAny(style, ["bun", "topknot", "knot"])) {
    addMesh(head, new THREE.SphereGeometry(0.3, 20, 14), hairMaterial, [0.22, 0.86, -0.12], [1, 0.9, 1]);
    addMesh(head, new THREE.TorusGeometry(0.23, 0.045, 7, 16), hairHighlight, [0.22, 0.85, -0.1], [1, 1, 1], [90 * DEG, 0, 0]);
  } else if (includesAny(style, ["spike", "messy", "quiff"])) {
    const tufts: ReadonlyArray<readonly [number, number, number]> = [[-0.38, 0.72, -12], [-0.14, 0.82, -6], [0.12, 0.84, 5], [0.36, 0.73, 12]];
    for (const [x, y, angle] of tufts) {
      addMesh(head, new THREE.ConeGeometry(0.16, 0.42, 12), hairMaterial, [x, y, 0], [1, 1, 0.9], [0, 0, angle * DEG]);
    }
  } else {
    addMesh(head, new THREE.SphereGeometry(0.2, 18, 10), hairHighlight, [-0.08, 0.59, 0.48], [1.65, 0.25, 0.32], [0, 0, -7 * DEG]);
  }
}

function addTraitDetail(
  chest: THREE.Group,
  head: THREE.Group,
  trait: string,
  shirtAccent: CharacterMaterial,
  darkMaterial: CharacterMaterial,
): void {
  const value = styleName(trait);
  if (includesAny(value, ["book", "smart", "invent", "curious"])) {
    for (const side of [-1, 1]) {
      addMesh(head, new THREE.TorusGeometry(0.13, 0.018, 7, 18), darkMaterial, [side * 0.2, 0.29, 0.565], [1, 0.82, 1]);
    }
    addMesh(head, new THREE.BoxGeometry(0.14, 0.02, 0.02), darkMaterial, [0, 0.29, 0.57]);
  } else if (includesAny(value, ["art", "creative", "music"])) {
    const pin = addMesh(chest, new THREE.CircleGeometry(0.09, 6), shirtAccent, [0.24, 0.18, 0.465], [1, 1, 1]);
    pin.rotation.z = 30 * DEG;
  } else if (includesAny(value, ["adventure", "brave", "explore"])) {
    addMesh(chest, new THREE.BoxGeometry(0.11, 0.72, 0.04), shirtAccent, [-0.05, 0, 0.46], [1, 1, 1], [0, 0, -21 * DEG]);
  }
}

function addOutfit(
  torso: THREE.Group,
  hips: THREE.Group,
  profile: CharacterProfile,
  shirtMaterial: CharacterMaterial,
  shirtShadow: CharacterMaterial,
  shirtAccent: CharacterMaterial,
  trouserMaterial: CharacterMaterial,
): void {
  const outfit = styleName(profile.outfitStyle);
  addMesh(torso, new THREE.CylinderGeometry(0.43, 0.53, 0.82, 18), shirtMaterial, [0, 0, 0], [1, 1, 0.82]);
  addMesh(torso, new THREE.CylinderGeometry(0.445, 0.54, 0.12, 18), shirtShadow, [0, -0.36, 0], [1, 1, 0.83]);
  addMesh(torso, new THREE.TorusGeometry(0.17, 0.035, 9, 24), shirtAccent, [0, 0.38, 0.19], [1, 0.48, 0.9], [90 * DEG, 0, 0]);

  if (includesAny(outfit, ["overall", "dungaree"])) {
    addMesh(torso, new THREE.BoxGeometry(0.46, 0.48, 0.07), trouserMaterial, [0, -0.06, 0.405]);
    for (const side of [-1, 1]) {
      addMesh(torso, new THREE.BoxGeometry(0.075, 0.5, 0.06), trouserMaterial, [side * 0.21, 0.25, 0.38], [1, 1, 1], [0, 0, side * -8 * DEG]);
    }
    addMesh(torso, new THREE.CircleGeometry(0.035, 12), shirtAccent, [0, -0.08, 0.45]);
  } else if (includesAny(outfit, ["jacket", "coat", "blazer"])) {
    for (const side of [-1, 1]) {
      addMesh(torso, new THREE.BoxGeometry(0.38, 0.7, 0.055), shirtShadow, [side * 0.19, -0.02, 0.405], [1, 1, 1], [0, 0, side * 2 * DEG]);
    }
    addMesh(torso, new THREE.BoxGeometry(0.025, 0.62, 0.025), shirtAccent, [0, -0.03, 0.45]);
    for (const y of [0.12, -0.08, -0.28]) {
      addMesh(torso, new THREE.SphereGeometry(0.028, 12, 8), shirtAccent, [0.045, y, 0.46], [1, 1, 0.5]);
    }
  } else if (includesAny(outfit, ["dress", "skirt"])) {
    addMesh(hips, new THREE.CylinderGeometry(0.43, 0.68, 0.56, 18), shirtMaterial, [0, -0.05, 0], [1, 1, 0.86]);
    addMesh(hips, new THREE.CylinderGeometry(0.69, 0.69, 0.07, 18), shirtAccent, [0, -0.32, 0], [1, 1, 0.86]);
  } else if (includesAny(outfit, ["sport", "athletic", "active"])) {
    addMesh(torso, new THREE.BoxGeometry(0.08, 0.72, 0.04), shirtAccent, [0.28, -0.03, 0.42]);
    addMesh(hips, new THREE.BoxGeometry(0.77, 0.22, 0.46), trouserMaterial, [0, -0.09, 0]);
  } else {
    addMesh(torso, new THREE.BoxGeometry(0.57, 0.055, 0.055), shirtAccent, [0, 0.16, 0.42], [1, 1, 1], [0, 0, -3 * DEG]);
    addMesh(torso, new THREE.BoxGeometry(0.2, 0.15, 0.025), shirtShadow, [0.19, -0.11, 0.445], [1, 1, 1], [0, 0, -2 * DEG]);
  }
}

function addArm(
  chest: THREE.Group,
  side: -1 | 1,
  skinMaterial: CharacterMaterial,
  shirtMaterial: CharacterMaterial,
  shirtAccent: CharacterMaterial,
): { shoulder: THREE.Group; arm: THREE.Group; forearm: THREE.Group; hand: THREE.Group } {
  const shoulder = joint(chest, side * 0.49, 0.25, 0);
  const arm = joint(shoulder, 0, 0, 0);
  addMesh(arm, new THREE.CylinderGeometry(0.105, 0.09, 0.38, 16), shirtMaterial, [0, -0.18, 0]);
  addMesh(arm, new THREE.CylinderGeometry(0.112, 0.112, 0.07, 16), shirtAccent, [0, -0.36, 0]);

  const forearm = joint(arm, 0, -0.39, 0);
  addMesh(forearm, new THREE.CylinderGeometry(0.085, 0.073, 0.38, 16), skinMaterial, [0, -0.18, 0]);
  const hand = joint(forearm, 0, -0.39, 0);
  addMesh(hand, new THREE.SphereGeometry(0.105, 16, 11), skinMaterial, [0, -0.055, 0.01], [0.82, 1.08, 0.7]);
  addMesh(
    hand,
    new THREE.SphereGeometry(0.058, 12, 8),
    skinMaterial,
    [-side * 0.071, -0.045, 0.045],
    [0.72, 1, 0.72],
    [0, 0, side * 24 * DEG],
  );
  return { shoulder, arm, forearm, hand };
}

function addLeg(
  hips: THREE.Group,
  side: -1 | 1,
  skinMaterial: CharacterMaterial,
  trouserMaterial: CharacterMaterial,
  shoeMaterial: CharacterMaterial,
  outfitStyle: string | number,
): { leg: THREE.Group; shin: THREE.Group; foot: THREE.Group } {
  const leg = joint(hips, side * 0.235, -0.18, 0);
  const dress = includesAny(styleName(outfitStyle), ["dress", "skirt"]);
  const upperMaterial = dress ? skinMaterial : trouserMaterial;
  addMesh(leg, new THREE.CylinderGeometry(0.13, 0.115, 0.5, 16), upperMaterial, [0, -0.24, 0]);

  const shin = joint(leg, 0, -0.5, 0);
  addMesh(shin, new THREE.CylinderGeometry(0.11, 0.085, 0.47, 16), skinMaterial, [0, -0.22, 0]);
  addMesh(shin, new THREE.CylinderGeometry(0.105, 0.105, 0.14, 16), shoeMaterial, [0, -0.4, 0]);

  const foot = joint(shin, 0, -0.47, 0.08);
  addMesh(foot, new THREE.BoxGeometry(0.25, 0.15, 0.4), shoeMaterial, [0, -0.015, 0.1], [1, 1, 1]);
  addMesh(foot, new THREE.BoxGeometry(0.27, 0.045, 0.42), material("#e9edf0"), [0, -0.1, 0.11]);
  return { leg, shin, foot };
}

/** Build a self-contained, shadow-ready cartoon resident and animation rig. */
export function createCharacter(profile: CharacterProfile): Character {
  const group = new THREE.Group();
  group.name = `character:${profile.id}`;
  group.userData.characterId = profile.id;
  group.userData.characterName = profile.name;
  group.userData.trait = profile.trait;

  const root = joint(group, 0, 0, 0);
  root.name = "motion-root";
  const hips = joint(root, 0, 1.14, 0);
  hips.name = "hips";
  const torso = joint(hips, 0, 0.43, 0);
  torso.name = "torso";
  const chest = joint(torso, 0, 0.08, 0);
  chest.name = "chest";
  const neck = joint(torso, 0, 0.53, 0);
  neck.name = "neck";
  const head = joint(neck, 0, 0.34, 0);
  head.name = "head";

  const skinMaterial = material(profile.skin || "#d99a73", { surface: "skin" });
  const skinShadow = material(shiftedColor(profile.skin, -0.1, "#b9795d"), { surface: "skin" });
  const hairMaterial = material(profile.hair || "#4a3028", { surface: "hair" });
  const hairHighlight = material(shiftedColor(profile.hair, 0.08, "#67453a"), { surface: "hair" });
  const shirtMaterial = material(profile.shirt || "#5ba8a0", { surface: "fabric" });
  const shirtShadow = material(shiftedColor(profile.shirt, -0.12, "#3d7e79"), { surface: "fabric" });
  const shirtAccent = material(shiftedColor(profile.shirt, 0.16, "#8dd0c8"), { surface: "fabric" });
  const trouserMaterial = material("#405b72", { surface: "fabric" });
  const shoeMaterial = material("#303946", { surface: "leather" });

  addOutfit(torso, hips, profile, shirtMaterial, shirtShadow, shirtAccent, trouserMaterial);
  addMesh(neck, new THREE.CylinderGeometry(0.16, 0.18, 0.25, 16), skinMaterial, [0, -0.08, 0]);

  const face = styleName(profile.faceShape);
  const headScale: readonly [number, number, number] = includesAny(face, ["round", "wide", "soft"])
    ? [1.03, 0.94, 0.94]
    : includesAny(face, ["long", "oval", "slim"])
      ? [0.88, 1.08, 0.91]
      : includesAny(face, ["square", "angular"])
        ? [0.98, 0.98, 0.9]
        : [0.94, 1.02, 0.92];
  const headMesh = addMesh(head, new THREE.SphereGeometry(0.62, 28, 20), skinMaterial, [0, 0.25, 0], headScale);
  headMesh.name = "face";
  if (includesAny(face, ["square", "angular"])) {
    headMesh.geometry = new THREE.SphereGeometry(0.62, 12, 9);
  }

  addHair(head, profile, headScale, hairMaterial, hairHighlight);
  const eyeStyle = styleName(profile.eyeStyle);
  const eyes = joint(head, 0, 0, 0);
  eyes.name = "eyes";
  const leftEye = createEye(eyes, -0.2, eyeStyle, skinMaterial);
  const rightEye = createEye(eyes, 0.2, eyeStyle, skinMaterial);
  leftEye.name = "left-eye";
  rightEye.name = "right-eye";
  const browStyle = styleName(profile.browStyle);
  const leftBrow = createBrow(head, -0.2, browStyle, hairMaterial);
  const rightBrow = createBrow(head, 0.2, browStyle, hairMaterial);
  leftBrow.name = "left-brow";
  rightBrow.name = "right-brow";
  createNose(head, styleName(profile.noseStyle), skinShadow);
  const mouth = createMouth(head, styleName(profile.mouthStyle));
  mouth.name = "mouth";

  // Ears and subtle cheeks break up the face silhouette without noisy outlines.
  for (const side of [-1, 1]) {
    addMesh(head, new THREE.SphereGeometry(0.105, 12, 8), skinMaterial, [side * 0.59 * headScale[0], 0.24, -0.01], [0.62, 1, 0.52]);
    addMesh(head, new THREE.CircleGeometry(0.075, 16), material("#e88486", { transparent: true, opacity: 0.28, surface: "skin" }), [side * 0.34, 0.11, 0.545], [1.25, 0.58, 1]);
  }

  addTraitDetail(chest, head, profile.trait, shirtAccent, material("#293547", { surface: "leather" }));
  const left = addArm(chest, -1, skinMaterial, shirtMaterial, shirtAccent);
  const right = addArm(chest, 1, skinMaterial, shirtMaterial, shirtAccent);
  const leftLeg = addLeg(hips, -1, skinMaterial, trouserMaterial, shoeMaterial, profile.outfitStyle);
  const rightLeg = addLeg(hips, 1, skinMaterial, trouserMaterial, shoeMaterial, profile.outfitStyle);

  const joints: CharacterJoints = {
    root,
    hips,
    torso,
    chest,
    neck,
    head,
    leftShoulder: left.shoulder,
    rightShoulder: right.shoulder,
    leftArm: left.arm,
    rightArm: right.arm,
    armL: left.arm,
    armR: right.arm,
    leftForearm: left.forearm,
    rightForearm: right.forearm,
    leftHand: left.hand,
    rightHand: right.hand,
    leftLeg: leftLeg.leg,
    rightLeg: rightLeg.leg,
    legL: leftLeg.leg,
    legR: rightLeg.leg,
    leftShin: leftLeg.shin,
    rightShin: rightLeg.shin,
    leftFoot: leftLeg.foot,
    rightFoot: rightLeg.foot,
    leftEye,
    rightEye,
    eyes,
    leftBrow,
    rightBrow,
    mouth,
  };

  const character: Character = {
    group,
    joints,
    profile: { ...profile },
    animation: { state: "idle", stateStartedAt: 0 },
  };
  updateCharacter(character, "idle", 0, 1);
  return character;
}

function damp(current: number, target: number, speed: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
}

function setRotation(
  object: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  delta: number,
  speed = 12,
): void {
  object.rotation.x = damp(object.rotation.x, x, speed, delta);
  object.rotation.y = damp(object.rotation.y, y, speed, delta);
  object.rotation.z = damp(object.rotation.z, z, speed, delta);
}

function setPositionY(object: THREE.Object3D, y: number, delta: number, speed = 14): void {
  object.position.y = damp(object.position.y, y, speed, delta);
}

function setScaleY(object: THREE.Object3D, y: number, delta: number, speed = 18): void {
  object.scale.y = damp(object.scale.y, y, speed, delta);
}

/**
 * Pose a character for the supplied state. `time` is elapsed seconds and
 * `delta` is the frame duration; both can come directly from THREE.Clock.
 */
export function updateCharacter(
  character: Character,
  state: CharacterState,
  time: number,
  delta: number,
): void {
  const { joints } = character;
  const dt = THREE.MathUtils.clamp(Number.isFinite(delta) ? delta : 1 / 60, 0, 0.1);
  if (character.animation.state !== state) {
    character.animation.state = state;
    character.animation.stateStartedAt = time;
  }
  const elapsed = Math.max(0, time - character.animation.stateStartedAt);

  let rootY = 0;
  const hipsX = 0;
  let hipsY = 0;
  let hipsZ = 0;
  let torsoX = 0;
  let torsoY = 0;
  let torsoZ = 0;
  let headX = 0;
  let headY = 0;
  let headZ = 0;
  let leftArmX = 0;
  let rightArmX = 0;
  let leftArmZ = -0.07;
  let rightArmZ = 0.07;
  let leftForearmX = 0;
  let rightForearmX = 0;
  let leftForearmZ = 0;
  let rightForearmZ = 0;
  let leftLegX = 0;
  let rightLegX = 0;
  let leftShinX = 0;
  let rightShinX = 0;
  let leftFootX = 0;
  let rightFootX = 0;
  let browLeftZ = 0;
  let browRightZ = 0;
  let mouthOpen = 0.08;

  switch (state) {
    case "walk": {
      const swing = Math.sin(elapsed * 7.2);
      const liftLeft = Math.max(0, -swing);
      const liftRight = Math.max(0, swing);
      rootY = Math.abs(Math.cos(elapsed * 7.2)) * 0.035;
      hipsY = swing * 0.055;
      torsoY = -swing * 0.035;
      torsoZ = Math.sin(elapsed * 3.6) * 0.018;
      headY = swing * 0.025;
      leftLegX = swing * 0.48;
      rightLegX = -swing * 0.48;
      leftShinX = liftLeft * 0.44;
      rightShinX = liftRight * 0.44;
      leftFootX = -liftLeft * 0.18;
      rightFootX = -liftRight * 0.18;
      leftArmX = -swing * 0.42;
      rightArmX = swing * 0.42;
      leftForearmX = -0.08;
      rightForearmX = -0.08;
      break;
    }
    case "run": {
      const swing = Math.sin(elapsed * 11.5);
      const liftLeft = Math.max(0, -swing);
      const liftRight = Math.max(0, swing);
      rootY = 0.045 + Math.abs(Math.cos(elapsed * 11.5)) * 0.085;
      hipsY = swing * 0.08;
      torsoX = -0.12;
      torsoY = -swing * 0.07;
      headX = 0.06;
      leftLegX = swing * 0.82;
      rightLegX = -swing * 0.82;
      leftShinX = 0.16 + liftLeft * 0.92;
      rightShinX = 0.16 + liftRight * 0.92;
      leftFootX = -0.2 - liftLeft * 0.18;
      rightFootX = -0.2 - liftRight * 0.18;
      leftArmX = -swing * 0.72;
      rightArmX = swing * 0.72;
      leftForearmX = -0.62;
      rightForearmX = -0.62;
      break;
    }
    case "talk": {
      const beat = Math.sin(elapsed * 4.8);
      rootY = Math.sin(elapsed * 2.4) * 0.012;
      torsoY = Math.sin(elapsed * 1.7) * 0.05;
      headY = Math.sin(elapsed * 2.1) * 0.1;
      headZ = Math.sin(elapsed * 3.2) * 0.025;
      rightArmZ = 0.5 + beat * 0.18;
      rightArmX = -0.18 + Math.cos(elapsed * 3.1) * 0.15;
      rightForearmX = -0.72 + beat * 0.24;
      rightForearmZ = -0.18;
      leftArmZ = -0.16;
      mouthOpen = 0.15 + (Math.sin(elapsed * 13) * 0.5 + 0.5) * 0.7;
      break;
    }
    case "eat": {
      const bite = Math.sin(elapsed * 4.2) * 0.5 + 0.5;
      torsoX = 0.06;
      headX = 0.12 + bite * 0.08;
      leftArmX = -0.92;
      rightArmX = -0.92;
      leftArmZ = -0.18;
      rightArmZ = 0.18;
      leftForearmX = -1.35 + bite * 0.28;
      rightForearmX = -1.22 + bite * 0.24;
      leftForearmZ = 0.11;
      rightForearmZ = -0.11;
      mouthOpen = 0.12 + bite * 0.78;
      break;
    }
    case "sit": {
      rootY = -0.02;
      torsoX = -0.035;
      leftLegX = -1.23;
      rightLegX = -1.23;
      leftShinX = 1.17;
      rightShinX = 1.17;
      leftFootX = 0.06;
      rightFootX = 0.06;
      leftArmX = -0.22;
      rightArmX = -0.22;
      leftForearmX = -0.6;
      rightForearmX = -0.6;
      leftArmZ = -0.16;
      rightArmZ = 0.16;
      headY = Math.sin(elapsed * 0.8) * 0.05;
      break;
    }
    case "happy": {
      const bounce = Math.sin(elapsed * 6.4);
      rootY = Math.max(0, bounce) * 0.12;
      hipsZ = Math.sin(elapsed * 3.2) * 0.04;
      torsoZ = -Math.sin(elapsed * 3.2) * 0.06;
      headZ = Math.sin(elapsed * 3.2) * 0.09;
      leftArmZ = -2.4 + bounce * 0.13;
      rightArmZ = 2.4 - bounce * 0.13;
      leftForearmX = -0.18;
      rightForearmX = -0.18;
      leftLegX = Math.sin(elapsed * 6.4) * 0.08;
      rightLegX = -Math.sin(elapsed * 6.4) * 0.08;
      browLeftZ = -0.08;
      browRightZ = 0.08;
      mouthOpen = 0.28;
      break;
    }
    case "sad": {
      rootY = -0.055;
      hipsZ = 0.035;
      torsoX = 0.13;
      torsoZ = Math.sin(elapsed * 1.2) * 0.012;
      headX = 0.22;
      headY = Math.sin(elapsed * 0.65) * 0.035;
      leftArmZ = 0.12;
      rightArmZ = -0.12;
      leftArmX = 0.1;
      rightArmX = 0.1;
      leftForearmX = -0.12;
      rightForearmX = -0.12;
      browLeftZ = 0.2;
      browRightZ = -0.2;
      mouthOpen = 0.04;
      break;
    }
    case "idle":
    default: {
      rootY = Math.sin(elapsed * 2.1) * 0.014;
      torsoZ = Math.sin(elapsed * 1.05) * 0.018;
      headY = Math.sin(elapsed * 0.72) * 0.055;
      headZ = -torsoZ * 0.7;
      leftArmZ = -0.08 - Math.sin(elapsed * 1.05) * 0.018;
      rightArmZ = 0.08 - Math.sin(elapsed * 1.05) * 0.018;
      break;
    }
  }

  setPositionY(joints.root, rootY, dt);
  setRotation(joints.hips, hipsX, hipsY, hipsZ, dt);
  setRotation(joints.torso, torsoX, torsoY, torsoZ, dt);
  setRotation(joints.head, headX, headY, headZ, dt);
  setRotation(joints.leftArm, leftArmX, 0, leftArmZ, dt);
  setRotation(joints.rightArm, rightArmX, 0, rightArmZ, dt);
  setRotation(joints.leftForearm, leftForearmX, 0, leftForearmZ, dt);
  setRotation(joints.rightForearm, rightForearmX, 0, rightForearmZ, dt);
  setRotation(joints.leftLeg, leftLegX, 0, 0, dt);
  setRotation(joints.rightLeg, rightLegX, 0, 0, dt);
  setRotation(joints.leftShin, leftShinX, 0, 0, dt);
  setRotation(joints.rightShin, rightShinX, 0, 0, dt);
  setRotation(joints.leftFoot, leftFootX, 0, 0, dt);
  setRotation(joints.rightFoot, rightFootX, 0, 0, dt);
  setRotation(joints.leftBrow, 0, 0, browLeftZ, dt);
  setRotation(joints.rightBrow, 0, 0, browRightZ, dt);
  setScaleY(joints.mouth, mouthOpen, dt);

  // A short, infrequent blink. Emotion states remain readable between blinks.
  const blinkCycle = (time + String(character.profile.id).length * 0.37) % 4.15;
  const blink = blinkCycle > 3.94 ? 0.08 : 1;
  setScaleY(joints.leftEye, blink, dt, 30);
  setScaleY(joints.rightEye, blink, dt, 30);
}

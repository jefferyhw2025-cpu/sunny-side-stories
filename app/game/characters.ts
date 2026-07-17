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

const HAIR_STYLES = [
  "crop",
  "bob",
  "pixie",
  "curly",
  "ponytail",
  "pigtails",
  "bun",
  "braid",
  "quiff",
  "undercut",
  "long",
  "afro",
] as const;
const FACE_STYLES = ["round", "oval", "soft-square", "heart", "slim", "broad"] as const;
const EYE_STYLES = [
  "classic",
  "round",
  "sparkle",
  "almond",
  "happy",
  "sleepy",
  "dot",
  "kind",
  "cat",
  "downturned",
  "focused",
  "lashes",
] as const;
const BROW_STYLES = ["soft", "straight", "arch", "bold", "curious", "gentle", "determined", "short"] as const;
const NOSE_STYLES = ["button", "tiny", "round", "soft-triangle", "short-line", "long", "upturned", "broad", "freckle", "pointed"] as const;
const MOUTH_STYLES = ["smile", "grin", "small", "open", "cat", "pout", "toothy", "neutral", "laugh", "dimple"] as const;
const OUTFIT_STYLES = ["tee", "overalls", "jacket", "dress", "sport", "sweater", "sailor", "hoodie"] as const;

const materialCache = new Map<string, CharacterMaterial>();
const geometryCache = new Map<string, THREE.BufferGeometry>();

function cachedGeometry<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
  const cached = geometryCache.get(key);
  if (cached) return cached as T;
  const result = create();
  result.userData.sharedCharacterAsset = true;
  geometryCache.set(key, result);
  return result;
}

function styleName(value: string | number): string {
  return String(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function resolveStyle<T extends readonly string[]>(
  value: string | number,
  styles: T,
  fallback: T[number],
): string {
  const requested = styleName(value);
  if (/^-?\d+$/.test(requested)) {
    const index = Number.parseInt(requested, 10);
    if (index >= 0 && index < styles.length) return styles[index];
    return fallback;
  }
  return requested || fallback;
}

function resolveFaceStyle(value: string | number): string {
  const requested = resolveStyle(value, FACE_STYLES, "round");
  if ((FACE_STYLES as readonly string[]).includes(requested)) return requested;
  if (includesAny(requested, ["round", "wide", "soft", "baby"])) return "round";
  if (includesAny(requested, ["long", "oval"])) return "oval";
  if (includesAny(requested, ["square", "angular", "strong"])) return "soft-square";
  if (includesAny(requested, ["heart", "pointed-chin"])) return "heart";
  if (includesAny(requested, ["slim", "narrow", "thin"])) return "slim";
  if (includesAny(requested, ["broad", "full"])) return "broad";
  return "round";
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
  const resolvedColor = new THREE.Color(color);
  const surface = options.surface ?? "detail";
  const key = [
    resolvedColor.getHexString(),
    surface,
    options.side ?? THREE.FrontSide,
    options.transparent ? 1 : 0,
    options.opacity ?? 1,
  ].join(":");
  const cached = materialCache.get(key);
  if (cached) return cached;

  const base = {
    color: resolvedColor,
    side: options.side ?? THREE.FrontSide,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    metalness: 0,
  };

  let result: CharacterMaterial;
  switch (surface) {
    case "skin":
      result = new THREE.MeshPhysicalMaterial({
        ...base,
        roughness: 0.71,
        clearcoat: 0.018,
        clearcoatRoughness: 0.9,
        sheen: 0.045,
        sheenColor: resolvedColor,
        sheenRoughness: 0.94,
      });
      break;
    case "fabric":
      result = new THREE.MeshPhysicalMaterial({
        ...base,
        roughness: 0.94,
        clearcoat: 0,
        sheen: 0.2,
        sheenColor: resolvedColor.clone().offsetHSL(0, 0, 0.08),
        sheenRoughness: 0.86,
      });
      break;
    case "leather":
      result = new THREE.MeshPhysicalMaterial({
        ...base,
        roughness: 0.48,
        clearcoat: 0.16,
        clearcoatRoughness: 0.58,
      });
      break;
    case "eye":
      result = new THREE.MeshPhysicalMaterial({
        ...base,
        roughness: 0.12,
        clearcoat: 0.82,
        clearcoatRoughness: 0.2,
      });
      break;
    case "hair":
      result = new THREE.MeshStandardMaterial({ ...base, roughness: 0.46 });
      break;
    case "detail":
    default:
      result = new THREE.MeshStandardMaterial({ ...base, roughness: 0.76 });
      break;
  }
  result.userData.sharedCharacterAsset = true;
  materialCache.set(key, result);
  return result;
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
  const resolved = resolveStyle(style, EYE_STYLES, "classic");
  const eye = joint(parent, x, 0.285, 0.535 + FRONT);
  const dark = material("#243044", { surface: "eye" });
  const white = material("#fffdf7", { surface: "eye" });
  const iris = material("#527d8e", { surface: "eye" });
  const highlight = material("#ffffff", { surface: "eye" });

  const circle = (radius: number, segments = 24) => cachedGeometry(
    `circle:${radius}:${segments}`,
    () => new THREE.CircleGeometry(radius, segments),
  );
  const addLashes = (outerSide: number, count = 2): void => {
    for (let index = 0; index < count; index += 1) {
      addMesh(
        eye,
        cachedGeometry("eye-lash", () => new THREE.BoxGeometry(0.055, 0.012, 0.014)),
        dark,
        [outerSide * (0.085 + index * 0.018), 0.06 - index * 0.018, 0.025],
        [1, 1, 1],
        [0, 0, outerSide * (28 + index * 12) * DEG],
      );
    }
  };

  if (includesAny(resolved, ["sleep", "closed", "calm", "happy"])) {
    const arc = addMesh(
      eye,
      cachedGeometry("eye-closed-arc", () => new THREE.TorusGeometry(0.085, 0.014, 7, 24, Math.PI)),
      dark,
      [0, resolved === "happy" ? -0.005 : 0.018, 0],
      [1.08, resolved === "happy" ? 0.72 : 0.42, 1],
      [0, 0, resolved === "happy" ? 0 : Math.PI],
    );
    arc.name = "eye-line";
    if (resolved === "happy") addLashes(x < 0 ? -1 : 1, 1);
    addMesh(eye, circle(0.04, 18), skinMaterial, [0, -0.035, -0.005], [1.6, 0.45, 1]);
  } else if (includesAny(resolved, ["dot", "tiny", "button"])) {
    addMesh(eye, circle(0.062, 22), dark, [0, 0, 0], [0.8, 1.12, 1]);
    addMesh(eye, circle(0.014, 14), highlight, [-0.017, 0.021, 0.012]);
  } else {
    const wide = includesAny(resolved, ["wide", "round", "sparkle", "kind", "lashes"]);
    const almond = includesAny(resolved, ["almond", "cat", "focused", "downturned"]);
    const eyeScaleX = almond ? 1.22 : wide ? 0.98 : 0.88;
    const eyeScaleY = almond ? 0.68 : wide ? 1.08 : 0.92;
    addMesh(
      eye,
      circle(wide ? 0.11 : 0.1),
      white,
      [0, 0, 0],
      [eyeScaleX, eyeScaleY, 1],
      [0, 0, resolved === "downturned" ? (x < 0 ? -7 : 7) * DEG : resolved === "cat" ? (x < 0 ? 6 : -6) * DEG : 0],
    );
    const irisRadius = wide ? 0.066 : 0.058;
    addMesh(eye, circle(irisRadius, 22), iris, [0, resolved === "kind" ? -0.012 : -0.004, 0.012]);
    addMesh(eye, circle(0.031, 20), dark, [0, -0.006, 0.023]);
    addMesh(eye, circle(resolved === "sparkle" ? 0.016 : 0.012, 14), highlight, [-0.016, 0.02, 0.034]);
    if (resolved === "sparkle") {
      addMesh(eye, circle(0.007, 10), highlight, [0.02, -0.02, 0.035]);
    }
    if (includesAny(resolved, ["lashes", "cat"])) addLashes(x < 0 ? -1 : 1, resolved === "lashes" ? 3 : 2);
    if (resolved === "focused") {
      addMesh(eye, cachedGeometry("focused-lid", () => new THREE.BoxGeometry(0.19, 0.018, 0.018)), dark, [0, 0.07, 0.025], [1, 1, 1], [0, 0, x < 0 ? -7 * DEG : 7 * DEG]);
    }
  }

  eye.userData.baseY = eye.position.y;
  return eye;
}

function createBrow(
  parent: THREE.Object3D,
  x: number,
  style: string,
  hairMaterial: CharacterMaterial,
): THREE.Group {
  const resolved = resolveStyle(style, BROW_STYLES, "soft");
  const brow = joint(parent, x, 0.46, 0.552 + FRONT);
  const bold = includesAny(resolved, ["bold", "thick", "strong", "determined"]);
  const arch = includesAny(resolved, ["arch", "curious", "raised", "gentle"]);
  const soft = includesAny(resolved, ["soft", "round", "gentle"]);
  const short = resolved === "short";
  const browMesh = addMesh(
    brow,
    soft
      ? cachedGeometry(`brow-arc:${bold ? "bold" : "fine"}`, () => new THREE.TorusGeometry(0.095, bold ? 0.023 : 0.016, 7, 20, Math.PI))
      : cachedGeometry(`brow-bar:${bold ? "bold" : "fine"}`, () => new THREE.CapsuleGeometry(bold ? 0.023 : 0.014, bold ? 0.135 : 0.145, 4, 12)),
    hairMaterial,
    [0, 0, 0],
    [short ? 0.7 : 1, arch ? 1.25 : 1, 1],
    soft ? [0, 0, 0] : [0, 0, 90 * DEG],
  );
  const baseTilt = resolved === "determined" ? -10 : resolved === "curious" ? 12 : arch ? 7 : 2;
  browMesh.rotation.z += (x < 0 ? 1 : -1) * baseTilt * DEG;
  brow.userData.baseY = brow.position.y;
  return brow;
}

function createNose(parent: THREE.Object3D, style: string, skinShadow: CharacterMaterial): void {
  const resolved = resolveStyle(style, NOSE_STYLES, "button");
  if (includesAny(resolved, ["point", "sharp", "long"])) {
    addMesh(
      parent,
      cachedGeometry(`nose-cone:${resolved}`, () => new THREE.ConeGeometry(resolved === "long" ? 0.046 : 0.058, resolved === "long" ? 0.18 : 0.135, 12)),
      skinShadow,
      [0, 0.195, 0.584],
      [1, 1, 1],
      [90 * DEG, 0, 0],
    );
  } else if (includesAny(resolved, ["line", "small", "subtle", "tiny"])) {
    const nose = addMesh(parent, cachedGeometry("nose-line", () => new THREE.CapsuleGeometry(0.015, 0.07, 4, 10)), skinShadow, [0, 0.2, 0.577], [1, resolved === "tiny" ? 0.65 : 1, 0.7]);
    nose.rotation.z = -5 * DEG;
  } else if (resolved === "soft-triangle" || resolved === "upturned") {
    addMesh(parent, cachedGeometry("nose-soft-triangle", () => new THREE.ConeGeometry(0.055, 0.07, 3)), skinShadow, [0, resolved === "upturned" ? 0.22 : 0.19, 0.582], [1, 1, 0.5], [90 * DEG, 0, resolved === "upturned" ? Math.PI : 0]);
  } else {
    const broad = resolved === "broad";
    addMesh(parent, cachedGeometry("nose-button", () => new THREE.SphereGeometry(0.062, 18, 12)), skinShadow, [0, 0.19, 0.578], [broad ? 1.22 : 0.86, broad ? 0.62 : 0.72, 0.72]);
  }
  if (resolved === "freckle") {
    const freckle = material("#9b654e", { surface: "detail" });
    for (const [x, y] of [[-0.09, 0.17], [-0.055, 0.15], [0.055, 0.155], [0.095, 0.18]] as const) {
      addMesh(parent, cachedGeometry("freckle-dot", () => new THREE.CircleGeometry(0.012, 10)), freckle, [x, y, 0.591], [1, 0.75, 1]);
    }
  }
}

function createMouth(parent: THREE.Object3D, style: string): THREE.Group {
  const resolved = resolveStyle(style, MOUTH_STYLES, "smile");
  const mouth = joint(parent, 0, 0.04, 0.574 + FRONT);
  const lip = material("#9e4051", { surface: "detail" });
  const inside = material("#5a2734", { surface: "detail" });
  const teeth = material("#fff9ed", { surface: "eye" });
  const tongue = material("#db7180", { surface: "skin" });
  const rest = new THREE.Group();
  rest.name = "mouth-rest";
  mouth.add(rest);
  const open = new THREE.Group();
  open.name = "mouth-open-expression";
  mouth.add(open);

  if (includesAny(resolved, ["small", "quiet", "neutral"])) {
    addMesh(rest, cachedGeometry("mouth-line", () => new THREE.CapsuleGeometry(0.012, 0.1, 4, 12)), lip, [0, 0, 0], [resolved === "small" ? 0.72 : 1, 1, 1], [0, 0, 90 * DEG]);
  } else if (resolved === "cat") {
    for (const side of [-1, 1]) {
      addMesh(rest, cachedGeometry("mouth-cat-half", () => new THREE.TorusGeometry(0.057, 0.014, 7, 18, Math.PI)), lip, [side * 0.05, 0.02, 0], [1, 0.62, 1], [0, 0, side < 0 ? Math.PI : 0]);
    }
  } else if (resolved === "pout") {
    addMesh(rest, cachedGeometry("mouth-pout", () => new THREE.TorusGeometry(0.085, 0.016, 7, 20, Math.PI)), lip, [0, -0.01, 0], [1.12, 0.65, 1]);
  } else {
    const smile = addMesh(
      rest,
      cachedGeometry("mouth-smile", () => new THREE.TorusGeometry(0.105, 0.017, 7, 22, Math.PI)),
      lip,
      [0, 0.035, 0],
      [resolved === "dimple" ? 0.94 : 1.15, 0.8, 1],
      [0, 0, Math.PI],
    );
    smile.name = "smile";
    if (resolved === "dimple") {
      for (const side of [-1, 1]) addMesh(rest, cachedGeometry("dimple-dot", () => new THREE.CircleGeometry(0.014, 10)), lip, [side * 0.13, 0.017, 0]);
    }
  }

  const openMouth = addMesh(open, cachedGeometry("mouth-open", () => new THREE.CircleGeometry(0.105, 24)), inside, [0, -0.008, 0], [resolved === "laugh" ? 1.4 : 1.15, 0.78, 1]);
  openMouth.name = "open-mouth";
  addMesh(open, cachedGeometry("mouth-tongue", () => new THREE.CircleGeometry(0.061, 18, 0, Math.PI)), tongue, [0, -0.043, 0.014], [1.15, 0.58, 1], [0, 0, Math.PI]);
  if (includesAny(resolved, ["grin", "big", "toothy", "laugh"])) {
    addMesh(open, cachedGeometry("mouth-teeth", () => new THREE.BoxGeometry(0.19, 0.042, 0.012)), teeth, [0, 0.034, 0.016]);
  }
  const baseOpen = includesAny(resolved, ["grin", "big", "open", "toothy", "laugh"]);
  rest.visible = !baseOpen;
  open.visible = baseOpen;
  open.scale.y = baseOpen ? 0.7 : 0.08;
  mouth.userData.rest = rest;
  mouth.userData.open = open;
  mouth.userData.baseOpen = baseOpen;
  mouth.userData.style = resolved;
  return mouth;
}

function addHair(
  head: THREE.Group,
  profile: CharacterProfile,
  headScale: readonly [number, number, number],
  hairMaterial: CharacterMaterial,
  hairHighlight: CharacterMaterial,
): void {
  const style = resolveStyle(profile.hairStyle, HAIR_STYLES, "crop");
  const capGeometry = cachedGeometry("hair-cap", () => new THREE.SphereGeometry(0.625, 30, 18, 0, Math.PI * 2, 0, Math.PI * 0.61));
  const lockGeometry = cachedGeometry("hair-lock", () => new THREE.SphereGeometry(0.18, 20, 14));
  const curlGeometry = cachedGeometry("hair-curl", () => new THREE.SphereGeometry(0.22, 18, 14));
  const sideGeometry = cachedGeometry("hair-side-lock", () => new THREE.CapsuleGeometry(0.105, 0.34, 7, 16));
  const cap = addMesh(
    head,
    capGeometry,
    hairMaterial,
    [0, 0.35, -0.012],
    [headScale[0] * 1.04, headScale[1] * 1.025, headScale[2] * 1.045],
  );
  cap.name = "hair-cap";

  const addLock = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
    accent = false,
  ): void => {
    addMesh(head, lockGeometry, accent ? hairHighlight : hairMaterial, [x * headScale[0], y, z * headScale[2]], [sx, sy, sz], [0, 0, angle * DEG]);
  };

  const addPartedFringe = (sweep = 0, short = false): void => {
    const fringe: ReadonlyArray<readonly [number, number, number, number, boolean]> = [
      [-0.35, 0.53, -10 + sweep, short ? 0.72 : 0.94, false],
      [-0.13, 0.59, -3 + sweep, short ? 0.82 : 1.1, true],
      [0.11, 0.58, 5 + sweep, short ? 0.76 : 1.05, false],
      [0.34, 0.52, 11 + sweep, short ? 0.68 : 0.9, true],
    ];
    for (const [x, y, angle, width, accent] of fringe) addLock(x, y, 0.505, width, short ? 0.42 : 0.55, 0.34, angle, accent);
  };

  const addSideburns = (length = 1): void => {
    for (const side of [-1, 1]) {
      addMesh(head, sideGeometry, hairMaterial, [side * 0.55 * headScale[0], 0.25 - (length - 1) * 0.08, 0.2], [0.5, length, 0.58], [0, 0, side * -6 * DEG]);
    }
  };

  const curled = includesAny(style, ["curl", "afro", "cloud"]);
  if (!curled) addPartedFringe(includesAny(style, ["pixie", "undercut"]) ? 8 : 0, includesAny(style, ["crop", "pixie", "undercut"]));

  if (includesAny(style, ["bob", "page"])) {
    addSideburns(1.28);
    for (const side of [-1, 1]) {
      addMesh(head, sideGeometry, hairMaterial, [side * 0.51 * headScale[0], 0.06, -0.08], [1.02, 1.28, 1.28], [0, 0, side * -4 * DEG]);
      addLock(side * 0.44, 0.02, 0.29, 0.72, 1.18, 0.48, side * 7, side > 0);
    }
  } else if (includesAny(style, ["pixie"])) {
    addSideburns(0.7);
    const tufts: ReadonlyArray<readonly [number, number, number]> = [[-0.42, 0.69, -28], [-0.17, 0.76, -13], [0.11, 0.76, 7], [0.39, 0.68, 25]];
    for (const [x, y, angle] of tufts) addMesh(head, cachedGeometry("hair-tuft-small", () => new THREE.ConeGeometry(0.11, 0.3, 14)), hairMaterial, [x, y, -0.02], [1, 1, 0.85], [0, 0, angle * DEG]);
  } else if (curled) {
    cap.visible = false;
    const afro = includesAny(style, ["afro", "cloud"]);
    const curls: ReadonlyArray<readonly [number, number, number, number]> = afro
      ? [[-0.55, 0.52, 0, 1.25], [-0.3, 0.77, 0, 1.36], [0.02, 0.84, -0.02, 1.42], [0.35, 0.74, -0.02, 1.34], [0.57, 0.48, 0, 1.22], [-0.61, 0.22, -0.08, 1.2], [0.61, 0.2, -0.08, 1.2], [-0.42, 0.34, -0.42, 1.35], [-0.12, 0.49, -0.5, 1.43], [0.22, 0.47, -0.49, 1.4], [0.47, 0.31, -0.4, 1.31]]
      : [[-0.48, 0.53, 0, 1], [-0.22, 0.7, 0, 1.08], [0.08, 0.73, -0.01, 1.12], [0.39, 0.57, -0.01, 1.04], [-0.52, 0.27, -0.04, 0.98], [0.51, 0.26, -0.04, 1], [-0.34, 0.34, -0.37, 1.12], [-0.02, 0.44, -0.45, 1.2], [0.33, 0.33, -0.37, 1.12]];
    for (let index = 0; index < curls.length; index += 1) {
      const [x, y, z, scale] = curls[index];
      addMesh(head, curlGeometry, index % 4 === 1 ? hairHighlight : hairMaterial, [x * headScale[0], y, z], [scale, scale * 0.92, scale]);
    }
  } else if (includesAny(style, ["pigtail", "twin"])) {
    addSideburns(0.92);
    for (const side of [-1, 1]) {
      addMesh(head, cachedGeometry("hair-tail", () => new THREE.CapsuleGeometry(0.13, 0.42, 7, 16)), hairMaterial, [side * 0.66, 0.22, -0.18], [1.12, 1, 1.08], [0, 0, side * -18 * DEG]);
      addMesh(head, cachedGeometry("hair-tie", () => new THREE.TorusGeometry(0.12, 0.032, 8, 20)), hairHighlight, [side * 0.57, 0.49, -0.14], [1, 1, 1], [90 * DEG, 0, 0]);
    }
  } else if (includesAny(style, ["pony", "tail"])) {
    addSideburns(0.9);
    addMesh(head, cachedGeometry("hair-ponytail", () => new THREE.CapsuleGeometry(0.16, 0.58, 8, 18)), hairMaterial, [0.16, 0.17, -0.55], [1.15, 1, 1.08], [16 * DEG, 0, -12 * DEG]);
    addMesh(head, cachedGeometry("hair-tie", () => new THREE.TorusGeometry(0.12, 0.032, 8, 20)), hairHighlight, [0.12, 0.55, -0.45], [1, 1, 1], [90 * DEG, 0, 0]);
  } else if (includesAny(style, ["braid"])) {
    addSideburns(1.02);
    for (let index = 0; index < 5; index += 1) {
      addMesh(head, cachedGeometry("hair-braid-segment", () => new THREE.SphereGeometry(0.14, 16, 12)), index % 2 ? hairHighlight : hairMaterial, [0.28 + Math.sin(index * 1.7) * 0.035, 0.38 - index * 0.19, -0.48], [1, 1.18, 0.9], [0, 0, (index % 2 ? -8 : 8) * DEG]);
    }
    addMesh(head, cachedGeometry("hair-braid-tie", () => new THREE.TorusGeometry(0.085, 0.024, 7, 18)), hairHighlight, [0.28, -0.42, -0.47], [1, 1, 1], [90 * DEG, 0, 0]);
  } else if (includesAny(style, ["bun", "topknot", "knot"])) {
    addSideburns(0.82);
    addMesh(head, cachedGeometry("hair-bun", () => new THREE.SphereGeometry(0.29, 24, 18)), hairMaterial, [0.2, 0.86, -0.11], [1, 0.9, 1]);
    addMesh(head, cachedGeometry("hair-bun-ring", () => new THREE.TorusGeometry(0.225, 0.042, 9, 24)), hairHighlight, [0.2, 0.85, -0.09], [1, 1, 1], [90 * DEG, 0, 0]);
  } else if (includesAny(style, ["quiff", "spike", "messy"])) {
    addSideburns(0.72);
    const tufts: ReadonlyArray<readonly [number, number, number, number]> = [[-0.38, 0.7, -20, 0.33], [-0.14, 0.82, -9, 0.42], [0.12, 0.85, 7, 0.45], [0.39, 0.74, 20, 0.35]];
    for (let index = 0; index < tufts.length; index += 1) {
      const [x, y, angle, height] = tufts[index];
      addMesh(head, cachedGeometry(`hair-quiff:${height}`, () => new THREE.ConeGeometry(0.145, height, 16)), index === 2 ? hairHighlight : hairMaterial, [x, y, 0.02], [1, 1, 0.92], [0, 0, angle * DEG]);
    }
  } else if (includesAny(style, ["undercut", "fade"])) {
    addSideburns(0.45);
    cap.scale.y *= 0.86;
    cap.position.y += 0.08;
    for (const [x, y, angle] of [[-0.28, 0.72, -16], [0.01, 0.78, -4], [0.29, 0.72, 12]] as const) {
      addMesh(head, cachedGeometry("hair-undercut-top", () => new THREE.CapsuleGeometry(0.13, 0.28, 6, 14)), x > 0 ? hairHighlight : hairMaterial, [x, y, 0.02], [1.12, 1, 1], [0, 0, angle * DEG]);
    }
  } else if (includesAny(style, ["long", "straight"])) {
    addSideburns(1.45);
    addMesh(head, cachedGeometry("hair-long-back", () => new THREE.CapsuleGeometry(0.35, 0.7, 10, 22)), hairMaterial, [0, -0.02, -0.43], [1.22, 1, 0.5]);
    for (const side of [-1, 1]) addMesh(head, sideGeometry, side > 0 ? hairHighlight : hairMaterial, [side * 0.51, -0.03, 0.04], [1.12, 1.65, 1.06], [0, 0, side * -3 * DEG]);
  } else {
    addSideburns(0.64);
    addLock(-0.08, 0.61, 0.48, 1.65, 0.25, 0.31, -7, true);
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
): string {
  const outfit = resolveStyle(profile.outfitStyle, OUTFIT_STYLES, "tee");
  const relaxed = includesAny(outfit, ["sweater", "hoodie"]);
  addMesh(torso, cachedGeometry("outfit-torso", () => new THREE.CylinderGeometry(0.43, 0.53, 0.82, 24)), shirtMaterial, [0, 0, 0], [relaxed ? 1.05 : 1, 1, relaxed ? 0.87 : 0.82]);
  addMesh(torso, cachedGeometry("outfit-hem", () => new THREE.CylinderGeometry(0.445, 0.54, 0.12, 24)), shirtShadow, [0, -0.36, 0], [relaxed ? 1.05 : 1, 1, 0.83]);
  addMesh(torso, cachedGeometry("outfit-neckline", () => new THREE.TorusGeometry(0.17, 0.03, 10, 28)), shirtAccent, [0, 0.38, 0.19], [1, 0.48, 0.9], [90 * DEG, 0, 0]);

  if (includesAny(outfit, ["overall", "dungaree"])) {
    addMesh(torso, cachedGeometry("overall-bib", () => new THREE.BoxGeometry(0.46, 0.48, 0.07)), trouserMaterial, [0, -0.06, 0.405]);
    for (const side of [-1, 1]) {
      addMesh(torso, cachedGeometry("overall-strap", () => new THREE.BoxGeometry(0.075, 0.5, 0.06)), trouserMaterial, [side * 0.21, 0.25, 0.38], [1, 1, 1], [0, 0, side * -8 * DEG]);
      addMesh(torso, cachedGeometry("overall-button", () => new THREE.SphereGeometry(0.03, 12, 8)), shirtAccent, [side * 0.18, 0.17, 0.45], [1, 1, 0.5]);
    }
    addMesh(torso, cachedGeometry("overall-pocket", () => new THREE.BoxGeometry(0.22, 0.16, 0.035)), shirtAccent, [0, -0.09, 0.455]);
  } else if (includesAny(outfit, ["jacket", "coat", "blazer"])) {
    for (const side of [-1, 1]) {
      addMesh(torso, cachedGeometry("jacket-panel", () => new THREE.BoxGeometry(0.38, 0.7, 0.055)), shirtShadow, [side * 0.19, -0.02, 0.405], [1, 1, 1], [0, 0, side * 2 * DEG]);
      addMesh(torso, cachedGeometry("jacket-lapel", () => new THREE.ConeGeometry(0.13, 0.38, 3)), shirtAccent, [side * 0.14, 0.17, 0.45], [1, 1, 0.4], [0, 0, side * 14 * DEG]);
    }
    addMesh(torso, cachedGeometry("jacket-seam", () => new THREE.BoxGeometry(0.025, 0.62, 0.025)), shirtAccent, [0, -0.03, 0.45]);
    for (const y of [0.12, -0.08, -0.28]) {
      addMesh(torso, cachedGeometry("jacket-button", () => new THREE.SphereGeometry(0.028, 12, 8)), shirtAccent, [0.045, y, 0.46], [1, 1, 0.5]);
    }
  } else if (includesAny(outfit, ["dress", "skirt"])) {
    addMesh(hips, cachedGeometry("dress-skirt", () => new THREE.CylinderGeometry(0.43, 0.68, 0.56, 28)), shirtMaterial, [0, -0.05, 0], [1, 1, 0.86]);
    addMesh(hips, cachedGeometry("dress-hem", () => new THREE.CylinderGeometry(0.69, 0.69, 0.07, 28)), shirtAccent, [0, -0.32, 0], [1, 1, 0.86]);
    addMesh(torso, cachedGeometry("dress-belt", () => new THREE.BoxGeometry(0.78, 0.08, 0.06)), shirtAccent, [0, -0.31, 0.36]);
  } else if (includesAny(outfit, ["sport", "athletic", "active"])) {
    addMesh(torso, cachedGeometry("sport-stripe", () => new THREE.BoxGeometry(0.08, 0.72, 0.04)), shirtAccent, [0.28, -0.03, 0.42]);
    addMesh(hips, cachedGeometry("sport-shorts", () => new THREE.BoxGeometry(0.77, 0.22, 0.46)), trouserMaterial, [0, -0.09, 0]);
    addMesh(torso, cachedGeometry("sport-number", () => new THREE.CircleGeometry(0.14, 24)), shirtAccent, [0, 0.03, 0.445], [1, 1, 1]);
  } else if (includesAny(outfit, ["sweater", "jumper", "knit"])) {
    for (const y of [-0.24, -0.1, 0.04]) addMesh(torso, cachedGeometry("sweater-rib", () => new THREE.BoxGeometry(0.67, 0.025, 0.025)), shirtAccent, [0, y, 0.435]);
    addMesh(torso, cachedGeometry("sweater-patch", () => new THREE.CircleGeometry(0.1, 24)), shirtShadow, [0.22, 0.18, 0.445], [1, 0.72, 1]);
  } else if (includesAny(outfit, ["sailor", "navy"])) {
    addMesh(torso, cachedGeometry("sailor-collar", () => new THREE.CircleGeometry(0.34, 3)), shirtAccent, [0, 0.21, 0.43], [1.35, 0.9, 1], [0, 0, Math.PI]);
    for (const side of [-1, 1]) addMesh(torso, cachedGeometry("sailor-bow", () => new THREE.ConeGeometry(0.105, 0.24, 3)), shirtShadow, [side * 0.105, 0.07, 0.47], [1, 1, 0.45], [0, 0, side * 90 * DEG]);
    addMesh(torso, cachedGeometry("sailor-knot", () => new THREE.SphereGeometry(0.055, 14, 10)), shirtAccent, [0, 0.07, 0.49], [1, 1, 0.55]);
  } else if (includesAny(outfit, ["hoodie", "hooded"])) {
    addMesh(torso, cachedGeometry("hoodie-hood", () => new THREE.TorusGeometry(0.31, 0.095, 12, 30, Math.PI * 1.55)), shirtShadow, [0, 0.39, -0.03], [1, 0.9, 0.75], [90 * DEG, 0, -0.28 * Math.PI]);
    addMesh(torso, cachedGeometry("hoodie-pocket", () => new THREE.BoxGeometry(0.42, 0.19, 0.055)), shirtAccent, [0, -0.2, 0.445]);
    for (const side of [-1, 1]) {
      addMesh(torso, cachedGeometry("hoodie-string", () => new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8)), shirtAccent, [side * 0.09, 0.22, 0.46]);
      addMesh(torso, cachedGeometry("hoodie-string-tip", () => new THREE.SphereGeometry(0.018, 10, 7)), shirtShadow, [side * 0.09, 0.07, 0.46]);
    }
  } else {
    addMesh(torso, cachedGeometry("tee-stripe", () => new THREE.BoxGeometry(0.57, 0.055, 0.055)), shirtAccent, [0, 0.16, 0.42], [1, 1, 1], [0, 0, -3 * DEG]);
    addMesh(torso, cachedGeometry("tee-pocket", () => new THREE.BoxGeometry(0.2, 0.15, 0.025)), shirtShadow, [0.19, -0.11, 0.445], [1, 1, 1], [0, 0, -2 * DEG]);
  }
  return outfit;
}

function addArm(
  chest: THREE.Group,
  side: -1 | 1,
  skinMaterial: CharacterMaterial,
  shirtMaterial: CharacterMaterial,
  shirtAccent: CharacterMaterial,
  outfitStyle: string,
): { shoulder: THREE.Group; arm: THREE.Group; forearm: THREE.Group; hand: THREE.Group } {
  const shoulder = joint(chest, side * 0.49, 0.25, 0);
  const arm = joint(shoulder, 0, 0, 0);
  const longSleeve = includesAny(outfitStyle, ["jacket", "sweater", "hoodie", "coat"]);
  addMesh(arm, cachedGeometry("arm-upper", () => new THREE.CylinderGeometry(0.105, 0.09, 0.38, 18)), shirtMaterial, [0, -0.18, 0]);
  addMesh(arm, cachedGeometry("sleeve-cuff", () => new THREE.CylinderGeometry(0.112, 0.112, 0.07, 18)), shirtAccent, [0, -0.36, 0]);

  const forearm = joint(arm, 0, -0.39, 0);
  addMesh(forearm, cachedGeometry("arm-forearm", () => new THREE.CylinderGeometry(0.085, 0.073, 0.38, 18)), longSleeve ? shirtMaterial : skinMaterial, [0, -0.18, 0]);
  if (longSleeve) addMesh(forearm, cachedGeometry("wrist-cuff", () => new THREE.CylinderGeometry(0.088, 0.088, 0.07, 18)), shirtAccent, [0, -0.36, 0]);
  const hand = joint(forearm, 0, -0.39, 0);
  addMesh(hand, cachedGeometry("hand-palm", () => new THREE.SphereGeometry(0.105, 18, 13)), skinMaterial, [0, -0.055, 0.01], [0.82, 1.08, 0.7]);
  addMesh(
    hand,
    cachedGeometry("hand-thumb", () => new THREE.CapsuleGeometry(0.028, 0.055, 4, 10)),
    skinMaterial,
    [-side * 0.071, -0.045, 0.045],
    [0.82, 1, 0.82],
    [0, 0, side * 24 * DEG],
  );
  for (const offset of [-0.034, 0, 0.034]) {
    addMesh(hand, cachedGeometry("hand-finger", () => new THREE.CapsuleGeometry(0.016, 0.055, 4, 9)), skinMaterial, [offset, -0.115, 0.035], [1, 1, 0.85]);
  }
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
  const resolvedOutfit = resolveStyle(outfitStyle, OUTFIT_STYLES, "tee");
  const dress = includesAny(resolvedOutfit, ["dress", "skirt"]);
  const upperMaterial = dress ? skinMaterial : trouserMaterial;
  addMesh(leg, cachedGeometry("leg-upper", () => new THREE.CylinderGeometry(0.13, 0.115, 0.5, 18)), upperMaterial, [0, -0.24, 0]);

  const shin = joint(leg, 0, -0.5, 0);
  addMesh(shin, cachedGeometry("leg-shin", () => new THREE.CylinderGeometry(0.11, 0.085, 0.47, 18)), skinMaterial, [0, -0.22, 0]);
  addMesh(shin, cachedGeometry("shoe-collar", () => new THREE.CylinderGeometry(0.105, 0.105, 0.14, 18)), shoeMaterial, [0, -0.4, 0]);

  const foot = joint(shin, 0, -0.47, 0.08);
  addMesh(foot, cachedGeometry("shoe-upper", () => new THREE.CapsuleGeometry(0.105, 0.2, 6, 16)), shoeMaterial, [0, -0.015, 0.105], [1.08, 1, 1], [90 * DEG, 0, 0]);
  addMesh(foot, cachedGeometry("shoe-toe", () => new THREE.SphereGeometry(0.12, 18, 12)), shoeMaterial, [0, -0.02, 0.28], [1.08, 0.72, 1.15]);
  addMesh(foot, cachedGeometry("shoe-sole", () => new THREE.BoxGeometry(0.27, 0.045, 0.43)), material("#e9edf0"), [0, -0.11, 0.12]);
  addMesh(foot, cachedGeometry("shoe-lace", () => new THREE.BoxGeometry(0.12, 0.018, 0.11)), material("#d7dde2"), [0, 0.07, 0.15], [1, 1, 1], [0, 0, 0]);
  return { leg, shin, foot };
}

function createHeadGeometry(faceStyle: string): THREE.BufferGeometry {
  return cachedGeometry(`face:${faceStyle}`, () => {
    const geometry = new THREE.SphereGeometry(0.62, 36, 26);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const normalizedY = THREE.MathUtils.clamp(y / 0.62, -1, 1);
      let width = 1;
      let depth = 1;
      if (faceStyle === "heart") {
        width = THREE.MathUtils.lerp(0.82, 1.08, (normalizedY + 1) * 0.5);
        depth = THREE.MathUtils.lerp(0.94, 1.02, (normalizedY + 1) * 0.5);
      } else if (faceStyle === "soft-square") {
        width = 1 + 0.075 * (1 - Math.abs(normalizedY));
        if (normalizedY < -0.35) width *= 1.035;
        depth = 0.96;
      } else if (faceStyle === "broad") {
        width = 1.07 + 0.04 * (1 - Math.abs(normalizedY));
        depth = 0.98;
      } else if (faceStyle === "slim") {
        width = THREE.MathUtils.lerp(0.86, 0.96, (normalizedY + 1) * 0.5);
        depth = 0.95;
      } else if (faceStyle === "oval") {
        width = 0.96;
        depth = 0.98;
      }
      position.setXYZ(index, x * width, y, z * depth);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  });
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
  const hips = joint(root, 0, 1.13, 0);
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

  const outfitStyle = addOutfit(torso, hips, profile, shirtMaterial, shirtShadow, shirtAccent, trouserMaterial);
  addMesh(neck, cachedGeometry("neck", () => new THREE.CylinderGeometry(0.16, 0.18, 0.25, 20)), skinMaterial, [0, -0.08, 0]);

  const face = resolveFaceStyle(profile.faceShape);
  const headScale: readonly [number, number, number] = face === "round"
    ? [1.02, 0.98, 0.96]
    : face === "oval"
      ? [0.94, 1.07, 0.94]
      : face === "soft-square"
        ? [0.99, 1, 0.94]
        : face === "heart"
          ? [1, 1.02, 0.94]
          : face === "slim"
            ? [0.92, 1.08, 0.93]
            : [1.04, 0.98, 0.95];
  const headMesh = addMesh(head, createHeadGeometry(face), skinMaterial, [0, 0.25, 0], headScale);
  headMesh.name = "face";

  addHair(head, profile, headScale, hairMaterial, hairHighlight);
  const eyeStyle = resolveStyle(profile.eyeStyle, EYE_STYLES, "classic");
  const eyes = joint(head, 0, 0, 0);
  eyes.name = "eyes";
  const leftEye = createEye(eyes, -0.2, eyeStyle, skinMaterial);
  const rightEye = createEye(eyes, 0.2, eyeStyle, skinMaterial);
  leftEye.name = "left-eye";
  rightEye.name = "right-eye";
  const browStyle = resolveStyle(profile.browStyle, BROW_STYLES, "soft");
  const leftBrow = createBrow(head, -0.2, browStyle, hairMaterial);
  const rightBrow = createBrow(head, 0.2, browStyle, hairMaterial);
  leftBrow.name = "left-brow";
  rightBrow.name = "right-brow";
  createNose(head, resolveStyle(profile.noseStyle, NOSE_STYLES, "button"), skinShadow);
  const mouth = createMouth(head, resolveStyle(profile.mouthStyle, MOUTH_STYLES, "smile"));
  mouth.name = "mouth";

  // Ears and subtle cheeks break up the face silhouette without noisy outlines.
  for (const side of [-1, 1]) {
    addMesh(head, cachedGeometry("ear-outer", () => new THREE.SphereGeometry(0.105, 18, 12)), skinMaterial, [side * 0.59 * headScale[0], 0.24, -0.01], [0.62, 1, 0.52]);
    addMesh(head, cachedGeometry("ear-inner", () => new THREE.TorusGeometry(0.052, 0.012, 7, 18, Math.PI * 1.35)), skinShadow, [side * 0.603 * headScale[0], 0.24, 0.035], [0.58, 1, 0.5], [0, 0, side < 0 ? -0.2 * Math.PI : 0.45 * Math.PI]);
    addMesh(head, cachedGeometry("cheek", () => new THREE.CircleGeometry(0.075, 18)), material("#e88486", { transparent: true, opacity: 0.24, surface: "skin" }), [side * 0.34, 0.11, 0.545], [1.25, 0.58, 1]);
  }

  addTraitDetail(chest, head, profile.trait, shirtAccent, material("#293547", { surface: "leather" }));
  const left = addArm(chest, -1, skinMaterial, shirtMaterial, shirtAccent, outfitStyle);
  const right = addArm(chest, 1, skinMaterial, shirtMaterial, shirtAccent, outfitStyle);
  const leftLeg = addLeg(hips, -1, skinMaterial, trouserMaterial, shoeMaterial, outfitStyle);
  const rightLeg = addLeg(hips, 1, skinMaterial, trouserMaterial, shoeMaterial, outfitStyle);

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

function updateMouthExpression(
  mouth: THREE.Group,
  openness: number,
  state: CharacterState,
  delta: number,
): void {
  const rest = mouth.userData.rest as THREE.Group | undefined;
  const open = mouth.userData.open as THREE.Group | undefined;
  if (!rest || !open) return;
  const baseOpen = Boolean(mouth.userData.baseOpen);
  const targetOpen = THREE.MathUtils.clamp(Math.max(openness, baseOpen && state === "idle" ? 0.62 : 0), 0, 1);
  const currentOpen = Number.isFinite(open.userData.amount) ? Number(open.userData.amount) : targetOpen;
  const amount = damp(currentOpen, targetOpen, 22, delta);
  open.userData.amount = amount;
  open.visible = amount > 0.035;
  rest.visible = amount < 0.72;
  open.scale.y = damp(open.scale.y, 0.12 + amount * 0.92, 20, delta);
  open.scale.x = damp(open.scale.x, state === "happy" ? 1.16 : state === "sad" ? 0.82 : 1, 14, delta);
  rest.scale.y = damp(rest.scale.y, state === "happy" ? 1.12 : state === "sad" ? 0.78 : 1, 14, delta);
  rest.rotation.z = damp(rest.rotation.z, state === "sad" ? Math.PI : 0, 12, delta);
  mouth.position.y = damp(mouth.position.y, state === "sad" ? 0.02 : state === "happy" ? 0.055 : 0.04, 12, delta);
}

function profileBlinkOffset(profile: CharacterProfile): number {
  const value = `${profile.id}:${profile.name}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) % 997;
  return hash / 997;
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
  let browOffsetY = 0;
  let mouthOpen = 0;

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
      const syllable = Math.sin(elapsed * 13.2) * 0.62 + Math.sin(elapsed * 7.1) * 0.24;
      mouthOpen = 0.24 + Math.max(0, syllable) * 0.72;
      browOffsetY = Math.sin(elapsed * 2.6) * 0.015;
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
      mouthOpen = bite > 0.58 ? 0.78 : 0.12 + bite * 0.18;
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
      browOffsetY = 0.025;
      mouthOpen = 0.56 + Math.max(0, bounce) * 0.18;
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
      browOffsetY = -0.035;
      mouthOpen = 0;
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
  setPositionY(joints.leftBrow, Number(joints.leftBrow.userData.baseY ?? 0.46) + browOffsetY, dt);
  setPositionY(joints.rightBrow, Number(joints.rightBrow.userData.baseY ?? 0.46) + browOffsetY, dt);
  updateMouthExpression(joints.mouth, mouthOpen, state, dt);

  // Ease through a complete lid closure instead of snapping between two scales.
  const cycleLength = 4.1 + profileBlinkOffset(character.profile) * 1.35;
  const blinkCycle = (time + profileBlinkOffset(character.profile) * cycleLength) % cycleLength;
  const blinkStart = cycleLength - 0.25;
  const blinkWave = blinkCycle > blinkStart
    ? Math.sin(((blinkCycle - blinkStart) / (cycleLength - blinkStart)) * Math.PI)
    : 0;
  let leftBlink = 1 - blinkWave * 0.94;
  let rightBlink = leftBlink;
  if (state === "happy") {
    const happySquint = 0.28 + Math.max(0, Math.sin(elapsed * 6.4)) * 0.16;
    leftBlink = Math.min(leftBlink, happySquint);
    rightBlink = Math.min(rightBlink, happySquint);
  } else if (state === "sad") {
    leftBlink = Math.min(leftBlink, 0.7);
    rightBlink = Math.min(rightBlink, 0.7);
  } else if (state === "eat" && Math.sin(elapsed * 4.2) > 0.82) {
    leftBlink = Math.min(leftBlink, 0.36);
    rightBlink = Math.min(rightBlink, 0.36);
  }
  setScaleY(joints.leftEye, leftBlink, dt, 30);
  setScaleY(joints.rightEye, rightBlink, dt, 30);
}

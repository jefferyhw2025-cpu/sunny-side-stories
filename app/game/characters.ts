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
  root: THREE.Bone;
  hips: THREE.Bone;
  torso: THREE.Bone;
  chest: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  leftShoulder: THREE.Bone;
  rightShoulder: THREE.Bone;
  leftArm: THREE.Bone;
  rightArm: THREE.Bone;
  /** Director-friendly aliases of leftArm/rightArm. */
  armL: THREE.Bone;
  armR: THREE.Bone;
  leftForearm: THREE.Bone;
  rightForearm: THREE.Bone;
  leftHand: THREE.Bone;
  rightHand: THREE.Bone;
  leftLeg: THREE.Bone;
  rightLeg: THREE.Bone;
  /** Director-friendly aliases of leftLeg/rightLeg. */
  legL: THREE.Bone;
  legR: THREE.Bone;
  leftShin: THREE.Bone;
  rightShin: THREE.Bone;
  leftFoot: THREE.Bone;
  rightFoot: THREE.Bone;
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
  /** Real transform skeleton; geometry is parented to its corresponding bones. */
  skeleton: THREE.Skeleton;
  profile: CharacterProfile;
  animation: CharacterAnimation;
  /** Optional authored, skinned visual. Procedural residents leave this unset. */
  assetRuntime?: CharacterAssetRuntime;
}

export interface CharacterAssetRuntime {
  source: "chibi-gltf";
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<CharacterState, THREE.AnimationAction>>;
  activeAction: THREE.AnimationAction | null;
  visualRoot: THREE.Group;
  leftFoot: THREE.Bone;
  rightFoot: THREE.Bone;
  /** Local child markers follow the animated foot rotation in world space. */
  leftSoleMarker: THREE.Object3D;
  rightSoleMarker: THREE.Object3D;
  displayHeight: number;
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

/**
 * A revolved, softly tailored silhouette.  Using an authored profile instead
 * of a cylinder/capsule keeps the body rounded while still giving it a real
 * shoulder, waist and hem line.  That distinction is important at the small
 * on-screen scale where a generic capsule reads as a carved peg.
 */
function createTailoredTorsoGeometry(): THREE.BufferGeometry {
  return cachedGeometry("outfit-tailored-body-v6", () => {
    const profile = [
      new THREE.Vector2(0, -0.49),
      new THREE.Vector2(0.31, -0.49),
      new THREE.Vector2(0.39, -0.41),
      new THREE.Vector2(0.415, -0.16),
      new THREE.Vector2(0.405, 0.16),
      new THREE.Vector2(0.355, 0.37),
      new THREE.Vector2(0.25, 0.47),
      new THREE.Vector2(0, 0.47),
    ];
    const geometry = new THREE.LatheGeometry(profile, 36);
    geometry.computeVertexNormals();
    return geometry;
  });
}

function createRoundedShortsGeometry(): THREE.BufferGeometry {
  return cachedGeometry("outfit-rounded-shorts-v6", () => {
    const profile = [
      new THREE.Vector2(0, -0.21),
      new THREE.Vector2(0.33, -0.21),
      new THREE.Vector2(0.405, -0.13),
      new THREE.Vector2(0.415, 0.05),
      new THREE.Vector2(0.36, 0.15),
      new THREE.Vector2(0, 0.15),
    ];
    const geometry = new THREE.LatheGeometry(profile, 32);
    geometry.computeVertexNormals();
    return geometry;
  });
}

/**
 * One softly tapered, fully rounded limb surface.  The old resident used a
 * stack of capsules, cylinders and joint spheres; even with smooth normals the
 * repeated circular breaks read as a wooden doll.  This geometry has no flat
 * cut face and is deliberately allowed to overlap its neighbouring segment so
 * elbows and knees stay visually closed while their bones rotate.
 */
function createOrganicSegmentGeometry(
  key: string,
  topY: number,
  bottomY: number,
  topRadius: number,
  middleRadius: number,
  bottomRadius: number,
  depth = 0.92,
): THREE.BufferGeometry {
  return cachedGeometry(`organic-segment-v2:${key}`, () => {
    const geometry = new THREE.SphereGeometry(1, 32, 24);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const sourceY = position.getY(index);
      const z = position.getZ(index);
      const u = THREE.MathUtils.clamp((sourceY + 1) * 0.5, 0, 1);
      const lowerRadius = THREE.MathUtils.lerp(bottomRadius, middleRadius, u * 2);
      const upperRadius = THREE.MathUtils.lerp(middleRadius, topRadius, (u - 0.5) * 2);
      const radius = u < 0.5 ? lowerRadius : upperRadius;
      position.setXYZ(
        index,
        x * radius,
        THREE.MathUtils.lerp(bottomY, topY, u),
        z * radius * depth,
      );
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  });
}

/** A single rounded shoe upper, replacing the former collar/body/toe stack. */
function createSoftShoeGeometry(): THREE.BufferGeometry {
  return cachedGeometry("shoe-one-piece-v2", () => {
    const geometry = new THREE.SphereGeometry(1, 32, 22);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const toe = THREE.MathUtils.smoothstep(z, -0.18, 0.9);
      const underside = y < -0.42 ? THREE.MathUtils.lerp(y, -0.58, 0.48) : y;
      position.setXYZ(
        index,
        x * (0.126 + toe * 0.018),
        underside * (0.095 + toe * 0.006),
        z * (z > 0 ? 0.2 : 0.145) + 0.1,
      );
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  });
}

function createSoftSkirtGeometry(): THREE.BufferGeometry {
  return cachedGeometry("dress-soft-skirt-v2", () => {
    const profile = [
      new THREE.Vector2(0, -0.34),
      new THREE.Vector2(0.54, -0.34),
      new THREE.Vector2(0.59, -0.29),
      new THREE.Vector2(0.565, -0.16),
      new THREE.Vector2(0.47, 0.21),
      new THREE.Vector2(0.38, 0.3),
      new THREE.Vector2(0, 0.3),
    ];
    const geometry = new THREE.LatheGeometry(profile, 36);
    geometry.computeVertexNormals();
    return geometry;
  });
}

/** A tapered, asymmetric lock reads as illustrated hair instead of a rod. */
function createHairLockGeometry(kind: "front" | "side"): THREE.BufferGeometry {
  return cachedGeometry(`hair-painted-lock-v6:${kind}`, () => {
    const geometry = new THREE.SphereGeometry(0.5, 22, 16);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const rawX = position.getX(index);
      const rawY = position.getY(index);
      const rawZ = position.getZ(index);
      const y01 = rawY + 0.5;
      const tip = THREE.MathUtils.smoothstep(y01, 0, kind === "front" ? 0.42 : 0.28);
      const width = THREE.MathUtils.lerp(0.18, 1, tip);
      const x = rawX * (kind === "front" ? 0.24 : 0.27) * width;
      const y = rawY * (kind === "front" ? 0.46 : 0.68);
      const curvedFront = (1 - Math.abs(rawY) * 2) * (kind === "front" ? 0.045 : 0.025);
      const z = rawZ * (kind === "front" ? 0.2 : 0.18) + curvedFront;
      position.setXYZ(index, x, y, z);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  });
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

function stableVariant(profile: CharacterProfile, count: number): number {
  const value = `${profile.id}:${profile.name}:${profile.outfitStyle}`;
  let hash = 17;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  return count > 0 ? hash % count : 0;
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
    // Keep colours readable after sunset, but retain enough diffuse modelling
    // to separate skin, cloth and hair.  Strong self-lighting made every part
    // look as though it was cut from the same painted material.
    emissive: resolvedColor,
    emissiveIntensity:
      surface === "skin" ? 0.018
        : surface === "hair" ? 0.008
          : surface === "fabric" ? 0.003
            : 0.006,
    side: options.side ?? THREE.FrontSide,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    metalness: 0,
    flatShading: false,
  };

  let result: CharacterMaterial;
  switch (surface) {
    case "skin":
      // A broad, weak highlight gives skin volume without wax/clearcoat glare.
      result = new THREE.MeshStandardMaterial({
        ...base,
        roughness: 0.86,
        envMapIntensity: 0.2,
      });
      break;
    case "fabric":
      result = new THREE.MeshStandardMaterial({
        ...base,
        roughness: 0.99,
        envMapIntensity: 0.06,
      });
      break;
    case "leather":
      result = new THREE.MeshStandardMaterial({
        ...base,
        roughness: 0.78,
        envMapIntensity: 0.24,
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
      result = new THREE.MeshStandardMaterial({
        ...base,
        roughness: 0.92,
        envMapIntensity: 0.11,
      });
      break;
    case "detail":
    default:
      result = new THREE.MeshStandardMaterial({
        ...base,
        roughness: 0.9,
        envMapIntensity: 0.1,
      });
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

function boneJoint(
  parent: THREE.Object3D,
  name: string,
  x: number,
  y: number,
  z: number,
): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(x, y, z);
  parent.add(bone);
  return bone;
}

function createEye(
  parent: THREE.Object3D,
  x: number,
  style: string,
  skinMaterial: CharacterMaterial,
): THREE.Group {
  const resolved = resolveStyle(style, EYE_STYLES, "classic");
  // The eye artwork is flat, so place it on the cheek plane. The previous
  // depth was inherited from the old spherical eyeball and left most of each
  // oval buried inside the face, which read as permanently half-closed eyes.
  const eye = joint(parent, x, 0.285, 0.593 + FRONT);
  const dark = material("#243044", { surface: "eye" });
  const iris = material("#755842", { surface: "eye" });
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

  if (resolved === "classic") {
    // The default face follows the accepted key art: a simple dark oval with
    // tiny painted highlights, not a wide white toy-doll sclera.
    addMesh(eye, circle(0.078, 24), dark, [0, 0, 0], [0.74, 1.18, 1]);
    addMesh(eye, circle(0.016, 14), highlight, [-0.016, 0.027, 0.014]);
    addMesh(eye, circle(0.006, 10), highlight, [0.018, -0.022, 0.016]);
  } else if (includesAny(resolved, ["sleep", "closed", "calm", "happy"])) {
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
    // Keep every open-eye option inside one coherent illustrated family.  A
    // large white toy sclera made neighbouring residents look as though they
    // came from different games; the target style uses a dark oval with two
    // crisp catchlights and only a quiet hint of iris colour.
    const eyeScaleX = almond ? 1.18 : wide ? 0.82 : 0.76;
    const eyeScaleY = almond ? 0.76 : wide ? 1.18 : 1.06;
    const eyeRadius = wide ? 0.092 : 0.087;
    addMesh(
      eye,
      circle(eyeRadius + 0.014, 26),
      dark,
      [0, 0, 0],
      [eyeScaleX, eyeScaleY, 1],
      [0, 0, resolved === "downturned" ? (x < 0 ? -7 : 7) * DEG : resolved === "cat" ? (x < 0 ? 6 : -6) * DEG : 0],
    );
    const irisRadius = eyeRadius * 0.58;
    addMesh(eye, circle(irisRadius, 22), iris, [0, resolved === "kind" ? -0.018 : -0.012, 0.012], [eyeScaleX * 0.92, eyeScaleY * 0.9, 1]);
    addMesh(eye, circle(irisRadius * 0.64, 18), dark, [0, -0.013, 0.018], [eyeScaleX, eyeScaleY, 1]);
    addMesh(eye, circle(resolved === "sparkle" ? 0.019 : 0.015, 14), highlight, [-0.018, 0.024, 0.024]);
    addMesh(eye, circle(0.0065, 10), highlight, [0.018, -0.024, 0.026]);
    // A fine upper lid gives the eye an illustrated edge without using a
    // heavy whole-character outline.
    addMesh(
      eye,
      cachedGeometry("eye-upper-lid-v6", () => new THREE.TorusGeometry(0.095, 0.009, 6, 24, Math.PI)),
      dark,
      [0, 0.008, 0.028],
      [eyeScaleX, eyeScaleY * 0.82, 1],
      [0, 0, 0],
    );
    if (resolved === "sparkle") {
      addMesh(eye, cachedGeometry("eye-star-glint", () => new THREE.OctahedronGeometry(0.012, 0)), highlight, [0.025, -0.018, 0.032], [0.72, 1.35, 0.38]);
    }
    if (includesAny(resolved, ["lashes", "cat"])) addLashes(x < 0 ? -1 : 1, resolved === "lashes" ? 3 : 2);
    if (resolved === "focused") {
      addMesh(eye, cachedGeometry("focused-lid-v6", () => new THREE.CapsuleGeometry(0.008, 0.16, 3, 8)), dark, [0, 0.07, 0.03], [1, 1, 0.4], [0, 0, (x < 0 ? 83 : 97) * DEG]);
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
      cachedGeometry(`nose-cone:${resolved}`, () => new THREE.ConeGeometry(resolved === "long" ? 0.038 : 0.048, resolved === "long" ? 0.13 : 0.1, 12)),
      skinShadow,
      [0, 0.195, 0.58],
      [1, 1, 0.62],
      [90 * DEG, 0, 0],
    );
  } else if (includesAny(resolved, ["line", "small", "subtle", "tiny"])) {
    const nose = addMesh(parent, cachedGeometry("nose-line", () => new THREE.CapsuleGeometry(0.012, 0.055, 4, 10)), skinShadow, [0, 0.2, 0.577], [1, resolved === "tiny" ? 0.65 : 1, 0.55]);
    nose.rotation.z = -5 * DEG;
  } else if (resolved === "soft-triangle" || resolved === "upturned") {
    addMesh(parent, cachedGeometry("nose-soft-triangle", () => new THREE.ConeGeometry(0.044, 0.055, 3)), skinShadow, [0, resolved === "upturned" ? 0.215 : 0.19, 0.58], [1, 1, 0.35], [90 * DEG, 0, resolved === "upturned" ? Math.PI : 0]);
  } else {
    const broad = resolved === "broad";
    addMesh(parent, cachedGeometry("nose-button-v4", () => new THREE.SphereGeometry(0.036, 18, 12)), skinShadow, [0, 0.19, 0.578], [broad ? 1.24 : 0.82, broad ? 0.68 : 0.72, 0.34]);
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
  head: THREE.Object3D,
  profile: CharacterProfile,
  headScale: readonly [number, number, number],
  hairMaterial: CharacterMaterial,
  hairHighlight: CharacterMaterial,
): void {
  const style = resolveStyle(profile.hairStyle, HAIR_STYLES, "crop");
  // Stop the cap above the eye line. Extending the spherical shell past the
  // forehead made several styles read as a dark helmet and hid the large eyes.
  const capGeometry = cachedGeometry("hair-cap-v4", () => new THREE.SphereGeometry(0.625, 30, 18, 0, Math.PI * 2, 0, Math.PI * 0.41));
  const lockGeometry = createHairLockGeometry("front");
  const curlGeometry = cachedGeometry("hair-curl", () => new THREE.SphereGeometry(0.22, 18, 14));
  const sideGeometry = createHairLockGeometry("side");
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
    const strandGeometry = cachedGeometry("hair-painted-strand", () => new THREE.CapsuleGeometry(0.016, 0.16, 4, 9));
    for (const [x, y, angle] of [[-0.28, 0.545, -12 + sweep], [-0.055, 0.59, -3 + sweep], [0.19, 0.57, 8 + sweep]] as const) {
      addMesh(
        head,
        strandGeometry,
        hairHighlight,
        [x * headScale[0], y, 0.568 * headScale[2]],
        [1, short ? 0.62 : 0.88, 0.42],
        [0, 0, angle * DEG],
      );
    }
  };

  const addSideburns = (length = 1): void => {
    for (const side of [-1, 1]) {
      addMesh(head, sideGeometry, side > 0 ? hairHighlight : hairMaterial, [side * 0.55 * headScale[0], 0.27 - (length - 1) * 0.1, 0.17], [0.58, length * 0.84, 0.72], [0, 0, side * -7 * DEG]);
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
    addMesh(head, cachedGeometry("hair-bun-headband", () => new THREE.TorusGeometry(0.625, 0.028, 7, 34, Math.PI * 0.86)), hairHighlight, [0, 0.24, 0.06], [1, 1.04, 0.95], [0, 0, 0.07 * Math.PI]);
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
  chest: THREE.Object3D,
  head: THREE.Object3D,
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
    const pin = addMesh(chest, cachedGeometry("trait-creative-pin-v6", () => new THREE.CircleGeometry(0.075, 8)), shirtAccent, [0.22, 0.16, 0.355], [1, 1, 1]);
    pin.rotation.z = 30 * DEG;
  } else if (includesAny(value, ["adventure", "brave", "explore"])) {
    addMesh(chest, cachedGeometry("trait-adventure-strap-v6", () => new THREE.CapsuleGeometry(0.035, 0.61, 5, 12)), shirtAccent, [-0.05, 0, 0.345], [1, 1, 0.25], [0, 0, -21 * DEG]);
  }
}

function addOutfit(
  torso: THREE.Object3D,
  hips: THREE.Object3D,
  profile: CharacterProfile,
  shirtMaterial: CharacterMaterial,
  shirtShadow: CharacterMaterial,
  shirtAccent: CharacterMaterial,
  trouserMaterial: CharacterMaterial,
): string {
  const outfit = resolveStyle(profile.outfitStyle, OUTFIT_STYLES, "tee");
  const torsoStart = torso.children.length;
  const hipsStart = hips.children.length;
  const relaxed = includesAny(outfit, ["sweater", "hoodie"]);
  addMesh(
    torso,
    createTailoredTorsoGeometry(),
    shirtMaterial,
    [0, -0.005, 0],
    [relaxed ? 1.08 : 1.02, 1, relaxed ? 0.84 : 0.8],
  );
  addMesh(torso, cachedGeometry("outfit-hem-tailored-v6", () => new THREE.TorusGeometry(0.325, 0.025, 8, 30)), shirtShadow, [0, -0.47, 0], [relaxed ? 1.08 : 1.02, 1, 0.82], [90 * DEG, 0, 0]);
  addMesh(torso, cachedGeometry("outfit-neckline-v6", () => new THREE.TorusGeometry(0.16, 0.025, 10, 30)), shirtAccent, [0, 0.42, 0.11], [1, 0.54, 0.92], [90 * DEG, 0, 0]);

  const isDress = includesAny(outfit, ["dress", "skirt"]);
  if (!isDress) {
    addMesh(hips, createRoundedShortsGeometry(), trouserMaterial, [0, -0.085, 0], [1.03, 1, 0.78]);
    addMesh(hips, cachedGeometry("shorts-waistband-v6", () => new THREE.TorusGeometry(0.355, 0.025, 8, 30)), shirtAccent, [0, 0.055, 0], [1.02, 1, 0.78], [90 * DEG, 0, 0]);
    addMesh(hips, cachedGeometry("shorts-seam-v6", () => new THREE.CapsuleGeometry(0.009, 0.17, 3, 8)), material(shiftedColor(profile.shirt, -0.2, "#314a62"), { surface: "fabric" }), [0, -0.09, 0.326], [1, 1, 0.45]);
  }

  if (includesAny(outfit, ["overall", "dungaree"])) {
    addMesh(torso, cachedGeometry("overall-bib-v6", () => new THREE.CapsuleGeometry(0.16, 0.2, 7, 20)), trouserMaterial, [0, -0.055, 0.345], [1.12, 1, 0.16]);
    for (const side of [-1, 1]) {
      addMesh(torso, cachedGeometry("overall-strap-v6", () => new THREE.CapsuleGeometry(0.032, 0.39, 5, 12)), trouserMaterial, [side * 0.2, 0.225, 0.34], [1, 1, 0.2], [0, 0, side * -8 * DEG]);
      addMesh(torso, cachedGeometry("overall-button", () => new THREE.SphereGeometry(0.03, 12, 8)), shirtAccent, [side * 0.18, 0.17, 0.385], [1, 1, 0.5]);
    }
    addMesh(torso, cachedGeometry("overall-pocket-v6", () => new THREE.CapsuleGeometry(0.055, 0.11, 5, 14)), shirtAccent, [0, -0.105, 0.378], [1.28, 1, 0.18], [0, 0, 90 * DEG]);
  } else if (includesAny(outfit, ["jacket", "coat", "blazer"])) {
    for (const side of [-1, 1]) {
      addMesh(torso, cachedGeometry("jacket-panel-v6", () => new THREE.CapsuleGeometry(0.145, 0.42, 7, 20)), shirtShadow, [side * 0.18, -0.035, 0.335], [1.05, 1, 0.14], [0, 0, side * 2 * DEG]);
      addMesh(torso, cachedGeometry("jacket-lapel-v6", () => new THREE.ConeGeometry(0.12, 0.36, 3)), shirtAccent, [side * 0.13, 0.17, 0.375], [1, 1, 0.18], [0, 0, side * 14 * DEG]);
    }
    addMesh(torso, cachedGeometry("jacket-seam-v6", () => new THREE.CapsuleGeometry(0.009, 0.58, 4, 10)), shirtAccent, [0, -0.035, 0.382], [1, 1, 0.4]);
    for (const y of [0.12, -0.08, -0.28]) {
      addMesh(torso, cachedGeometry("jacket-button", () => new THREE.SphereGeometry(0.026, 14, 9)), shirtAccent, [0.045, y, 0.393], [1, 1, 0.42]);
    }
  } else if (includesAny(outfit, ["dress", "skirt"])) {
    addMesh(hips, createSoftSkirtGeometry(), shirtMaterial, [0, -0.02, 0], [1, 1, 0.86]);
    addMesh(torso, cachedGeometry("dress-belt-v2", () => new THREE.TorusGeometry(0.335, 0.025, 8, 32)), shirtAccent, [0, -0.31, 0], [1.02, 1, 0.81], [90 * DEG, 0, 0]);
  } else if (includesAny(outfit, ["sport", "athletic", "active"])) {
    addMesh(torso, cachedGeometry("sport-stripe-v6", () => new THREE.CapsuleGeometry(0.026, 0.62, 5, 12)), shirtAccent, [0.27, -0.03, 0.355], [1, 1, 0.22]);
    addMesh(torso, cachedGeometry("sport-number", () => new THREE.CircleGeometry(0.13, 28)), shirtAccent, [0, 0.03, 0.366], [1, 1, 1]);
  } else if (includesAny(outfit, ["sweater", "jumper", "knit"])) {
    for (const y of [-0.24, -0.1, 0.04]) addMesh(torso, cachedGeometry("sweater-rib-v6", () => new THREE.CapsuleGeometry(0.011, 0.59, 4, 10)), shirtAccent, [0, y, 0.36], [1, 1, 0.3], [0, 0, 90 * DEG]);
    addMesh(torso, cachedGeometry("sweater-patch", () => new THREE.CircleGeometry(0.1, 28)), shirtShadow, [0.22, 0.18, 0.37], [1, 0.72, 1]);
  } else if (includesAny(outfit, ["sailor", "navy"])) {
    addMesh(torso, cachedGeometry("sailor-collar", () => new THREE.CircleGeometry(0.34, 3)), shirtAccent, [0, 0.21, 0.43], [1.35, 0.9, 1], [0, 0, Math.PI]);
    for (const side of [-1, 1]) addMesh(torso, cachedGeometry("sailor-bow", () => new THREE.ConeGeometry(0.105, 0.24, 3)), shirtShadow, [side * 0.105, 0.07, 0.47], [1, 1, 0.45], [0, 0, side * 90 * DEG]);
    addMesh(torso, cachedGeometry("sailor-knot", () => new THREE.SphereGeometry(0.055, 14, 10)), shirtAccent, [0, 0.07, 0.49], [1, 1, 0.55]);
  } else if (includesAny(outfit, ["hoodie", "hooded"])) {
    addMesh(torso, cachedGeometry("hoodie-hood", () => new THREE.TorusGeometry(0.31, 0.095, 12, 30, Math.PI * 1.55)), shirtShadow, [0, 0.39, -0.03], [1, 0.9, 0.75], [90 * DEG, 0, -0.28 * Math.PI]);
    addMesh(torso, cachedGeometry("hoodie-pocket-v6", () => new THREE.CapsuleGeometry(0.065, 0.27, 6, 16)), shirtAccent, [0, -0.2, 0.36], [1, 1, 0.18], [0, 0, 90 * DEG]);
    for (const side of [-1, 1]) {
      addMesh(torso, cachedGeometry("hoodie-string", () => new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8)), shirtAccent, [side * 0.09, 0.22, 0.46]);
      addMesh(torso, cachedGeometry("hoodie-string-tip", () => new THREE.SphereGeometry(0.018, 10, 7)), shirtShadow, [side * 0.09, 0.07, 0.46]);
    }
  } else {
    addMesh(torso, cachedGeometry("tee-stripe-v6", () => new THREE.CapsuleGeometry(0.021, 0.5, 5, 12)), shirtAccent, [0, 0.15, 0.36], [1, 1, 0.24], [0, 0, 87 * DEG]);
    addMesh(torso, cachedGeometry("tee-pocket-v6", () => new THREE.CapsuleGeometry(0.045, 0.105, 5, 12)), shirtShadow, [0.18, -0.12, 0.365], [1.08, 1, 0.2], [0, 0, 90 * DEG]);
  }

  // Keep clothing graphic and compact: this scales only garment meshes, not the
  // animation rig or the head that are attached to the same joints later.
  for (const child of torso.children.slice(torsoStart)) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.position.y *= 0.85;
    child.scale.x *= 0.92;
    child.scale.y *= 0.85;
  }
  for (const child of hips.children.slice(hipsStart)) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.position.y *= 0.88;
    child.scale.x *= 0.92;
    child.scale.y *= 0.88;
  }
  return outfit;
}

function addArm(
  chest: THREE.Object3D,
  side: -1 | 1,
  skinMaterial: CharacterMaterial,
  shirtMaterial: CharacterMaterial,
  shirtAccent: CharacterMaterial,
  outfitStyle: string,
): { shoulder: THREE.Bone; arm: THREE.Bone; forearm: THREE.Bone; hand: THREE.Bone } {
  const sideName = side < 0 ? "left" : "right";
  const shoulder = boneJoint(chest, `${sideName}-shoulder`, side * 0.43, 0.22, 0);
  const arm = boneJoint(shoulder, `${sideName}-upper-arm`, 0, 0, 0);
  const longSleeve = includesAny(outfitStyle, ["jacket", "sweater", "hoodie", "coat"]);
  // One continuous sleeve envelope reaches into the torso at the shoulder and
  // rounds over the cuff.  There is no visible shoulder ball or cylinder end.
  addMesh(
    arm,
    createOrganicSegmentGeometry(
      longSleeve ? "upper-sleeve-long" : "upper-sleeve-short",
      0.13,
      longSleeve ? -0.37 : -0.32,
      0.175,
      longSleeve ? 0.125 : 0.13,
      longSleeve ? 0.105 : 0.11,
      0.9,
    ),
    shirtMaterial,
    [0, 0, 0],
  );

  const forearm = boneJoint(arm, `${sideName}-forearm`, 0, -0.3, 0);
  addMesh(
    forearm,
    createOrganicSegmentGeometry(
      longSleeve ? "forearm-sleeve" : "forearm-skin",
      0.075,
      -0.325,
      longSleeve ? 0.11 : 0.098,
      longSleeve ? 0.096 : 0.09,
      longSleeve ? 0.086 : 0.082,
      0.9,
    ),
    longSleeve ? shirtMaterial : skinMaterial,
  );
  // A soft woven cuff sits over the skin/hand overlap rather than exposing a
  // circular cut plane at the wrist.
  if (longSleeve) {
    addMesh(
      forearm,
      createOrganicSegmentGeometry("wrist-cuff", -0.235, -0.35, 0.094, 0.092, 0.084, 0.9),
      shirtAccent,
    );
  }
  const hand = boneJoint(forearm, `${sideName}-hand`, 0, -0.29, 0);
  addMesh(hand, cachedGeometry("hand-palm-smooth-v2", () => new THREE.SphereGeometry(0.112, 28, 20)), skinMaterial, [0, -0.04, 0.012], [0.92, 1.08, 0.8]);
  addMesh(
    hand,
    createOrganicSegmentGeometry("hand-thumb", 0.035, -0.09, 0.034, 0.031, 0.021, 0.82),
    skinMaterial,
    [-side * 0.076, -0.025, 0.045],
    [0.9, 0.82, 0.86],
    [0, 0, side * 24 * DEG],
  );
  return { shoulder, arm, forearm, hand };
}

function addLeg(
  hips: THREE.Object3D,
  side: -1 | 1,
  skinMaterial: CharacterMaterial,
  trouserMaterial: CharacterMaterial,
  shoeMaterial: CharacterMaterial,
  outfitStyle: string | number,
): { leg: THREE.Bone; shin: THREE.Bone; foot: THREE.Bone } {
  const sideName = side < 0 ? "left" : "right";
  const leg = boneJoint(hips, `${sideName}-upper-leg`, side * 0.205, -0.12, 0);
  const resolvedOutfit = resolveStyle(outfitStyle, OUTFIT_STYLES, "tee");
  const dress = includesAny(resolvedOutfit, ["dress", "skirt"]);
  // Bare, softly tapered legs continue beneath the clothing.  The garment is
  // a slightly wider overlay, so the hip and knee pivots never reveal a hole.
  addMesh(
    leg,
    createOrganicSegmentGeometry("upper-leg-skin", 0.105, -0.44, 0.132, 0.119, 0.106, 0.92),
    skinMaterial,
  );
  if (!dress) {
    addMesh(
      leg,
      createOrganicSegmentGeometry("shorts-leg-overlay", 0.13, -0.16, 0.158, 0.154, 0.136, 0.92),
      trouserMaterial,
    );
  }

  const shin = boneJoint(leg, `${sideName}-shin`, 0, -0.38, 0);
  addMesh(
    shin,
    createOrganicSegmentGeometry("lower-leg-skin", 0.115, -0.35, 0.116, 0.104, 0.092, 0.92),
    skinMaterial,
  );
  const sockMaterial = material("#f7f1e6", { surface: "fabric" });
  addMesh(
    shin,
    createOrganicSegmentGeometry("sock-overlay", -0.17, -0.37, 0.104, 0.1, 0.094, 0.92),
    sockMaterial,
  );

  const foot = boneJoint(shin, `${sideName}-foot`, 0, -0.33, 0.045);
  addMesh(foot, createSoftShoeGeometry(), shoeMaterial, [0, -0.015, 0]);
  const laceMaterial = material("#eadfca", { surface: "fabric" });
  for (const z of [0.105, 0.16]) {
    addMesh(foot, cachedGeometry("shoe-lace-soft-v2", () => new THREE.CapsuleGeometry(0.006, 0.075, 4, 12)), laceMaterial, [0, 0.068, z], [1, 1, 0.36], [0, 0, 90 * DEG]);
  }
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
      // Start with a cheek-and-jaw silhouette rather than a scaled ball: the
      // upper cranium stays broad, cheeks are gently full, and the chin tapers.
      const cheek = Math.exp(-Math.pow((normalizedY + 0.12) / 0.42, 2)) * 0.045;
      const minimumChin = faceStyle === "heart" ? 0.88 : faceStyle === "slim" ? 0.91 : faceStyle === "oval" ? 0.93 : 0.955;
      const chinTaper = normalizedY < -0.42
        ? THREE.MathUtils.lerp(1, minimumChin, THREE.MathUtils.smoothstep(-normalizedY, 0.42, 1))
        : 1;
      let width = (1 + cheek) * chinTaper;
      let depth = z >= 0 ? 0.965 : 0.91;
      if (faceStyle === "heart") {
        width *= THREE.MathUtils.lerp(0.91, 1.045, (normalizedY + 1) * 0.5);
        depth *= THREE.MathUtils.lerp(0.97, 1.015, (normalizedY + 1) * 0.5);
      } else if (faceStyle === "soft-square") {
        width *= 1 + 0.035 * (1 - Math.abs(normalizedY));
        if (normalizedY < -0.35) width *= 1.018;
        depth *= 0.99;
      } else if (faceStyle === "broad") {
        width *= 1.035 + 0.018 * (1 - Math.abs(normalizedY));
        depth *= 1.01;
      } else if (faceStyle === "slim") {
        width *= THREE.MathUtils.lerp(0.94, 0.985, (normalizedY + 1) * 0.5);
        depth *= 0.985;
      } else if (faceStyle === "oval") {
        width *= 0.985;
        depth *= 1.005;
      }
      // Flatten only the rear skull and add a soft front cheek plane. It keeps
      // facial features readable under changing scene lights.
      const frontPlane = z > 0 && Math.abs(normalizedY) < 0.58 ? 0.012 * (1 - Math.abs(normalizedY) / 0.58) : 0;
      position.setXYZ(index, x * width, y, z * depth + frontPlane);
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
  group.userData.characterSource = "sunny-custom-v2";
  group.userData.authoredVariant = "custom";
  group.userData.characterId = profile.id;
  group.userData.characterName = profile.name;
  group.userData.trait = profile.trait;

  const root = boneJoint(group, "root", 0, 0, 0);
  const hips = boneJoint(root, "hips", 0, 1, 0);
  const torso = boneJoint(hips, "spine", 0, 0.37, 0);
  const chest = boneJoint(torso, "chest", 0, 0.06, 0);
  const neck = boneJoint(chest, "neck", 0, 0.4, 0);
  const head = boneJoint(neck, "head", 0, 0.3, 0);
  // A slightly smaller cranium puts the resident at roughly 2.6 heads tall:
  // still unmistakably chibi, but no longer a head attached to a peg body.
  head.scale.setScalar(0.98);

  const skinMaterial = material(profile.skin || "#d99a73", { surface: "skin" });
  const skinShadow = material(shiftedColor(profile.skin, -0.065, "#c78467"), { surface: "skin" });
  const hairMaterial = material(profile.hair || "#4a3028", { surface: "hair" });
  const hairHighlight = material(shiftedColor(profile.hair, 0.055, "#67453a"), { surface: "hair" });
  const shirtMaterial = material(profile.shirt || "#5ba8a0", { surface: "fabric" });
  const shirtShadow = material(shiftedColor(profile.shirt, -0.12, "#3d7e79"), { surface: "fabric" });
  const shirtAccent = material(shiftedColor(profile.shirt, 0.16, "#8dd0c8"), { surface: "fabric" });
  const paletteVariant = stableVariant(profile, 5);
  const bottomPalette = ["#4f6b7c", "#466779", "#7a5b43", "#4f6266", "#66556d"] as const;
  const shoePalette = ["#6d4931", "#765038", "#5e4438", "#70432f", "#5c4637"] as const;
  const trouserMaterial = material(bottomPalette[paletteVariant]!, { surface: "fabric" });
  const shoeMaterial = material(shoePalette[paletteVariant]!, { surface: "leather" });

  const outfitStyle = addOutfit(torso, hips, profile, shirtMaterial, shirtShadow, shirtAccent, trouserMaterial);
  addMesh(
    neck,
    createOrganicSegmentGeometry("neck-smooth", 0.085, -0.235, 0.155, 0.175, 0.18, 0.94),
    skinMaterial,
  );

  const face = resolveFaceStyle(profile.faceShape);
  const headScale: readonly [number, number, number] = face === "round"
    ? [1.055, 0.975, 0.96]
    : face === "oval"
      ? [1, 0.985, 0.95]
      : face === "soft-square"
        ? [1.035, 0.99, 0.95]
        : face === "heart"
          ? [1.035, 0.985, 0.95]
          : face === "slim"
            ? [0.995, 0.985, 0.945]
            : [1.06, 0.98, 0.96];
  const headMesh = addMesh(head, createHeadGeometry(face), skinMaterial, [0, 0.25, 0], headScale);
  headMesh.name = "face";

  addHair(head, profile, headScale, hairMaterial, hairHighlight);
  const eyeStyle = resolveStyle(profile.eyeStyle, EYE_STYLES, "classic");
  const eyes = joint(head, 0, 0, 0);
  eyes.name = "eyes";
  const leftEye = createEye(eyes, -0.21, eyeStyle, skinMaterial);
  const rightEye = createEye(eyes, 0.21, eyeStyle, skinMaterial);
  leftEye.name = "left-eye";
  rightEye.name = "right-eye";
  const browStyle = resolveStyle(profile.browStyle, BROW_STYLES, "soft");
  const leftBrow = createBrow(head, -0.21, browStyle, hairMaterial);
  const rightBrow = createBrow(head, 0.21, browStyle, hairMaterial);
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

  const skeleton = new THREE.Skeleton([
    root,
    hips,
    torso,
    chest,
    neck,
    head,
    left.shoulder,
    left.arm,
    left.forearm,
    left.hand,
    right.shoulder,
    right.arm,
    right.forearm,
    right.hand,
    leftLeg.leg,
    leftLeg.shin,
    leftLeg.foot,
    rightLeg.leg,
    rightLeg.shin,
    rightLeg.foot,
  ]);
  group.updateMatrixWorld(true);
  skeleton.calculateInverses();
  group.userData.skeleton = skeleton;

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
    skeleton,
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

export type CharacterGrounding = {
  readonly grounded: boolean;
  readonly leftGap: number;
  readonly rightGap: number;
  readonly minimumGap: number;
};

const groundingLeftBox = new THREE.Box3();
const groundingRightBox = new THREE.Box3();
const groundingWorldPosition = new THREE.Vector3();
const groundingRightPosition = new THREE.Vector3();
const groundingWorldScale = new THREE.Vector3();

/**
 * Keep the lowest shoe sole on the character's world-space ground plane.
 * The leg rig still supplies the stride; this only removes the visual hover
 * (or pavement clipping) that a rotating procedural foot can otherwise cause.
 */
export function groundCharacterToPlane(
  character: Character,
  groundY?: number,
): CharacterGrounding {
  const { group, joints } = character;
  group.updateWorldMatrix(true, true);
  const planeY = typeof groundY === "number" && Number.isFinite(groundY)
    ? groundY
    : group.getWorldPosition(groundingWorldPosition).y;
  const authored = character.assetRuntime;
  if (authored) {
    const worldScaleY = Math.max(0.0001, Math.abs(group.getWorldScale(groundingWorldScale).y));
    const leftSoleY = authored.leftSoleMarker.getWorldPosition(groundingWorldPosition).y;
    const rightSoleY = authored.rightSoleMarker.getWorldPosition(groundingRightPosition).y;
    const lowestY = Math.min(leftSoleY, rightSoleY);
    if (Number.isFinite(lowestY)) {
      authored.visualRoot.position.y += (planeY - lowestY) / worldScaleY;
      group.updateWorldMatrix(true, true);
    }
    const nextLeft = authored.leftSoleMarker.getWorldPosition(groundingWorldPosition).y;
    const nextRight = authored.rightSoleMarker.getWorldPosition(groundingRightPosition).y;
    const leftGap = nextLeft - planeY;
    const rightGap = nextRight - planeY;
    const minimumGap = Math.min(leftGap, rightGap);
    return {
      grounded: Number.isFinite(minimumGap) && Math.abs(minimumGap) <= 0.006,
      leftGap,
      rightGap,
      minimumGap,
    };
  }
  groundingLeftBox.setFromObject(joints.leftFoot, true);
  groundingRightBox.setFromObject(joints.rightFoot, true);
  const lowestY = Math.min(groundingLeftBox.min.y, groundingRightBox.min.y);
  const worldScaleY = Math.max(0.0001, Math.abs(group.getWorldScale(groundingWorldScale).y));
  if (Number.isFinite(lowestY)) {
    joints.root.position.y += (planeY - lowestY) / worldScaleY;
    group.updateWorldMatrix(true, true);
    groundingLeftBox.setFromObject(joints.leftFoot, true);
    groundingRightBox.setFromObject(joints.rightFoot, true);
  }
  const leftGap = groundingLeftBox.min.y - planeY;
  const rightGap = groundingRightBox.min.y - planeY;
  const minimumGap = Math.min(leftGap, rightGap);
  return {
    grounded: Number.isFinite(minimumGap) && Math.abs(minimumGap) <= 0.006,
    leftGap,
    rightGap,
    minimumGap,
  };
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
  const authored = character.assetRuntime;
  if (authored) {
    const dt = THREE.MathUtils.clamp(Number.isFinite(delta) ? delta : 1 / 60, 0, 0.1);
    if (character.animation.state !== state) {
      character.animation.state = state;
      character.animation.stateStartedAt = time;
      const next = authored.actions[state] ?? authored.actions.idle ?? null;
      if (next && next !== authored.activeAction) {
        authored.activeAction?.fadeOut(0.16);
        next.reset().fadeIn(0.16).play();
        authored.activeAction = next;
      }
    }
    authored.mixer.update(dt);
    return;
  }
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

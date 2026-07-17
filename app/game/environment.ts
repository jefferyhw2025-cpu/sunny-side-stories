import * as THREE from "three";

export type TownActivityKind =
  | "home"
  | "cafe"
  | "shop"
  | "fountain"
  | "garden"
  | "lookout";

export type TownSceneName = "home" | "plaza" | "cafe";

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

const COLORS = {
  ink: 0x344b4f,
  grass: 0x75bd62,
  grassLight: 0x94d679,
  grassDark: 0x4f9955,
  road: 0x65717a,
  roadEdge: 0x4c5962,
  paving: 0xf2cf95,
  pavingLight: 0xffe4ad,
  cream: 0xfff1cf,
  white: 0xfffbec,
  wood: 0x966344,
  darkWood: 0x674536,
  water: 0x55c9e8,
  waterLight: 0xb9f5ff,
  stone: 0xcbd1c8,
  stoneDark: 0x9da9a5,
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

const sharedMaterials = new Map<string, THREE.Material>();

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
  const resolvedOptions: THREE.MeshStandardMaterialParameters = {
    ...surfaceProperties(inferSurface(color)),
    ...options,
  };
  const key = materialKey("standard", color, resolvedOptions);
  const cached = sharedMaterials.get(key);
  if (cached instanceof THREE.MeshStandardMaterial) return cached;

  const result = new THREE.MeshStandardMaterial({ color, ...resolvedOptions });
  result.userData.shared = true;
  sharedMaterials.set(key, result);
  return result;
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
    roughness: 0.2,
    metalness: 0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.8,
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
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
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
  geometry.computeVertexNormals();
  return geometry;
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
  box(parent, [width + 0.24, height + 0.24, 0.15], 0x5c6c6a, [x, y, z - 0.015]);
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

function addDoor(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: THREE.ColorRepresentation,
): void {
  box(parent, [1.02, 2.04, 0.18], COLORS.white, [x, y, z]);
  box(parent, [0.82, 1.86, 0.13], color, [x, y, z + 0.12]);
  // Four recessed panels break up the tall slab and better establish scale.
  for (const panelY of [y - 0.46, y + 0.42]) {
    box(parent, [0.57, 0.57, 0.035], 0x596e75, [x, panelY, z + 0.2]);
  }
  sphere(parent, 0.062, COLORS.gold, [x + 0.28, y, z + 0.23], [1, 1, 0.55]);
  box(parent, [1.2, 0.16, 0.58], 0xdcbf89, [x, 0.12, z + 0.28]);
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
  house.scale.setScalar(scale);
  parent.add(house);

  const foundation = box(house, [4.04, 0.24, 3.08], 0xb8aa90, [0, 0.1, 0]);
  foundation.receiveShadow = true;
  const body = box(house, [3.86, 3.35, 2.9], bodyColor, [0, 1.78, 0]);
  addEdges(body, COLORS.ink, 0.08, 42);
  const lowerBand = box(house, [3.98, 0.32, 3.02], 0xf3c98d, [0, 0.34, 0]);
  addEdges(lowerBand, COLORS.ink, 0.08, 44);
  const roof = addMesh(
    house,
    gableRoofGeometry(4.56, 3.55, 1.5),
    toon(roofColor, { roughness: 0.7, side: THREE.DoubleSide }),
    [0, 3.42, 0],
  );
  roof.castShadow = true;
  addEdges(roof, COLORS.ink, 0.15, 24);
  for (const front of [-1, 1]) {
    box(house, [4.66, 0.15, 0.18], roofColor, [0, 3.4, front * 1.78]);
  }
  for (const corner of [-1, 1]) {
    box(house, [0.17, 3.02, 0.16], COLORS.cream, [corner * 1.84, 1.83, 1.48]);
  }

  addDoor(house, 0, 1.04, 1.52, roofColor);
  addWindow(house, -1.19, 2.25, 1.5);
  addWindow(house, 1.19, 2.25, 1.5);
  // A small porch canopy and posts give the entrance believable depth.
  box(house, [1.48, 0.13, 0.82], roofColor, [0, 2.3, 1.84], [-0.06, 0, 0]);
  for (const postX of [-0.62, 0.62]) {
    box(house, [0.09, 1.12, 0.09], COLORS.cream, [postX, 1.7, 2.1]);
  }
  box(house, [0.34, 1.4, 0.36], 0x875440, [1.22, 4.32, -0.45]);
  box(house, [0.55, 0.18, 0.58], 0x63443a, [1.22, 5.02, -0.45]);

  const planter = box(house, [1.1, 0.28, 0.34], 0xb86d4f, [-1.19, 1.54, 1.7]);
  planter.userData.decorative = true;
  for (const offset of [-0.34, 0, 0.34]) {
    sphere(house, 0.16, offset === 0 ? 0xffdd5e : 0xf47c91, [-1.19 + offset, 1.78, 1.72]);
  }

  house.userData.kind = "house";
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

  const cafeFoundation = box(cafe, [5.45, 0.24, 3.68], 0xb7a98c, [0, 0.1, 0]);
  cafeFoundation.receiveShadow = true;
  const cafeBody = box(cafe, [5.2, 3.72, 3.45], 0xf3ad76, [0, 1.92, 0]);
  addEdges(cafeBody, COLORS.ink, 0.08, 44);
  box(cafe, [5.66, 0.42, 3.9], 0x4f9b86, [0, 3.9, 0]);
  box(cafe, [5.42, 0.5, 0.34], COLORS.cream, [0, 3.37, 1.84]);
  for (const corner of [-1, 1]) {
    box(cafe, [0.18, 3.38, 0.18], COLORS.cream, [corner * 2.51, 1.93, 1.78]);
  }

  for (let index = -2; index <= 2; index += 1) {
    box(
      cafe,
      [1.02, 0.13, 1.05],
      index % 2 === 0 ? 0xf0685d : COLORS.white,
      [index * 1.02, 3.07, 2.16],
      [-0.16, 0, 0],
      false,
    );
  }

  addStorefrontWindow(cafe, -1.15, 1.88, 1.78, 2.65, 1.72, 3);
  addDoor(cafe, 1.45, 1.04, 1.79, 0x398276);

  const sign = cylinder(cafe, 0.68, 0.68, 0.16, 20, COLORS.cream, [0, 4.34, 1.93]);
  sign.rotation.x = Math.PI / 2;
  const cup = cylinder(cafe, 0.27, 0.22, 0.37, 12, 0x6e4536, [0, 4.33, 2.05], false);
  cup.rotation.x = Math.PI / 2;
  const handle = addMesh(
    cafe,
    new THREE.TorusGeometry(0.2, 0.055, 8, 14, Math.PI * 1.5),
    toon(0x6e4536),
    [0.3, 4.33, 2.09],
    [0, 0, -Math.PI / 2],
  );
  handle.castShadow = false;
  for (const sx of [-0.14, 0.05, 0.24]) {
    const steam = addMesh(
      cafe,
      new THREE.TorusGeometry(0.12, 0.022, 6, 12, Math.PI),
      toon(0xffffff),
      [sx, 4.67 + sx * 0.22, 2.1],
      [0, 0, sx > 0.1 ? 0.1 : -0.12],
    );
    steam.castShadow = false;
  }

  const terrace = box(cafe, [5.8, 0.14, 2.05], 0xe2b976, [0, 0.08, 2.55]);
  terrace.receiveShadow = true;
  for (const tableX of [-1.5, 1.5]) {
    cylinder(cafe, 0.62, 0.62, 0.12, 16, 0xfaf1d0, [tableX, 0.9, 2.7]);
    cylinder(cafe, 0.09, 0.13, 0.82, 8, COLORS.darkWood, [tableX, 0.45, 2.7]);
    cylinder(cafe, 0.95, 0.08, 0.72, 12, tableX < 0 ? 0xf56f69 : 0x5bb5a0, [tableX, 2.1, 2.7]);
    cylinder(cafe, 0.07, 0.07, 1.35, 8, COLORS.darkWood, [tableX, 1.38, 2.7]);
  }

  cafe.userData.kind = "cafe";
  return cafe;
}

function createShop(parent: THREE.Object3D, x: number, z: number): THREE.Group {
  const shop = new THREE.Group();
  shop.position.set(x, 0, z);
  parent.add(shop);

  const shopFoundation = box(shop, [5.02, 0.24, 3.48], 0xb7a98c, [0, 0.1, 0]);
  shopFoundation.receiveShadow = true;
  const shopBody = box(shop, [4.8, 3.48, 3.25], 0xf4d36d, [0, 1.8, 0]);
  addEdges(shopBody, COLORS.ink, 0.08, 44);
  const roof = addMesh(
    shop,
    gableRoofGeometry(5.38, 3.78, 1.42),
    toon(0x7b71b9, { roughness: 0.7, side: THREE.DoubleSide }),
    [0, 3.5, 0],
  );
  roof.castShadow = true;
  addEdges(roof, COLORS.ink, 0.15, 24);
  box(shop, [5.48, 0.16, 0.2], 0x6b5ca2, [0, 3.49, 1.9]);
  for (const corner of [-1, 1]) {
    box(shop, [0.18, 3.12, 0.18], COLORS.cream, [corner * 2.31, 1.83, 1.69]);
  }

  box(shop, [4.62, 0.78, 0.22], 0x6b5ca2, [0, 3.03, 1.72]);
  for (const stripe of [-2, -1, 0, 1, 2]) {
    box(
      shop,
      [0.92, 0.15, 0.98],
      stripe % 2 === 0 ? 0x7666af : COLORS.white,
      [stripe * 0.92, 2.54, 2.05],
      [-0.17, 0, 0],
      false,
    );
  }

  addStorefrontWindow(shop, -0.75, 1.58, 1.68, 2.65, 1.65, 2);
  addDoor(shop, 1.48, 1.04, 1.68, 0x6b5ca2);

  const badge = cylinder(shop, 0.58, 0.58, 0.14, 6, COLORS.cream, [0, 4.04, 1.98]);
  badge.rotation.x = Math.PI / 2;
  const bag = box(shop, [0.5, 0.44, 0.1], 0xef7a6d, [0, 4, 2.08], [0, 0, 0], false);
  addEdges(bag, COLORS.ink, 0.14);
  const bagHandle = addMesh(
    shop,
    new THREE.TorusGeometry(0.17, 0.035, 6, 12, Math.PI),
    toon(0xef7a6d),
    [0, 4.25, 2.09],
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
    [-0.58, 0.77, 0.08, 0.72, 1.04, 0.86, 0.8, COLORS.leaf],
    [0.05, 0.94, -0.06, 0.86, 1.02, 0.9, 0.82, COLORS.leafLight],
    [0.65, 0.66, -0.14, 0.72, 1.06, 0.82, 0.9, COLORS.leafDark],
    [-0.08, 1.52, 0.06, 0.66, 0.94, 0.88, 0.82, 0x83d36d],
    [-0.82, 1.26, -0.08, 0.54, 0.96, 0.84, 0.86, COLORS.leafDark],
    [0.72, 1.28, 0.16, 0.55, 0.94, 0.86, 0.82, COLORS.leaf],
    [0.08, 0.58, 0.45, 0.58, 1.04, 0.78, 0.86, COLORS.leafLight],
  ];
  crownData.forEach(([cx, cy, cz, radius, sx, sy, sz, color], index) => {
    const leaves = addMesh(
      root,
      new THREE.IcosahedronGeometry(radius, 1),
      toon(color, { roughness: 0.76 }),
      [cx, cy, cz],
      [phase * 0.17 + index * 0.21, index * 0.42, phase * 0.09 - index * 0.08],
    );
    leaves.scale.set(sx, sy, sz);
    leaves.castShadow = index < 4;
    leaves.receiveShadow = false;
  });
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
}

function createFlowerPatch(
  parent: THREE.Object3D,
  centerX: number,
  centerZ: number,
  count: number,
  seed: number,
): void {
  const flowerColors = [0xff6f91, 0xffd45f, 0xf7f2ff, 0x8b78d0, 0xf48a62];
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399 + seed;
    const distance = 0.3 + ((index * 47 + seed * 31) % 17) * 0.075;
    const x = centerX + Math.cos(angle) * distance;
    const z = centerZ + Math.sin(angle) * distance * 0.7;
    cylinder(parent, 0.018, 0.025, 0.28, 5, COLORS.grassDark, [x, 0.2, z], false);
    const flower = new THREE.Group();
    flower.position.set(x, 0.38 + (index % 3) * 0.035, z);
    parent.add(flower);
    const color = flowerColors[(index + seed) % flowerColors.length];
    for (let petal = 0; petal < 5; petal += 1) {
      const petalAngle = (petal / 5) * Math.PI * 2;
      sphere(
        flower,
        0.075,
        color,
        [Math.cos(petalAngle) * 0.09, 0, Math.sin(petalAngle) * 0.09],
        [1.2, 0.55, 1],
      );
    }
    sphere(flower, 0.055, COLORS.gold, [0, 0.025, 0]);
  }
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
  cylinder(lamp, 0.2, 0.28, 0.2, 8, 0x44565d, [0, 0.1, 0]);
  cylinder(lamp, 0.065, 0.09, 2.75, 8, 0x44565d, [0, 1.54, 0]);
  box(lamp, [0.65, 0.09, 0.1], 0x44565d, [0.22, 2.88, 0], [0, 0, -0.06], false);
  const shade = cylinder(lamp, 0.42, 0.25, 0.33, 8, 0x3d5057, [0.48, 2.7, 0]);
  shade.rotation.z = Math.PI;
  sphere(
    lamp,
    0.25,
    0xffe69b,
    [0.48, 2.48, 0],
    [0.92, 1.08, 0.92],
    false,
  ).material = glassMaterial(0xffdf84, true);
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
  const roadMaterial = toon(COLORS.road, { roughness: 1 });
  const roadVertical = addMesh(parent, new THREE.BoxGeometry(5.7, 0.045, 46), roadMaterial, [1, 0.015, 0]);
  const roadHorizontal = addMesh(parent, new THREE.BoxGeometry(46, 0.045, 5.7), roadMaterial, [0, 0.018, 2]);
  roadVertical.receiveShadow = true;
  roadHorizontal.receiveShadow = true;

  box(parent, [0.38, 0.075, 46], COLORS.pavingLight, [-2.05, 0.055, 0], [0, 0, 0], false);
  box(parent, [0.38, 0.075, 46], COLORS.pavingLight, [4.05, 0.055, 0], [0, 0, 0], false);
  box(parent, [46, 0.075, 0.38], COLORS.pavingLight, [0, 0.055, -1.05], [0, 0, 0], false);
  box(parent, [46, 0.075, 0.38], COLORS.pavingLight, [0, 0.055, 5.05], [0, 0, 0], false);

  for (let z = -20; z <= 20; z += 3.2) {
    box(parent, [0.14, 0.018, 1.42], COLORS.cream, [1, 0.05, z], [0, 0, 0], false);
  }
  for (let x = -20; x <= 20; x += 3.2) {
    box(parent, [1.42, 0.018, 0.14], COLORS.cream, [x, 0.052, 2], [0, 0, 0], false);
  }

  for (let stripe = -2; stripe <= 2; stripe += 1) {
    box(parent, [0.48, 0.018, 2.3], COLORS.white, [-0.35 + stripe * 0.68, 0.055, -0.1], [0, 0, 0], false);
    box(parent, [2.3, 0.018, 0.48], COLORS.white, [5.2, 0.055, 0.65 + stripe * 0.68], [0, 0, 0], false);
  }
}

function createPlaza(parent: THREE.Object3D, droplets: JetDrop[]): void {
  cylinder(parent, 7.25, 7.25, 0.18, 32, COLORS.paving, [-7.7, 0.12, -5.2]);
  cylinder(parent, 6.1, 6.1, 0.06, 32, 0xf9dca6, [-7.7, 0.24, -5.2], false);
  for (let ring = 0; ring < 3; ring += 1) {
    const ringMesh = addMesh(
      parent,
      new THREE.TorusGeometry(3.1 + ring * 1.15, 0.07, 5, 32),
      toon(ring % 2 === 0 ? 0xd6b57d : 0xefc989),
      [-7.7, 0.3, -5.2],
      [Math.PI / 2, 0, 0],
    );
    ringMesh.castShadow = false;
  }
  createFountain(parent, -7.7, -5.2, droplets);
}

function createParkPond(parent: THREE.Object3D): void {
  const pond = addMesh(
    parent,
    new THREE.CylinderGeometry(2.7, 2.95, 0.18, 28),
    waterMaterial(0x49b7d3),
    [-8.5, 0.17, 10.2],
  );
  pond.scale.z = 0.68;
  pond.receiveShadow = false;
  for (const angle of [0.3, 1.35, 2.5, 3.7, 5.1]) {
    const x = -8.5 + Math.cos(angle) * 2.65;
    const z = 10.2 + Math.sin(angle) * 1.75;
    cylinder(parent, 0.24, 0.28, 0.12, 10, 0x5eae5c, [x, 0.34, z], false);
    sphere(parent, 0.09, 0xff8ba5, [x, 0.46, z], [1, 0.45, 1]);
  }
  const bridge = new THREE.Group();
  bridge.position.set(-8.5, 0.42, 10.2);
  parent.add(bridge);
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
}

function createGrassDetails(parent: THREE.Object3D): void {
  const maximum = 190;
  const geometry = new THREE.ConeGeometry(0.052, 0.25, 3);
  geometry.translate(0, 0.125, 0);
  const grass = new THREE.InstancedMesh(geometry, toon(COLORS.grassDark, { roughness: 1 }), maximum);
  grass.name = "Fine grass tufts";
  grass.castShadow = false;
  grass.receiveShadow = false;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
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

    position.set(x, 0.005, z);
    euler.set(0, angle * 1.7, Math.sin(candidate * 1.31) * 0.08);
    rotation.setFromEuler(euler);
    const variation = 0.72 + ((candidate * 29) % 37) / 92;
    scale.set(variation, variation, variation);
    matrix.compose(position, rotation, scale);
    grass.setMatrixAt(placed, matrix);
    placed += 1;
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  parent.add(grass);
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

  const skylineColors = [0xe8a970, 0xe2817c, 0x76b1a2, 0xd9b96c, 0x9b8ac5];
  for (let index = 0; index < 11; index += 1) {
    const angle = Math.PI * (1.04 + index * 0.087);
    const distance = 19 + (index % 3) * 1.1;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const building = new THREE.Group();
    building.position.set(x, 0, z);
    building.rotation.y = -angle + Math.PI / 2;
    background.add(building);
    box(building, [2.25, 2.2 + (index % 3) * 0.4, 1.75], skylineColors[index % skylineColors.length], [0, 1.1, 0]);
    const roof = addMesh(
      building,
      gableRoofGeometry(2.65, 2.05, 0.82),
      toon(index % 2 === 0 ? 0xb85f54 : 0x5d7589, { side: THREE.DoubleSide }),
      [0, 2.2 + (index % 3) * 0.4, 0],
    );
    addEdges(roof, COLORS.ink, 0.08, 34);
    box(building, [0.45, 0.58, 0.06], 0x8ed5e1, [0, 1.4, 0.91], [0, 0, 0], false);
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

/**
 * Builds the full Sunny Side town. The caller owns attaching the returned group
 * to its scene, which keeps creation safe for scene transitions.
 *
 * Bench groups expose `sitPosition`, `sitYaw`, and `interactionRadius` through
 * `userData`, while activity points are stable world-space destinations.
 */
export function createTown(sceneName: TownSceneName): TownEnvironment {
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

  const distantClouds = createDistantScenery(group);
  createRoadNetwork(group);
  createPlaza(group, droplets);
  createParkPond(group);
  createGrassDetails(group);

  createHouse(group, -9.8, 3.1, 0xf4a78b, 0xb95455, 0.04, 1.03);
  createHouse(group, -15.2, 2.6, 0x8fc8b0, 0x577c7c, -0.03, 0.92);
  createHouse(group, -15.2, -8.9, 0xf3cf79, 0xd46f55, 0.06, 0.96);
  createHouse(group, -3.1, -12.6, 0x9fbbdc, 0x6c6aa5, -0.03, 0.9);
  createHouse(group, 8.6, -10.5, 0xf3b3b7, 0x9b5a75, 0.05, 0.96);
  createHouse(group, 14.7, -8.5, 0xf1c576, 0x4c8c85, -0.06, 0.9);
  createHouse(group, 14.5, 9.8, 0x91c5b0, 0x517a72, Math.PI, 0.92);
  createCafe(group, 7.9, -2.2);
  createShop(group, 8.4, 7.65);

  const treeData: ReadonlyArray<readonly [number, number, number, number]> = [
    [-12.2, 8.2, 1.05, 0.2],
    [-5.2, 9.4, 0.9, 1.3],
    [-12.7, 12.4, 0.94, 2.4],
    [-4.7, 13.4, 1.1, 3.1],
    [-17.8, -3.6, 0.92, 0.7],
    [-12.5, -14.4, 1.08, 1.8],
    [5.7, -14.5, 0.94, 2.6],
    [17.1, -1.2, 1.05, 3.5],
    [18.1, 5.8, 0.9, 0.9],
    [10.8, 14.3, 1.08, 2.1],
    [5.8, 12.3, 0.87, 3.8],
    [-1.7, 16.4, 1.08, 1.1],
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
  benches.push(createBench(group, -5.2, 10.7, Math.PI / 2));
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

  const activeActivityId =
    sceneName === "home"
      ? "home-rose"
      : sceneName === "plaza"
        ? "wish-fountain"
        : "sunny-cafe";
  group.userData.activeActivityId = activeActivityId;

  group.userData.activityPoints = activityPoints;
  group.userData.benches = benches;

  const windmillSails = group.getObjectByName("Windmill sails");
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

    if (windmillSails) windmillSails.rotation.z = -time * 0.22;

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

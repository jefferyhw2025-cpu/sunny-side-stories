import * as THREE from "three";

export type WindVegetationKind = "grass" | "flower" | "bush" | "treeLeaves";

type WindProfile = {
  amplitude: number;
  frequency: number;
  flutter: number;
  baseWeight: number;
  heightPower: number;
};

export type WindMaterialFilter = (
  mesh: THREE.Mesh,
  material: THREE.Material,
  materialIndex: number,
) => boolean;

export interface VegetationWindDiagnostics {
  readonly time: number;
  readonly gust: number;
  readonly direction: readonly [number, number];
  readonly attachedMeshes: number;
  readonly byKind: Readonly<Record<WindVegetationKind, number>>;
}

export interface VegetationWindSystem {
  attachMesh(
    mesh: THREE.Mesh,
    kind: WindVegetationKind,
    phase?: number,
    materialFilter?: WindMaterialFilter,
  ): void;
  attachObject(
    object: THREE.Object3D,
    kind: WindVegetationKind,
    phase?: number,
    materialFilter?: WindMaterialFilter,
  ): void;
  update(time: number): void;
  getDiagnostics(): VegetationWindDiagnostics;
}

const WIND_ATTRIBUTE = "sunnyWindWeight";
const WIND_SHADER_KEY = "sunny-height-wind-v2";

const PROFILES: Record<WindVegetationKind, WindProfile> = {
  // The blade foot stays planted while the narrow tip can travel far enough
  // to read at the normal gameplay camera distance.
  grass: {
    amplitude: 0.115,
    frequency: 1.42,
    flutter: 0.34,
    baseWeight: 0,
    heightPower: 1.42,
  },
  // Blossoms follow their stems without looking as stiff as the surrounding
  // hedge. The authored flower mesh already places petals near weight 1.
  flower: {
    amplitude: 0.068,
    frequency: 1.18,
    flutter: 0.42,
    baseWeight: 0,
    heightPower: 1.08,
  },
  bush: {
    amplitude: 0.072,
    frequency: 0.94,
    flutter: 0.3,
    baseWeight: 0,
    heightPower: 1.18,
  },
  // Leaf geometry is animated independently from bark. A little base motion
  // lets the canopy travel as a mass, while height weighting adds soft bend.
  treeLeaves: {
    amplitude: 0.105,
    frequency: 0.69,
    flutter: 0.24,
    baseWeight: 0.22,
    heightPower: 0.86,
  },
};

type WindUniforms = {
  time: { value: number };
  gust: { value: number };
  direction: { value: THREE.Vector2 };
};

function ensureHeightWeights(geometry: THREE.BufferGeometry): boolean {
  if (geometry.getAttribute(WIND_ATTRIBUTE)) return true;
  const position = geometry.getAttribute("position");
  if (!position || position.count === 0) return false;

  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    minimum = Math.min(minimum, y);
    maximum = Math.max(maximum, y);
  }
  const height = Math.max(0.0001, maximum - minimum);
  const weights = new Float32Array(position.count);
  for (let index = 0; index < position.count; index += 1) {
    weights[index] = THREE.MathUtils.clamp((position.getY(index) - minimum) / height, 0, 1);
  }
  geometry.setAttribute(WIND_ATTRIBUTE, new THREE.BufferAttribute(weights, 1));
  geometry.userData.sunnyWindHeightWeighted = true;
  return true;
}

function windMaterial(
  source: THREE.Material,
  profile: WindProfile,
  phase: number,
  uniforms: WindUniforms,
): THREE.Material {
  const material = source.clone();
  const originalCompile = material.onBeforeCompile;
  const originalCacheKey = source.customProgramCacheKey();

  material.userData = {
    ...material.userData,
    shared: false,
    sharedEnvironmentAsset: false,
    sunnyWindAnimated: true,
  };
  material.onBeforeCompile = (shader, renderer) => {
    originalCompile.call(material, shader, renderer);
    shader.uniforms.sunnyWindTime = uniforms.time;
    shader.uniforms.sunnyWindGust = uniforms.gust;
    shader.uniforms.sunnyWindDirection = uniforms.direction;
    shader.uniforms.sunnyWindAmplitude = { value: profile.amplitude };
    shader.uniforms.sunnyWindFrequency = { value: profile.frequency };
    shader.uniforms.sunnyWindFlutter = { value: profile.flutter };
    shader.uniforms.sunnyWindPhase = { value: phase };
    shader.uniforms.sunnyWindBaseWeight = { value: profile.baseWeight };
    shader.uniforms.sunnyWindHeightPower = { value: profile.heightPower };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
attribute float ${WIND_ATTRIBUTE};
uniform float sunnyWindTime;
uniform float sunnyWindGust;
uniform vec2 sunnyWindDirection;
uniform float sunnyWindAmplitude;
uniform float sunnyWindFrequency;
uniform float sunnyWindFlutter;
uniform float sunnyWindPhase;
uniform float sunnyWindBaseWeight;
uniform float sunnyWindHeightPower;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `float sunnyHeight = pow(clamp(${WIND_ATTRIBUTE}, 0.0, 1.0), sunnyWindHeightPower);
float sunnyInfluence = mix(sunnyWindBaseWeight, 1.0, sunnyHeight);
vec3 sunnyAnchor = modelMatrix[3].xyz;
#ifdef USE_INSTANCING
  sunnyAnchor += (modelMatrix * vec4(instanceMatrix[3].xyz, 0.0)).xyz;
#endif
float sunnySpatialPhase = dot(sunnyAnchor.xz, vec2(0.173, 0.117));
float sunnyMainWave = sin(
  sunnyWindTime * sunnyWindFrequency + sunnyWindPhase + sunnySpatialPhase
);
float sunnyCrossWave = sin(
  sunnyWindTime * sunnyWindFrequency * 0.73
  + sunnyWindPhase * 1.71
  + sunnySpatialPhase * 1.63
);
float sunnyLeafFlutter = sin(
  sunnyWindTime * sunnyWindFrequency * 2.17
  + sunnyWindPhase * 2.31
  + dot(position.xz, vec2(2.7, 3.1))
);
vec2 sunnyCrossDirection = vec2(-sunnyWindDirection.y, sunnyWindDirection.x);
vec2 sunnySway = sunnyWindDirection * (sunnyMainWave + sunnyLeafFlutter * sunnyWindFlutter);
sunnySway += sunnyCrossDirection * sunnyCrossWave * 0.31;
transformed.xz += sunnySway
  * sunnyWindAmplitude
  * sunnyWindGust
  * sunnyInfluence;
#include <project_vertex>`,
    );
  };
  material.customProgramCacheKey = () => `${originalCacheKey}:${WIND_SHADER_KEY}`;
  material.needsUpdate = true;
  return material;
}

/**
 * Adds GPU-side, height-weighted wind to vegetation only. Geometry and object
 * transforms remain unchanged on the CPU, so gameplay collision, grounding,
 * raycasts and the walkable terrain are not affected by the visual sway.
 */
export function createVegetationWindSystem(): VegetationWindSystem {
  const uniforms: WindUniforms = {
    time: { value: 0 },
    gust: { value: 0.72 },
    direction: { value: new THREE.Vector2(0.84, 0.54).normalize() },
  };
  const attachedByKind: Record<WindVegetationKind, number> = {
    grass: 0,
    flower: 0,
    bush: 0,
    treeLeaves: 0,
  };
  let attachedMeshes = 0;

  const attachMesh: VegetationWindSystem["attachMesh"] = (
    mesh,
    kind,
    phase = 0,
    materialFilter,
  ) => {
    if (mesh.userData.sunnyWindAttached || !ensureHeightWeights(mesh.geometry)) return;
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let changed = false;
    const materials = sourceMaterials.map((source, index) => {
      if (materialFilter && !materialFilter(mesh, source, index)) return source;
      changed = true;
      return windMaterial(source, PROFILES[kind], phase + index * 0.37, uniforms);
    });
    if (!changed) return;
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0]!;
    mesh.userData.sunnyWindAttached = kind;
    attachedMeshes += 1;
    attachedByKind[kind] += 1;
  };

  const attachObject: VegetationWindSystem["attachObject"] = (
    object,
    kind,
    phase = 0,
    materialFilter,
  ) => {
    let meshIndex = 0;
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      attachMesh(mesh, kind, phase + meshIndex * 0.43, materialFilter);
      meshIndex += 1;
    });
  };

  const update = (time: number): void => {
    if (!Number.isFinite(time)) return;
    uniforms.time.value = time;

    // Several long, incommensurate waves produce calm stretches followed by
    // rounded gusts. There are no random jumps and neighbouring plants still
    // share one believable wind front.
    const broadWave = Math.sin(time * 0.17 - 0.8) * 0.5 + 0.5;
    const roundedGust = broadWave * broadWave * (3 - 2 * broadWave);
    const secondary = Math.sin(time * 0.071 + 1.9) * 0.5 + 0.5;
    const softVariation = Math.sin(time * 0.037 + 4.2);
    uniforms.gust.value = THREE.MathUtils.clamp(
      0.43 + roundedGust * 0.37 + secondary * 0.17 + softVariation * 0.055,
      0.38,
      1.05,
    );

    uniforms.direction.value.set(
      0.86 + Math.sin(time * 0.061) * 0.16,
      0.5 + Math.cos(time * 0.047 + 0.7) * 0.14,
    ).normalize();
  };

  const getDiagnostics = (): VegetationWindDiagnostics => ({
    time: uniforms.time.value,
    gust: uniforms.gust.value,
    direction: [uniforms.direction.value.x, uniforms.direction.value.y],
    attachedMeshes,
    byKind: { ...attachedByKind },
  });

  return { attachMesh, attachObject, update, getDiagnostics };
}

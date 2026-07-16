import * as THREE from "three";

export const RESIDENT_STATES = [
  "idle",
  "walk",
  "run",
  "talk",
  "eat",
  "sit",
  "happy",
  "sad",
] as const;

export type ResidentState = (typeof RESIDENT_STATES)[number];

export type PointLike =
  | THREE.Vector3
  | { x: number; y?: number; z: number }
  | readonly [number, number]
  | readonly [number, number, number];

export type DurationValue =
  | number
  | readonly [number, number]
  | { min: number; max: number };

export type StateDurations = Partial<Record<ResidentState, DurationValue>>;

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y?: number;
}

export interface CircularObstacle {
  position: PointLike;
  radius: number;
}

export interface ResidentHandle {
  readonly id: string;
  readonly group: THREE.Group;
  readonly home: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly state: ResidentState;
  readonly stateTime: number;
  readonly stateDuration: number;
  readonly target: THREE.Vector3 | null;
  readonly partner: ResidentHandle | null;
  readonly userData: unknown;
}

export interface ResidentAnimationFrame {
  readonly resident: ResidentHandle;
  readonly group: THREE.Group;
  readonly state: ResidentState;
  readonly elapsed: number;
  readonly delta: number;
  readonly stateTime: number;
  readonly stateProgress: number;
  readonly velocity: THREE.Vector3;
  readonly speed: number;
  readonly target: THREE.Vector3 | null;
  readonly partner: ResidentHandle | null;
}

export interface ResidentTransitionEvent {
  readonly resident: ResidentHandle;
  readonly group: THREE.Group;
  readonly from: ResidentState | null;
  readonly to: ResidentState;
  readonly reason: string;
  readonly elapsed: number;
}

export type ApplyResidentAnimation = (
  resident: THREE.Group,
  state: ResidentState,
  elapsed: number,
  delta: number,
) => void;

export interface ResidentAnimationAdapter {
  applyAnimation?: ApplyResidentAnimation;
  onTransition?: (event: ResidentTransitionEvent) => void;
  onUpdate?: (frame: ResidentAnimationFrame) => void;
  states?: Partial<Record<ResidentState, (frame: ResidentAnimationFrame) => void>>;
}

export interface ResidentDefinition {
  id?: string;
  group: THREE.Group;
  initialState?: ResidentState;
  targetPoints?: readonly PointLike[];
  walkSpeed?: number;
  runSpeed?: number;
  radius?: number;
  wanderRadius?: number;
  turnSpeed?: number;
  acceleration?: number;
  headingOffset?: number;
  lockY?: boolean;
  durations?: StateDurations;
  animation?: ResidentAnimationAdapter;
  applyAnimation?: ApplyResidentAnimation;
  userData?: unknown;
}

export type ResidentSource = THREE.Group | ResidentDefinition;
export type ResidentReference = string | THREE.Object3D | ResidentHandle;

export interface CameraMotionOptions {
  positionDamping?: number;
  targetDamping?: number;
  fov?: number;
}

export interface CameraFocusOptions extends CameraMotionOptions {
  position?: PointLike;
  offset?: PointLike;
}

export interface CameraFollowOptions extends CameraMotionOptions {
  offset?: PointLike;
  targetOffset?: PointLike;
  offsetSpace?: "world" | "local";
}

export interface CameraFrameOptions extends CameraMotionOptions {
  padding?: number;
  targetOffset?: PointLike;
  viewDirection?: PointLike;
}

export interface SmoothCameraDirectorOptions {
  target?: PointLike;
  positionDamping?: number;
  targetDamping?: number;
  fovDamping?: number;
  minFov?: number;
  maxFov?: number;
}

export interface SmoothCameraDirector {
  readonly camera: THREE.Camera;
  readonly target: THREE.Vector3;
  readonly desiredTarget: THREE.Vector3;
  readonly desiredPosition: THREE.Vector3;
  moveTo(position: PointLike, target: PointLike, options?: CameraMotionOptions): void;
  focus(target: THREE.Object3D | PointLike, options?: CameraFocusOptions): void;
  follow(subject: THREE.Object3D, options?: CameraFollowOptions): void;
  clearFollow(): void;
  frame(subjects: readonly THREE.Object3D[], options?: CameraFrameOptions): void;
  cut(position: PointLike, target: PointLike, fov?: number): void;
  setDamping(positionDamping: number, targetDamping?: number): void;
  update(deltaSeconds: number, elapsedSeconds?: number): void;
}

export interface WorldDirectorOptions {
  residents: readonly ResidentSource[];
  targetPoints?: readonly PointLike[];
  bounds?: WorldBounds;
  obstacles?: readonly CircularObstacle[];
  walkSpeed?: number;
  runSpeed?: number;
  radius?: number;
  wanderRadius?: number;
  arrivalDistance?: number;
  avoidancePadding?: number;
  avoidanceStrength?: number;
  conversationDistance?: number;
  conversationRate?: number;
  conversationCooldown?: number;
  autonomous?: boolean;
  durations?: StateDurations;
  random?: () => number;
  animation?: ResidentAnimationAdapter;
  applyAnimation?: ApplyResidentAnimation;
  camera?: THREE.Camera;
  cameraDirector?: SmoothCameraDirector;
  cameraOptions?: SmoothCameraDirectorOptions;
}

export interface SetResidentStateOptions {
  duration?: number;
  target?: PointLike;
  reason?: string;
}

export interface MoveResidentOptions {
  run?: boolean;
  duration?: number;
  reason?: string;
}

export interface WorldDirector {
  readonly residents: readonly ResidentHandle[];
  readonly camera: SmoothCameraDirector | null;
  readonly elapsed: number;
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
  getResident(reference: ResidentReference): ResidentHandle | undefined;
  setState(
    reference: ResidentReference,
    state: ResidentState,
    options?: SetResidentStateOptions,
  ): boolean;
  moveTo(reference: ResidentReference, target: PointLike, options?: MoveResidentOptions): boolean;
  startConversation(
    first: ResidentReference,
    second: ResidentReference,
    duration?: number,
  ): boolean;
  update(deltaSeconds: number, elapsedSeconds?: number): void;
}

const DEFAULT_DURATIONS: Record<ResidentState, DurationValue> = {
  idle: [1.2, 3.8],
  walk: [4, 10],
  run: [2.5, 6],
  talk: [3.5, 7],
  eat: [2.8, 5.5],
  sit: [3, 7],
  happy: [1.4, 3],
  sad: [2, 4.5],
};

const ZERO = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: number | undefined, fallback: number): number {
  const finite = finiteOr(value, fallback);
  return finite > 0 ? finite : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function safeDelta(deltaSeconds: number): number {
  return Math.min(0.25, Math.max(0, finiteOr(deltaSeconds, 0)));
}

function dampingAlpha(damping: number, delta: number): number {
  return 1 - Math.exp(-Math.max(0, damping) * delta);
}

function copyPoint(target: THREE.Vector3, point: PointLike, fallbackY = 0): THREE.Vector3 {
  if (Array.isArray(point)) {
    const coordinates = point as readonly number[];
    if (coordinates.length >= 3) {
      return target.set(coordinates[0] ?? 0, coordinates[1] ?? fallbackY, coordinates[2] ?? 0);
    }
    return target.set(coordinates[0] ?? 0, fallbackY, coordinates[1] ?? 0);
  }
  const objectPoint = point as { x: number; y?: number; z: number };
  return target.set(objectPoint.x, objectPoint.y ?? fallbackY, objectPoint.z);
}

function isObject3D(value: unknown): value is THREE.Object3D {
  return Boolean(value && typeof value === "object" && (value as THREE.Object3D).isObject3D);
}

function resolveWorldPoint(
  target: THREE.Vector3,
  source: THREE.Object3D | PointLike,
  fallbackY = 0,
): THREE.Vector3 {
  if (isObject3D(source)) {
    source.updateWorldMatrix(true, false);
    return source.getWorldPosition(target);
  }
  return copyPoint(target, source, fallbackY);
}

function setPerspectiveFov(camera: THREE.Camera, fov: number): void {
  if (!(camera instanceof THREE.PerspectiveCamera)) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

class SmoothCameraDirectorImpl implements SmoothCameraDirector {
  readonly camera: THREE.Camera;
  readonly target = new THREE.Vector3();
  readonly desiredTarget = new THREE.Vector3();
  readonly desiredPosition = new THREE.Vector3();

  private positionDamping: number;
  private targetDamping: number;
  private readonly fovDamping: number;
  private readonly minFov: number;
  private readonly maxFov: number;
  private desiredFov: number | null = null;
  private followSubject: THREE.Object3D | null = null;
  private followOffset = new THREE.Vector3();
  private followTargetOffset = new THREE.Vector3(0, 1.2, 0);
  private followOffsetSpace: "world" | "local" = "world";
  private readonly scratch = new THREE.Vector3();
  private readonly box = new THREE.Box3();
  private readonly sphere = new THREE.Sphere();

  constructor(camera: THREE.Camera, options: SmoothCameraDirectorOptions = {}) {
    this.camera = camera;
    this.positionDamping = positiveOr(options.positionDamping, 4.8);
    this.targetDamping = positiveOr(options.targetDamping, 6.5);
    this.fovDamping = positiveOr(options.fovDamping, 5);
    this.minFov = positiveOr(options.minFov, 18);
    this.maxFov = Math.max(this.minFov, positiveOr(options.maxFov, 75));
    this.desiredPosition.copy(camera.position);
    copyPoint(this.target, options.target ?? [0, 0, 0]);
    this.desiredTarget.copy(this.target);
    camera.lookAt(this.target);
    if (camera instanceof THREE.PerspectiveCamera) this.desiredFov = camera.fov;
  }

  moveTo(position: PointLike, target: PointLike, options: CameraMotionOptions = {}): void {
    this.clearFollow();
    copyPoint(this.desiredPosition, position, this.camera.position.y);
    copyPoint(this.desiredTarget, target, this.target.y);
    this.applyMotionOptions(options);
  }

  focus(target: THREE.Object3D | PointLike, options: CameraFocusOptions = {}): void {
    this.clearFollow();
    resolveWorldPoint(this.desiredTarget, target, this.target.y);
    if (options.position) {
      copyPoint(this.desiredPosition, options.position, this.camera.position.y);
    } else if (options.offset) {
      copyPoint(this.scratch, options.offset);
      this.desiredPosition.copy(this.desiredTarget).add(this.scratch);
    }
    this.applyMotionOptions(options);
  }

  follow(subject: THREE.Object3D, options: CameraFollowOptions = {}): void {
    this.followSubject = subject;
    this.followOffsetSpace = options.offsetSpace ?? "world";
    subject.updateWorldMatrix(true, false);
    subject.getWorldPosition(this.scratch);
    if (options.offset) copyPoint(this.followOffset, options.offset);
    else this.followOffset.copy(this.camera.position).sub(this.scratch);
    if (options.targetOffset) copyPoint(this.followTargetOffset, options.targetOffset);
    this.applyMotionOptions(options);
    this.updateFollowGoal();
  }

  clearFollow(): void {
    this.followSubject = null;
  }

  frame(subjects: readonly THREE.Object3D[], options: CameraFrameOptions = {}): void {
    this.clearFollow();
    this.box.makeEmpty();
    for (const subject of subjects) {
      subject.updateWorldMatrix(true, true);
      this.box.expandByObject(subject, true);
    }
    if (this.box.isEmpty()) return;
    this.box.getBoundingSphere(this.sphere);
    this.desiredTarget.copy(this.sphere.center);
    if (options.targetOffset) {
      copyPoint(this.scratch, options.targetOffset);
      this.desiredTarget.add(this.scratch);
    }
    const direction = this.scratch;
    if (options.viewDirection) copyPoint(direction, options.viewDirection);
    else direction.copy(this.desiredPosition).sub(this.target);
    if (direction.lengthSq() < 0.0001) direction.set(0.65, 0.45, 1);
    direction.normalize();
    const padding = Math.max(1, finiteOr(options.padding, 1.25));
    let distance = Math.max(1, this.sphere.radius * 2.5 * padding);
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const verticalHalfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * this.camera.aspect);
      const limitingHalfFov = Math.max(0.05, Math.min(verticalHalfFov, horizontalHalfFov));
      distance = (Math.max(0.1, this.sphere.radius) / Math.sin(limitingHalfFov)) * padding;
    }
    this.desiredPosition.copy(this.desiredTarget).addScaledVector(direction, distance);
    this.applyMotionOptions(options);
  }

  cut(position: PointLike, target: PointLike, fov?: number): void {
    this.clearFollow();
    copyPoint(this.camera.position, position, this.camera.position.y);
    this.desiredPosition.copy(this.camera.position);
    copyPoint(this.target, target, this.target.y);
    this.desiredTarget.copy(this.target);
    if (typeof fov === "number") {
      this.desiredFov = THREE.MathUtils.clamp(fov, this.minFov, this.maxFov);
      setPerspectiveFov(this.camera, this.desiredFov);
    }
    this.camera.lookAt(this.target);
  }

  setDamping(positionDamping: number, targetDamping = positionDamping): void {
    this.positionDamping = Math.max(0, positionDamping);
    this.targetDamping = Math.max(0, targetDamping);
  }

  update(deltaSeconds: number): void {
    const delta = safeDelta(deltaSeconds);
    if (this.followSubject) this.updateFollowGoal();
    this.camera.position.lerp(this.desiredPosition, dampingAlpha(this.positionDamping, delta));
    this.target.lerp(this.desiredTarget, dampingAlpha(this.targetDamping, delta));
    if (this.camera instanceof THREE.PerspectiveCamera && this.desiredFov !== null) {
      const nextFov = THREE.MathUtils.lerp(
        this.camera.fov,
        this.desiredFov,
        dampingAlpha(this.fovDamping, delta),
      );
      if (Math.abs(nextFov - this.camera.fov) > 0.0001) setPerspectiveFov(this.camera, nextFov);
    }
    this.camera.lookAt(this.target);
  }

  private applyMotionOptions(options: CameraMotionOptions): void {
    if (typeof options.positionDamping === "number") {
      this.positionDamping = Math.max(0, options.positionDamping);
    }
    if (typeof options.targetDamping === "number") {
      this.targetDamping = Math.max(0, options.targetDamping);
    }
    if (typeof options.fov === "number") {
      this.desiredFov = THREE.MathUtils.clamp(options.fov, this.minFov, this.maxFov);
    }
  }

  private updateFollowGoal(): void {
    const subject = this.followSubject;
    if (!subject) return;
    subject.updateWorldMatrix(true, false);
    subject.getWorldPosition(this.desiredTarget).add(this.followTargetOffset);
    if (this.followOffsetSpace === "local") {
      this.desiredPosition.copy(this.followOffset);
      subject.localToWorld(this.desiredPosition);
    } else {
      subject.getWorldPosition(this.desiredPosition).add(this.followOffset);
    }
  }
}

export function createCameraDirector(
  camera: THREE.Camera,
  options: SmoothCameraDirectorOptions = {},
): SmoothCameraDirector {
  return new SmoothCameraDirectorImpl(camera, options);
}

interface ResidentRuntime extends ResidentHandle {
  state: ResidentState;
  stateTime: number;
  stateDuration: number;
  target: THREE.Vector3 | null;
  partner: ResidentRuntime | null;
  readonly definition: ResidentDefinition;
  readonly desiredVelocity: THREE.Vector3;
  readonly worldPosition: THREE.Vector3;
  readonly nextPosition: THREE.Vector3;
  readonly targetPoints: readonly PointLike[];
  readonly walkSpeed: number;
  readonly runSpeed: number;
  readonly radius: number;
  readonly wanderRadius: number;
  readonly turnSpeed: number;
  readonly acceleration: number;
  readonly headingOffset: number;
  readonly lockY: boolean;
  chatCooldown: number;
}

class WorldDirectorImpl implements WorldDirector {
  readonly residents: readonly ResidentRuntime[];
  readonly camera: SmoothCameraDirector | null;
  elapsed = 0;
  enabled = true;

  private readonly options: WorldDirectorOptions;
  private readonly random: () => number;
  private readonly scratchA = new THREE.Vector3();
  private readonly scratchB = new THREE.Vector3();

  constructor(options: WorldDirectorOptions) {
    this.options = options;
    this.random = options.random ?? Math.random;
    const ids = new Set<string>();
    this.residents = options.residents.map((source, index) => {
      const definition = this.normalizeDefinition(source);
      const group = definition.group;
      group.updateWorldMatrix(true, false);
      const home = group.getWorldPosition(new THREE.Vector3());
      const baseId = definition.id?.trim() || group.name.trim() || `resident-${index + 1}`;
      let id = baseId;
      let suffix = 2;
      while (ids.has(id)) id = `${baseId}-${suffix++}`;
      ids.add(id);
      const initialState = definition.initialState ?? "idle";
      const runtime: ResidentRuntime = {
        id,
        group,
        home,
        velocity: new THREE.Vector3(),
        desiredVelocity: new THREE.Vector3(),
        worldPosition: home.clone(),
        nextPosition: home.clone(),
        state: initialState,
        stateTime: 0,
        stateDuration: 0,
        target: null,
        partner: null,
        definition,
        targetPoints: definition.targetPoints ?? options.targetPoints ?? [],
        walkSpeed: positiveOr(definition.walkSpeed, positiveOr(options.walkSpeed, 1.15)),
        runSpeed: positiveOr(definition.runSpeed, positiveOr(options.runSpeed, 2.25)),
        radius: positiveOr(definition.radius, positiveOr(options.radius, 0.42)),
        wanderRadius: positiveOr(
          definition.wanderRadius,
          positiveOr(options.wanderRadius, 4.5),
        ),
        turnSpeed: positiveOr(definition.turnSpeed, 9),
        acceleration: positiveOr(definition.acceleration, 8),
        headingOffset: finiteOr(definition.headingOffset, 0),
        lockY: definition.lockY ?? true,
        chatCooldown: this.random() * positiveOr(options.conversationCooldown, 5),
        userData: definition.userData,
      };
      runtime.stateDuration = this.sampleDuration(runtime, initialState);
      return runtime;
    });
    this.camera =
      options.cameraDirector ??
      (options.camera ? createCameraDirector(options.camera, options.cameraOptions) : null);
    for (const resident of this.residents) {
      if (resident.state === "walk" || resident.state === "run") this.chooseTarget(resident);
      this.emitTransition(resident, null, resident.state, "initial");
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getResident(reference: ResidentReference): ResidentHandle | undefined {
    return this.findRuntime(reference);
  }

  setState(
    reference: ResidentReference,
    state: ResidentState,
    options: SetResidentStateOptions = {},
  ): boolean {
    const resident = this.findRuntime(reference);
    if (!resident) return false;
    const target = options.target
      ? copyPoint(new THREE.Vector3(), options.target, resident.worldPosition.y)
      : undefined;
    this.transition(resident, state, options.reason ?? "manual", options.duration, target);
    return true;
  }

  moveTo(
    reference: ResidentReference,
    target: PointLike,
    options: MoveResidentOptions = {},
  ): boolean {
    const resident = this.findRuntime(reference);
    if (!resident) return false;
    const destination = copyPoint(new THREE.Vector3(), target, resident.worldPosition.y);
    this.transition(
      resident,
      options.run ? "run" : "walk",
      options.reason ?? "move-to",
      options.duration,
      destination,
    );
    return true;
  }

  startConversation(
    firstReference: ResidentReference,
    secondReference: ResidentReference,
    duration?: number,
  ): boolean {
    const first = this.findRuntime(firstReference);
    const second = this.findRuntime(secondReference);
    if (!first || !second || first === second) return false;
    this.detachPartner(first, "conversation-replaced");
    this.detachPartner(second, "conversation-replaced");
    first.partner = second;
    second.partner = first;
    const sharedDuration = positiveOr(duration, this.sampleDuration(first, "talk"));
    this.transition(first, "talk", "conversation", sharedDuration);
    this.transition(second, "talk", "conversation", sharedDuration);
    return true;
  }

  update(deltaSeconds: number, elapsedSeconds?: number): void {
    if (!this.enabled) return;
    const delta = safeDelta(deltaSeconds);
    if (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds)) {
      this.elapsed = Math.max(0, elapsedSeconds);
    } else {
      this.elapsed += delta;
    }

    for (const resident of this.residents) {
      resident.group.updateWorldMatrix(true, false);
      resident.group.getWorldPosition(resident.worldPosition);
      resident.stateTime += delta;
      resident.chatCooldown = Math.max(0, resident.chatCooldown - delta);
      this.advanceState(resident);
      this.planVelocity(resident);
    }

    if (this.options.autonomous !== false) this.tryConversations(delta);
    this.applyResidentAvoidance();
    this.applyObstacleAvoidance();

    for (const resident of this.residents) {
      this.integrateResident(resident, delta);
      this.faceResident(resident, delta);
      this.emitAnimation(resident, delta);
    }
    this.camera?.update(delta, this.elapsed);
  }

  private normalizeDefinition(source: ResidentSource): ResidentDefinition {
    if (isObject3D(source)) return { group: source as THREE.Group };
    return source;
  }

  private findRuntime(reference: ResidentReference): ResidentRuntime | undefined {
    if (typeof reference === "string") {
      return this.residents.find((resident) => resident.id === reference);
    }
    if (isObject3D(reference)) {
      return this.residents.find((resident) => resident.group === reference);
    }
    return this.residents.find(
      (resident) => resident === reference || resident.group === reference.group,
    );
  }

  private sampleDuration(resident: ResidentRuntime, state: ResidentState): number {
    const value =
      resident.definition.durations?.[state] ??
      this.options.durations?.[state] ??
      DEFAULT_DURATIONS[state];
    if (typeof value === "number") return positiveOr(value, 1);
    const min = "min" in value ? value.min : value[0];
    const max = "max" in value ? value.max : value[1];
    const low = Math.max(0.05, Math.min(min, max));
    const high = Math.max(low, Math.max(min, max));
    return THREE.MathUtils.lerp(low, high, clamp01(this.random()));
  }

  private transition(
    resident: ResidentRuntime,
    state: ResidentState,
    reason: string,
    duration?: number,
    target?: THREE.Vector3,
  ): void {
    const previous = resident.state;
    if (previous === "talk" && state !== "talk") this.detachPartner(resident, reason);
    resident.state = state;
    resident.stateTime = 0;
    resident.stateDuration = positiveOr(duration, this.sampleDuration(resident, state));
    resident.target = target?.clone() ?? null;
    if ((state === "walk" || state === "run") && !resident.target) this.chooseTarget(resident);
    if (state !== "walk" && state !== "run") {
      resident.desiredVelocity.set(0, 0, 0);
    }
    this.emitTransition(resident, previous, state, reason);
  }

  private detachPartner(resident: ResidentRuntime, reason: string): void {
    const partner = resident.partner;
    if (!partner) return;
    resident.partner = null;
    partner.partner = null;
    const cooldown = positiveOr(this.options.conversationCooldown, 6);
    resident.chatCooldown = cooldown * (0.75 + this.random() * 0.5);
    partner.chatCooldown = cooldown * (0.75 + this.random() * 0.5);
    if (partner.state === "talk") {
      const previous = partner.state;
      partner.state = "idle";
      partner.stateTime = 0;
      partner.stateDuration = this.sampleDuration(partner, "idle");
      partner.target = null;
      this.emitTransition(partner, previous, "idle", reason);
    }
  }

  private advanceState(resident: ResidentRuntime): void {
    if (resident.state === "talk" && !resident.partner) {
      this.transition(resident, "idle", "partner-left");
      return;
    }
    if (resident.stateTime < resident.stateDuration) return;
    if (resident.state === "talk") {
      const partner = resident.partner;
      this.transition(resident, "idle", "conversation-ended");
      if (partner && partner.state === "talk") this.transition(partner, "happy", "conversation-ended");
      return;
    }
    if (resident.state === "walk" || resident.state === "run") {
      this.transition(resident, "idle", "movement-timeout");
      return;
    }
    if (this.options.autonomous === false) {
      this.transition(resident, "idle", "state-ended");
      return;
    }
    this.chooseAutonomousState(resident);
  }

  private chooseAutonomousState(resident: ResidentRuntime): void {
    const roll = clamp01(this.random());
    if (roll < 0.45) this.transition(resident, "walk", "wander");
    else if (roll < 0.54) this.transition(resident, "run", "wander-fast");
    else if (roll < 0.65) this.transition(resident, "eat", "daily-life");
    else if (roll < 0.76) this.transition(resident, "sit", "daily-life");
    else if (roll < 0.88) this.transition(resident, "happy", "mood");
    else if (roll < 0.95) this.transition(resident, "sad", "mood");
    else this.transition(resident, "idle", "pause");
  }

  private chooseTarget(resident: ResidentRuntime): void {
    if (resident.targetPoints.length > 0) {
      const index = Math.min(
        resident.targetPoints.length - 1,
        Math.floor(clamp01(this.random()) * resident.targetPoints.length),
      );
      resident.target = copyPoint(
        new THREE.Vector3(),
        resident.targetPoints[index]!,
        resident.worldPosition.y,
      );
    } else {
      const angle = this.random() * Math.PI * 2;
      const distance = resident.wanderRadius * (0.3 + this.random() * 0.7);
      resident.target = resident.home
        .clone()
        .add(new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance));
    }
    this.clampToBounds(resident.target, resident);
  }

  private planVelocity(resident: ResidentRuntime): void {
    if (resident.state !== "walk" && resident.state !== "run") {
      resident.desiredVelocity.set(0, 0, 0);
      return;
    }
    if (!resident.target) this.chooseTarget(resident);
    const target = resident.target;
    if (!target) return;
    resident.desiredVelocity.copy(target).sub(resident.worldPosition);
    if (resident.lockY) resident.desiredVelocity.y = 0;
    const distance = resident.desiredVelocity.length();
    if (distance <= positiveOr(this.options.arrivalDistance, 0.14)) {
      resident.velocity.set(0, 0, 0);
      this.transition(resident, "idle", "arrived");
      return;
    }
    const speed = resident.state === "run" ? resident.runSpeed : resident.walkSpeed;
    resident.desiredVelocity.multiplyScalar(speed / distance);
  }

  private tryConversations(delta: number): void {
    const distanceLimit = positiveOr(this.options.conversationDistance, 1.8);
    const rate = Math.max(0, finiteOr(this.options.conversationRate, 0.075));
    const chance = 1 - Math.exp(-rate * delta);
    for (let firstIndex = 0; firstIndex < this.residents.length; firstIndex += 1) {
      const first = this.residents[firstIndex]!;
      if (first.state !== "idle" || first.partner || first.chatCooldown > 0) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < this.residents.length; secondIndex += 1) {
        const second = this.residents[secondIndex]!;
        if (second.state !== "idle" || second.partner || second.chatCooldown > 0) continue;
        const distanceSquared = first.worldPosition.distanceToSquared(second.worldPosition);
        if (distanceSquared > distanceLimit * distanceLimit || this.random() >= chance) continue;
        this.startConversation(first, second);
        break;
      }
    }
  }

  private applyResidentAvoidance(): void {
    const padding = Math.max(0, finiteOr(this.options.avoidancePadding, 0.32));
    const strength = Math.max(0, finiteOr(this.options.avoidanceStrength, 1.35));
    for (let firstIndex = 0; firstIndex < this.residents.length; firstIndex += 1) {
      const first = this.residents[firstIndex]!;
      for (let secondIndex = firstIndex + 1; secondIndex < this.residents.length; secondIndex += 1) {
        const second = this.residents[secondIndex]!;
        this.scratchA.copy(first.worldPosition).sub(second.worldPosition);
        this.scratchA.y = 0;
        const minimumDistance = first.radius + second.radius + padding;
        const distanceSquared = this.scratchA.lengthSq();
        if (distanceSquared >= minimumDistance * minimumDistance) continue;
        let distance = Math.sqrt(distanceSquared);
        if (distance < 0.0001) {
          const angle = (firstIndex * 2.399 + secondIndex * 1.618) % (Math.PI * 2);
          this.scratchA.set(Math.cos(angle), 0, Math.sin(angle));
          distance = 0;
        } else {
          this.scratchA.multiplyScalar(1 / distance);
        }
        const amount = strength * (1 - distance / minimumDistance);
        if (first.state === "walk" || first.state === "run") {
          first.desiredVelocity.addScaledVector(this.scratchA, amount * first.walkSpeed);
          this.limitDesiredSpeed(first);
        }
        if (second.state === "walk" || second.state === "run") {
          second.desiredVelocity.addScaledVector(this.scratchA, -amount * second.walkSpeed);
          this.limitDesiredSpeed(second);
        }
      }
    }
  }

  private applyObstacleAvoidance(): void {
    const obstacles = this.options.obstacles;
    if (!obstacles?.length) return;
    const padding = Math.max(0, finiteOr(this.options.avoidancePadding, 0.32));
    const strength = Math.max(0, finiteOr(this.options.avoidanceStrength, 1.35));
    for (const resident of this.residents) {
      if (resident.state !== "walk" && resident.state !== "run") continue;
      for (const obstacle of obstacles) {
        copyPoint(this.scratchB, obstacle.position, resident.worldPosition.y);
        this.scratchA.copy(resident.worldPosition).sub(this.scratchB);
        this.scratchA.y = 0;
        const minimumDistance = resident.radius + Math.max(0, obstacle.radius) + padding;
        const distanceSquared = this.scratchA.lengthSq();
        if (distanceSquared >= minimumDistance * minimumDistance) continue;
        const distance = Math.sqrt(distanceSquared);
        if (distance < 0.0001) this.scratchA.set(1, 0, 0);
        else this.scratchA.multiplyScalar(1 / distance);
        resident.desiredVelocity.addScaledVector(
          this.scratchA,
          strength * (1 - distance / minimumDistance) * resident.walkSpeed,
        );
      }
      this.limitDesiredSpeed(resident);
    }
  }

  private limitDesiredSpeed(resident: ResidentRuntime): void {
    const maximum = resident.state === "run" ? resident.runSpeed : resident.walkSpeed;
    if (resident.desiredVelocity.lengthSq() > maximum * maximum) {
      resident.desiredVelocity.setLength(maximum);
    }
  }

  private integrateResident(resident: ResidentRuntime, delta: number): void {
    const moving = resident.state === "walk" || resident.state === "run";
    const acceleration = dampingAlpha(resident.acceleration, delta);
    resident.velocity.lerp(moving ? resident.desiredVelocity : ZERO, acceleration);
    if (resident.lockY) resident.velocity.y = 0;
    resident.nextPosition.copy(resident.worldPosition).addScaledVector(resident.velocity, delta);
    this.clampToBounds(resident.nextPosition, resident);
    if (resident.lockY) resident.nextPosition.y = resident.home.y;
    const parent = resident.group.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(resident.nextPosition);
    }
    resident.group.position.copy(resident.nextPosition);
  }

  private faceResident(resident: ResidentRuntime, delta: number): void {
    let direction: THREE.Vector3 | null = null;
    if (resident.state === "talk" && resident.partner) {
      direction = this.scratchA.copy(resident.partner.worldPosition).sub(resident.worldPosition);
    } else if (resident.velocity.lengthSq() > 0.0025) {
      direction = this.scratchA.copy(resident.velocity);
    }
    if (!direction) return;
    direction.y = 0;
    if (direction.lengthSq() < 0.0001) return;
    const desiredYaw = Math.atan2(direction.x, direction.z) + resident.headingOffset;
    const difference = THREE.MathUtils.euclideanModulo(
      desiredYaw - resident.group.rotation.y + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    resident.group.rotation.y += difference * dampingAlpha(resident.turnSpeed, delta);
  }

  private clampToBounds(point: THREE.Vector3, resident: ResidentRuntime): void {
    const bounds = this.options.bounds;
    if (!bounds) return;
    point.x = THREE.MathUtils.clamp(point.x, bounds.minX + resident.radius, bounds.maxX - resident.radius);
    point.z = THREE.MathUtils.clamp(point.z, bounds.minZ + resident.radius, bounds.maxZ - resident.radius);
    if (!resident.lockY && typeof bounds.y === "number") point.y = bounds.y;
  }

  private emitTransition(
    resident: ResidentRuntime,
    from: ResidentState | null,
    to: ResidentState,
    reason: string,
  ): void {
    const event: ResidentTransitionEvent = {
      resident,
      group: resident.group,
      from,
      to,
      reason,
      elapsed: this.elapsed,
    };
    this.options.animation?.onTransition?.(event);
    if (resident.definition.animation !== this.options.animation) {
      resident.definition.animation?.onTransition?.(event);
    }
  }

  private emitAnimation(resident: ResidentRuntime, delta: number): void {
    this.options.applyAnimation?.(resident.group, resident.state, this.elapsed, delta);
    this.options.animation?.applyAnimation?.(resident.group, resident.state, this.elapsed, delta);
    resident.definition.applyAnimation?.(resident.group, resident.state, this.elapsed, delta);
    if (resident.definition.animation !== this.options.animation) {
      resident.definition.animation?.applyAnimation?.(
        resident.group,
        resident.state,
        this.elapsed,
        delta,
      );
    }
    const frame: ResidentAnimationFrame = {
      resident,
      group: resident.group,
      state: resident.state,
      elapsed: this.elapsed,
      delta,
      stateTime: resident.stateTime,
      stateProgress: clamp01(resident.stateTime / Math.max(0.0001, resident.stateDuration)),
      velocity: resident.velocity,
      speed: resident.velocity.length(),
      target: resident.target,
      partner: resident.partner,
    };
    this.options.animation?.onUpdate?.(frame);
    this.options.animation?.states?.[resident.state]?.(frame);
    if (resident.definition.animation !== this.options.animation) {
      resident.definition.animation?.onUpdate?.(frame);
      resident.definition.animation?.states?.[resident.state]?.(frame);
    }
  }
}

export function createWorldDirector(options: WorldDirectorOptions): WorldDirector;
export function createWorldDirector(
  residents: readonly ResidentSource[],
  options?: Omit<WorldDirectorOptions, "residents">,
): WorldDirector;
export function createWorldDirector(
  optionsOrResidents: WorldDirectorOptions | readonly ResidentSource[],
  options: Omit<WorldDirectorOptions, "residents"> = {},
): WorldDirector {
  const resolvedOptions: WorldDirectorOptions = Array.isArray(optionsOrResidents)
    ? { ...options, residents: optionsOrResidents }
    : (optionsOrResidents as WorldDirectorOptions);
  return new WorldDirectorImpl(resolvedOptions);
}

export function update(
  director: { update(deltaSeconds: number, elapsedSeconds?: number): void },
  deltaSeconds: number,
  elapsedSeconds?: number,
): void {
  director.update(deltaSeconds, elapsedSeconds);
}

export { WORLD_UP };

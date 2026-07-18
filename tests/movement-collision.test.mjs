import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  createCharacter,
  groundCharacterToPlane,
  updateCharacter,
} from "../app/game/characters.ts";
import { createWorldDirector } from "../app/game/worldSystems.ts";

const PROFILE = {
  id: "qa-resident",
  name: "步态测试",
  skin: "#ffd0a6",
  hair: "#4b3028",
  shirt: "#66aa88",
  hairStyle: 0,
  faceShape: 0,
  eyeStyle: 0,
  browStyle: 0,
  noseStyle: 0,
  mouthStyle: 0,
  outfitStyle: 0,
  trait: "active",
};

test("walk cycle separates hip, knee and foot joints while one sole stays grounded", () => {
  const character = createCharacter(PROFILE);
  character.group.scale.setScalar(0.74);
  let maximumHipSeparation = 0;
  let maximumKneeBend = 0;
  let maximumFootPitch = 0;
  let maximumSwingFootGap = 0;

  for (let frame = 0; frame < 180; frame += 1) {
    updateCharacter(character, "walk", frame / 60, 1 / 60);
    const grounding = groundCharacterToPlane(character, 0);
    maximumHipSeparation = Math.max(
      maximumHipSeparation,
      Math.abs(character.joints.leftLeg.rotation.x - character.joints.rightLeg.rotation.x),
    );
    maximumKneeBend = Math.max(
      maximumKneeBend,
      character.joints.leftShin.rotation.x,
      character.joints.rightShin.rotation.x,
    );
    maximumFootPitch = Math.max(
      maximumFootPitch,
      Math.abs(character.joints.leftFoot.rotation.x),
      Math.abs(character.joints.rightFoot.rotation.x),
    );
    maximumSwingFootGap = Math.max(
      maximumSwingFootGap,
      grounding.leftGap,
      grounding.rightGap,
    );
    assert.ok(Math.abs(grounding.minimumGap) < 1e-6, `sole gap ${grounding.minimumGap}`);
    assert.equal(grounding.grounded, true);
  }

  assert.ok(maximumHipSeparation > 0.7, `hip separation ${maximumHipSeparation}`);
  assert.ok(maximumKneeBend > 0.3, `knee bend ${maximumKneeBend}`);
  assert.ok(maximumFootPitch > 0.12, `foot pitch ${maximumFootPitch}`);
  assert.ok(maximumSwingFootGap > 0.025, `swing foot gap ${maximumSwingFootGap}`);
});

test("direct control stays claimed and hard collision prevents NPC overlap", () => {
  const first = new THREE.Group();
  const second = new THREE.Group();
  first.position.set(-1, 0, 0);
  second.position.set(1, 0, 0);
  const director = createWorldDirector({
    residents: [
      { id: "first", group: first, initialState: "idle", radius: 0.34, walkSpeed: 1 },
      { id: "second", group: second, initialState: "idle", radius: 0.34, walkSpeed: 1 },
    ],
    bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, y: 0 },
    autonomous: true,
    random: () => 0.2,
  });
  director.setControl("first", { direction: [1, 0] });
  director.setControl("second", { direction: [-1, 0] });
  let minimumDistance = Number.POSITIVE_INFINITY;

  for (let frame = 0; frame < 360; frame += 1) {
    director.update(1 / 60, (frame + 1) / 60);
    minimumDistance = Math.min(minimumDistance, first.position.distanceTo(second.position));
  }

  assert.ok(minimumDistance >= 0.725, `minimum resident distance ${minimumDistance}`);
  assert.equal(director.residents[0].state, "walk");
  assert.equal(director.residents[1].state, "walk");

  director.setControl("first", { direction: [0, 0] });
  for (let frame = 0; frame < 900; frame += 1) director.update(1 / 60);
  assert.equal(director.residents[0].state, "idle", "AI must not reclaim the player");
});

test("hard collision keeps a controlled resident outside buildings and bounds", () => {
  const resident = new THREE.Group();
  resident.position.set(-3, 0, 0);
  const director = createWorldDirector({
    residents: [{ id: "player", group: resident, radius: 0.34, walkSpeed: 1.4 }],
    bounds: { minX: -4, maxX: 4, minZ: -4, maxZ: 4, y: 0 },
    obstacles: [{ position: [0, 0], radius: 1 }],
    autonomous: false,
  });
  director.setControl("player", { direction: [1, 0] });
  let minimumClearance = Number.POSITIVE_INFINITY;

  for (let frame = 0; frame < 600; frame += 1) {
    director.update(1 / 60, (frame + 1) / 60);
    minimumClearance = Math.min(
      minimumClearance,
      Math.hypot(resident.position.x, resident.position.z) - 1 - 0.34 - 0.035,
    );
    assert.ok(resident.position.x <= 4 - 0.34 + 1e-9);
    assert.ok(resident.position.x >= -4 + 0.34 - 1e-9);
  }

  assert.ok(minimumClearance >= -1e-9, `building clearance ${minimumClearance}`);
});

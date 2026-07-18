import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultLifeGameState,
  deserializeLifeGameState,
  executeLifeAction,
  getInventoryCount,
  getQuestObjectives,
  getRelationshipStage,
  serializeLifeGameState,
} from "../app/game/lifeSystems.ts";

const NOW = 1_787_000_000_000;
const DAY_ONE = "2026-07-18";

function run(state, action, seconds = 1) {
  return executeLifeAction(state, action, { now: NOW + seconds * 1_000, dayKey: action.dayKey ?? DAY_ONE });
}

test("default state is complete and survives a JSON save round trip", () => {
  const state = createDefaultLifeGameState({ now: NOW, dayKey: DAY_ONE });

  assert.equal(state.version, 1);
  assert.equal(state.wallet.coins, 120);
  assert.equal(getInventoryCount(state, "fishing_rod"), 1);
  assert.equal(state.inventory.equipped.tool, "fishing_rod");
  assert.equal(state.quests["main:first-day"].status, "active");
  assert.equal(state.quests["side:welcome-gift"].status, "available");
  assert.equal(state.quests["daily:good-neighbor"].cycleKey, DAY_ONE);

  const restored = deserializeLifeGameState(serializeLifeGameState(state), { now: NOW, dayKey: DAY_ONE });
  assert.deepEqual(restored, state);
});

test("talking, exploring and a life activity advance main and daily quests", () => {
  let state = createDefaultLifeGameState({ now: NOW, dayKey: DAY_ONE });

  let result = run(state, { type: "social/talk", residentId: "小满" });
  assert.equal(result.ok, true);
  state = result.state;
  assert.equal(state.relationships["小满"].affinity, 2);
  assert.equal(state.achievements["achievement:first-chat"].unlockedAt, NOW + 1_000);
  assert.equal(getQuestObjectives(state, "main:first-day")[0].progress, 1);

  state = run(state, { type: "world/explore", sceneId: "sunny-district" }, 2).state;
  result = run(state, { type: "activity/complete", activityId: "fish:river" }, 3);
  assert.equal(result.ok, true);
  state = result.state;

  assert.equal(state.quests["main:first-day"].status, "completed");
  assert.equal(state.quests["daily:good-neighbor"].status, "active");
  assert.equal(getInventoryCount(state, "river_fish"), 1);
  assert.equal(state.skills.fishing.totalXp, 20);
  assert.equal(state.stats.completedQuests, 1);
});

test("completed quests and achievements grant each reward exactly once", () => {
  let state = createDefaultLifeGameState({ now: NOW, dayKey: DAY_ONE });
  state = run(state, { type: "social/talk", residentId: "小满" }).state;
  state = run(state, { type: "world/explore", sceneId: "plaza" }, 2).state;
  state = run(state, { type: "activity/complete", activityId: "fish:river" }, 3).state;

  const questClaim = run(state, { type: "quest/claim", questId: "main:first-day" }, 4);
  assert.equal(questClaim.ok, true);
  state = questClaim.state;
  assert.equal(state.quests["main:first-day"].status, "claimed");
  assert.equal(getInventoryCount(state, "friendship_bracelet"), 1);
  assert.equal(state.wallet.coins, 204);

  const repeatedQuestClaim = run(state, { type: "quest/claim", questId: "main:first-day" }, 5);
  assert.equal(repeatedQuestClaim.ok, false);
  assert.equal(repeatedQuestClaim.error?.code, "QUEST_ALREADY_CLAIMED");

  const achievementClaim = run(state, { type: "achievement/claim", achievementId: "achievement:first-chat" }, 6);
  assert.equal(achievementClaim.ok, true);
  assert.equal(achievementClaim.state.wallet.coins, 214);
  const repeatedAchievementClaim = run(achievementClaim.state, { type: "achievement/claim", achievementId: "achievement:first-chat" }, 7);
  assert.equal(repeatedAchievementClaim.ok, false);
  assert.equal(repeatedAchievementClaim.error?.code, "ACHIEVEMENT_ALREADY_CLAIMED");
});

test("gifting consumes a gift, raises affinity and enforces a per-resident daily limit", () => {
  let state = createDefaultLifeGameState({ now: NOW, dayKey: DAY_ONE });
  state = run(state, { type: "quest/accept", questId: "side:welcome-gift" }).state;

  const first = run(state, { type: "social/gift", residentId: "露露", itemId: "wildflower", preference: "loved" }, 2);
  assert.equal(first.ok, true);
  state = first.state;
  assert.equal(getInventoryCount(state, "wildflower"), 1);
  assert.equal(state.relationships["露露"].affinity, 15);
  assert.equal(getRelationshipStage(15), "acquaintance");
  assert.equal(state.quests["side:welcome-gift"].status, "completed");

  const duplicate = run(state, { type: "social/gift", residentId: "露露", itemId: "wildflower" }, 3);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error?.code, "DAILY_GIFT_LIMIT");
  assert.equal(getInventoryCount(duplicate.state, "wildflower"), 1);
});

test("activities atomically consume materials and grant items, coins, skills and event progress", () => {
  let state = createDefaultLifeGameState({ now: NOW, dayKey: DAY_ONE });
  state = run(state, { type: "quest/accept", questId: "event:riverside-picnic" }).state;
  state = run(state, { type: "activity/complete", activityId: "fish:river" }, 2).state;
  state = run(state, { type: "activity/complete", activityId: "fish:river" }, 3).state;
  const cooked = run(state, { type: "activity/complete", activityId: "cook:vegetable-soup" }, 4);

  assert.equal(cooked.ok, true);
  state = cooked.state;
  assert.equal(getInventoryCount(state, "carrot"), 0);
  assert.equal(getInventoryCount(state, "vegetable_soup"), 1);
  assert.equal(state.skills.cooking.totalXp, 24);
  assert.equal(state.stats.fishCaught, 2);
  assert.equal(state.stats.mealsCooked, 1);
  assert.equal(state.quests["event:riverside-picnic"].status, "completed");

  const noIngredients = run(state, { type: "activity/complete", activityId: "cook:vegetable-soup" }, 5);
  assert.equal(noIngredients.ok, false);
  assert.equal(noIngredients.error?.code, "NOT_ENOUGH_ITEMS");
  assert.equal(getInventoryCount(noIngredients.state, "vegetable_soup"), 1);
});

test("daily synchronization resets daily tasks and social gift counters", () => {
  let state = createDefaultLifeGameState({ now: NOW, dayKey: DAY_ONE });
  state = run(state, { type: "social/talk", residentId: "阿奇" }).state;
  state = run(state, { type: "social/gift", residentId: "阿奇", itemId: "apple" }, 2).state;
  assert.equal(getQuestObjectives(state, "daily:good-neighbor")[0].progress, 1);

  const nextDay = executeLifeAction(state, { type: "day/sync", dayKey: "2026-07-19", at: NOW + 86_400_000 });
  assert.equal(nextDay.ok, true);
  assert.equal(nextDay.state.dayKey, "2026-07-19");
  assert.equal(getQuestObjectives(nextDay.state, "daily:good-neighbor")[0].progress, 0);
  assert.equal(nextDay.state.relationships["阿奇"].daily.gifts, 0);

  const loadedNextDay = deserializeLifeGameState(serializeLifeGameState(state), { now: NOW + 86_400_000, dayKey: "2026-07-19" });
  assert.equal(getQuestObjectives(loadedNextDay, "daily:good-neighbor")[0].progress, 0);
  assert.equal(loadedNextDay.relationships["阿奇"].daily.gifts, 0);
});

test("migration clamps unsafe values, drops unknown data and safely repairs a save", () => {
  const malformed = JSON.stringify({
    version: 999,
    dayKey: DAY_ONE,
    wallet: { coins: -80 },
    inventory: {
      capacity: 2,
      items: { apple: 999, carrot: 1, made_up_item: 99 },
      equipped: { tool: "apple", outfit: "yellow_cardigan" },
    },
    relationships: { 小满: { affinity: 500, totalTalks: -1, daily: { dayKey: DAY_ONE, gifts: 4 } } },
    skills: { fishing: { level: 500, xp: -10, totalXp: 50 } },
    quests: { "made-up": { status: "claimed" } },
    stats: { talks: -20, visitedScenes: ["plaza", "plaza", null] },
  });

  const state = deserializeLifeGameState(malformed, { now: NOW, dayKey: DAY_ONE });
  assert.equal(state.version, 1);
  assert.equal(state.wallet.coins, 0);
  assert.equal(getInventoryCount(state, "apple"), 30);
  assert.equal(getInventoryCount(state, "carrot"), 1);
  assert.equal(state.inventory.equipped.tool, undefined);
  assert.equal(state.relationships["小满"].affinity, 100);
  assert.equal(state.skills.fishing.level, 99);
  assert.equal(state.skills.fishing.xp, 0);
  assert.deepEqual(state.stats.visitedScenes, ["plaza"]);
  assert.equal(state.quests["main:first-day"].status, "active");

  const invalidJson = deserializeLifeGameState("{ definitely broken", { now: NOW, dayKey: DAY_ONE });
  assert.equal(invalidJson.wallet.coins, 120);
});

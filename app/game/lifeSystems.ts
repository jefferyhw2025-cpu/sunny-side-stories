/**
 * Serializable life-sim domain state.
 *
 * This module intentionally has no React, DOM, Three.js, or storage dependency.
 * A UI can use `lifeGameReducer` with React.useReducer, or call
 * `executeLifeAction` when it also needs the effects produced by an action.
 */

export const LIFE_SAVE_VERSION = 1 as const;

export const LIFE_SKILL_IDS = ["fishing", "cooking", "gardening", "crafting", "social"] as const;
export type LifeSkillId = (typeof LIFE_SKILL_IDS)[number];

export const EQUIPMENT_SLOTS = ["tool", "outfit", "accessory"] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export type ItemCategory =
  | "food"
  | "dish"
  | "material"
  | "seed"
  | "fish"
  | "gift"
  | "equipment"
  | "clothing"
  | "furniture";

export interface ItemDefinition {
  readonly name: string;
  readonly description: string;
  readonly category: ItemCategory;
  readonly stackLimit: number;
  readonly giftable?: boolean;
  readonly equipmentSlot?: EquipmentSlot;
}

export const ITEM_CATALOG = {
  apple: { name: "红苹果", description: "清甜多汁的本地苹果。", category: "food", stackLimit: 30, giftable: true },
  carrot: { name: "胡萝卜", description: "做饭和送礼都很实用。", category: "food", stackLimit: 30, giftable: true },
  carrot_seed: { name: "胡萝卜种子", description: "可以在菜地里播种。", category: "seed", stackLimit: 20 },
  wildflower: { name: "晴空野花", description: "在草地上采到的小花。", category: "gift", stackLimit: 20, giftable: true },
  friendship_bracelet: { name: "友情手环", description: "一份用心的小礼物。", category: "gift", stackLimit: 10, giftable: true },
  wood: { name: "木材", description: "制作家具的基础材料。", category: "material", stackLimit: 40 },
  river_fish: { name: "银鳞河鱼", description: "河里常见的新鲜鱼。", category: "fish", stackLimit: 20, giftable: true },
  vegetable_soup: { name: "暖心蔬菜汤", description: "恢复精神的家常料理。", category: "dish", stackLimit: 10, giftable: true },
  wooden_stool: { name: "手作木凳", description: "可以摆进家里的小家具。", category: "furniture", stackLimit: 5 },
  fishing_rod: { name: "初心钓竿", description: "在河岸钓鱼时使用。", category: "equipment", stackLimit: 1, equipmentSlot: "tool" },
  yellow_cardigan: { name: "向日葵开衫", description: "适合晴天散步的衣服。", category: "clothing", stackLimit: 1, giftable: true, equipmentSlot: "outfit" },
  flower_pin: { name: "小花发夹", description: "精巧的日常配饰。", category: "clothing", stackLimit: 1, giftable: true, equipmentSlot: "accessory" },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEM_CATALOG;

export interface ItemAmount {
  readonly itemId: ItemId;
  readonly quantity: number;
}

export interface InventoryState {
  capacity: number;
  items: Partial<Record<ItemId, number>>;
  equipped: Partial<Record<EquipmentSlot, ItemId>>;
}

export type QuestKind = "main" | "side" | "daily" | "event";
export type QuestStatus = "available" | "active" | "completed" | "claimed" | "expired";
export type ProgressEvent = "talk" | "gift" | "activity" | "fish" | "cook" | "garden" | "craft" | "collect" | "explore" | "affinity" | "skill";

export interface QuestObjectiveDefinition {
  readonly id: string;
  readonly label: string;
  readonly event: ProgressEvent;
  readonly required: number;
  readonly mode?: "sum" | "max";
  readonly residentId?: string;
  readonly itemId?: ItemId;
  readonly activityId?: ActivityId;
  readonly sceneId?: string;
  readonly skillId?: LifeSkillId;
}

export interface QuestReward {
  readonly coins?: number;
  readonly items?: readonly ItemAmount[];
  readonly skillXp?: Partial<Record<LifeSkillId, number>>;
}

export interface QuestDefinition {
  readonly title: string;
  readonly description: string;
  readonly kind: QuestKind;
  readonly initialStatus: Extract<QuestStatus, "available" | "active">;
  readonly objectives: readonly QuestObjectiveDefinition[];
  readonly reward: QuestReward;
}

export const QUEST_CATALOG = {
  "main:first-day": {
    title: "搬进晴天市",
    description: "认识邻居、看看街区，再体验一项生活活动。",
    kind: "main",
    initialStatus: "active",
    objectives: [
      { id: "meet", label: "和一位居民聊天", event: "talk", required: 1 },
      { id: "explore", label: "探索一个地点", event: "explore", required: 1 },
      { id: "life", label: "完成一项生活活动", event: "activity", required: 1 },
    ],
    reward: { coins: 80, items: [{ itemId: "friendship_bracelet", quantity: 1 }], skillXp: { social: 15 } },
  },
  "side:welcome-gift": {
    title: "用礼物说你好",
    description: "挑一件合适的礼物送给居民。",
    kind: "side",
    initialStatus: "available",
    objectives: [{ id: "gift", label: "送出一份礼物", event: "gift", required: 1 }],
    reward: { coins: 35, items: [{ itemId: "flower_pin", quantity: 1 }] },
  },
  "daily:good-neighbor": {
    title: "今日好邻居",
    description: "每天和大家打招呼，并做一件充实的小事。",
    kind: "daily",
    initialStatus: "active",
    objectives: [
      { id: "talks", label: "聊天 2 次", event: "talk", required: 2 },
      { id: "activity", label: "完成 1 项生活活动", event: "activity", required: 1 },
    ],
    reward: { coins: 30, items: [{ itemId: "apple", quantity: 2 }] },
  },
  "event:riverside-picnic": {
    title: "河畔野餐会",
    description: "为周末野餐准备鲜鱼和热腾腾的料理。",
    kind: "event",
    initialStatus: "available",
    objectives: [
      { id: "fish", label: "钓到 2 条鱼", event: "fish", required: 2 },
      { id: "cook", label: "完成 1 次烹饪", event: "cook", required: 1 },
    ],
    reward: { coins: 100, items: [{ itemId: "yellow_cardigan", quantity: 1 }], skillXp: { cooking: 20, fishing: 20 } },
  },
} as const satisfies Record<string, QuestDefinition>;

export type QuestId = keyof typeof QUEST_CATALOG;

export interface QuestProgress {
  id: QuestId;
  status: QuestStatus;
  progress: Record<string, number>;
  cycleKey?: string;
  acceptedAt?: number;
  completedAt?: number;
  claimedAt?: number;
}

export interface SkillProgress {
  level: number;
  xp: number;
  totalXp: number;
}

export type GiftPreference = "loved" | "liked" | "neutral" | "disliked";

export interface RelationshipState {
  affinity: number;
  totalTalks: number;
  totalGifts: number;
  daily: {
    dayKey: string;
    talks: number;
    gifts: number;
  };
}

export interface ActivityDefinition {
  readonly name: string;
  readonly description: string;
  readonly skillId: LifeSkillId;
  readonly event: Extract<ProgressEvent, "fish" | "cook" | "garden" | "craft" | "activity">;
  readonly costs?: readonly ItemAmount[];
  readonly rewards?: readonly ItemAmount[];
  readonly coins: number;
  readonly skillXp: number;
}

export const ACTIVITY_CATALOG = {
  "fish:river": {
    name: "河岸钓鱼",
    description: "在河边等待鱼儿咬钩。",
    skillId: "fishing",
    event: "fish",
    rewards: [{ itemId: "river_fish", quantity: 1 }],
    coins: 4,
    skillXp: 20,
  },
  "cook:vegetable-soup": {
    name: "烹饪蔬菜汤",
    description: "把新鲜蔬菜做成温暖的料理。",
    skillId: "cooking",
    event: "cook",
    costs: [{ itemId: "carrot", quantity: 2 }],
    rewards: [{ itemId: "vegetable_soup", quantity: 1 }],
    coins: 3,
    skillXp: 24,
  },
  "garden:carrots": {
    name: "照料胡萝卜田",
    description: "播种、浇水并收获成熟蔬菜。",
    skillId: "gardening",
    event: "garden",
    costs: [{ itemId: "carrot_seed", quantity: 1 }],
    rewards: [{ itemId: "carrot", quantity: 3 }],
    coins: 2,
    skillXp: 22,
  },
  "craft:wooden-stool": {
    name: "制作木凳",
    description: "在工作台上制作一件小家具。",
    skillId: "crafting",
    event: "craft",
    costs: [{ itemId: "wood", quantity: 3 }],
    rewards: [{ itemId: "wooden_stool", quantity: 1 }],
    coins: 5,
    skillXp: 26,
  },
  "social:plaza-performance": {
    name: "广场表演",
    description: "在居民面前进行一次小型演出。",
    skillId: "social",
    event: "activity",
    coins: 10,
    skillXp: 22,
  },
} as const satisfies Record<string, ActivityDefinition>;

export type ActivityId = keyof typeof ACTIVITY_CATALOG;

export interface LifeStats {
  talks: number;
  gifts: number;
  activities: number;
  collectedItems: number;
  completedQuests: number;
  fishCaught: number;
  mealsCooked: number;
  cropsHarvested: number;
  furnitureCrafted: number;
  visitedScenes: string[];
}

export type AchievementMetric = "talks" | "gifts" | "activities" | "quests" | "collection" | "skillLevel";

export interface AchievementDefinition {
  readonly name: string;
  readonly description: string;
  readonly metric: AchievementMetric;
  readonly target: number;
  readonly rewardCoins: number;
}

export const ACHIEVEMENT_CATALOG = {
  "achievement:first-chat": { name: "你好，邻居！", description: "第一次和居民聊天。", metric: "talks", target: 1, rewardCoins: 10 },
  "achievement:thoughtful-giver": { name: "心意相通", description: "累计送出 5 份礼物。", metric: "gifts", target: 5, rewardCoins: 30 },
  "achievement:busy-day": { name: "生活家入门", description: "累计完成 5 项生活活动。", metric: "activities", target: 5, rewardCoins: 35 },
  "achievement:helping-hand": { name: "值得信赖", description: "完成 3 项任务。", metric: "quests", target: 3, rewardCoins: 50 },
  "achievement:collector": { name: "小小收藏家", description: "背包中拥有 8 种不同物品。", metric: "collection", target: 8, rewardCoins: 40 },
  "achievement:skilled-neighbor": { name: "熟练生活家", description: "任意生活技能达到 3 级。", metric: "skillLevel", target: 3, rewardCoins: 60 },
} as const satisfies Record<string, AchievementDefinition>;

export type AchievementId = keyof typeof ACHIEVEMENT_CATALOG;

export interface AchievementProgress {
  id: AchievementId;
  progress: number;
  unlockedAt?: number;
  claimedAt?: number;
}

export interface LifeJournalEntry {
  id: string;
  at: number;
  kind: "system" | "inventory" | "quest" | "social" | "activity" | "achievement";
  text: string;
}

export interface LifeGameState {
  version: typeof LIFE_SAVE_VERSION;
  revision: number;
  createdAt: number;
  updatedAt: number;
  dayKey: string;
  wallet: { coins: number };
  inventory: InventoryState;
  quests: Record<QuestId, QuestProgress>;
  relationships: Record<string, RelationshipState>;
  skills: Record<LifeSkillId, SkillProgress>;
  achievements: Record<AchievementId, AchievementProgress>;
  stats: LifeStats;
  journal: LifeJournalEntry[];
}

export interface LifeProgressSignal {
  event: ProgressEvent;
  amount?: number;
  residentId?: string;
  itemId?: ItemId;
  activityId?: ActivityId;
  sceneId?: string;
  skillId?: LifeSkillId;
}

export interface LifeActionMeta {
  at?: number;
  dayKey?: string;
}

export type LifeAction = LifeActionMeta & (
  | { type: "day/sync" }
  | { type: "inventory/add"; itemId: ItemId; quantity: number; source?: "collect" | "purchase" | "reward" | "system" }
  | { type: "inventory/remove"; itemId: ItemId; quantity: number }
  | { type: "inventory/equip"; itemId: ItemId }
  | { type: "quest/accept"; questId: QuestId }
  | { type: "quest/claim"; questId: QuestId }
  | { type: "social/talk"; residentId: string }
  | { type: "social/gift"; residentId: string; itemId: ItemId; preference?: GiftPreference }
  | { type: "activity/complete"; activityId: ActivityId }
  | { type: "world/explore"; sceneId: string }
  | { type: "achievement/claim"; achievementId: AchievementId }
  | { type: "progress/advance"; signal: LifeProgressSignal }
);

export type LifeEffectKind = "day" | "inventory" | "currency" | "quest" | "relationship" | "skill" | "achievement" | "activity" | "error";

export interface LifeEffect {
  kind: LifeEffectKind;
  message: string;
  id?: string;
  amount?: number;
}

export type LifeErrorCode =
  | "INVALID_ACTION"
  | "INVALID_QUANTITY"
  | "INVENTORY_FULL"
  | "NOT_ENOUGH_ITEMS"
  | "NOT_EQUIPPABLE"
  | "QUEST_NOT_AVAILABLE"
  | "QUEST_NOT_COMPLETED"
  | "QUEST_ALREADY_CLAIMED"
  | "ITEM_NOT_GIFTABLE"
  | "DAILY_GIFT_LIMIT"
  | "ACHIEVEMENT_LOCKED"
  | "ACHIEVEMENT_ALREADY_CLAIMED";

export interface LifeActionResult {
  ok: boolean;
  state: LifeGameState;
  effects: LifeEffect[];
  error?: { code: LifeErrorCode; message: string };
}

export interface CreateLifeStateOptions {
  now?: number;
  dayKey?: string;
}

export type ExecuteLifeActionOptions = CreateLifeStateOptions;

const MAX_JOURNAL_ENTRIES = 40;
const DEFAULT_INVENTORY_CAPACITY = 24;
const VALID_QUEST_STATUSES = new Set<QuestStatus>(["available", "active", "completed", "claimed", "expired"]);

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return Math.min(maximum, Math.max(minimum, Math.trunc(finiteNumber(value, fallback))));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isItemId(value: string): value is ItemId {
  return Object.prototype.hasOwnProperty.call(ITEM_CATALOG, value);
}

function isQuestId(value: string): value is QuestId {
  return Object.prototype.hasOwnProperty.call(QUEST_CATALOG, value);
}

function isAchievementId(value: string): value is AchievementId {
  return Object.prototype.hasOwnProperty.call(ACHIEVEMENT_CATALOG, value);
}

function safeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 80);
  if (!trimmed || trimmed === "__proto__" || trimmed === "constructor" || trimmed === "prototype") return null;
  return trimmed;
}

export function getLocalDayKey(value: number | Date = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "1970-01-01";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createQuestState(id: QuestId, dayKey: string): QuestProgress {
  const definition = QUEST_CATALOG[id];
  return {
    id,
    status: definition.initialStatus,
    progress: Object.fromEntries(definition.objectives.map((objective) => [objective.id, 0])),
    ...(definition.kind === "daily" ? { cycleKey: dayKey } : {}),
  };
}

function createSkills(): Record<LifeSkillId, SkillProgress> {
  return Object.fromEntries(LIFE_SKILL_IDS.map((id) => [id, { level: 1, xp: 0, totalXp: 0 }])) as Record<LifeSkillId, SkillProgress>;
}

function createAchievements(): Record<AchievementId, AchievementProgress> {
  return Object.fromEntries(Object.keys(ACHIEVEMENT_CATALOG).map((id) => [id, { id, progress: 0 }])) as Record<AchievementId, AchievementProgress>;
}

export function createDefaultLifeGameState(options: CreateLifeStateOptions = {}): LifeGameState {
  const now = finiteNumber(options.now, Date.now());
  const dayKey = options.dayKey ?? getLocalDayKey(now);
  const quests = Object.fromEntries(
    (Object.keys(QUEST_CATALOG) as QuestId[]).map((id) => [id, createQuestState(id, dayKey)]),
  ) as Record<QuestId, QuestProgress>;
  const state: LifeGameState = {
    version: LIFE_SAVE_VERSION,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    dayKey,
    wallet: { coins: 120 },
    inventory: {
      capacity: DEFAULT_INVENTORY_CAPACITY,
      items: { apple: 3, carrot: 2, carrot_seed: 2, wildflower: 2, wood: 3, fishing_rod: 1, yellow_cardigan: 1 },
      equipped: { tool: "fishing_rod", outfit: "yellow_cardigan" },
    },
    quests,
    relationships: {},
    skills: createSkills(),
    achievements: createAchievements(),
    stats: {
      talks: 0,
      gifts: 0,
      activities: 0,
      collectedItems: 0,
      completedQuests: 0,
      fishCaught: 0,
      mealsCooked: 0,
      cropsHarvested: 0,
      furnitureCrafted: 0,
      visitedScenes: [],
    },
    journal: [{ id: `welcome-${now}`, at: now, kind: "system", text: "欢迎搬进晴天市，今天也会有新故事。" }],
  };
  updateAchievements(state, now, []);
  return state;
}

function cloneState(state: LifeGameState): LifeGameState {
  return JSON.parse(JSON.stringify(state)) as LifeGameState;
}

export function getInventoryCount(state: LifeGameState, itemId: ItemId): number {
  return state.inventory.items[itemId] ?? 0;
}

export function getInventoryEntries(state: LifeGameState): Array<{ itemId: ItemId; quantity: number; definition: ItemDefinition }> {
  return (Object.entries(state.inventory.items) as Array<[ItemId, number]>)
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity, definition: ITEM_CATALOG[itemId] }));
}

export function xpForNextSkillLevel(level: number): number {
  return 50 + Math.max(0, level - 1) * 35;
}

export function getRelationshipStage(affinity: number): "stranger" | "acquaintance" | "friend" | "close-friend" | "best-friend" {
  if (affinity >= 85) return "best-friend";
  if (affinity >= 60) return "close-friend";
  if (affinity >= 30) return "friend";
  if (affinity >= 10) return "acquaintance";
  return "stranger";
}

export function getQuestObjectives(state: LifeGameState, questId: QuestId): Array<QuestObjectiveDefinition & { progress: number; complete: boolean }> {
  const quest = state.quests[questId];
  return QUEST_CATALOG[questId].objectives.map((objective) => {
    const progress = Math.min(objective.required, quest?.progress[objective.id] ?? 0);
    return { ...objective, progress, complete: progress >= objective.required };
  });
}

function addJournal(state: LifeGameState, at: number, kind: LifeJournalEntry["kind"], text: string): void {
  state.journal.unshift({ id: `${state.revision + 1}-${at}-${kind}`, at, kind, text });
  state.journal = state.journal.slice(0, MAX_JOURNAL_ENTRIES);
}

function inventorySlotCount(items: InventoryState["items"]): number {
  return Object.values(items).filter((quantity) => typeof quantity === "number" && quantity > 0).length;
}

function canAddItem(inventory: InventoryState, itemId: ItemId, quantity: number): boolean {
  const current = inventory.items[itemId] ?? 0;
  if (current + quantity > ITEM_CATALOG[itemId].stackLimit) return false;
  return current > 0 || inventorySlotCount(inventory.items) < inventory.capacity;
}

function addItem(inventory: InventoryState, itemId: ItemId, quantity: number): boolean {
  if (!canAddItem(inventory, itemId, quantity)) return false;
  inventory.items[itemId] = (inventory.items[itemId] ?? 0) + quantity;
  return true;
}

function removeItem(inventory: InventoryState, itemId: ItemId, quantity: number): boolean {
  const current = inventory.items[itemId] ?? 0;
  if (current < quantity) return false;
  const next = current - quantity;
  if (next > 0) inventory.items[itemId] = next;
  else delete inventory.items[itemId];
  for (const slot of EQUIPMENT_SLOTS) {
    if (inventory.equipped[slot] === itemId && next === 0) delete inventory.equipped[slot];
  }
  return true;
}

function canApplyItemChanges(inventory: InventoryState, costs: readonly ItemAmount[] = [], rewards: readonly ItemAmount[] = []): boolean {
  const hypothetical: InventoryState = { capacity: inventory.capacity, items: { ...inventory.items }, equipped: { ...inventory.equipped } };
  for (const cost of costs) {
    if (!removeItem(hypothetical, cost.itemId, cost.quantity)) return false;
  }
  for (const reward of rewards) {
    if (!addItem(hypothetical, reward.itemId, reward.quantity)) return false;
  }
  return true;
}

function awardSkillXp(state: LifeGameState, skillId: LifeSkillId, amount: number, effects: LifeEffect[]): void {
  if (amount <= 0) return;
  const skill = state.skills[skillId];
  skill.xp += amount;
  skill.totalXp += amount;
  effects.push({ kind: "skill", id: skillId, amount, message: `${skillId} 获得 ${amount} 点经验` });
  while (skill.xp >= xpForNextSkillLevel(skill.level) && skill.level < 99) {
    skill.xp -= xpForNextSkillLevel(skill.level);
    skill.level += 1;
    effects.push({ kind: "skill", id: skillId, amount: skill.level, message: `${skillId} 提升到 ${skill.level} 级` });
  }
}

function objectiveMatches(objective: QuestObjectiveDefinition, signal: LifeProgressSignal): boolean {
  if (objective.event !== signal.event) return false;
  if (objective.residentId && objective.residentId !== signal.residentId) return false;
  if (objective.itemId && objective.itemId !== signal.itemId) return false;
  if (objective.activityId && objective.activityId !== signal.activityId) return false;
  if (objective.sceneId && objective.sceneId !== signal.sceneId) return false;
  if (objective.skillId && objective.skillId !== signal.skillId) return false;
  return true;
}

function advanceQuestProgress(state: LifeGameState, signal: LifeProgressSignal, at: number, effects: LifeEffect[]): void {
  const amount = Math.max(0, finiteNumber(signal.amount, 1));
  for (const questId of Object.keys(QUEST_CATALOG) as QuestId[]) {
    const quest = state.quests[questId];
    if (quest.status !== "active") continue;
    const definition = QUEST_CATALOG[questId];
    const objectives: readonly QuestObjectiveDefinition[] = definition.objectives;
    let changed = false;
    for (const objective of objectives) {
      if (!objectiveMatches(objective, signal)) continue;
      const current = quest.progress[objective.id] ?? 0;
      const next = objective.mode === "max" ? Math.max(current, amount) : current + amount;
      quest.progress[objective.id] = Math.min(objective.required, next);
      changed ||= quest.progress[objective.id] !== current;
    }
    if (!changed) continue;
    const complete = objectives.every((objective) => (quest.progress[objective.id] ?? 0) >= objective.required);
    if (complete) {
      quest.status = "completed";
      quest.completedAt = at;
      state.stats.completedQuests += 1;
      effects.push({ kind: "quest", id: questId, message: `任务完成：${definition.title}` });
      addJournal(state, at, "quest", `任务完成：${definition.title}`);
    } else {
      effects.push({ kind: "quest", id: questId, message: `任务进度更新：${definition.title}` });
    }
  }
}

function achievementMetric(state: LifeGameState, metric: AchievementMetric): number {
  if (metric === "talks") return state.stats.talks;
  if (metric === "gifts") return state.stats.gifts;
  if (metric === "activities") return state.stats.activities;
  if (metric === "quests") return state.stats.completedQuests;
  if (metric === "collection") return inventorySlotCount(state.inventory.items);
  return Math.max(...LIFE_SKILL_IDS.map((id) => state.skills[id].level));
}

function updateAchievements(state: LifeGameState, at: number, effects: LifeEffect[]): void {
  for (const achievementId of Object.keys(ACHIEVEMENT_CATALOG) as AchievementId[]) {
    const definition = ACHIEVEMENT_CATALOG[achievementId];
    const achievement = state.achievements[achievementId];
    achievement.progress = Math.min(definition.target, achievementMetric(state, definition.metric));
    if (!achievement.unlockedAt && achievement.progress >= definition.target) {
      achievement.unlockedAt = at;
      effects.push({ kind: "achievement", id: achievementId, message: `解锁成就：${definition.name}` });
      addJournal(state, at, "achievement", `解锁成就：${definition.name}`);
    }
  }
}

function ensureRelationship(state: LifeGameState, residentId: string): RelationshipState {
  const existing = state.relationships[residentId];
  if (existing) {
    if (existing.daily.dayKey !== state.dayKey) existing.daily = { dayKey: state.dayKey, talks: 0, gifts: 0 };
    return existing;
  }
  const created: RelationshipState = {
    affinity: 0,
    totalTalks: 0,
    totalGifts: 0,
    daily: { dayKey: state.dayKey, talks: 0, gifts: 0 },
  };
  state.relationships[residentId] = created;
  return created;
}

function syncDay(state: LifeGameState, dayKey: string, at: number, effects: LifeEffect[]): boolean {
  if (!dayKey || state.dayKey === dayKey) return false;
  state.dayKey = dayKey;
  for (const relationship of Object.values(state.relationships)) {
    relationship.daily = { dayKey, talks: 0, gifts: 0 };
  }
  for (const questId of Object.keys(QUEST_CATALOG) as QuestId[]) {
    if (QUEST_CATALOG[questId].kind !== "daily") continue;
    state.quests[questId] = createQuestState(questId, dayKey);
  }
  effects.push({ kind: "day", id: dayKey, message: `每日内容已更新：${dayKey}` });
  addJournal(state, at, "system", "新的一天开始了，每日任务已经更新。" );
  return true;
}

function finalize(state: LifeGameState, at: number, effects: LifeEffect[], changed: boolean): LifeGameState {
  if (changed) {
    updateAchievements(state, at, effects);
    state.revision += 1;
    state.updatedAt = Math.max(state.updatedAt, at);
  }
  return state;
}

function errorResult(state: LifeGameState, code: LifeErrorCode, message: string, effects: LifeEffect[], at: number, dayChanged: boolean): LifeActionResult {
  effects.push({ kind: "error", message });
  return { ok: false, state: finalize(state, at, effects, dayChanged), effects, error: { code, message } };
}

function applyReward(state: LifeGameState, reward: QuestReward, at: number, effects: LifeEffect[]): void {
  if (reward.coins) {
    state.wallet.coins += reward.coins;
    effects.push({ kind: "currency", amount: reward.coins, message: `获得 ${reward.coins} 枚阳光币` });
  }
  for (const item of reward.items ?? []) {
    addItem(state.inventory, item.itemId, item.quantity);
    effects.push({ kind: "inventory", id: item.itemId, amount: item.quantity, message: `获得 ${ITEM_CATALOG[item.itemId].name} ×${item.quantity}` });
    advanceQuestProgress(state, { event: "collect", itemId: item.itemId, amount: item.quantity }, at, effects);
  }
  for (const skillId of LIFE_SKILL_IDS) {
    awardSkillXp(state, skillId, reward.skillXp?.[skillId] ?? 0, effects);
    const level = state.skills[skillId].level;
    advanceQuestProgress(state, { event: "skill", skillId, amount: level }, at, effects);
  }
}

function giftAffinity(preference: GiftPreference): number {
  if (preference === "loved") return 15;
  if (preference === "liked") return 9;
  if (preference === "disliked") return 1;
  return 5;
}

function applyLifeAction(state: LifeGameState, action: LifeAction, at: number, dayKey: string): LifeActionResult {
  const next = cloneState(state);
  const effects: LifeEffect[] = [];
  const dayChanged = syncDay(next, dayKey, at, effects);
  let changed = dayChanged;

  switch (action.type) {
    case "day/sync":
      break;
    case "inventory/add": {
      const quantity = Math.trunc(action.quantity);
      if (quantity <= 0) return errorResult(next, "INVALID_QUANTITY", "物品数量必须大于 0。", effects, at, dayChanged);
      if (!addItem(next.inventory, action.itemId, quantity)) return errorResult(next, "INVENTORY_FULL", "背包空间或物品堆叠数量不足。", effects, at, dayChanged);
      changed = true;
      effects.push({ kind: "inventory", id: action.itemId, amount: quantity, message: `获得 ${ITEM_CATALOG[action.itemId].name} ×${quantity}` });
      if ((action.source ?? "collect") === "collect") {
        next.stats.collectedItems += quantity;
        advanceQuestProgress(next, { event: "collect", itemId: action.itemId, amount: quantity }, at, effects);
      }
      addJournal(next, at, "inventory", `获得 ${ITEM_CATALOG[action.itemId].name} ×${quantity}`);
      break;
    }
    case "inventory/remove": {
      const quantity = Math.trunc(action.quantity);
      if (quantity <= 0) return errorResult(next, "INVALID_QUANTITY", "物品数量必须大于 0。", effects, at, dayChanged);
      if (!removeItem(next.inventory, action.itemId, quantity)) return errorResult(next, "NOT_ENOUGH_ITEMS", `没有足够的${ITEM_CATALOG[action.itemId].name}。`, effects, at, dayChanged);
      changed = true;
      effects.push({ kind: "inventory", id: action.itemId, amount: -quantity, message: `使用 ${ITEM_CATALOG[action.itemId].name} ×${quantity}` });
      break;
    }
    case "inventory/equip": {
      const definition: ItemDefinition = ITEM_CATALOG[action.itemId];
      if (!definition.equipmentSlot || getInventoryCount(next, action.itemId) < 1) {
        return errorResult(next, "NOT_EQUIPPABLE", "这件物品无法装备，或尚未放进背包。", effects, at, dayChanged);
      }
      next.inventory.equipped[definition.equipmentSlot] = action.itemId;
      changed = true;
      effects.push({ kind: "inventory", id: action.itemId, message: `已装备：${definition.name}` });
      break;
    }
    case "quest/accept": {
      const quest = next.quests[action.questId];
      if (quest.status !== "available") return errorResult(next, "QUEST_NOT_AVAILABLE", "这个任务目前不能接取。", effects, at, dayChanged);
      quest.status = "active";
      quest.acceptedAt = at;
      changed = true;
      effects.push({ kind: "quest", id: action.questId, message: `已接取：${QUEST_CATALOG[action.questId].title}` });
      addJournal(next, at, "quest", `接受任务：${QUEST_CATALOG[action.questId].title}`);
      break;
    }
    case "quest/claim": {
      const quest = next.quests[action.questId];
      if (quest.status === "claimed") return errorResult(next, "QUEST_ALREADY_CLAIMED", "这个任务的奖励已经领取。", effects, at, dayChanged);
      if (quest.status !== "completed") return errorResult(next, "QUEST_NOT_COMPLETED", "任务目标还没有全部完成。", effects, at, dayChanged);
      const reward = QUEST_CATALOG[action.questId].reward;
      if (!canApplyItemChanges(next.inventory, [], reward.items ?? [])) return errorResult(next, "INVENTORY_FULL", "请先整理背包，再领取任务奖励。", effects, at, dayChanged);
      quest.status = "claimed";
      quest.claimedAt = at;
      applyReward(next, reward, at, effects);
      changed = true;
      effects.push({ kind: "quest", id: action.questId, message: `已领取：${QUEST_CATALOG[action.questId].title}` });
      break;
    }
    case "social/talk": {
      const residentId = safeIdentifier(action.residentId);
      if (!residentId) return errorResult(next, "INVALID_ACTION", "找不到要聊天的居民。", effects, at, dayChanged);
      const relationship = ensureRelationship(next, residentId);
      const affinityGain = relationship.daily.talks < 3 ? 2 : 0;
      relationship.daily.talks += 1;
      relationship.totalTalks += 1;
      relationship.affinity = Math.min(100, relationship.affinity + affinityGain);
      next.stats.talks += 1;
      awardSkillXp(next, "social", 4, effects);
      advanceQuestProgress(next, { event: "talk", residentId, amount: 1 }, at, effects);
      advanceQuestProgress(next, { event: "affinity", residentId, amount: relationship.affinity }, at, effects);
      changed = true;
      effects.push({ kind: "relationship", id: residentId, amount: affinityGain, message: affinityGain ? `和 ${residentId} 聊得很开心，好感 +${affinityGain}` : `和 ${residentId} 聊了聊` });
      addJournal(next, at, "social", `和 ${residentId} 聊天。`);
      break;
    }
    case "social/gift": {
      const residentId = safeIdentifier(action.residentId);
      if (!residentId) return errorResult(next, "INVALID_ACTION", "找不到要送礼的居民。", effects, at, dayChanged);
      const giftDefinition: ItemDefinition = ITEM_CATALOG[action.itemId];
      if (!giftDefinition.giftable) return errorResult(next, "ITEM_NOT_GIFTABLE", "这件物品不适合作为礼物。", effects, at, dayChanged);
      const relationship = ensureRelationship(next, residentId);
      if (relationship.daily.gifts >= 1) return errorResult(next, "DAILY_GIFT_LIMIT", "今天已经给这位居民送过礼物了。", effects, at, dayChanged);
      if (!removeItem(next.inventory, action.itemId, 1)) return errorResult(next, "NOT_ENOUGH_ITEMS", `背包里没有${ITEM_CATALOG[action.itemId].name}。`, effects, at, dayChanged);
      const gain = giftAffinity(action.preference ?? "neutral");
      relationship.daily.gifts += 1;
      relationship.totalGifts += 1;
      relationship.affinity = Math.min(100, relationship.affinity + gain);
      next.stats.gifts += 1;
      awardSkillXp(next, "social", 8, effects);
      advanceQuestProgress(next, { event: "gift", residentId, itemId: action.itemId, amount: 1 }, at, effects);
      advanceQuestProgress(next, { event: "affinity", residentId, amount: relationship.affinity }, at, effects);
      changed = true;
      effects.push({ kind: "relationship", id: residentId, amount: gain, message: `${residentId} 收下了${ITEM_CATALOG[action.itemId].name}，好感 +${gain}` });
      addJournal(next, at, "social", `送给 ${residentId} 一份${ITEM_CATALOG[action.itemId].name}。`);
      break;
    }
    case "activity/complete": {
      const activity: ActivityDefinition | undefined = ACTIVITY_CATALOG[action.activityId];
      if (!activity) return errorResult(next, "INVALID_ACTION", "找不到这项生活活动。", effects, at, dayChanged);
      if (!canApplyItemChanges(next.inventory, activity.costs ?? [], activity.rewards ?? [])) {
        const missing = (activity.costs ?? []).some((cost) => getInventoryCount(next, cost.itemId) < cost.quantity);
        return errorResult(next, missing ? "NOT_ENOUGH_ITEMS" : "INVENTORY_FULL", missing ? "缺少完成这项活动所需的材料。" : "背包空间不足，无法收下活动奖励。", effects, at, dayChanged);
      }
      for (const cost of activity.costs ?? []) removeItem(next.inventory, cost.itemId, cost.quantity);
      for (const reward of activity.rewards ?? []) {
        addItem(next.inventory, reward.itemId, reward.quantity);
        effects.push({ kind: "inventory", id: reward.itemId, amount: reward.quantity, message: `获得 ${ITEM_CATALOG[reward.itemId].name} ×${reward.quantity}` });
        next.stats.collectedItems += reward.quantity;
        advanceQuestProgress(next, { event: "collect", itemId: reward.itemId, amount: reward.quantity }, at, effects);
      }
      next.wallet.coins += activity.coins;
      next.stats.activities += 1;
      if (activity.event === "fish") next.stats.fishCaught += 1;
      if (activity.event === "cook") next.stats.mealsCooked += 1;
      if (activity.event === "garden") next.stats.cropsHarvested += 1;
      if (activity.event === "craft") next.stats.furnitureCrafted += 1;
      awardSkillXp(next, activity.skillId, activity.skillXp, effects);
      advanceQuestProgress(next, { event: "activity", activityId: action.activityId, amount: 1 }, at, effects);
      if (activity.event !== "activity") advanceQuestProgress(next, { event: activity.event, activityId: action.activityId, amount: 1 }, at, effects);
      advanceQuestProgress(next, { event: "skill", skillId: activity.skillId, amount: next.skills[activity.skillId].level }, at, effects);
      changed = true;
      effects.push({ kind: "activity", id: action.activityId, message: `完成活动：${activity.name}` });
      if (activity.coins > 0) effects.push({ kind: "currency", amount: activity.coins, message: `获得 ${activity.coins} 枚阳光币` });
      addJournal(next, at, "activity", `完成${activity.name}。`);
      break;
    }
    case "world/explore": {
      const sceneId = safeIdentifier(action.sceneId);
      if (!sceneId) return errorResult(next, "INVALID_ACTION", "地点标识无效。", effects, at, dayChanged);
      if (!next.stats.visitedScenes.includes(sceneId)) next.stats.visitedScenes.push(sceneId);
      advanceQuestProgress(next, { event: "explore", sceneId, amount: 1 }, at, effects);
      changed = true;
      effects.push({ kind: "activity", id: sceneId, message: `探索地点：${sceneId}` });
      break;
    }
    case "achievement/claim": {
      const achievement = next.achievements[action.achievementId];
      if (!achievement.unlockedAt) return errorResult(next, "ACHIEVEMENT_LOCKED", "这个成就还没有解锁。", effects, at, dayChanged);
      if (achievement.claimedAt) return errorResult(next, "ACHIEVEMENT_ALREADY_CLAIMED", "这个成就奖励已经领取。", effects, at, dayChanged);
      const rewardCoins = ACHIEVEMENT_CATALOG[action.achievementId].rewardCoins;
      achievement.claimedAt = at;
      next.wallet.coins += rewardCoins;
      changed = true;
      effects.push({ kind: "currency", amount: rewardCoins, message: `成就奖励：${rewardCoins} 枚阳光币` });
      break;
    }
    case "progress/advance":
      advanceQuestProgress(next, action.signal, at, effects);
      changed = effects.some((effect) => effect.kind === "quest") || dayChanged;
      break;
    default:
      return errorResult(next, "INVALID_ACTION", "无法识别这项操作。", effects, at, dayChanged);
  }

  return { ok: true, state: finalize(next, at, effects, changed), effects };
}

/** Executes an action and returns both the next state and UI-friendly effects. */
export function executeLifeAction(state: LifeGameState, action: LifeAction, options: ExecuteLifeActionOptions = {}): LifeActionResult {
  const at = finiteNumber(options.now ?? action.at, Date.now());
  const dayKey = options.dayKey ?? action.dayKey ?? getLocalDayKey(at);
  return applyLifeAction(state, action, at, dayKey);
}

/** Pure reducer form for React.useReducer. Supply `at`/`dayKey` on clock-sensitive actions. */
export function lifeGameReducer(state: LifeGameState, action: LifeAction): LifeGameState {
  const at = finiteNumber(action.at, state.updatedAt + 1);
  const dayKey = action.dayKey ?? (typeof action.at === "number" ? getLocalDayKey(at) : state.dayKey);
  return applyLifeAction(state, action, at, dayKey).state;
}

function migrateInventory(source: unknown, fallback: InventoryState): InventoryState {
  if (!isRecord(source)) return fallback;
  const capacity = clampInteger(source.capacity, 1, 80, fallback.capacity);
  const sourceItems = isRecord(source.items) ? source.items : source;
  const items: InventoryState["items"] = {};
  for (const [key, value] of Object.entries(sourceItems)) {
    if (!isItemId(key)) continue;
    const quantity = clampInteger(value, 0, ITEM_CATALOG[key].stackLimit, 0);
    if (quantity > 0 && inventorySlotCount(items) < capacity) items[key] = quantity;
  }
  const equipped: InventoryState["equipped"] = {};
  if (isRecord(source.equipped)) {
    for (const slot of EQUIPMENT_SLOTS) {
      const itemId = source.equipped[slot];
      if (typeof itemId === "string" && isItemId(itemId) && (ITEM_CATALOG[itemId] as ItemDefinition).equipmentSlot === slot && (items[itemId] ?? 0) > 0) equipped[slot] = itemId;
    }
  }
  return { capacity, items, equipped };
}

function migrateQuests(source: unknown, dayKey: string): Record<QuestId, QuestProgress> {
  const quests = Object.fromEntries((Object.keys(QUEST_CATALOG) as QuestId[]).map((id) => [id, createQuestState(id, dayKey)])) as Record<QuestId, QuestProgress>;
  if (!isRecord(source)) return quests;
  for (const [key, value] of Object.entries(source)) {
    if (!isQuestId(key) || !isRecord(value)) continue;
    const quest = quests[key];
    if (typeof value.status === "string" && VALID_QUEST_STATUSES.has(value.status as QuestStatus)) quest.status = value.status as QuestStatus;
    if (isRecord(value.progress)) {
      for (const objective of QUEST_CATALOG[key].objectives) quest.progress[objective.id] = clampInteger(value.progress[objective.id], 0, objective.required, 0);
    }
    if (typeof value.cycleKey === "string") quest.cycleKey = value.cycleKey.slice(0, 20);
    for (const timestamp of ["acceptedAt", "completedAt", "claimedAt"] as const) {
      if (typeof value[timestamp] === "number" && Number.isFinite(value[timestamp])) quest[timestamp] = value[timestamp];
    }
  }
  for (const questId of Object.keys(QUEST_CATALOG) as QuestId[]) {
    if (QUEST_CATALOG[questId].kind === "daily" && quests[questId].cycleKey !== dayKey) {
      quests[questId] = createQuestState(questId, dayKey);
    }
  }
  return quests;
}

function migrateRelationships(source: unknown, dayKey: string): Record<string, RelationshipState> {
  const relationships: Record<string, RelationshipState> = {};
  if (!isRecord(source)) return relationships;
  for (const [rawId, value] of Object.entries(source).slice(0, 100)) {
    const id = safeIdentifier(rawId);
    if (!id || !isRecord(value)) continue;
    const daily = isRecord(value.daily) ? value.daily : {};
    relationships[id] = {
      affinity: clampInteger(value.affinity, 0, 100, 0),
      totalTalks: clampInteger(value.totalTalks, 0, 1_000_000, 0),
      totalGifts: clampInteger(value.totalGifts, 0, 1_000_000, 0),
      daily: {
        dayKey: typeof daily.dayKey === "string" ? daily.dayKey.slice(0, 20) : dayKey,
        talks: clampInteger(daily.talks, 0, 1_000, 0),
        gifts: clampInteger(daily.gifts, 0, 1_000, 0),
      },
    };
    if (relationships[id].daily.dayKey !== dayKey) {
      relationships[id].daily = { dayKey, talks: 0, gifts: 0 };
    }
  }
  return relationships;
}

/** Accepts parsed JSON, old/partial state, or malformed input and always returns a valid save. */
export function migrateLifeGameState(input: unknown, options: CreateLifeStateOptions = {}): LifeGameState {
  const now = finiteNumber(options.now, Date.now());
  const source = isRecord(input) && isRecord(input.state) ? input.state : input;
  if (!isRecord(source)) return createDefaultLifeGameState(options);
  const sourceDayKey = typeof source.dayKey === "string" && source.dayKey ? source.dayKey.slice(0, 20) : undefined;
  const dayKey = options.dayKey ?? sourceDayKey ?? getLocalDayKey(now);
  const fallback = createDefaultLifeGameState({ now, dayKey });
  const state = fallback;
  state.revision = clampInteger(source.revision, 0, Number.MAX_SAFE_INTEGER, 0);
  state.createdAt = finiteNumber(source.createdAt, now);
  state.updatedAt = finiteNumber(source.updatedAt, state.createdAt);
  if (isRecord(source.wallet)) state.wallet.coins = clampInteger(source.wallet.coins, 0, 999_999_999, fallback.wallet.coins);
  else state.wallet.coins = clampInteger(source.coins, 0, 999_999_999, fallback.wallet.coins);
  state.inventory = migrateInventory(source.inventory, fallback.inventory);
  state.quests = migrateQuests(source.quests, dayKey);
  state.relationships = migrateRelationships(source.relationships, dayKey);
  if (isRecord(source.skills)) {
    for (const skillId of LIFE_SKILL_IDS) {
      const value = source.skills[skillId];
      if (!isRecord(value)) continue;
      state.skills[skillId] = {
        level: clampInteger(value.level, 1, 99, 1),
        xp: clampInteger(value.xp, 0, 1_000_000, 0),
        totalXp: clampInteger(value.totalXp, 0, 100_000_000, 0),
      };
    }
  }
  if (isRecord(source.stats)) {
    const stats = source.stats;
    state.stats.talks = clampInteger(stats.talks, 0, 1_000_000, 0);
    state.stats.gifts = clampInteger(stats.gifts, 0, 1_000_000, 0);
    state.stats.activities = clampInteger(stats.activities, 0, 1_000_000, 0);
    state.stats.collectedItems = clampInteger(stats.collectedItems, 0, 10_000_000, 0);
    state.stats.completedQuests = clampInteger(stats.completedQuests, 0, 1_000_000, 0);
    state.stats.fishCaught = clampInteger(stats.fishCaught, 0, 1_000_000, 0);
    state.stats.mealsCooked = clampInteger(stats.mealsCooked, 0, 1_000_000, 0);
    state.stats.cropsHarvested = clampInteger(stats.cropsHarvested, 0, 1_000_000, 0);
    state.stats.furnitureCrafted = clampInteger(stats.furnitureCrafted, 0, 1_000_000, 0);
    if (Array.isArray(stats.visitedScenes)) state.stats.visitedScenes = [...new Set(stats.visitedScenes.map(safeIdentifier).filter((id): id is string => Boolean(id)))].slice(0, 200);
  }
  if (isRecord(source.achievements)) {
    for (const [key, value] of Object.entries(source.achievements)) {
      if (!isAchievementId(key) || !isRecord(value)) continue;
      const definition = ACHIEVEMENT_CATALOG[key];
      const achievement = state.achievements[key];
      achievement.progress = clampInteger(value.progress, 0, definition.target, 0);
      if (typeof value.unlockedAt === "number" && Number.isFinite(value.unlockedAt)) achievement.unlockedAt = value.unlockedAt;
      if (typeof value.claimedAt === "number" && Number.isFinite(value.claimedAt)) achievement.claimedAt = value.claimedAt;
    }
  }
  if (Array.isArray(source.journal)) {
    state.journal = source.journal.flatMap((value): LifeJournalEntry[] => {
      if (!isRecord(value) || typeof value.text !== "string" || typeof value.kind !== "string") return [];
      const id = safeIdentifier(value.id) ?? `migrated-${state.journal.length}`;
      const allowedKinds: LifeJournalEntry["kind"][] = ["system", "inventory", "quest", "social", "activity", "achievement"];
      const kind = allowedKinds.includes(value.kind as LifeJournalEntry["kind"]) ? value.kind as LifeJournalEntry["kind"] : "system";
      return [{ id, at: finiteNumber(value.at, now), kind, text: value.text.slice(0, 240) }];
    }).slice(0, MAX_JOURNAL_ENTRIES);
  }
  const effects: LifeEffect[] = [];
  syncDay(state, dayKey, now, effects);
  updateAchievements(state, now, effects);
  return state;
}

export function serializeLifeGameState(state: LifeGameState): string {
  return JSON.stringify(state);
}

export function deserializeLifeGameState(raw: string | null | undefined, options: CreateLifeStateOptions = {}): LifeGameState {
  if (!raw) return createDefaultLifeGameState(options);
  try {
    return migrateLifeGameState(JSON.parse(raw) as unknown, options);
  } catch {
    return createDefaultLifeGameState(options);
  }
}

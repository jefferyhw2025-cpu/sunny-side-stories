"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACHIEVEMENT_CATALOG,
  ACTIVITY_CATALOG,
  ITEM_CATALOG,
  LIFE_SKILL_IDS,
  QUEST_CATALOG,
  getInventoryEntries,
  getQuestObjectives,
  getRelationshipStage,
  xpForNextSkillLevel,
  type AchievementId,
  type ActivityId,
  type ItemId,
  type LifeAction,
  type LifeGameState,
  type LifeSkillId,
  type QuestId,
} from "./game/lifeSystems";

export type LifePanel = "quests" | "inventory" | "activities" | "social" | "map" | "achievements" | "settings";

export type PlayerSettings = {
  sound: boolean;
  hints: boolean;
  reducedEffects: boolean;
};

type SceneItem = {
  id: string;
  icon: string;
  name: string;
  hint: string;
};

type Props = {
  state: LifeGameState;
  resident: { id: string | number; name: string };
  scene: string;
  scenes: readonly SceneItem[];
  marker: string | null;
  settings: PlayerSettings;
  onAction: (action: LifeAction) => void;
  onActivity: (activityId: ActivityId) => void;
  onUseItem: (itemId: ItemId) => void;
  onSceneChange: (sceneId: string) => void;
  onMarkerChange: (sceneId: string | null) => void;
  onSettingsChange: (settings: PlayerSettings) => void;
  onPhoto: () => void;
  onSave: () => void;
};

const PANEL_META: Array<{ id: LifePanel; icon: string; label: string }> = [
  { id: "quests", icon: "!", label: "任务" },
  { id: "inventory", icon: "▣", label: "背包" },
  { id: "activities", icon: "✦", label: "生活" },
  { id: "social", icon: "♡", label: "社交" },
  { id: "map", icon: "⌖", label: "地图" },
  { id: "achievements", icon: "★", label: "成就" },
  { id: "settings", icon: "⚙", label: "设置" },
];

const QUEST_KIND_LABEL = { main: "主线", side: "支线", daily: "每日", event: "小事件" } as const;
const QUEST_STATUS_LABEL = { available: "可接取", active: "进行中", completed: "可领奖", claimed: "已完成", expired: "已过期" } as const;
const SKILL_LABEL: Record<LifeSkillId, string> = {
  fishing: "钓鱼",
  cooking: "烹饪",
  gardening: "种植",
  crafting: "手作",
  social: "社交",
};
const ITEM_ICON: Record<ItemId, string> = {
  apple: "🍎",
  carrot: "🥕",
  carrot_seed: "🌱",
  wildflower: "🌼",
  friendship_bracelet: "📿",
  wood: "🪵",
  river_fish: "🐟",
  vegetable_soup: "🥣",
  wooden_stool: "🪑",
  fishing_rod: "🎣",
  yellow_cardigan: "🧥",
  flower_pin: "🌸",
};
const ACTIVITY_SCENES: Record<ActivityId, readonly string[]> = {
  "fish:river": ["home", "plaza"],
  "cook:vegetable-soup": ["cafe", "interior"],
  "garden:carrots": ["home"],
  "craft:wooden-stool": ["shop", "interior"],
  "social:plaza-performance": ["plaza"],
};

const QUICK_ITEMS = ["fishing_rod", "apple", "wildflower", "vegetable_soup"] as const satisfies readonly ItemId[];

function rewardText(questId: QuestId): string {
  const reward = QUEST_CATALOG[questId].reward;
  const pieces: string[] = [];
  if (reward.coins) pieces.push(`${reward.coins} 阳光币`);
  for (const item of reward.items ?? []) pieces.push(`${ITEM_CATALOG[item.itemId].name} ×${item.quantity}`);
  return pieces.join(" · ");
}

function relationshipLabel(stage: ReturnType<typeof getRelationshipStage>): string {
  return {
    stranger: "刚刚认识",
    acquaintance: "熟悉起来",
    friend: "好朋友",
    "close-friend": "亲密朋友",
    "best-friend": "挚友",
  }[stage];
}

export default function LifeSystemUI({
  state,
  resident,
  scene,
  scenes,
  marker,
  settings,
  onAction,
  onActivity,
  onUseItem,
  onSceneChange,
  onMarkerChange,
  onSettingsChange,
  onPhoto,
  onSave,
}: Props) {
  const [panel, setPanel] = useState<LifePanel | null>(null);
  const inventory = useMemo(() => getInventoryEntries(state), [state]);
  const giftItems = inventory.filter((entry) => entry.definition.giftable);
  const activeQuestCount = Object.values(state.quests).filter((quest) => quest.status === "active" || quest.status === "completed").length;
  const unlockedAchievementCount = Object.values(state.achievements).filter((achievement) => achievement.unlockedAt && !achievement.claimedAt).length;
  const relationship = state.relationships[String(resident.id)] ?? state.relationships[resident.name];
  const affinity = relationship?.affinity ?? 0;
  const closePanel = () => setPanel(null);
  const togglePanel = (next: LifePanel) => setPanel((current) => current === next ? null : next);
  const goToScene = (sceneId: string) => {
    onSceneChange(sceneId);
    closePanel();
  };

  useEffect(() => {
    const useHotbarItem = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const index = Number.parseInt(event.key, 10) - 1;
      const itemId = QUICK_ITEMS[index];
      if (!itemId || (state.inventory.items[itemId] ?? 0) < 1) return;
      event.preventDefault();
      onUseItem(itemId);
    };
    window.addEventListener("keydown", useHotbarItem);
    return () => window.removeEventListener("keydown", useHotbarItem);
  }, [onUseItem, state.inventory.items]);

  return (
    <>
      <nav className="system-dock" aria-label="游戏功能">
        {PANEL_META.map((item) => {
          const badge = item.id === "quests" ? activeQuestCount : item.id === "achievements" ? unlockedAchievementCount : 0;
          return (
            <button key={item.id} type="button" className={panel === item.id ? "active" : ""} aria-label={item.label} aria-pressed={panel === item.id} onClick={() => togglePanel(item.id)}>
              <span>{item.icon}</span><small>{item.label}</small>{badge > 0 && <b>{badge}</b>}
            </button>
          );
        })}
        <button type="button" aria-label="拍照" onClick={onPhoto}><span>▧</span><small>拍照</small></button>
        <button type="button" aria-label="存档" onClick={onSave}><span>✓</span><small>存档</small></button>
      </nav>

      <div className="quick-hotbar" aria-label="快捷栏">
        {QUICK_ITEMS.map((itemId, index) => {
          const count = state.inventory.items[itemId] ?? 0;
          return (
            <button type="button" key={itemId} disabled={count < 1} title={ITEM_CATALOG[itemId].description} onClick={() => onUseItem(itemId)}>
              <kbd>{index + 1}</kbd><span>{ITEM_ICON[itemId]}</span><b>{count}</b>
            </button>
          );
        })}
      </div>

      {settings.hints && (
        <div className="movement-hint" role="note">
          <b>移动</b><span>WASD / 方向键</span><i>Shift 奔跑</i><small>点击道路也能前往</small>
        </div>
      )}

      {panel && (
        <div className="life-panel-backdrop" onMouseDown={closePanel}>
          <section className={`life-panel life-panel-${panel}`} role="dialog" aria-modal="true" aria-labelledby={`life-panel-${panel}-title`} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="life-panel-close" onClick={closePanel} aria-label="关闭">×</button>

            {panel === "quests" && (
              <>
                <header><small>晴天手册</small><h2 id="life-panel-quests-title">任务与小事件</h2><p>探索、生活和交朋友都会推进任务，不需要反复刷菜单。</p></header>
                <div className="quest-grid">
                  {(Object.keys(QUEST_CATALOG) as QuestId[]).map((questId) => {
                    const definition = QUEST_CATALOG[questId];
                    const progress = state.quests[questId];
                    return (
                      <article className={`quest-card quest-${definition.kind}`} key={questId}>
                        <div><span>{QUEST_KIND_LABEL[definition.kind]}</span><em>{QUEST_STATUS_LABEL[progress.status]}</em></div>
                        <h3>{definition.title}</h3><p>{definition.description}</p>
                        <ul>{getQuestObjectives(state, questId).map((objective) => <li className={objective.complete ? "done" : ""} key={objective.id}><i>{objective.complete ? "✓" : "○"}</i><span>{objective.label}</span><b>{objective.progress}/{objective.required}</b></li>)}</ul>
                        <small>奖励：{rewardText(questId)}</small>
                        {progress.status === "available" && <button type="button" onClick={() => onAction({ type: "quest/accept", questId })}>接取任务</button>}
                        {progress.status === "completed" && <button type="button" className="claim" onClick={() => onAction({ type: "quest/claim", questId })}>领取奖励</button>}
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            {panel === "inventory" && (
              <>
                <header><small>随身物品</small><h2 id="life-panel-inventory-title">背包</h2><p>{inventory.length}/{state.inventory.capacity} 格 · 点击工具或服装即可装备。</p></header>
                <div className="inventory-grid">
                  {inventory.map(({ itemId, quantity, definition }) => {
                    const equipped = Object.values(state.inventory.equipped).includes(itemId);
                    return <article key={itemId}><span>{ITEM_ICON[itemId]}</span><div><h3>{definition.name}</h3><p>{definition.description}</p><small>{definition.category}</small></div><b>×{quantity}</b>{definition.equipmentSlot && <button type="button" disabled={equipped} onClick={() => onAction({ type: "inventory/equip", itemId })}>{equipped ? "已装备" : "装备"}</button>}</article>;
                  })}
                </div>
              </>
            )}

            {panel === "activities" && (
              <>
                <header><small>每天都有事做</small><h2 id="life-panel-activities-title">生活与成长</h2><p>种植、钓鱼、做饭和手作会消耗材料，也会提升对应技能。</p></header>
                <div className="skill-strip">
                  {LIFE_SKILL_IDS.map((skillId) => { const skill = state.skills[skillId]; const needed = xpForNextSkillLevel(skill.level); return <article key={skillId}><b>{SKILL_LABEL[skillId]} Lv.{skill.level}</b><span><i style={{ width: `${Math.min(100, skill.xp / needed * 100)}%` }} /></span><small>{skill.xp}/{needed}</small></article>; })}
                </div>
                <div className="activity-grid">
                  {(Object.keys(ACTIVITY_CATALOG) as ActivityId[]).map((activityId) => {
                    const activity = ACTIVITY_CATALOG[activityId];
                    const availableHere = ACTIVITY_SCENES[activityId].includes(scene);
                    const target = ACTIVITY_SCENES[activityId][0];
                    const targetScene = scenes.find((item) => item.id === target)?.name ?? "对应地点";
                    return <article key={activityId}><span>{activity.event === "fish" ? "🎣" : activity.event === "cook" ? "🍳" : activity.event === "garden" ? "🌱" : activity.event === "craft" ? "🔨" : "🎸"}</span><div><h3>{activity.name}</h3><p>{activity.description}</p><small>技能 +{activity.skillXp} · 阳光币 +{activity.coins}</small></div>{availableHere ? <button type="button" onClick={() => onActivity(activityId)}>开始</button> : <button type="button" className="travel" onClick={() => goToScene(target)}>前往{targetScene}</button>}</article>;
                  })}
                </div>
              </>
            )}

            {panel === "social" && (
              <>
                <header><small>居民关系</small><h2 id="life-panel-social-title">和{resident.name}相处</h2><p>目前是“{relationshipLabel(getRelationshipStage(affinity))}”，好感度 {affinity}/100。</p></header>
                <div className="affinity-track"><i style={{ width: `${affinity}%` }} /><b>♡ {affinity}</b></div>
                <div className="social-actions"><button type="button" onClick={() => onAction({ type: "social/talk", residentId: String(resident.id) })}>聊聊天<small>每天前三次增加好感</small></button></div>
                <h3 className="gift-title">从背包选择礼物</h3>
                <div className="gift-grid">{giftItems.length ? giftItems.map(({ itemId, quantity, definition }) => <button type="button" key={itemId} onClick={() => onAction({ type: "social/gift", residentId: String(resident.id), itemId, preference: itemId === "wildflower" || itemId === "friendship_bracelet" ? "loved" : "liked" })}><span>{ITEM_ICON[itemId]}</span><b>{definition.name}</b><small>拥有 {quantity}</small></button>) : <p>背包里暂时没有适合送出的礼物。</p>}</div>
              </>
            )}

            {panel === "map" && (
              <>
                <header><small>城镇导览</small><h2 id="life-panel-map-title">地图与标记</h2><p>去过的地点会自动记录，也可以留一个醒目的目标标记。</p></header>
                <div className="map-board">
                  <div className="map-road map-road-a" /><div className="map-road map-road-b" /><div className="map-water" />
                  {scenes.map((item, index) => <article key={item.id} className={`map-place map-place-${index} ${scene === item.id ? "current" : ""}`}><button type="button" onClick={() => goToScene(item.id)}><span>{item.icon}</span><b>{item.name}</b><small>{state.stats.visitedScenes.includes(item.id) ? "已探索" : "未探索"}</small></button><button type="button" className="marker-button" aria-pressed={marker === item.id} onClick={() => onMarkerChange(marker === item.id ? null : item.id)}>{marker === item.id ? "★ 已标记" : "☆ 标记"}</button></article>)}
                </div>
              </>
            )}

            {panel === "achievements" && (
              <>
                <header><small>生活足迹</small><h2 id="life-panel-achievements-title">成就</h2><p>每一段普通生活都值得被记住。</p></header>
                <div className="achievement-grid">{(Object.keys(ACHIEVEMENT_CATALOG) as AchievementId[]).map((achievementId) => { const definition = ACHIEVEMENT_CATALOG[achievementId]; const progress = state.achievements[achievementId]; return <article className={progress.unlockedAt ? "unlocked" : ""} key={achievementId}><span>{progress.unlockedAt ? "★" : "☆"}</span><div><h3>{definition.name}</h3><p>{definition.description}</p><small>{progress.progress}/{definition.target} · 奖励 {definition.rewardCoins} 币</small></div>{progress.unlockedAt && !progress.claimedAt && <button type="button" onClick={() => onAction({ type: "achievement/claim", achievementId })}>领取</button>}{progress.claimedAt && <em>已领取</em>}</article>; })}</div>
              </>
            )}

            {panel === "settings" && (
              <>
                <header><small>游戏选项</small><h2 id="life-panel-settings-title">设置</h2><p>这些设置会和存档一起保留在本机。</p></header>
                <div className="settings-list">
                  <label><span><b>音效</b><small>互动、奖励与界面提示音</small></span><input type="checkbox" checked={settings.sound} onChange={(event) => onSettingsChange({ ...settings, sound: event.target.checked })} /></label>
                  <label><span><b>操作提示</b><small>显示移动方式和快捷键</small></span><input type="checkbox" checked={settings.hints} onChange={(event) => onSettingsChange({ ...settings, hints: event.target.checked })} /></label>
                  <label><span><b>减少特效</b><small>减弱镜头和界面动画</small></span><input type="checkbox" checked={settings.reducedEffects} onChange={(event) => onSettingsChange({ ...settings, reducedEffects: event.target.checked })} /></label>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CharacterPreview3D from "./CharacterPreview3D";
import LifeSystemUI, { type PlayerSettings } from "./LifeSystemUI";
import World3D from "./World3D";
import { playGameSound } from "./game/audio";
import type { CharacterProfile } from "./game/characters";
import {
  ACTIVITY_CATALOG,
  ITEM_CATALOG,
  createDefaultLifeGameState,
  deserializeLifeGameState,
  executeLifeAction,
  getLocalDayKey,
  serializeLifeGameState,
  type ActivityId,
  type ItemId,
  type LifeAction,
} from "./game/lifeSystems";

type TimeOfDay = "day" | "sunset" | "night";
type WeatherMode = "clear" | "rain" | "snow";
type ActionKind = "talk" | "food" | "play" | "rest";

type Person = {
  id: number;
  name: string;
  color: string;
  hair: string;
  mood: number;
  food: number;
  energy: number;
  friend: number;
  trait: string;
  dream: string;
  shirt?: string;
  hairStyle?: number;
  faceShape?: number;
  eyeStyle?: number;
  browStyle?: number;
  noseStyle?: number;
  mouthStyle?: number;
  outfitStyle?: number;
};

type StyleOption = { value: number; label: string; glyph: string };

const starterPeople: Person[] = [
  { id: 1, name: "小满", color: "#efb18e", hair: "#70422d", shirt: "#e3ad3f", hairStyle: 6, faceShape: 0, eyeStyle: 0, browStyle: 0, noseStyle: 0, mouthStyle: 0, outfitStyle: 2, mood: 82, food: 61, energy: 74, friend: 45, trait: "天马行空", dream: "在广场举办一场演唱会" },
  { id: 2, name: "阿奇", color: "#efb18e", hair: "#5f392b", shirt: "#6f8f43", hairStyle: 8, faceShape: 0, eyeStyle: 0, browStyle: 0, noseStyle: 0, mouthStyle: 0, outfitStyle: 2, mood: 66, food: 78, energy: 48, friend: 45, trait: "热情冒险", dream: "做出全城最好吃的蛋包饭" },
  { id: 3, name: "露露", color: "#ffd0a6", hair: "#e1b84b", shirt: "#7ca9d6", hairStyle: 1, faceShape: 0, eyeStyle: 0, browStyle: 0, noseStyle: 0, mouthStyle: 0, outfitStyle: 3, mood: 74, food: 52, energy: 88, friend: 32, trait: "温柔细腻", dream: "交到三个真正的好朋友" },
];

function migrateStarterAppearance(person: Person): Person {
  const canonical = starterPeople.find((starter) => starter.id === person.id);
  if (!canonical) return person;
  return {
    ...person,
    color: canonical.color,
    hair: canonical.hair,
    shirt: canonical.shirt,
    hairStyle: canonical.hairStyle,
    faceShape: canonical.faceShape,
    eyeStyle: canonical.eyeStyle,
    browStyle: canonical.browStyle,
    noseStyle: canonical.noseStyle,
    mouthStyle: canonical.mouthStyle,
    outfitStyle: canonical.outfitStyle,
  };
}

function characterProfileForPerson(person: Person): CharacterProfile {
  return {
    id: person.id,
    name: person.name,
    skin: person.color,
    hair: person.hair,
    shirt: person.shirt || "#ef735f",
    hairStyle: person.hairStyle ?? 0,
    faceShape: person.faceShape ?? 0,
    eyeStyle: person.eyeStyle ?? 0,
    browStyle: person.browStyle ?? 0,
    noseStyle: person.noseStyle ?? 0,
    mouthStyle: person.mouthStyle ?? 0,
    outfitStyle: person.outfitStyle ?? 0,
    trait: person.trait,
  };
}

const scenes = [
  { id: "home", icon: "⌂", name: "阳光街区", hint: "回家、拜访与庭院生活" },
  { id: "plaza", icon: "♪", name: "彩虹广场", hint: "交朋友、表演与小游戏" },
  { id: "cafe", icon: "☕", name: "泡泡咖啡店", hint: "吃东西、聊天与打工" },
  { id: "shop", icon: "♢", name: "橙子商店", hint: "服装、家具与每日新品" },
  { id: "interior", icon: "▣", name: "我的房间", hint: "布置家园与室内互动" },
] as const;

const illustratedPresetOptions: StyleOption[] = [
  { value: 0, label: "清爽短发夹克", glyph: "少" },
  { value: 1, label: "丸子头花衬衫", glyph: "花" },
  { value: 2, label: "金色波波裙装", glyph: "裙" },
];

const WEATHER_SLOT_MINUTES = 180;
const DEFAULT_SETTINGS: PlayerSettings = { sound: true, hints: true, reducedEffects: false };

function localDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

function timePhase(date: Date): TimeOfDay {
  const minute = date.getHours() * 60 + date.getMinutes();
  if (minute >= 6 * 60 && minute < 17 * 60) return "day";
  if (minute >= 17 * 60 && minute < 20 * 60) return "sunset";
  return "night";
}

function seededRoll(seed: number, slot: number): number {
  let value = (seed ^ Math.imul(slot, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4_294_967_296;
}

function automaticWeather(date: Date, seed: number): WeatherMode {
  const minute = date.getHours() * 60 + date.getMinutes();
  const slot = localDayIndex(date) * (1440 / WEATHER_SLOT_MINUTES) + Math.floor(minute / WEATHER_SLOT_MINUTES);
  const roll = seededRoll(seed, slot);
  const month = date.getMonth();
  const winter = month === 11 || month <= 1;
  if (winter && roll < 0.16) return "snow";
  if (roll < (winter ? 0.36 : 0.27)) return "rain";
  return "clear";
}

function Face({ person, big = false }: { person: Person; big?: boolean }) {
  return (
    <div className={`face face-shape-${person.faceShape ?? 0} ${big ? "face-big" : ""}`} style={{ background: person.color }}>
      <div className={`hair hair-${person.hairStyle ?? 0}`} style={{ background: person.hair }} />
      <span className={`brow brow-${person.browStyle ?? 0} left`} />
      <span className={`brow brow-${person.browStyle ?? 0} right`} />
      <span className={`eye eye-${person.eyeStyle ?? 0} left`}>●</span>
      <span className={`eye eye-${person.eyeStyle ?? 0} right`}>●</span>
      <span className={`nose nose-${person.noseStyle ?? 0}`}>•</span>
      <span className={`mouth mouth-${person.mouthStyle ?? 0}`}>⌣</span>
    </div>
  );
}

function StylePicker({ title, options, value, onChange }: { title: string; options: StyleOption[]; value: number; onChange: (value: number) => void }) {
  return (
    <fieldset className="style-picker">
      <legend>{title}<small>{options.length} 种</small></legend>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? "picked" : ""}
            aria-pressed={value === option.value}
            aria-label={`${title}：${option.label}`}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <span>{option.glyph}</span><small>{option.label}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Home() {
  const [people, setPeople] = useState<Person[]>(starterPeople);
  const [selected, setSelected] = useState(1);
  const [scene, setScene] = useState<string>("home");
  const [lifeState, setLifeState] = useState(() => createDefaultLifeGameState({ now: 0, dayKey: "1970-01-01" }));
  const lifeStateRef = useRef(lifeState);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [mapMarker, setMapMarker] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [firstPlayedDay, setFirstPlayedDay] = useState<number | null>(null);
  const [weatherSeed, setWeatherSeed] = useState(1);
  const [lastProcessedDay, setLastProcessedDay] = useState<number | null>(null);
  const [storyLog, setStoryLog] = useState<string[]>(["欢迎来到晴天市！小满刚搬进了阳光街区。"]);
  const [saveReady, setSaveReady] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newSkin, setNewSkin] = useState("#efb18e");
  const [newHair, setNewHair] = useState("#2b211d");
  const [newShirt, setNewShirt] = useState("#ef735f");
  const [newHairStyle, setNewHairStyle] = useState(0);
  const [newFaceShape, setNewFaceShape] = useState(0);
  const [newEyeStyle, setNewEyeStyle] = useState(0);
  const [newBrowStyle, setNewBrowStyle] = useState(0);
  const [newNoseStyle, setNewNoseStyle] = useState(0);
  const [newMouthStyle, setNewMouthStyle] = useState(0);
  const [newOutfitStyle, setNewOutfitStyle] = useState(0);
  const [newTrait, setNewTrait] = useState("天马行空");
  const [toast, setToast] = useState("");
  const [worldAction, setWorldAction] = useState<{ kind: ActionKind; token: number } | null>(null);
  const [dialogue, setDialogue] = useState<{ speaker: string; text: string; response: string } | null>(null);
  const [actionMoment, setActionMoment] = useState<{ kind: ActionKind; text: string; token: number } | null>(null);

  const currentDate = nowMs === null ? null : new Date(nowMs);
  const currentDay = currentDate ? localDayIndex(currentDate) : null;
  const day = currentDay === null || firstPlayedDay === null ? 1 : Math.max(1, currentDay - firstPlayedDay + 1);
  const timeOfDay = currentDate ? timePhase(currentDate) : "day";
  const weatherMode = currentDate ? automaticWeather(currentDate, weatherSeed) : "clear";
  const coins = lifeState.wallet.coins;
  const clockLabel = currentDate
    ? currentDate.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";

  useEffect(() => {
    const updateClock = () => setNowMs(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    const resumeClock = () => {
      if (!document.hidden) updateClock();
    };
    document.addEventListener("visibilitychange", resumeClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resumeClock);
    };
  }, []);

  useEffect(() => {
    lifeStateRef.current = lifeState;
  }, [lifeState]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const now = Date.now();
      const todayDate = new Date(now);
      const today = localDayIndex(todayDate);
      let legacyCoins: number | undefined;
      const saved = localStorage.getItem("sunny-life-save");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Partial<{ people: Person[]; coins: number; day: number; log: string[]; firstPlayedDay: number; weatherSeed: number; lastProcessedDay: number }>;
          if (Array.isArray(parsed.people) && parsed.people.length > 0) {
            setPeople(parsed.people.map(migrateStarterAppearance));
          }
          if (typeof parsed.coins === "number") legacyCoins = parsed.coins;
          if (Array.isArray(parsed.log)) setStoryLog(parsed.log);
          const oldDay = Math.max(1, typeof parsed.day === "number" ? parsed.day : 1);
          setFirstPlayedDay(typeof parsed.firstPlayedDay === "number" ? parsed.firstPlayedDay : today - (oldDay - 1));
          if (typeof parsed.weatherSeed === "number") setWeatherSeed(parsed.weatherSeed);
          else {
            const seed = new Uint32Array(1);
            window.crypto.getRandomValues(seed);
            setWeatherSeed(seed[0] || 1);
          }
          setLastProcessedDay(typeof parsed.lastProcessedDay === "number" ? parsed.lastProcessedDay : today);
        } catch {
          /* Old and invalid saves safely start with the built-in town. */
          setFirstPlayedDay(today);
          setLastProcessedDay(today);
        }
      } else {
        const seed = new Uint32Array(1);
        window.crypto.getRandomValues(seed);
        setFirstPlayedDay(today);
        setWeatherSeed(seed[0] || 1);
        setLastProcessedDay(today);
      }
      const storedLifeState = localStorage.getItem("sunny-life-systems-v1");
      const restoredLifeState = deserializeLifeGameState(storedLifeState, { now, dayKey: getLocalDayKey(todayDate) });
      if (!storedLifeState && typeof legacyCoins === "number") restoredLifeState.wallet.coins = Math.max(0, legacyCoins);
      setLifeState(restoredLifeState);
      try {
        const storedSettings = JSON.parse(localStorage.getItem("sunny-life-settings-v1") ?? "null") as Partial<PlayerSettings> | null;
        if (storedSettings) setPlayerSettings({
          sound: typeof storedSettings.sound === "boolean" ? storedSettings.sound : true,
          hints: typeof storedSettings.hints === "boolean" ? storedSettings.hints : true,
          reducedEffects: typeof storedSettings.reducedEffects === "boolean" ? storedSettings.reducedEffects : false,
        });
      } catch {
        /* Invalid UI preferences fall back to comfortable defaults. */
      }
      const storedMarker = localStorage.getItem("sunny-life-map-marker");
      if (storedMarker && scenes.some((item) => item.id === storedMarker)) setMapMarker(storedMarker);
      setSaveReady(true);
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);
  useEffect(() => {
    if (saveReady && firstPlayedDay !== null && lastProcessedDay !== null) {
      localStorage.setItem("sunny-life-save", JSON.stringify({ people, coins, log: storyLog, firstPlayedDay, weatherSeed, lastProcessedDay }));
      localStorage.setItem("sunny-life-systems-v1", serializeLifeGameState(lifeState));
      localStorage.setItem("sunny-life-settings-v1", JSON.stringify(playerSettings));
      if (mapMarker) localStorage.setItem("sunny-life-map-marker", mapMarker);
      else localStorage.removeItem("sunny-life-map-marker");
    }
  }, [saveReady, people, coins, storyLog, firstPlayedDay, weatherSeed, lastProcessedDay, lifeState, playerSettings, mapMarker]);
  useEffect(() => {
    if (!saveReady || currentDay === null || lastProcessedDay === null || currentDay <= lastProcessedDay) return;
    const elapsedDays = Math.min(7, currentDay - lastProcessedDay);
    const timer = window.setTimeout(() => {
      const nextDate = new Date();
      setLifeState((current) => executeLifeAction(current, { type: "day/sync", at: nextDate.getTime(), dayKey: getLocalDayKey(nextDate) }).state);
      setPeople((current) => current.map((resident) => ({
        ...resident,
        food: Math.max(12, resident.food - elapsedDays * 10),
        energy: Math.max(15, resident.energy - elapsedDays * 7),
      })));
      setStoryLog((current) => [`真实时间来到了新的一天，晴天市的居民又开始四处活动了！`, ...current].slice(0, 6));
      setLastProcessedDay(currentDay);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveReady, currentDay, lastProcessedDay]);
  useEffect(() => {
    if (!actionMoment) return;
    const timer = window.setTimeout(() => setActionMoment(null), 4200);
    return () => window.clearTimeout(timer);
  }, [actionMoment]);
  useEffect(() => {
    if (!showCreate && !dialogue && !immersive) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDialogue(null);
      setWorldAction(null);
      setShowCreate(false);
      setImmersive(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showCreate, dialogue, immersive]);

  const person = people.find((candidate) => candidate.id === selected) || people[0];
  const activeScene = scenes.find((item) => item.id === scene) || scenes[0];
  const relationshipAffinity = lifeState.relationships[String(person.id)]?.affinity ?? person.friend;
  const worldResidents = useMemo(
    () => people.map(characterProfileForPerson),
    [people],
  );
  const previewProfile = useMemo<CharacterProfile>(() => ({
    id: "creator-preview",
    name: name.trim() || "新居民",
    skin: newSkin,
    hair: newHair,
    shirt: newShirt,
    hairStyle: newHairStyle,
    faceShape: newFaceShape,
    eyeStyle: newEyeStyle,
    browStyle: newBrowStyle,
    noseStyle: newNoseStyle,
    mouthStyle: newMouthStyle,
    outfitStyle: newOutfitStyle,
    trait: newTrait,
  }), [name, newSkin, newHair, newShirt, newHairStyle, newFaceShape, newEyeStyle, newBrowStyle, newNoseStyle, newMouthStyle, newOutfitStyle, newTrait]);

  const illustratedPreset = newHairStyle === 1 || newOutfitStyle === 3
    ? 2
    : newHairStyle === 6
      ? 1
      : 0;
  const chooseIllustratedPreset = (value: number) => {
    if (value === 2) {
      setNewHairStyle(1);
      setNewOutfitStyle(3);
    } else if (value === 1) {
      setNewHairStyle(6);
      setNewOutfitStyle(2);
    } else {
      setNewHairStyle(8);
      setNewOutfitStyle(2);
    }
    // The current polished atlas uses one coherent face design. Unsupported
    // fake controls were removed until their authored frames exist.
    setNewFaceShape(0);
    setNewEyeStyle(0);
    setNewBrowStyle(0);
    setNewNoseStyle(0);
    setNewMouthStyle(0);
  };

  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2300);
  };
  const change = (updates: Partial<Person>) => setPeople((current) => current.map((resident) => resident.id === person.id ? { ...resident, ...updates } : resident));
  const performLifeAction = (action: LifeAction): boolean => {
    const currentLifeState = lifeStateRef.current;
    const at = Math.max(currentLifeState.updatedAt + 1, nowMs ?? 0);
    const timedAction = { ...action, at, dayKey: getLocalDayKey(at) } as LifeAction;
    const result = executeLifeAction(currentLifeState, timedAction);
    lifeStateRef.current = result.state;
    setLifeState(result.state);
    if (!result.ok) {
      playGameSound("error", playerSettings.sound);
      notify(result.error?.message ?? "这项操作现在还不能完成。");
      return false;
    }
    const importantEffect = [...result.effects].reverse().find((effect) => effect.kind !== "skill");
    if (importantEffect) notify(importantEffect.message);
    playGameSound(result.effects.some((effect) => effect.kind === "achievement" || effect.kind === "quest") ? "reward" : "confirm", playerSettings.sound);
    return true;
  };
  const startActivity = (activityId: ActivityId) => {
    if (!performLifeAction({ type: "activity/complete", activityId })) return;
    const activity = ACTIVITY_CATALOG[activityId];
    const kind: ActionKind = activity.event === "cook" ? "food" : "play";
    const token = lifeStateRef.current.revision;
    setWorldAction({ kind, token });
    setDialogue(null);
    setActionMoment({ kind, text: `${person.name}${activity.name}完成了！${activity.description}`, token });
    setStoryLog((current) => [`${person.name}完成了${activity.name}，${activity.skillId}经验增加了。`, ...current].slice(0, 6));
  };
  const consumeOrEquipItem = (itemId: ItemId) => {
    const item = ITEM_CATALOG[itemId];
    if (item.equipmentSlot) {
      performLifeAction({ type: "inventory/equip", itemId });
      return;
    }
    if (item.category === "food" || item.category === "dish") {
      if (!performLifeAction({ type: "inventory/remove", itemId, quantity: 1 })) return;
      const token = lifeStateRef.current.revision;
      change({ food: Math.min(100, person.food + (item.category === "dish" ? 34 : 18)), mood: Math.min(100, person.mood + 4) });
      setWorldAction({ kind: "food", token });
      setActionMoment({ kind: "food", text: `${person.name}吃了${item.name}，感觉精神多了。`, token });
      setStoryLog((current) => [`${person.name}吃了${item.name}。`, ...current].slice(0, 6));
      return;
    }
    if (item.giftable) {
      if (!performLifeAction({ type: "social/gift", residentId: String(person.id), itemId, preference: itemId === "wildflower" || itemId === "friendship_bracelet" ? "loved" : "liked" })) return;
      change({ friend: Math.min(100, person.friend + 9) });
      return;
    }
    notify(`${item.name}需要在对应生活活动中使用。`);
  };
  const visitScene = (sceneId: string) => {
    setScene(sceneId);
    setWorldAction(null);
    setDialogue(null);
    setActionMoment(null);
    performLifeAction({ type: "world/explore", sceneId });
  };
  const saveGame = () => {
    if (!saveReady || firstPlayedDay === null || lastProcessedDay === null) return notify("小城还在准备存档，请稍等一下。");
    localStorage.setItem("sunny-life-save", JSON.stringify({ people, coins, log: storyLog, firstPlayedDay, weatherSeed, lastProcessedDay }));
    localStorage.setItem("sunny-life-systems-v1", serializeLifeGameState(lifeState));
    localStorage.setItem("sunny-life-settings-v1", JSON.stringify(playerSettings));
    playGameSound("reward", playerSettings.sound);
    notify("已保存人物、任务、背包、关系和地图进度。");
  };
  const takePhoto = () => {
    window.dispatchEvent(new Event("sunny-life:photo"));
    playGameSound("open", playerSettings.sound);
    notify("正在保存这张实时 3D 小城照片……");
  };
  const act = (kind: ActionKind) => {
    const action = {
      talk: { text: `${person.name}和邻居聊起了最近的梦想，关系更亲近了！`, mood: 8, friend: 7, energy: -4 },
      food: { text: `${person.name}吃了背包里的食物，幸福感正在上升。`, mood: 5, friend: 0, energy: 4 },
      play: { text: `${person.name}在广场完成了一次小表演，大家都很开心！`, mood: 13, friend: 3, energy: -10 },
      rest: { text: `${person.name}回到温暖的房间休息，做了一个会飞的梦。`, mood: 3, friend: 0, energy: 22 },
    }[kind];
    if (kind === "talk" && !performLifeAction({ type: "social/talk", residentId: String(person.id) })) return;
    if (kind === "food") {
      const foodItem: ItemId | null = (lifeState.inventory.items.vegetable_soup ?? 0) > 0 ? "vegetable_soup" : (lifeState.inventory.items.apple ?? 0) > 0 ? "apple" : null;
      if (!foodItem) return notify("背包里没有食物，先去种植或做饭吧！");
      consumeOrEquipItem(foodItem);
      return;
    }
    if (kind === "play") {
      setScene("plaza");
      startActivity("social:plaza-performance");
      change({ mood: Math.min(100, person.mood + action.mood), friend: Math.min(100, person.friend + action.friend), energy: Math.max(0, person.energy + action.energy), food: Math.max(0, person.food - 4) });
      return;
    }
    change({ mood: Math.min(100, person.mood + action.mood), friend: Math.min(100, person.friend + action.friend), energy: Math.max(0, Math.min(100, person.energy + action.energy)), food: kind === "food" ? Math.min(100, person.food + 25) : Math.max(0, person.food - 4) });
    const token = lifeStateRef.current.revision;
    setWorldAction({ kind, token });
    setStoryLog((current) => [action.text, ...current].slice(0, 6));
    if (kind === "talk") {
      setDialogue({ speaker: person.name, text: `我最近一直在想：${person.dream}。你愿意陪我一起试试看吗？`, response: "当然，我们一起完成它！" });
      setActionMoment(null);
    } else {
      setDialogue(null);
      setActionMoment({ kind, text: action.text, token });
    }
  };
  const createPerson = () => {
    if (!name.trim()) return notify("先给新居民起一个名字吧！");
    const id = Date.now();
    const resident: Person = { id, name: name.trim().slice(0, 8), color: newSkin, hair: newHair, shirt: newShirt, hairStyle: newHairStyle, faceShape: newFaceShape, eyeStyle: newEyeStyle, browStyle: newBrowStyle, noseStyle: newNoseStyle, mouthStyle: newMouthStyle, outfitStyle: newOutfitStyle, mood: 70, food: 65, energy: 80, friend: 20, trait: newTrait, dream: "发现属于自己的精彩生活" };
    setPeople((current) => [...current, resident]);
    setSelected(id);
    setWorldAction(null);
    setName("");
    setShowCreate(false);
    setStoryLog((current) => [`新居民${resident.name}搬进了晴天市！`, ...current]);
    notify(`欢迎${resident.name}！`);
  };

  const scenePrompt: Record<string, string> = {
    home: "风吹过门前的小花，今天想先拜访谁？",
    plaza: "广场上的音乐响起来了，一起去看看吧！",
    cafe: "刚烤好的松饼好香，要坐下来聊聊吗？",
    shop: "今日新品已经上架，也许会发现惊喜。",
    interior: "这是属于你的房间，慢慢把它变成家吧。",
  };
  const atmosphere = {
    day: { label: "白天", icon: "☀" }, sunset: { label: "黄昏", icon: "◐" }, night: { label: "夜晚", icon: "☾" },
  }[timeOfDay];
  const weather = {
    clear: { label: "晴朗", icon: "☀" }, rain: { label: "下雨", icon: "☂" }, snow: { label: "飘雪", icon: "❄" },
  }[weatherMode];

  return (
    <main className={`game-shell ${immersive ? "immersive-mode" : ""} ${playerSettings.reducedEffects ? "reduce-effects" : ""}`}>
      <header>
        <div className="brand"><span className="sun-mark">☀</span><div><b>晴天生活</b><small>SUNNY SIDE STORIES</small></div></div>
        <div className="top-stats"><span>第 {day} 天 · {clockLabel}</span><span>{weather.icon} {weather.label} · {atmosphere.label}</span><span className="coin">●</span><strong>{coins}</strong></div>
        <button className="immersive-entry" type="button" aria-pressed={immersive} onClick={() => setImmersive(true)} aria-label="进入沉浸画面"><b>⛶</b><span>沉浸画面</span></button>
      </header>

      <section className={`world atmosphere-${timeOfDay} weather-${weatherMode}`} aria-label={`${activeScene.name}三维场景`}>
        <World3D scene={scene} selectedId={person.id} residents={worldResidents} actionCue={worldAction} timeOfDay={timeOfDay} weatherMode={weatherMode} cinematicView={immersive} />
        <button className="immersive-exit" type="button" onClick={() => setImmersive(false)} aria-label="退出沉浸画面并返回居民面板"><span>‹</span> 返回居民面板</button>
        <div className="city-title"><span>{activeScene.icon}</span><div><b>{activeScene.name}</b><small>{activeScene.hint}</small></div></div>
        <div className="world-controls world-auto-controls" aria-label="自动环境状态">
          <div><span>时间</span><strong>{atmosphere.icon} {clockLabel} · {atmosphere.label}</strong><small>自动</small></div>
          <div><span>天气</span><strong>{weather.icon} {weather.label}</strong><small>自动</small></div>
        </div>
        {!dialogue && !actionMoment && <div className="scene-dialogue"><Face person={person}/><div><b>{person.name}</b><span>{scenePrompt[scene] || scenePrompt.home}</span></div></div>}
        {actionMoment && <div className={`action-moment action-${actionMoment.kind}`} role="status" aria-live="polite"><span>{actionMoment.kind === "food" ? "♨" : actionMoment.kind === "play" ? "✦" : "☾"}</span><p>{actionMoment.text}</p><button type="button" onClick={() => setActionMoment(null)} aria-label="关闭提示">×</button></div>}
        {dialogue && <div className="cinematic-dialogue" role="dialog" aria-label={`与${dialogue.speaker}对话`}><Face person={person} big/><div><b>{dialogue.speaker}</b><p>{dialogue.text}</p><button type="button" onClick={() => { setDialogue(null); setWorldAction(null); notify("你们约好了，下次一起出发！"); }}>{dialogue.response}</button></div><button className="dialogue-close" type="button" onClick={() => { setDialogue(null); setWorldAction(null); }} aria-label="结束对话">×</button></div>}
        <nav className="places" aria-label="地点">
          {scenes.map((item) => <button key={item.id} className={scene === item.id ? "active" : ""} onClick={() => visitScene(item.id)}><span>{item.icon}</span>{item.name}</button>)}
        </nav>
        <LifeSystemUI
          state={lifeState}
          resident={{ id: person.id, name: person.name }}
          scene={scene}
          scenes={scenes}
          marker={mapMarker}
          settings={playerSettings}
          onAction={performLifeAction}
          onActivity={startActivity}
          onUseItem={consumeOrEquipItem}
          onSceneChange={visitScene}
          onMarkerChange={setMapMarker}
          onSettingsChange={setPlayerSettings}
          onPhoto={takePhoto}
          onSave={saveGame}
        />
      </section>

      <aside className="panel">
        <div className="panel-title"><div><small>当前居民</small><h1>{person.name}</h1></div><button onClick={() => setShowCreate(true)}>＋ 设计新居民</button></div>
        <div className="resident-card"><Face person={person} big/><div className="bio"><span>{person.trait}</span><p>梦想：{person.dream}</p></div></div>
        <div className="meters">
          {([['心情','♥',person.mood,'pink'],['饱腹','●',person.food,'orange'],['精力','⚡',person.energy,'blue'],['友情','★',relationshipAffinity,'green']] as const).map(([label, icon, value, cls]) => <div className="meter" key={label}><span>{icon} {label}</span><div><i className={cls} style={{width:`${value}%`}}/></div><b>{value}</b></div>)}
        </div>
        <div className="actions"><button onClick={() => act("talk")}><span>☻</span>聊聊天</button><button onClick={() => act("food")}><span>♨</span>吃东西<small>背包</small></button><button onClick={() => act("play")}><span>✦</span>去玩耍<small>＋经验</small></button><button onClick={() => act("rest")}><span>☾</span>休息</button></div>
        <div className="resident-list"><b>城里居民 <em>{people.length}</em></b><div>{people.map((resident) => <button key={resident.id} className={selected === resident.id ? "chosen" : ""} onClick={() => { setSelected(resident.id); setWorldAction(null); setDialogue(null); setActionMoment(null); }}><Face person={resident}/><span>{resident.name}</span></button>)}</div></div>
      </aside>

      <section className="story"><div className="story-head"><b>今日小报</b><span>生活每一刻都有故事</span></div>{storyLog.slice(0,3).map((item, index) => <p key={`${item}-${index}`}><i>{index === 0 ? "新" : "•"}</i>{item}</p>)}</section>
      {toast && <div className="toast" role="status">{toast}</div>}

      {showCreate && <div className="modal-bg" onMouseDown={() => setShowCreate(false)}><div className="modal creator-v2" role="dialog" aria-modal="true" aria-labelledby="creator-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setShowCreate(false)} aria-label="关闭居民设计室">×</button>
        <section className="creator-preview-pane">
          <div className="creator-intro"><small>晴天市 · 居民设计室</small><h2 id="creator-title">创造你的高清居民</h2><p>预览与街区使用同一角色资产。选择造型与配色，再检查正面、侧面和背面。</p></div>
          <CharacterPreview3D profile={previewProfile} />
          <label className="name-field">居民名字<input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && createPerson()} placeholder="给居民起个名字" maxLength={8}/></label>
          <label className="trait-field">性格<select value={newTrait} onChange={(event) => setNewTrait(event.target.value)}><option>天马行空</option><option>热情冒险</option><option>温柔细腻</option><option>冷静可靠</option><option>幽默淘气</option></select></label>
          <button className="create" onClick={createPerson}>完成设计 · 搬进晴天市</button>
        </section>
        <section className="creator-options" aria-label="居民造型选项">
          <div className="color-row">
            <fieldset className="swatch-picker"><legend>肤色</legend><div>{["#ffd0a6","#efb18e","#c9845c","#9b623f","#714632","#4b3027"].map((color) => <button type="button" aria-label={`选择肤色 ${color}`} aria-pressed={newSkin === color} className={newSkin === color ? "picked" : ""} key={color} onClick={() => setNewSkin(color)} style={{background:color}} />)}</div></fieldset>
            <fieldset className="swatch-picker"><legend>发色</legend><div>{["#201b19","#70422d","#c95c69","#e1b84b","#315a72","#704d91","#d9d2c7"].map((color) => <button type="button" aria-label={`选择发色 ${color}`} aria-pressed={newHair === color} className={newHair === color ? "picked" : ""} key={color} onClick={() => setNewHair(color)} style={{background:color}} />)}</div></fieldset>
            <fieldset className="swatch-picker"><legend>服装颜色</legend><div>{["#ef735f","#54a98e","#7b65d1","#e3ad3f","#4c79ad","#e582aa","#384b61"].map((color) => <button type="button" aria-label={`选择服装颜色 ${color}`} aria-pressed={newShirt === color} className={newShirt === color ? "picked" : ""} key={color} onClick={() => setNewShirt(color)} style={{background:color}} />)}</div></fieldset>
          </div>
          <StylePicker title="高清造型" options={illustratedPresetOptions} value={illustratedPreset} onChange={chooseIllustratedPreset}/>
        </section>
      </div></div>}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import CharacterPreview3D from "./CharacterPreview3D";
import World3D from "./World3D";

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
  { id: 2, name: "阿奇", color: "#efb18e", hair: "#201b19", shirt: "#54a98e", hairStyle: 8, faceShape: 0, eyeStyle: 0, browStyle: 0, noseStyle: 0, mouthStyle: 0, outfitStyle: 2, mood: 66, food: 78, energy: 48, friend: 45, trait: "热情冒险", dream: "做出全城最好吃的蛋包饭" },
  { id: 3, name: "露露", color: "#ffd0a6", hair: "#e1b84b", shirt: "#7ca9d6", hairStyle: 1, faceShape: 0, eyeStyle: 0, browStyle: 0, noseStyle: 0, mouthStyle: 0, outfitStyle: 3, mood: 74, food: 52, energy: 88, friend: 32, trait: "温柔细腻", dream: "交到三个真正的好朋友" },
];

const scenes = [
  { id: "home", icon: "⌂", name: "阳光街区", hint: "回家、拜访与庭院生活" },
  { id: "plaza", icon: "♪", name: "彩虹广场", hint: "交朋友、表演与小游戏" },
  { id: "cafe", icon: "☕", name: "泡泡咖啡店", hint: "吃东西、聊天与打工" },
  { id: "shop", icon: "♢", name: "橙子商店", hint: "服装、家具与每日新品" },
  { id: "interior", icon: "▣", name: "我的房间", hint: "布置家园与室内互动" },
] as const;

const hairOptions: StyleOption[] = [
  ["利落短发", "◒"], ["齐肩波波", "◖"], ["精灵短发", "✦"], ["自然卷", "❀"],
  ["高马尾", "➶"], ["双马尾", "♬"], ["丸子头", "●"], ["麻花辫", "⌇"],
  ["飞机头", "⌁"], ["铲青短发", "◩"], ["长直发", "▥"], ["爆炸卷", "∞"],
].map(([label, glyph], value) => ({ value, label, glyph }));
const faceOptions: StyleOption[] = [
  ["圆润", "●"], ["鹅蛋", "⬭"], ["方圆", "▢"], ["心形", "♡"], ["小巧", "◌"], ["宽脸", "⬯"],
].map(([label, glyph], value) => ({ value, label, glyph }));
const eyeOptions: StyleOption[] = [
  ["自然", "● ●"], ["圆眼", "○ ○"], ["星眸", "✦ ✦"], ["杏眼", "◉ ◉"],
  ["笑眼", "⌒ ⌒"], ["慵懒", "︶ ︶"], ["豆豆", "• •"], ["温柔", "◡ ◡"],
  ["猫眼", "◖ ◗"], ["无辜", "◕ ◔"], ["认真", "— —"], ["睫毛", "✧ ✧"],
].map(([label, glyph], value) => ({ value, label, glyph }));
const browOptions: StyleOption[] = [
  ["柔和", "⌒"], ["平直", "━"], ["弯眉", "⌃"], ["浓眉", "へ"],
  ["好奇", "╱"], ["温顺", "﹏"], ["坚定", "ハ"], ["短眉", "—"],
].map(([label, glyph], value) => ({ value, label, glyph }));
const noseOptions: StyleOption[] = [
  ["纽扣鼻", "•"], ["小鼻", "·"], ["圆鼻", "●"], ["柔和三角", "▴"], ["短线", "╵"],
  ["细长", "│"], ["翘鼻", "⌝"], ["宽鼻", "⌑"], ["雀斑鼻", "∴"], ["尖鼻", "△"],
].map(([label, glyph], value) => ({ value, label, glyph }));
const mouthOptions: StyleOption[] = [
  ["微笑", "⌣"], ["灿烂笑", "▽"], ["小嘴", "ᴗ"], ["惊讶", "O"], ["猫嘴", "ω"],
  ["嘟嘴", "○"], ["露齿笑", "▱"], ["平静", "—"], ["大笑", "D"], ["酒窝笑", "⌁"],
].map(([label, glyph], value) => ({ value, label, glyph }));
const outfitOptions: StyleOption[] = [
  ["休闲T恤", "T"], ["背带装", "H"], ["夹克", "外"], ["连衣裙", "裙"],
  ["运动装", "动"], ["针织衫", "织"], ["水手服", "海"], ["连帽衫", "帽"],
].map(([label, glyph], value) => ({ value, label, glyph }));

const happenings = [
  "在路边捡到一顶会发光的帽子，所有人都想试戴。",
  "突然决定练习唱歌，隔壁居民忍不住跟着合唱。",
  "把盐当成糖做进了蛋糕，意外成为今日限定口味。",
  "收到一封没有署名的赞美信，开心得原地转了三圈。",
  "和朋友为最后一块披萨石头剪刀布，结果打成了七次平手。",
];

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
  const [coins, setCoins] = useState(120);
  const [day, setDay] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  const [weatherMode, setWeatherMode] = useState<WeatherMode>("clear");
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

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const saved = localStorage.getItem("sunny-life-save");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Partial<{ people: Person[]; coins: number; day: number; log: string[]; timeOfDay: TimeOfDay; weatherMode: WeatherMode }>;
          if (Array.isArray(parsed.people) && parsed.people.length > 0) setPeople(parsed.people);
          if (typeof parsed.coins === "number") setCoins(parsed.coins);
          if (typeof parsed.day === "number") setDay(parsed.day);
          if (Array.isArray(parsed.log)) setStoryLog(parsed.log);
          if (["day", "sunset", "night"].includes(parsed.timeOfDay || "")) setTimeOfDay(parsed.timeOfDay as TimeOfDay);
          if (["clear", "rain", "snow"].includes(parsed.weatherMode || "")) setWeatherMode(parsed.weatherMode as WeatherMode);
        } catch {
          /* Old and invalid saves safely start with the built-in town. */
        }
      }
      setSaveReady(true);
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);
  useEffect(() => {
    if (saveReady) localStorage.setItem("sunny-life-save", JSON.stringify({ people, coins, day, log: storyLog, timeOfDay, weatherMode }));
  }, [saveReady, people, coins, day, storyLog, timeOfDay, weatherMode]);
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
  const worldResidents = useMemo(() => people.map((resident) => ({
    id: resident.id,
    name: resident.name,
    skin: resident.color,
    hair: resident.hair,
    shirt: resident.shirt || "#ef735f",
    hairStyle: resident.hairStyle ?? 0,
    faceShape: resident.faceShape ?? 0,
    eyeStyle: resident.eyeStyle ?? 0,
    browStyle: resident.browStyle ?? 0,
    noseStyle: resident.noseStyle ?? 0,
    mouthStyle: resident.mouthStyle ?? 0,
    outfitStyle: resident.outfitStyle ?? 0,
    trait: resident.trait,
  })), [people]);
  const previewProfile = useMemo(() => ({
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

  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2300);
  };
  const change = (updates: Partial<Person>) => setPeople((current) => current.map((resident) => resident.id === person.id ? { ...resident, ...updates } : resident));
  const act = (kind: ActionKind) => {
    const action = {
      talk: { text: `${person.name}和邻居聊起了最近的梦想，关系更亲近了！`, cost: 0, mood: 8, friend: 7, energy: -4 },
      food: { text: `${person.name}品尝了热乎乎的云朵松饼，幸福感正在上升。`, cost: 15, mood: 5, friend: 0, energy: 4 },
      play: { text: `${person.name}参加了广场泡泡赛，在欢呼声中冲过终点！`, cost: 5, mood: 13, friend: 3, energy: -10 },
      rest: { text: `${person.name}回到温暖的房间休息，做了一个会飞的梦。`, cost: 0, mood: 3, friend: 0, energy: 22 },
    }[kind];
    if (coins < action.cost) return notify("金币不够啦，去咖啡店打工吧！");
    setCoins((current) => current - action.cost + (kind === "talk" ? 3 : 0));
    change({ mood: Math.min(100, person.mood + action.mood), friend: Math.min(100, person.friend + action.friend), energy: Math.max(0, Math.min(100, person.energy + action.energy)), food: kind === "food" ? Math.min(100, person.food + 25) : Math.max(0, person.food - 4) });
    const token = Date.now();
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
  const nextDay = () => {
    const text = `${person.name}${happenings[(day + person.id) % happenings.length]}`;
    setWorldAction(null);
    setDialogue(null);
    setActionMoment(null);
    setDay((current) => current + 1);
    setCoins((current) => current + 20);
    setPeople((current) => current.map((resident) => ({ ...resident, food: Math.max(12, resident.food - 10), energy: Math.max(15, resident.energy - 7) })));
    setStoryLog((current) => [text, ...current].slice(0, 6));
    notify("新的一天，发生了新鲜事！");
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
    <main className={`game-shell ${immersive ? "immersive-mode" : ""}`}>
      <header>
        <div className="brand"><span className="sun-mark">☀</span><div><b>晴天生活</b><small>SUNNY SIDE STORIES</small></div></div>
        <div className="top-stats"><span>第 {day} 天</span><span>{weather.icon} {weather.label} · {atmosphere.label}</span><span className="coin">●</span><strong>{coins}</strong></div>
        <button className="immersive-entry" type="button" aria-pressed={immersive} onClick={() => setImmersive(true)} aria-label="进入沉浸画面"><b>⛶</b><span>沉浸画面</span></button>
        <button className="next-day" onClick={nextDay}>度过一天 <span>›</span></button>
      </header>

      <section className={`world atmosphere-${timeOfDay} weather-${weatherMode}`} aria-label={`${activeScene.name}三维场景`}>
        <World3D scene={scene} selectedId={person.id} residents={worldResidents} actionCue={worldAction} timeOfDay={timeOfDay} weatherMode={weatherMode} cinematicView={immersive} />
        <button className="immersive-exit" type="button" onClick={() => setImmersive(false)} aria-label="退出沉浸画面并返回居民面板"><span>‹</span> 返回居民面板</button>
        <div className="city-title"><span>{activeScene.icon}</span><div><b>{activeScene.name}</b><small>{activeScene.hint}</small></div></div>
        <div className="world-controls" aria-label="场景环境设置">
          <div role="group" aria-label="时间"><span>时间</span>{(["day", "sunset", "night"] as TimeOfDay[]).map((value) => <button type="button" key={value} aria-pressed={timeOfDay === value} className={timeOfDay === value ? "active" : ""} onClick={() => setTimeOfDay(value)}>{value === "day" ? "☀ 白天" : value === "sunset" ? "◐ 黄昏" : "☾ 夜晚"}</button>)}</div>
          <div role="group" aria-label="天气"><span>天气</span>{(["clear", "rain", "snow"] as WeatherMode[]).map((value) => <button type="button" key={value} aria-pressed={weatherMode === value} className={weatherMode === value ? "active" : ""} onClick={() => setWeatherMode(value)}>{value === "clear" ? "☀ 晴朗" : value === "rain" ? "☂ 雨天" : "❄ 飘雪"}</button>)}</div>
        </div>
        {!dialogue && !actionMoment && <div className="scene-dialogue"><Face person={person}/><div><b>{person.name}</b><span>{scenePrompt[scene] || scenePrompt.home}</span></div></div>}
        {actionMoment && <div className={`action-moment action-${actionMoment.kind}`} role="status" aria-live="polite"><span>{actionMoment.kind === "food" ? "♨" : actionMoment.kind === "play" ? "✦" : "☾"}</span><p>{actionMoment.text}</p><button type="button" onClick={() => setActionMoment(null)} aria-label="关闭提示">×</button></div>}
        {dialogue && <div className="cinematic-dialogue" role="dialog" aria-label={`与${dialogue.speaker}对话`}><Face person={person} big/><div><b>{dialogue.speaker}</b><p>{dialogue.text}</p><button type="button" onClick={() => { setDialogue(null); setWorldAction(null); notify("你们约好了，下次一起出发！"); }}>{dialogue.response}</button></div><button className="dialogue-close" type="button" onClick={() => { setDialogue(null); setWorldAction(null); }} aria-label="结束对话">×</button></div>}
        <nav className="places" aria-label="地点">
          {scenes.map((item) => <button key={item.id} className={scene === item.id ? "active" : ""} onClick={() => { setScene(item.id); setWorldAction(null); setDialogue(null); setActionMoment(null); }}><span>{item.icon}</span>{item.name}</button>)}
        </nav>
      </section>

      <aside className="panel">
        <div className="panel-title"><div><small>当前居民</small><h1>{person.name}</h1></div><button onClick={() => setShowCreate(true)}>＋ 设计新居民</button></div>
        <div className="resident-card"><Face person={person} big/><div className="bio"><span>{person.trait}</span><p>梦想：{person.dream}</p></div></div>
        <div className="meters">
          {([['心情','♥',person.mood,'pink'],['饱腹','●',person.food,'orange'],['精力','⚡',person.energy,'blue'],['友情','★',person.friend,'green']] as const).map(([label, icon, value, cls]) => <div className="meter" key={label}><span>{icon} {label}</span><div><i className={cls} style={{width:`${value}%`}}/></div><b>{value}</b></div>)}
        </div>
        <div className="actions"><button onClick={() => act("talk")}><span>☻</span>聊聊天</button><button onClick={() => act("food")}><span>♨</span>吃东西<small>-15</small></button><button onClick={() => act("play")}><span>✦</span>去玩耍<small>-5</small></button><button onClick={() => act("rest")}><span>☾</span>休息</button></div>
        <div className="resident-list"><b>城里居民 <em>{people.length}</em></b><div>{people.map((resident) => <button key={resident.id} className={selected === resident.id ? "chosen" : ""} onClick={() => { setSelected(resident.id); setWorldAction(null); setDialogue(null); setActionMoment(null); }}><Face person={resident}/><span>{resident.name}</span></button>)}</div></div>
      </aside>

      <section className="story"><div className="story-head"><b>今日小报</b><span>生活每一刻都有故事</span></div>{storyLog.slice(0,3).map((item, index) => <p key={`${item}-${index}`}><i>{index === 0 ? "新" : "•"}</i>{item}</p>)}</section>
      {toast && <div className="toast" role="status">{toast}</div>}

      {showCreate && <div className="modal-bg" onMouseDown={() => setShowCreate(false)}><div className="modal creator-v2" role="dialog" aria-modal="true" aria-labelledby="creator-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setShowCreate(false)} aria-label="关闭居民设计室">×</button>
        <section className="creator-preview-pane">
          <div className="creator-intro"><small>晴天市 · 居民设计室</small><h2 id="creator-title">创造你的 3D 居民</h2><p>选择会立即反映到真实游戏模型中。转动角色，确认正面与侧面的细节。</p></div>
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
          <StylePicker title="发型" options={hairOptions} value={newHairStyle} onChange={setNewHairStyle}/>
          <StylePicker title="脸型" options={faceOptions} value={newFaceShape} onChange={setNewFaceShape}/>
          <StylePicker title="眼睛" options={eyeOptions} value={newEyeStyle} onChange={setNewEyeStyle}/>
          <StylePicker title="眉毛" options={browOptions} value={newBrowStyle} onChange={setNewBrowStyle}/>
          <StylePicker title="鼻子" options={noseOptions} value={newNoseStyle} onChange={setNewNoseStyle}/>
          <StylePicker title="嘴巴" options={mouthOptions} value={newMouthStyle} onChange={setNewMouthStyle}/>
          <StylePicker title="服装款式" options={outfitOptions} value={newOutfitStyle} onChange={setNewOutfitStyle}/>
        </section>
      </div></div>}
    </main>
  );
}

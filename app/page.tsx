"use client";

import { useEffect, useMemo, useState } from "react";
import World3D from "./World3D";

type Person = {
  id: number; name: string; color: string; hair: string; mood: number;
  food: number; energy: number; friend: number; trait: string; dream: string;
  shirt?: string; hairStyle?: number; faceShape?: number; eyeStyle?: number;
  browStyle?: number; noseStyle?: number; mouthStyle?: number; outfitStyle?: number;
};

const starterPeople: Person[] = [
  { id: 1, name: "小满", color: "#ffcc9c", hair: "#56331f", mood: 82, food: 61, energy: 74, friend: 45, trait: "天马行空", dream: "在广场举办一场演唱会" },
  { id: 2, name: "阿奇", color: "#9b623f", hair: "#1d1714", mood: 66, food: 78, energy: 48, friend: 45, trait: "热情冒险", dream: "做出全城最好吃的蛋包饭" },
  { id: 3, name: "露露", color: "#f1b88f", hair: "#e85e69", mood: 74, food: 52, energy: 88, friend: 32, trait: "温柔细腻", dream: "交到三个真正的好朋友" },
];

const scenes = [
  { id: "home", icon: "⌂", name: "阳光公寓", hint: "休息、拜访与日常惊喜" },
  { id: "plaza", icon: "♪", name: "彩虹广场", hint: "交朋友、表演与小游戏" },
  { id: "cafe", icon: "☕", name: "泡泡咖啡店", hint: "吃东西、聊天与打工" },
];

const happenings = [
  "在路边捡到一顶会发光的帽子，所有人都想试戴。",
  "突然决定练习唱歌，隔壁居民忍不住跟着合唱。",
  "把盐当成糖做进了蛋糕，意外成为今日限定口味。",
  "收到一封没有署名的赞美信，开心得原地转了三圈。",
  "和朋友为最后一块披萨石头剪刀布，结果打成了七次平手。",
];

function Face({ person, big = false }: { person: Person; big?: boolean }) {
  return <div className={`face face-shape-${person.faceShape || 0} ${big ? "face-big" : ""}`} style={{ background: person.color }}>
    <div className={`hair hair-${person.hairStyle || 0}`} style={{ background: person.hair }} />
    <span className={`brow brow-${person.browStyle || 0} left`}/><span className={`brow brow-${person.browStyle || 0} right`}/>
    <span className={`eye eye-${person.eyeStyle || 0} left`}>●</span><span className={`eye eye-${person.eyeStyle || 0} right`}>●</span>
    <span className={`nose nose-${person.noseStyle || 0}`}>•</span><span className={`mouth mouth-${person.mouthStyle || 0}`}>⌣</span>
  </div>;
}

export default function Home() {
  const [people, setPeople] = useState<Person[]>(starterPeople);
  const [selected, setSelected] = useState(1);
  const [scene, setScene] = useState("home");
  const [coins, setCoins] = useState(120);
  const [day, setDay] = useState(1);
  const [log, setLog] = useState(["欢迎来到晴天市！小满刚搬进了阳光公寓。"]);
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

  useEffect(() => {
    const saved = localStorage.getItem("sunny-life-save");
    if (saved) try { const s = JSON.parse(saved); setPeople(s.people); setCoins(s.coins); setDay(s.day); setLog(s.log); } catch { /* fresh town */ }
  }, []);
  useEffect(() => { if (day > 1 || people.length > 3) localStorage.setItem("sunny-life-save", JSON.stringify({ people, coins, day, log })); }, [people, coins, day, log]);

  const person = people.find(p => p.id === selected) || people[0];
  const activeScene = scenes.find(s => s.id === scene)!;
  const weather = useMemo(() => ["晴朗 24°", "微风 22°", "彩虹 23°"][day % 3], [day]);

  const notify = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2300); };
  const change = (updates: Partial<Person>) => setPeople(ps => ps.map(p => p.id === person.id ? { ...p, ...updates } : p));
  const act = (kind: "talk" | "food" | "play" | "rest") => {
    const map = {
      talk: { text: `${person.name}和邻居聊起了最近的梦想，关系更亲近了！`, cost: 0, mood: 8, friend: 7, energy: -4 },
      food: { text: `${person.name}吃了一份云朵松饼，感觉肚子里住进了太阳。`, cost: 15, mood: 5, friend: 0, energy: 4 },
      play: { text: `${person.name}参加了广场泡泡赛，赢得一阵热烈掌声！`, cost: 5, mood: 13, friend: 3, energy: -10 },
      rest: { text: `${person.name}做了一个会飞的梦，醒来精神满满。`, cost: 0, mood: 3, friend: 0, energy: 22 },
    }[kind];
    if (coins < map.cost) return notify("金币不够啦，去咖啡店打工吧！");
    setCoins(c => c - map.cost + (kind === "talk" ? 3 : 0));
    change({ mood: Math.min(100, person.mood + map.mood), friend: Math.min(100, person.friend + map.friend), energy: Math.max(0, Math.min(100, person.energy + map.energy)), food: kind === "food" ? Math.min(100, person.food + 25) : Math.max(0, person.food - 4) });
    setLog(l => [map.text, ...l].slice(0, 6)); notify(map.text);
  };
  const nextDay = () => {
    const text = `${person.name}${happenings[(day + person.id) % happenings.length]}`;
    setDay(d => d + 1); setCoins(c => c + 20);
    setPeople(ps => ps.map(p => ({ ...p, food: Math.max(12, p.food - 10), energy: Math.max(15, p.energy - 7) })));
    setLog(l => [text, ...l].slice(0, 6)); notify("新的一天，发生了新鲜事！");
  };
  const createPerson = () => {
    if (!name.trim()) return;
    const id = Date.now();
    const p: Person = { id, name: name.trim().slice(0, 8), color: newSkin, hair: newHair, shirt: newShirt, hairStyle: newHairStyle, faceShape: newFaceShape, eyeStyle: newEyeStyle, browStyle: newBrowStyle, noseStyle: newNoseStyle, mouthStyle: newMouthStyle, outfitStyle: newOutfitStyle, mood: 70, food: 65, energy: 80, friend: 20, trait: newTrait, dream: "发现属于自己的精彩生活" };
    setPeople(ps => [...ps, p]); setSelected(id); setName(""); setShowCreate(false); setLog(l => [`新居民${p.name}搬进了晴天市！`, ...l]); notify(`欢迎${p.name}！`);
  };

  return <main className="game-shell">
    <header>
      <div className="brand"><span className="sun-mark">☀</span><div><b>晴天生活</b><small>SUNNY SIDE STORIES</small></div></div>
      <div className="top-stats"><span>第 {day} 天</span><span>☀ {weather}</span><span className="coin">●</span><strong>{coins}</strong></div>
      <button className="next-day" onClick={nextDay}>度过一天 <span>›</span></button>
    </header>

    <section className="world">
      <World3D scene={scene} selectedId={person.id} residents={people.map(p => ({ id:p.id, name:p.name, skin:p.color, hair:p.hair, shirt:p.shirt || "#ef735f", hairStyle:p.hairStyle || 0, faceShape:p.faceShape || 0, eyeStyle:p.eyeStyle || 0, browStyle:p.browStyle || 0, noseStyle:p.noseStyle || 0, mouthStyle:p.mouthStyle || 0, outfitStyle:p.outfitStyle || 0, trait:p.trait }))} />
      <div className="city-title"><span>{activeScene.icon}</span><div><b>{activeScene.name}</b><small>{activeScene.hint}</small></div></div>
      <div className="scene-dialogue"><Face person={person}/><div><b>{person.name}</b><span>{scene === "home" ? "今天会发生什么呢？" : scene === "plaza" ? "一起去广场玩吧！" : "这里的松饼闻起来好香！"}</span></div></div>
      <nav className="places" aria-label="地点">
        {scenes.map(s => <button key={s.id} className={scene === s.id ? "active" : ""} onClick={() => setScene(s.id)}><span>{s.icon}</span>{s.name}</button>)}
      </nav>
    </section>

    <aside className="panel">
      <div className="panel-title"><div><small>当前居民</small><h1>{person.name}</h1></div><button onClick={() => setShowCreate(true)}>＋ 新居民</button></div>
      <div className="resident-card"><Face person={person} big/><div className="bio"><span>{person.trait}</span><p>梦想：{person.dream}</p></div></div>
      <div className="meters">
        {[['心情','♥',person.mood,'pink'],['饱腹','●',person.food,'orange'],['精力','⚡',person.energy,'blue'],['友情','★',person.friend,'green']].map(([label, icon, value, cls]) => <div className="meter" key={String(label)}><span>{icon} {label}</span><div><i className={String(cls)} style={{width:`${value}%`}}/></div><b>{value}</b></div>)}
      </div>
      <div className="actions"><button onClick={() => act("talk")}><span>☻</span>聊聊天</button><button onClick={() => act("food")}><span>♨</span>吃东西<small>-15</small></button><button onClick={() => act("play")}><span>✦</span>去玩耍<small>-5</small></button><button onClick={() => act("rest")}><span>☾</span>休息</button></div>
      <div className="resident-list"><b>城里居民 <em>{people.length}</em></b><div>{people.map(p => <button key={p.id} className={selected === p.id ? "chosen" : ""} onClick={() => setSelected(p.id)}><Face person={p}/><span>{p.name}</span></button>)}</div></div>
    </aside>

    <section className="story"><div className="story-head"><b>今日小报</b><span>生活每一刻都有故事</span></div>{log.slice(0,3).map((x,i) => <p key={i}><i>{i === 0 ? "新" : "•"}</i>{x}</p>)}</section>
    {toast && <div className="toast">{toast}</div>}
    {showCreate && <div className="modal-bg" onMouseDown={() => setShowCreate(false)}><div className="modal creator" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={() => setShowCreate(false)}>×</button><div className="creator-head"><div className="avatar-preview"><Face big person={{...starterPeople[0],color:newSkin,hair:newHair,shirt:newShirt,hairStyle:newHairStyle,faceShape:newFaceShape,eyeStyle:newEyeStyle,browStyle:newBrowStyle,noseStyle:newNoseStyle,mouthStyle:newMouthStyle,outfitStyle:newOutfitStyle}}/><span style={{background:newShirt}}/></div><div><small>晴天市居民设计室</small><h2>创造独一无二的居民</h2><p>五官、发型与服装都会同步进入 3D 小城。</p></div></div><div className="creator-grid"><label className="name-field">名字<input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && createPerson()} placeholder="输入名字" maxLength={8}/></label><div className="choice"><b>肤色</b><div>{["#ffd0a6","#efb18e","#c9845c","#8f573e","#5b382c"].map(c=><button aria-label={`选择肤色 ${c}`} className={newSkin===c?"picked":""} key={c} onClick={()=>setNewSkin(c)} style={{background:c}}/>)}</div></div><div className="choice"><b>发色</b><div>{["#2b211d","#70422d","#df6a78","#e1b84b","#315a72"].map(c=><button aria-label={`选择发色 ${c}`} className={newHair===c?"picked":""} key={c} onClick={()=>setNewHair(c)} style={{background:c}}/>)}</div></div><div className="choice hair-choice"><b>发型</b><div>{[0,1,2,3].map(n=><button aria-label={`选择发型 ${n+1}`} className={newHairStyle===n?"picked":""} key={n} onClick={()=>setNewHairStyle(n)}><i className={`mini-hair hair-${n}`} style={{background:newHair}}/></button>)}</div></div><div className="choice feature-choice"><b>脸型</b><div>{["椭","圆","长"].map((s,n)=><button aria-label={`选择脸型 ${n+1}`} className={newFaceShape===n?"picked":""} key={s} onClick={()=>setNewFaceShape(n)}>{s}</button>)}</div></div><div className="choice feature-choice"><b>眼睛</b><div>{["●","—","⌒"].map((s,n)=><button aria-label={`选择眼睛 ${n+1}`} className={newEyeStyle===n?"picked":""} key={n} onClick={()=>setNewEyeStyle(n)}>{s}</button>)}</div></div><div className="choice feature-choice"><b>眉毛</b><div>{["一","⌃","⌄"].map((s,n)=><button aria-label={`选择眉毛 ${n+1}`} className={newBrowStyle===n?"picked":""} key={n} onClick={()=>setNewBrowStyle(n)}>{s}</button>)}</div></div><div className="choice feature-choice"><b>鼻子</b><div>{["•","△","L"].map((s,n)=><button aria-label={`选择鼻子 ${n+1}`} className={newNoseStyle===n?"picked":""} key={n} onClick={()=>setNewNoseStyle(n)}>{s}</button>)}</div></div><div className="choice feature-choice"><b>嘴巴</b><div>{["⌣","—","○"].map((s,n)=><button aria-label={`选择嘴巴 ${n+1}`} className={newMouthStyle===n?"picked":""} key={n} onClick={()=>setNewMouthStyle(n)}>{s}</button>)}</div></div><div className="choice"><b>服装颜色</b><div>{["#ef735f","#54a98e","#7b65d1","#e3ad3f","#4c79ad"].map(c=><button aria-label={`选择服装 ${c}`} className={newShirt===c?"picked":""} key={c} onClick={()=>setNewShirt(c)} style={{background:c}}/>)}</div></div><div className="choice feature-choice"><b>服装款式</b><div>{["T","衬","外"].map((s,n)=><button aria-label={`选择服装款式 ${n+1}`} className={newOutfitStyle===n?"picked":""} key={n} onClick={()=>setNewOutfitStyle(n)}>{s}</button>)}</div></div><label className="trait-field">性格<select value={newTrait} onChange={e=>setNewTrait(e.target.value)}><option>天马行空</option><option>热情冒险</option><option>温柔细腻</option><option>冷静可靠</option><option>幽默淘气</option></select></label></div><button className="create" onClick={createPerson}>完成设计 · 搬进晴天市</button></div></div>}
  </main>;
}

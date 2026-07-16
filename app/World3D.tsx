"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = { scene: string; skin: string; hair: string; shirt: string; hairStyle: number };

const mat = (color: THREE.ColorRepresentation) => new THREE.MeshToonMaterial({ color });

export default function World3D({ scene: sceneName, skin, hair, shirt, hairStyle }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const world = new THREE.Scene();
    world.background = new THREE.Color("#80d8f6");
    world.fog = new THREE.Fog("#bfeeff", 15, 31);
    const camera = new THREE.PerspectiveCamera(34, el.clientWidth / el.clientHeight, .1, 100);
    camera.position.set(8.5, 6.2, 13.5); camera.lookAt(0, 2.4, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(el.clientWidth, el.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    el.appendChild(renderer.domElement);

    world.add(new THREE.HemisphereLight("#fffdf4", "#79a978", 2));
    const sun = new THREE.DirectionalLight("#fff8df", 3.2); sun.position.set(-7, 12, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-13; sun.shadow.camera.right=13; sun.shadow.camera.top=13; sun.shadow.camera.bottom=-8; world.add(sun);

    const ground = new THREE.Mesh(new THREE.CylinderGeometry(12, 12.8, .65, 64), mat("#7fd05a")); ground.receiveShadow=true; ground.position.y=-.38; world.add(ground);
    const path = new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 13, 8, 18), mat("#f6d59d")); path.rotation.x=Math.PI/2; path.rotation.z=-.12; path.scale.set(1,1,.08); path.position.set(0,.015,2); path.receiveShadow=true; world.add(path);

    const mesh = (geo: THREE.BufferGeometry, material: THREE.Material, x=0,y=0,z=0) => { const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;world.add(m);return m; };
    const edge = (target:THREE.Mesh,color="#40505a",opacity=.34) => { const e=new THREE.LineSegments(new THREE.EdgesGeometry(target.geometry,28),new THREE.LineBasicMaterial({color,transparent:true,opacity}));e.position.copy(target.position);e.rotation.copy(target.rotation);e.scale.copy(target.scale);world.add(e);return e };
    const box = (w:number,h:number,d:number,c:string,x:number,y:number,z:number,r=0) => mesh(new THREE.BoxGeometry(w,h,d),mat(c),x,y,z);
    const sphere = (r:number,c:string,x:number,y:number,z:number,sy=1) => { const m=mesh(new THREE.SphereGeometry(r,24,16),mat(c),x,y,z);m.scale.y=sy;return m; };

    // Background neighborhood, softened by fog for genuine depth.
    [[-8,1,-5,"#ffd081"],[-5,1.2,-7,"#f28d82"],[7,1,-6,"#8dc9bd"],[10,1.1,-4,"#f0b56e"]].forEach(([x,y,z,c])=>{
      box(2.6,2.5,2.1,c as string,x as number,y as number,z as number); box(2.9,.35,2.4,"#fff5dd",x as number,2.45,z as number);
    });

    // Main location.
    const mainColor = sceneName === "home" ? "#ffe08a" : sceneName === "plaza" ? "#ed89ac" : "#e9b873";
    const mainBuilding=box(5.8,4.5,3.2,mainColor,0,2.25,-2.2); edge(mainBuilding,"#6a665d",.24);
    const roof = box(6.5,.55,3.75,sceneName === "plaza" ? "#836ac6" : sceneName === "cafe" ? "#4cae99" : "#ee6d55",0,4.65,-2.2);
    roof.rotation.z=.035;
    for (const x of [-1.75,0,1.75]) {
      const win=box(1.2,1.3,.12,"#73cde7",x,3.15,-.56,.25); edge(win,"#3d7182",.42);
      box(1.42,.11,.18,"#fffaf0",x,3.15,-.48); box(.11,1.5,.18,"#fffaf0",x,3.15,-.48);
    }
    box(1.25,1.95,.18,"#3c7890",0,1,-.5,.25);
    if (sceneName === "cafe") { box(6.15,.18,.85,"#fff4da",0,4.02,-.6); for(let i=-2;i<=2;i++) box(.54,.2,.9,i%2 ? "#ef735f" : "#fff4da",i*1.15,4.02,-.54); }
    if (sceneName === "plaza") { sphere(.7,"#fff0b5",0,5.15,-2.2,.45); }

    // Trees and flowers add scale and environmental detail.
    for (const [x,z,s] of [[-5,-1,1],[5.5,-2,.9],[-6,-5,.75],[6,-5,.75]] as number[][]) {
      box(.3,1.6,.3,"#81563b",x,.8,z); const crown=mesh(new THREE.DodecahedronGeometry(1.15*s,2),mat("#4ea953"),x,2,z);crown.scale.y=1.12;mesh(new THREE.DodecahedronGeometry(.76*s,2),mat("#69bd57"),x-.5,2.25,z+.1);
    }
    [[-3.6,-.3,"#fb6685"],[3.9,-.7,"#ffd348"],[-4.2,-2,"#f2f3ff"],[4.5,-3,"#f47d72"]].forEach(([x,z,c])=>{sphere(.18,c as string,x as number,.25,z as number);box(.05,.35,.05,"#3c9448",x as number,.12,z as number)});

    // Original resident with crisp proportions and cel shading.
    const hero=new THREE.Group(); world.add(hero); hero.position.set(-2.3,0,1.75);
    const add=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const q=new THREE.Mesh(g,m);q.position.set(x,y,z);q.castShadow=true;hero.add(q);return q};
    add(new THREE.CylinderGeometry(.46,.58,1.18,16),mat(shirt),0,1.25,0);
    const head=add(new THREE.SphereGeometry(.76,32,22),mat(skin),0,2.62,0);head.scale.set(.88,1.08,.84);
    const hairCap=add(new THREE.SphereGeometry(.79,28,18,0,Math.PI*2,0,Math.PI*(hairStyle===2?.66:.52)),mat(hair),0,2.88,0);
    if(hairStyle===1){for(const x of [-.43,0,.43]){const lock=add(new THREE.ConeGeometry(.25,.5,12),mat(hair),x,3.18,.03);lock.rotation.z=x*.45}}
    if(hairStyle===2){for(const x of [-.67,.67]){const tail=add(new THREE.CylinderGeometry(.16,.25,.75,14),mat(hair),x,2.65,-.08);tail.rotation.z=x*.35}}
    if(hairStyle===3){hairCap.scale.y=.72;add(new THREE.SphereGeometry(.3,22,16),mat(hair),.32,3.39,-.05)}
    for(const x of [-.25,.25]){const eye=add(new THREE.CircleGeometry(.065,18),mat("#20242b"),x,2.66,.65);eye.scale.y=1.35;add(new THREE.CircleGeometry(.018,12),mat("#ffffff"),x-.016,2.69,.664)}
    for(const x of [-.25,.25]){const brow=add(new THREE.BoxGeometry(.19,.025,.025),mat(hair),x,2.85,.64);brow.rotation.z=x*.35}
    const nose=add(new THREE.ConeGeometry(.035,.12,10),mat("#c98368"),0,2.55,.69);nose.rotation.x=Math.PI/2;
    const mouth=add(new THREE.TorusGeometry(.1,.018,8,18,Math.PI),mat("#a9434b"),0,2.4,.67);mouth.rotation.z=Math.PI;
    for(const x of [-.23,.23]){const leg=add(new THREE.CylinderGeometry(.09,.11,.68,12),mat("#38536b"),x,.35,0);leg.rotation.z=x*.08;const shoe=add(new THREE.BoxGeometry(.28,.14,.42),mat("#f8f3e8"),x,.04,.12);shoe.rotation.y=-x*.2}
    const armL=add(new THREE.CylinderGeometry(.075,.095,.72,12),mat(skin),-.58,1.45,0);armL.rotation.z=-.65;
    const armR=add(new THREE.CylinderGeometry(.075,.095,.72,12),mat(skin),.58,1.48,0);armR.rotation.z=.95;

    // A second resident for social-life atmosphere.
    const friend=hero.clone(true); friend.position.set(2.75,0,1.2); friend.scale.set(.88,.88,.88); friend.rotation.y=-.25; world.add(friend);
    const friendShirt=(friend.children[0] as THREE.Mesh); friendShirt.material=mat("#54a98e");

    // Foreground props differ per destination.
    if(sceneName==="cafe"){const top=mesh(new THREE.CylinderGeometry(1.25,1.25,.16,40),mat("#a76b43"),2,.9,2.6);top.castShadow=true;box(.25,1.6,.25,"#6c4634",2,.05,2.6);sphere(.38,"#f3c36c",2,1.18,2.6,.32)}
    if(sceneName==="plaza"){const stage=mesh(new THREE.CylinderGeometry(2.2,2.35,.45,40),mat("#e9cf88"),2,.2,2.5);stage.receiveShadow=true;}

    const clock=new THREE.Clock(); let raf=0;
    const render=()=>{const t=clock.getElapsedTime();hero.position.y=Math.sin(t*2)*.045;hero.rotation.y=Math.sin(t*.7)*.055;friend.position.y=Math.sin(t*2+1)*.04;armR.rotation.z=.95+Math.sin(t*3)*.18;camera.position.x=8.5+Math.sin(t*.18)*.28;camera.lookAt(0,2.35,0);renderer.render(world,camera);raf=requestAnimationFrame(render)};render();
    const resize=()=>{if(!el.clientWidth)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight)};new ResizeObserver(resize).observe(el);
    return()=>{cancelAnimationFrame(raf);renderer.dispose();el.replaceChildren()};
  }, [sceneName, skin, hair, shirt, hairStyle]);

  return <div className="world3d" ref={host} aria-label="立体小城生活场景" />;
}

"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = { scene: string; skin: string; hair: string; shirt: string; hairStyle: number };

const mat = (color: THREE.ColorRepresentation, rough = .62, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

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
    renderer.setSize(el.clientWidth, el.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
    el.appendChild(renderer.domElement);

    world.add(new THREE.HemisphereLight("#fff8df", "#76a26a", 2.5));
    const sun = new THREE.DirectionalLight("#fff0c4", 4.4); sun.position.set(-7, 12, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-13; sun.shadow.camera.right=13; sun.shadow.camera.top=13; sun.shadow.camera.bottom=-8; world.add(sun);

    const ground = new THREE.Mesh(new THREE.CylinderGeometry(12, 12.8, .65, 64), mat("#7fd05a")); ground.receiveShadow=true; ground.position.y=-.38; world.add(ground);
    const path = new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 13, 8, 18), mat("#f6d59d")); path.rotation.x=Math.PI/2; path.rotation.z=-.12; path.scale.set(1,1,.08); path.position.set(0,.015,2); path.receiveShadow=true; world.add(path);

    const mesh = (geo: THREE.BufferGeometry, material: THREE.Material, x=0,y=0,z=0) => { const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;world.add(m);return m; };
    const box = (w:number,h:number,d:number,c:string,x:number,y:number,z:number,r=0) => { const m=mesh(new THREE.BoxGeometry(w,h,d),mat(c,r||.62),x,y,z); return m; };
    const sphere = (r:number,c:string,x:number,y:number,z:number,sy=1) => { const m=mesh(new THREE.SphereGeometry(r,32,24),mat(c,.54),x,y,z);m.scale.y=sy;return m; };

    // Background neighborhood, softened by fog for genuine depth.
    [[-8,1,-5,"#ffd081"],[-5,1.2,-7,"#f28d82"],[7,1,-6,"#8dc9bd"],[10,1.1,-4,"#f0b56e"]].forEach(([x,y,z,c])=>{
      box(2.6,2.5,2.1,c as string,x as number,y as number,z as number); box(2.9,.35,2.4,"#fff5dd",x as number,2.45,z as number);
    });

    // Main location.
    const mainColor = sceneName === "home" ? "#ffe08a" : sceneName === "plaza" ? "#ed89ac" : "#e9b873";
    box(5.8,4.5,3.2,mainColor,0,2.25,-2.2);
    const roof = box(6.5,.55,3.75,sceneName === "plaza" ? "#836ac6" : sceneName === "cafe" ? "#4cae99" : "#ee6d55",0,4.65,-2.2);
    roof.rotation.z=.035;
    for (const x of [-1.75,0,1.75]) {
      const win=box(1.2,1.3,.12,"#6ac4df",x,3.15,-.56,.25); win.material=mat("#73cde7",.18,.06);
      box(1.42,.11,.18,"#fffaf0",x,3.15,-.48); box(.11,1.5,.18,"#fffaf0",x,3.15,-.48);
    }
    box(1.25,1.95,.18,"#3c7890",0,1,-.5,.25);
    if (sceneName === "cafe") { box(6.15,.18,.85,"#fff4da",0,4.02,-.6); for(let i=-2;i<=2;i++) box(.54,.2,.9,i%2 ? "#ef735f" : "#fff4da",i*1.15,4.02,-.54); }
    if (sceneName === "plaza") { sphere(.7,"#fff0b5",0,5.15,-2.2,.45); }

    // Trees and flowers add scale and environmental detail.
    for (const [x,z,s] of [[-5,-1,1],[5.5,-2,.9],[-6,-5,.75],[6,-5,.75]] as number[][]) {
      box(.3,1.6,.3,"#81563b",x,.8,z); sphere(1.15*s,"#4ea953",x,2,z,1.12); sphere(.76*s,"#69bd57",x-.5,2.25,z+.1);
    }
    [[-3.6,-.3,"#fb6685"],[3.9,-.7,"#ffd348"],[-4.2,-2,"#f2f3ff"],[4.5,-3,"#f47d72"]].forEach(([x,z,c])=>{sphere(.18,c as string,x as number,.25,z as number);box(.05,.35,.05,"#3c9448",x as number,.12,z as number)});

    // Original resident, built from rounded 3D forms.
    const hero=new THREE.Group(); world.add(hero); hero.position.set(-2.3,0,1.75);
    const add=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const q=new THREE.Mesh(g,m);q.position.set(x,y,z);q.castShadow=true;hero.add(q);return q};
    add(new THREE.CapsuleGeometry(.57,1.05,12,24),mat(shirt,.7),0,1.3,0);
    const head=add(new THREE.SphereGeometry(.82,40,32),mat(skin,.72),0,2.65,0);head.scale.set(.91,1.08,.88);
    const hairCap=add(new THREE.SphereGeometry(.87,36,24,0,Math.PI*2,0,Math.PI*(hairStyle===2?.66:.52)),mat(hair,.86),0,2.92,0);
    if(hairStyle===1){for(const x of [-.52,0,.52]){const lock=add(new THREE.SphereGeometry(.3,20,16),mat(hair,.86),x,3.24,.03);lock.scale.y=.78}}
    if(hairStyle===2){for(const x of [-.72,.72]){const tail=add(new THREE.SphereGeometry(.33,20,16),mat(hair,.86),x,2.7,-.08);tail.scale.y=1.55}}
    if(hairStyle===3){hairCap.scale.y=.72;const bun=add(new THREE.SphereGeometry(.34,24,18),mat(hair,.86),.35,3.47,-.05);bun.scale.y=1.1}
    for(const x of [-.27,.27]){add(new THREE.SphereGeometry(.075,18,12),mat("#272d35",.3),x,2.68,.72);add(new THREE.SphereGeometry(.023,10,8),mat("#ffffff",.2),x-.018,2.705,.78)}
    const mouth=add(new THREE.TorusGeometry(.12,.025,10,20,Math.PI),mat("#b4464b",.5),0,2.42,.77);mouth.rotation.z=Math.PI;
    for(const x of [-.27,.27]){const leg=add(new THREE.CapsuleGeometry(.12,.6,8,16),mat("#38536b"),x,0.35,0);leg.rotation.z=x*.08;add(new THREE.SphereGeometry(.19,20,12),mat("#f8f3e8"),x,.04,.14,.8)}
    const armL=add(new THREE.CapsuleGeometry(.1,.68,8,16),mat(skin),-.68,1.45,0);armL.rotation.z=-.65;
    const armR=add(new THREE.CapsuleGeometry(.1,.68,8,16),mat(skin),.68,1.5,0);armR.rotation.z=.95;

    // A second resident for social-life atmosphere.
    const friend=hero.clone(true); friend.position.set(2.75,0,1.2); friend.scale.set(.88,.88,.88); friend.rotation.y=-.25; world.add(friend);
    const friendShirt=(friend.children[0] as THREE.Mesh); friendShirt.material=mat("#54a98e",.72);

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

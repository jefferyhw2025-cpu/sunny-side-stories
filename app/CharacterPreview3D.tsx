"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  createCharacter,
  updateCharacter,
  type Character,
  type CharacterProfile,
} from "./game/characters";

type Props = {
  profile: CharacterProfile;
};

function disposeCharacter(character: Character): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  character.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!object.geometry.userData.sharedCharacterAsset) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const item of list) {
      if (!item.userData.sharedCharacterAsset) materials.add(item);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

/** A lightweight, real-time Three.js fitting-room preview of the actual game rig. */
export default function CharacterPreview3D({ profile }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const characterRef = useRef<Character | null>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    camera.position.set(0, 2.15, 6.35);
    camera.lookAt(0, 1.85, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const sky = new THREE.HemisphereLight("#eaf8ff", "#a88767", 1.75);
    scene.add(sky);
    const key = new THREE.DirectionalLight("#fff4dd", 3.2);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#80cfff", 1.4);
    rim.position.set(4, 3, -4);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 64),
      new THREE.MeshStandardMaterial({ color: "#e7f2df", roughness: 0.98 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const clock = new THREE.Clock();
    let frame = 0;
    const render = () => {
      const delta = clock.getDelta();
      const time = clock.elapsedTime;
      const character = characterRef.current;
      if (character) {
        updateCharacter(character, "idle", time, delta);
        character.group.rotation.y = THREE.MathUtils.lerp(
          character.group.rotation.y,
          rotationRef.current + Math.sin(time * 0.55) * 0.06,
          0.09,
        );
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      if (characterRef.current) {
        scene.remove(characterRef.current.group);
        disposeCharacter(characterRef.current);
        characterRef.current = null;
      }
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (characterRef.current) {
      scene.remove(characterRef.current.group);
      disposeCharacter(characterRef.current);
    }
    const character = createCharacter(profile);
    character.group.scale.setScalar(0.82);
    character.group.position.y = 0;
    character.group.rotation.y = rotationRef.current;
    character.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    scene.add(character.group);
    characterRef.current = character;
  }, [profile]);

  const turn = (amount: number) => {
    rotationRef.current += amount;
  };

  return (
    <div className="creator-3d-stage">
      <div
        ref={mountRef}
        className="creator-3d-canvas"
        role="img"
        aria-label={`${profile.name || "新居民"}的实时三维造型预览`}
      />
      <div className="preview-turner" aria-label="旋转角色预览">
        <button type="button" onClick={() => turn(-Math.PI / 4)} aria-label="向左旋转角色">↶</button>
        <span>实时 3D</span>
        <button type="button" onClick={() => turn(Math.PI / 4)} aria-label="向右旋转角色">↷</button>
      </div>
    </div>
  );
}

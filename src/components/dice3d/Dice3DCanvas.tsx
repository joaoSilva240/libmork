"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useDice3D } from "@/context/Dice3DContext";
import { useTheme } from "@/context/ThemeContext";
import { buildDie, updateDieFace } from "./diceGeometry";

interface PhysicalDie {
  group: THREE.Group;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  targetFace: number;
  sides: number;
  settled: boolean;
}

export function Dice3DCanvas() {
  const { activeRolls, isDice3DEnabled } = useDice3D();
  const { theme } = useTheme();
  const mountRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const diceListRef = useRef<PhysicalDie[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const rollStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 14, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      currentMount.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("[Dice3D] WebGL not supported or failed to init:", e);
      return;
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(10, 20, 15);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.PointLight(0xffffff, 1.0, 30);
    fillLight.position.set(-10, 10, -5);
    scene.add(fillLight);

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current && rendererRef.current.domElement && currentMount) {
        try {
          currentMount.removeChild(rendererRef.current.domElement);
        } catch {}
        rendererRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !isDice3DEnabled) return;

    const scene = sceneRef.current;

    diceListRef.current.forEach((d) => {
      scene.remove(d.group);
    });
    diceListRef.current = [];

    if (activeRolls.length === 0) {
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.clear();
      }
      return;
    }

    const themeColor = theme?.colors?.accent?.primary || "#7c3aed";
    const textColor = "#ffffff";

    rollStartTimeRef.current = performance.now();

    const count = activeRolls.length;
    const spacing = Math.min(2.5, 10 / Math.max(1, count));
    const startX = -((count - 1) * spacing) / 2;

    activeRolls.forEach((rollReq, index) => {
      const dieGroup = buildDie(rollReq.sides, themeColor, textColor);
      dieGroup.position.set(
        startX + index * spacing,
        8 + Math.random() * 2,
        -2 + Math.random() * 2,
      );

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        -8 - Math.random() * 4,
        (Math.random() - 0.5) * 3,
      );

      const angularVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
      );

      updateDieFace(dieGroup, rollReq.result, textColor);

      scene.add(dieGroup);

      diceListRef.current.push({
        group: dieGroup,
        velocity,
        angularVelocity,
        targetFace: rollReq.result,
        sides: rollReq.sides,
        settled: false,
      });
    });

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const delta = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const elapsed = (currentTime - rollStartTimeRef.current) / 1000;
      const settleProgress = Math.min(Math.max((elapsed - 0.8) / 0.5, 0), 1);

      diceListRef.current.forEach((die) => {
        if (!die.settled) {
          die.velocity.y -= 25 * delta;
          die.group.position.addScaledVector(die.velocity, delta);

          if (die.group.position.y <= 0) {
            die.group.position.y = 0;
            die.velocity.y = -die.velocity.y * 0.4;
            die.velocity.x *= 0.7;
            die.velocity.z *= 0.7;
            die.angularVelocity.multiplyScalar(0.7);

            if (Math.abs(die.velocity.y) < 0.5) {
              die.velocity.set(0, 0, 0);
            }
          }

          die.group.rotation.x += die.angularVelocity.x * delta;
          die.group.rotation.y += die.angularVelocity.y * delta;
          die.group.rotation.z += die.angularVelocity.z * delta;

          if (settleProgress > 0) {
            die.group.rotation.x *= 1 - settleProgress;
            die.group.rotation.z *= 1 - settleProgress;
            if (settleProgress >= 1) {
              die.settled = true;
              die.group.position.y = 0;
            }
          }
        }
      });

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      if (activeRolls.length > 0) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeRolls, isDice3DEnabled, theme]);

  if (!isDice3DEnabled || activeRolls.length === 0) {
    return null;
  }

  return (
    <div
      ref={mountRef}
      data-testid="dice-3d-canvas"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
    />
  );
}

"use client";

// components/Hotspot.tsx
// A clickable marker in 3D space, built for visibility against a large,
// busy model viewed from a distance — the original thin ring (radius
// 0.12–0.18) was too subtle. This version layers: a filled glowing core,
// a larger pulsing outer ring, and a floating label — each independently
// depth-tested where it matters and readable at typical camera distances.
//
// Sizing note: these dimensions (core radius 0.45, ring up to 0.75) are
// tuned for the house model's actual scale — its bounding box measured
// ~16 x 9.7 x 29.6 units (see fitCameraToObject console log). If you reuse
// this component on a model at a very different scale (e.g. the apartment
// model turns out to be ~1-2 units instead of ~20), multiply these radii
// down/up proportionally or the hotspot will look comically oversized or
// disappear again.

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { HotspotConfig } from "@/types/Scene";

interface HotspotProps {
  config: HotspotConfig;
  onSelect: (target: HotspotConfig["target"]) => void;
}

const ACCENT = "#22d3ee"; // cyan — high contrast against typical architectural greys/whites
const ACCENT_HOVER = "#facc15"; // yellow on hover — unmistakable state change

export default function Hotspot({ config, onSelect }: HotspotProps) {
  const outerRingRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Outer ring: continuous expand-and-fade pulse, like a sonar ping —
    // reads as "something interactive is here" even in peripheral vision.
    if (outerRingRef.current) {
      const pulse = (t * 0.9) % 1; // 0 -> 1 repeating
      const scale = 1 + pulse * 1.4;
      outerRingRef.current.scale.setScalar(scale);
      const material = outerRingRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = (1 - pulse) * 0.6;
    }

    // Core: gentle bob + brighter pulse, independent of the outer ring.
    if (coreRef.current) {
      const bob = Math.sin(t * 2) * 0.03;
      coreRef.current.position.y = bob;
      const coreScale = hovered ? 1.4 : 1 + Math.sin(t * 3) * 0.12;
      coreRef.current.scale.setScalar(coreScale);
    }
  });

  return (
    <group ref={groupRef} position={config.position}>
      {/* Filled core — the actual click target, always visible and bright */}
      <mesh
        ref={coreRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(config.target);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshBasicMaterial
          color={hovered ? ACCENT_HOVER : ACCENT}
          transparent
          opacity={0.95}
          depthTest={false}
        />
      </mesh>

      {/* Pulsing outer ring — draws the eye from a distance */}
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial
          color={hovered ? ACCENT_HOVER : ACCENT}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {/* Static outer ring outline for a crisp edge even between pulses */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.53, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      <Html distanceFactor={8} occlude>
        <div
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            background: hovered ? ACCENT_HOVER : "rgba(15,23,42,0.85)",
            color: hovered ? "#0f172a" : "white",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "sans-serif",
            whiteSpace: "nowrap",
            transform: "translateY(-40px)",
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "background 0.15s ease, color 0.15s ease",
          }}
        >
          {config.label}
        </div>
      </Html>
    </group>
  );
}
"use client";

// components/SceneViewer.tsx
// Owns the ONE <Canvas> for both models. We swap *what's inside* the canvas
// based on `view` state instead of mounting/unmounting separate <Canvas>
// trees — that would tear down and recreate the WebGL context on every
// navigation (visible stutter, wasted GPU init cost).
//
// Navigation transition: a fade-to-black overlay, not a 3D camera
// animation. A crossfade is simple, can't collide with the WebGL context
// issues we already fought through, and looks intentional rather than
// jarring. Trade-off: it's a fade, not a "walk through the door" camera
// move — upgrade path noted below if you want that later.

import { Suspense, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Loader } from "@react-three/drei";
import HouseModel from "./Housemodel";
import ApartmentModel from "./ApartmentModel";
import type { SceneView } from "@/types/Scene";

const FADE_MS = 450;

export default function SceneViewer() {
  const [view, setView] = useState<SceneView>("house");
  const [fading, setFading] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const pendingTarget = useRef<SceneView | null>(null);

  const navigate = (target: SceneView) => {
    if (target === view || fading) return; // ignore re-clicks mid-transition
    pendingTarget.current = target;
    setFading(true); // start fade to opaque

    window.setTimeout(() => {
      // Swap the model while the overlay is fully opaque, so the swap
      // itself (unmount + dispose + mount + suspense) is never visible.
      if (pendingTarget.current) {
        setView(pendingTarget.current);
        pendingTarget.current = null;
      }
      // Let the new model mount for a frame before fading back in, so we
      // don't fade into a single blank frame.
      requestAnimationFrame(() => {
        window.setTimeout(() => setFading(false), 30);
      });
    }, FADE_MS);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      {contextLost && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15,23,42,0.9)",
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          <div>WebGL context was lost.</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#22d3ee",
              color: "#0f172a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      )}

      {view === "apartment" && !contextLost && (
        <button
          onClick={() => navigate("house")}
          disabled={fading}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "rgba(15,23,42,0.85)",
            color: "white",
            fontFamily: "sans-serif",
            fontSize: 14,
            cursor: fading ? "default" : "pointer",
            opacity: fading ? 0.6 : 1,
            transition: "opacity 150ms ease",
          }}
        >
          ← Back to house
        </button>
      )}

      {/* Fade overlay: opaque during the model swap, transparent otherwise. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 15,
          background: "#0b1120",
          opacity: fading ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
          pointerEvents: "none",
        }}
      />
    
      <Canvas
        shadows
        camera={{ position: [5, 5, 5], fov: 45 }}
        gl={{ powerPreference: "default", antialias: true }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            console.warn("WebGL context lost");
            setContextLost(true);
          });
          gl.domElement.addEventListener("webglcontextrestored", () => {
            console.info("WebGL context restored");
            setContextLost(false);
          });
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <Environment preset="city" />

        <Suspense fallback={null}>
          {view === "house" ? (
            <HouseModel onNavigate={navigate} />
          ) : (
            <ApartmentModel />
          )}
        </Suspense>

        <OrbitControls enableDamping makeDefault />
      </Canvas>

      <Loader />
    </div>
  );
}
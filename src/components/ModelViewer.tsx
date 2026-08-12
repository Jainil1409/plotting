"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { ViewerScene } from "../three/ViewerScene";
import { ModelLoader } from "../three/ModelLoader";
import { CameraController } from "../three/CameraController";
import { HotspotManager } from "../three/HotspotManager";

import HotspotEditorPanel from "./HotspotEditorPanel";

import { HotspotConfig } from "../types/hotspot";
import { getViewerHotspotsForModel } from "../data/viewerHotspots";

interface ModelViewerProps {
  modelUrl: string;
  onBack: () => void;
  initialHotspots?: HotspotConfig[];
}

export default function ModelViewer({
  modelUrl,
  onBack,
  initialHotspots,
}: ModelViewerProps) {
  // Resolve the hotspot list from the actual model URL every time the
  // model changes. This way clicking an entry hotspot on the map that
  // opens the apartment loads the apartment's own hotspot camera
  // presets (hotspots.json), not the house's.
  const resolvedHotspots = initialHotspots ?? getViewerHotspotsForModel(modelUrl);
  const mountRef = useRef<HTMLDivElement>(null);
  const hotspotManagerRef = useRef<HotspotManager | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [hotspots, setHotspots] = useState<HotspotConfig[]>(resolvedHotspots);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Refs that stay in sync with state so the pointerdown listener added in
  // useEffect can always read the CURRENT value (the closure would otherwise
  // capture a stale value forever).
  const editModeRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    let animationId = 0;

    const viewer = new ViewerScene(container);
    viewer.onContextLost = (message) => setError(message);

    const cameraController = new CameraController(
      viewer.renderer,
      container.clientWidth,
      container.clientHeight
    );
    cameraControllerRef.current = cameraController;

    const modelLoader = new ModelLoader();

    let model: THREE.Object3D | null = null;
    let hotspotManager: HotspotManager | null = null;

    const init = async () => {
      try {
        const { model: loadedModel, size, center } = await modelLoader.load(modelUrl);
        model = loadedModel;

        viewer.scene.add(model);

        hotspotManager = new HotspotManager(model, resolvedHotspots);
        hotspotManagerRef.current = hotspotManager;

        setHotspots(hotspotManager.getHotspots());
        setLoading(false);

        if (resolvedHotspots.length > 0) {
          // Opening a model from a map hotspot should land the camera
          // directly on the FIRST hotspot's saved angle, so the user
          // immediately sees the unit/location they clicked instead of
          // a generic overview. Plain instant placement — the cinematic
          // tween is reserved for clicking hotspots inside the viewer.
          cameraController.setCameraPreset(resolvedHotspots[0]);
        } else {
          // No registered hotspot presets for this model — reproduce the
          // original auto-framing: position the camera to the living
          // room / main room area from front eye-level.
          cameraController.frameModel(size, center);
        }
      } catch (err) {
        console.error("Model loading failed:", err);
        setError("Failed to load model.");
      }
    };

    init();

    const handlePointerDown = (event: PointerEvent) => {
      if (!hotspotManager || !cameraController) return;

      // If the user grabs the camera while a hotspot transition is still
      // tweening, gsap and OrbitControls fight over camera.position every
      // frame — that fight is what causes the glitching/jitter. Cancel any
      // in-flight transition immediately so the user's drag takes over.
      cameraController.cancelTransition();

      // Use the ref so we always read the CURRENT edit-mode value instead of
      // the stale one captured when the effect first ran.
      const result = hotspotManager.handleClick(
        event,
        viewer.renderer,
        cameraController.camera,
        editModeRef.current
      );

      if (result.type === "navigate") {
        if (result.hotspot) {
          cameraController.goToHotspot(result.hotspot);
        }
        // This handler runs in the CAPTURE phase (listener added with
        // capture:true), so stopping propagation here prevents OrbitControls
        // — which listens on the same canvas in the bubble phase — from ALSO
        // starting a drag on this pointerdown. Without this, both gsap and
        // OrbitControls write camera.position during the transition and the
        // camera glitches/jitters while rotating.
        event.stopImmediatePropagation();
        return;
      }

      if (result.type === "select" || result.type === "created") {
        if (result.hotspot) {
          setSelectedId(result.hotspot.id);
        }
        if (result.type === "select") {
          hotspotManager.select(result.hotspot.id);
        }
        setHotspots(hotspotManager.getHotspots());
      }
    };

    // If the user zooms (mouse wheel / trackpad) while a hotspot camera
    // transition is still tweening, gsap writes camera.position every frame
    // while OrbitControls' wheel handler ALSO moves the camera. That fight
    // is what causes the first-zoom flicker. Cancelling in the CAPTURE phase
    // (before OrbitControls' bubble-phase wheel handler runs) lets the user's
    // zoom take over cleanly instead of jittering against the running tween.
    const handleWheel = () => {
      cameraController.cancelTransition();
    };
    viewer.renderer.domElement.addEventListener("wheel", handleWheel, true);

    // Capture phase so hotspot handling runs BEFORE OrbitControls. When a
    // hotspot is clicked, stopImmediatePropagation() prevents OrbitControls
    // from also starting a drag on the same pointerdown (the two fighting is
    // what caused the rotation glitch). For normal drags (no hotspot hit) the
    // event still reaches OrbitControls normally.
    viewer.renderer.domElement.addEventListener("pointerdown", handlePointerDown, true);

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      cameraController.update();

      // Keep every hotspot marker billboarded toward the camera and lifted
      // off its surface normal — this is what keeps them flicker-free flat
      // 2D circles during a 360° rotation.
      hotspotManager?.updateMarkers(cameraController.camera);

      viewer.render(cameraController.camera);
    };

    animate();

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      viewer.resize(width, height);
      cameraController.updateAspect(width, height);
    };

    window.addEventListener("resize", resize);
    resize();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);

      viewer.renderer.domElement.removeEventListener("pointerdown", handlePointerDown, true);
      viewer.renderer.domElement.removeEventListener("wheel", handleWheel, true);

      hotspotManager?.dispose();
      cameraController.dispose();
      viewer.dispose();

      hotspotManagerRef.current = null;
      cameraControllerRef.current = null;
    };
  }, [modelUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectHotspot = (id: string) => {
    setSelectedId(id);
    hotspotManagerRef.current?.select(id);
  };

  const renameHotspot = (id: string, label: string) => {
    hotspotManagerRef.current?.rename(id, label);
    setHotspots(hotspotManagerRef.current?.getHotspots() ?? []);
  };

  const deleteHotspot = (id: string) => {
    hotspotManagerRef.current?.delete(id);
    setHotspots(hotspotManagerRef.current?.getHotspots() ?? []);
    setSelectedId(null);
    hotspotManagerRef.current?.clearSelection();
  };

  const exportJSON = () => {
    hotspotManagerRef.current?.exportJSON(modelUrl.split("/").pop() ?? "model.glb");
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#0b1120" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 60,
          padding: "9px 18px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10,18,35,0.85)",
          color: "#e2e8f0",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        ← Back to house
      </button>

      <button
        type="button"
        onClick={() => setEditMode((v) => !v)}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 60,
          padding: "9px 18px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.08)",
          background: editMode ? "rgba(0,170,255,0.85)" : "rgba(10,18,35,0.85)",
          color: "#e2e8f0",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {editMode ? "Editing hotspots: ON" : "Edit hotspots"}
      </button>

      {loading && !error && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            padding: "9px 16px",
            borderRadius: 999,
            background: "rgba(10,18,35,0.85)",
            color: "#e2e8f0",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Loading model…
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 55,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "sans-serif",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div>{error}</div>
        </div>
      )}

      {editMode && (
        <HotspotEditorPanel
          hotspots={hotspots}
          selectedId={selectedId}
          onSelect={selectHotspot}
          onRename={renameHotspot}
          onDelete={deleteHotspot}
          onExport={exportJSON}
          onClose={() => setEditMode(false)}
        />
      )}

      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
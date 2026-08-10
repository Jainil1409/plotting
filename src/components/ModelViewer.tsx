"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { ViewerScene } from "../three/ViewerScene";
import { ModelLoader } from "../three/ModelLoader";
import { CameraController } from "../three/CameraController";
import { HotspotManager } from "../three/HotspotManager";

import HotspotEditorPanel from "./HotspotEditorPanel";

import { HotspotConfig } from "../types/hotspot";
import seedHotspotsData from "../data/hotspots.json";

interface ModelViewerProps {
  modelUrl: string;
  onBack: () => void;
  initialHotspots?: HotspotConfig[];
}

// Convert seed JSON data (plain x/y/z objects) into THREE.Vector3
// HotspotConfig objects. Cloned per-mount so two instances of this
// component never share the same underlying Vector3 objects.
function parseSeedHotspots(): HotspotConfig[] {
  return seedHotspotsData.hotspots.map((h) => ({
    id: h.id,
    label: h.label,
    position: new THREE.Vector3(h.position.x, h.position.y, h.position.z),
    cameraPosition: new THREE.Vector3(h.cameraPosition.x, h.cameraPosition.y, h.cameraPosition.z),
    cameraTarget: new THREE.Vector3(h.cameraTarget.x, h.cameraTarget.y, h.cameraTarget.z),
  }));
}

export default function ModelViewer({
  modelUrl,
  onBack,
  initialHotspots = parseSeedHotspots(),
}: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hotspotManagerRef = useRef<HotspotManager | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [hotspots, setHotspots] = useState<HotspotConfig[]>(initialHotspots);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

        hotspotManager = new HotspotManager(model, initialHotspots);
        hotspotManagerRef.current = hotspotManager;

        setHotspots(hotspotManager.getHotspots());
        setLoading(false);

        // Reproduce the original auto-framing: position the camera to the
        // living room / main room area from front eye-level.
        cameraController.frameModel(size, center);
      } catch (err) {
        console.error("Model loading failed:", err);
        setError("Failed to load model.");
      }
    };

    init();

    const handlePointerDown = (event: PointerEvent) => {
      if (!hotspotManager || !cameraController) return;

      const result = hotspotManager.handleClick(
        event,
        viewer.renderer,
        cameraController.camera,
        editMode
      );

      if (result.type === "navigate") {
        if (result.hotspot) {
          cameraController.goToHotspot(result.hotspot);
        }
        return;
      }

      if (result.type === "select" || result.type === "created") {
        if (result.hotspot) {
          setSelectedId(result.hotspot.id);
        }
        setHotspots(hotspotManager.getHotspots());
      }
    };

    viewer.renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      cameraController.update();
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

      viewer.renderer.domElement.removeEventListener("pointerdown", handlePointerDown);

      hotspotManager?.dispose();
      cameraController.dispose();
      viewer.dispose();

      hotspotManagerRef.current = null;
      cameraControllerRef.current = null;
    };
  }, [modelUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const renameHotspot = (id: string, label: string) => {
    hotspotManagerRef.current?.rename(id, label);
    setHotspots(hotspotManagerRef.current?.getHotspots() ?? []);
  };

  const captureCamera = (id: string) => {
    const manager = hotspotManagerRef.current;
    const cameraController = cameraControllerRef.current;
    if (!manager || !cameraController) return;

    manager.captureCamera(id, cameraController.camera, cameraController.controls);
    setHotspots(manager.getHotspots());
  };

  const deleteHotspot = (id: string) => {
    hotspotManagerRef.current?.delete(id);
    setHotspots(hotspotManagerRef.current?.getHotspots() ?? []);
    setSelectedId(null);
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
          onSelect={setSelectedId}
          onRename={renameHotspot}
          onCapture={captureCamera}
          onDelete={deleteHotspot}
          onExport={exportJSON}
        />
      )}

      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
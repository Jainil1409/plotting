/// <reference types="@types/google.maps" />
"use client";
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import { GoogleMapsThreeRenderer } from "@/src/three/scene/GoogleMapsThreeRenderer";
import { ModelManager } from "@/src/three/models/ModelManager";
import { LoadedModel, ModelConfig, ModelDefinition } from "@/src/three/models/modelTypes";
import { HotspotManager } from "@/src/three/hotspots/HotspotManager";
import { ModelInteractionManager, PropertyPopup } from "@/src/three/interaction/ModelInteractionManager";

import { PROPERTY_DETAILS } from "@/src/data/properties";
import { HOTSPOTS } from "@/src/data/hotspots";
import {
  DEFAULT_MODEL_INSTANCE_ID,
  getInitialModelConfigs,
  getModelConfig,
  getModelDefinition,
} from "@/src/data/models";

import ModelViewerOverlay from "@/src/components/ModelViewerOverlay";

const GOOGLE_MAPS_API_KEY = "AIzaSyBCswT9ODeUU9ByGUjbRg1KzV-nUF3BFkU"; // demo key

const defaultModelConfig = getModelConfig(DEFAULT_MODEL_INSTANCE_ID);

if (!defaultModelConfig) {
  throw new Error(`Missing default model instance: ${DEFAULT_MODEL_INSTANCE_ID}`);
}

const DEFAULT_MODEL_CONFIG: ModelConfig = defaultModelConfig;

// Default anchor — model is visible here on load. User can move it via "Move Model".
const DEFAULT_ANCHOR = DEFAULT_MODEL_CONFIG.anchor; // Ahmedabad
const MODEL_HEADING = DEFAULT_MODEL_CONFIG.heading;

function cloneModelConfig(config: ModelConfig): ModelConfig {
  return {
    ...config,
    anchor: { ...config.anchor },
  };
}

function createInitialModelConfigMap() {
  return new Map(
    getInitialModelConfigs().map((config) => [
      config.instanceId,
      cloneModelConfig(config),
    ])
  );
}

export default function GoogleMap3D() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const rendererRef = useRef<GoogleMapsThreeRenderer | null>(null);
  const modelManagerRef = useRef(new ModelManager());
  const hotspotManagerRef = useRef(new HotspotManager());
  const interactionManagerRef = useRef<ModelInteractionManager | null>(null);

  const currentModelRef = useRef<LoadedModel | null>(null);
  const activeModelInstanceIdRef = useRef<string>(DEFAULT_MODEL_INSTANCE_ID);
  const modelConfigsRef = useRef<Map<string, ModelConfig>>(createInitialModelConfigMap());
  const clockRef = useRef(new THREE.Clock());

  const anchorRef = useRef<{ lat: number; lng: number; altitude: number } | null>(DEFAULT_ANCHOR);
  const placementListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const modelConfigRef = useRef<ModelConfig | null>(cloneModelConfig(DEFAULT_MODEL_CONFIG));
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(() =>
    cloneModelConfig(DEFAULT_MODEL_CONFIG)
  );
  const [placementMode, setPlacementMode] = useState(false);
  const placementModeRef = useRef(false);
  const [propertyPopup, setPropertyPopup] = useState<PropertyPopup | null>(null);
  const [modelHeadingDeg, setModelHeadingDeg] = useState(MODEL_HEADING);
  const [compassOpen, setCompassOpen] = useState(false);

  // The ONLY thing hotspot clicks do now: flip this. It mounts/unmounts
  // <ModelViewerOverlay>, a completely independent canvas — no scene swapping
  // inside the map's own WebGLOverlayView anymore.
  const [viewerModel, setViewerModel] = useState<ModelDefinition | null>(null);

  const dragStateRef = useRef<{ pointerId: number | null; startX: number; startHeading: number; dragging: boolean }>({
    pointerId: null,
    startX: 0,
    startHeading: 0,
    dragging: false,
  });

  useEffect(() => {
    let canceled = false;
    const modelManager = modelManagerRef.current;
    const hotspotManager = hotspotManagerRef.current;
    anchorRef.current = { ...DEFAULT_ANCHOR };
    const initialConfigs = getInitialModelConfigs().map(cloneModelConfig);
    modelConfigsRef.current = new Map(
      initialConfigs.map((config) => [config.instanceId, config])
    );
    modelConfigRef.current =
      modelConfigsRef.current.get(activeModelInstanceIdRef.current) ??
      initialConfigs[0] ??
      null;
    setModelConfig(modelConfigRef.current);
    setModelHeadingDeg(modelConfigRef.current?.heading ?? MODEL_HEADING);

    const loadGoogleMaps = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (typeof window === "undefined") return;
        if (window.google?.maps?.Map) { resolve(); return; }
        const existing = document.getElementById("gmaps-script");
        if (existing) {
          const poll = setInterval(() => {
            if (window.google?.maps?.Map) { clearInterval(poll); resolve(); }
          }, 50);
          return;
        }
        const script = document.createElement("script");
        script.id = "gmaps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=beta`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google Maps script"));
        document.head.appendChild(script);
      });
    };

    (async () => {
      await loadGoogleMaps();
      if (canceled || !mapDiv.current) return;

      const g = window.google;

      const map = new g.maps.Map(mapDiv.current, {
        center: { lat: DEFAULT_ANCHOR.lat, lng: DEFAULT_ANCHOR.lng },
        zoom: 18,
        tilt: 45,
        heading: 0,
        mapId: "8e0a97af9386fef",
        disableDefaultUI: true,
        rotateControl: true,
        gestureHandling: "greedy",
        keyboardShortcuts: true,
        mapTypeId: "roadmap",
      });
      mapRef.current = map;

      // ── Three.js scene / camera / renderer via GoogleMapsThreeRenderer ──
      const renderer = new GoogleMapsThreeRenderer();
      renderer.setAnchor(DEFAULT_ANCHOR);
      renderer.setOnDraw(() => {
        // Update hotspot animations each frame
        const t = clockRef.current.getElapsedTime();
        hotspotManager.update(t);
      });
      renderer.attachToMap(map);
      rendererRef.current = renderer;

      // ── Interaction manager (property selection) ──
      interactionManagerRef.current = new ModelInteractionManager(
        [],
        PROPERTY_DETAILS
      );

      // Load all configured model instances.
      const sceneAnchor = anchorRef.current ?? DEFAULT_ANCHOR;
      const loadedModels: LoadedModel[] = [];

      // Attach hotspots per model instance, separate from GLB loading.
      for (const config of initialConfigs) {
        const loaded = await modelManager.loadModel(config);

        if (canceled) {
          modelManager.dispose(loaded);
          return;
        }

        modelManager.setAnchor(loaded, config.anchor, sceneAnchor);
        modelManager.addModel(renderer.scene, loaded);
        loadedModels.push(loaded);

        const modelHotspots = HOTSPOTS[config.hotspotSetId] ?? [];
        for (const hotspotConfig of modelHotspots) {
          const hotspot = hotspotManager.createHotspot(hotspotConfig);
          hotspotManager.attachHotspot(loaded.pivot, hotspot);
        }
      }

      currentModelRef.current =
        modelManager.getModel(activeModelInstanceIdRef.current) ??
        loadedModels[0] ??
        null;

      interactionManagerRef.current?.setMeshes(modelManager.getAllMeshes());

      renderer.requestRedraw();
    })();

    return () => {
      canceled = true;
      if (placementListenerRef.current) {
        window.google?.maps?.event?.removeListener(placementListenerRef.current);
        placementListenerRef.current = null;
      }

      // Dispose models
      modelManager.disposeAll();
      currentModelRef.current = null;

      // Dispose hotspots
      hotspotManager.dispose();

      // Dispose renderer
      rendererRef.current?.dispose();
      rendererRef.current = null;

      mapRef.current = null;
      anchorRef.current = null;
      interactionManagerRef.current = null;
    };
  }, []);

  const enterPlacementMode = () => {
    const map = mapRef.current;
    if (!map) return;
    if (placementListenerRef.current) {
      window.google.maps.event.removeListener(placementListenerRef.current);
      placementListenerRef.current = null;
    }
    placementModeRef.current = true;
    setPlacementMode(true);
    placementListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      const anchor = { lat, lng, altitude: 0 };
      const activeInstanceId = activeModelInstanceIdRef.current;
      const currentConfig =
        modelConfigsRef.current.get(activeInstanceId) ?? modelConfigRef.current;

      if (!currentConfig) return;

      anchorRef.current = anchor;
      const newConfig: ModelConfig = {
        ...currentConfig,
        anchor,
        heading: modelHeadingDeg,
      };
      const loaded = modelManagerRef.current.getModel(activeInstanceId);

      if (loaded) {
        loaded.config = newConfig;
      }

      modelConfigsRef.current.set(newConfig.instanceId, newConfig);
      modelConfigRef.current = newConfig;
      setModelConfig(newConfig);
      mapRef.current?.setCenter({ lat, lng });
      mapRef.current?.setZoom(18);
      mapRef.current?.setTilt(45);
      rendererRef.current?.setAnchor(anchor);
      modelManagerRef.current.setSceneOrigin(anchor);
      rendererRef.current?.requestRedraw();
      const placementListener = placementListenerRef.current;
      if (placementListener) {
        window.google.maps.event.removeListener(placementListener);
      }
      placementListenerRef.current = null;
      placementModeRef.current = false;
      setPlacementMode(false);
    });
  };

  const handleScenePick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (placementModeRef.current) return;
    const renderer = rendererRef.current;
    const mapElement = mapDiv.current;
    if (!renderer || !mapElement) {
      console.log("Raycast click ignored: scene is not ready yet");
      return;
    }

    const nativeEvent = event.nativeEvent;
    const camera = renderer.camera;

    // Calibration: Alt+click any point on the house to log its exact
    // pivot-local coordinate.
    if (event.altKey && currentModelRef.current) {
      const local = interactionManagerRef.current?.calibrateLocalPosition(
        nativeEvent,
        camera,
        currentModelRef.current.pivot,
        mapElement
      );
      if (local) {
        console.info("Calibration — Alt+clicked pivot-local position:", [local.x, local.y, local.z]);
      } else {
        console.info("Calibration: Alt+click didn't hit any model geometry.");
      }
      return;
    }

    // ── Hotspot click detection (independent of model loading) ──
    const hotspot = hotspotManagerRef.current.pickHotspotAt(
      nativeEvent,
      camera,
      mapElement
    );

    if (hotspot) {
      const nextModel = getModelDefinition(hotspot.nextModelId);

      if (!nextModel) {
        console.warn("Hotspot target model is not registered:", hotspot.nextModelId);
        return;
      }

      console.log("Hotspot clicked -> Opening ModelViewer:", hotspot.nextModelId);
      setViewerModel(nextModel);
      return;
    }

    // ── Property selection via ModelInteractionManager ──
    const result = interactionManagerRef.current?.handleClick(
      nativeEvent,
      camera,
      mapElement
    );

    if (result?.type === "property") {
      setPropertyPopup(result.popup);
    } else {
      setPropertyPopup(null);
    }
  };

  const rotateMap = (deltaDegrees: number) => {
    const map = mapRef.current;
    if (!map) return;
    const currentHeading = map.getHeading?.() ?? 0;
    const nextHeading = ((currentHeading + deltaDegrees) % 360 + 360) % 360;
    map.setHeading(nextHeading);
  };

  const tiltMap = (deltaDegrees: number) => {
    const map = mapRef.current;
    if (!map) return;
    const currentTilt = map.getTilt?.() ?? 0;
    const nextTilt = Math.min(67.5, Math.max(0, currentTilt + deltaDegrees));
    map.setTilt(nextTilt);
  };

  const startDragRotate = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const map = mapRef.current;
    if (!map) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startHeading: map.getHeading?.() ?? 0,
      dragging: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDragRotate = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    const map = mapRef.current;
    if (!map || !state.dragging || state.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - state.startX;
    const nextHeading = ((state.startHeading + deltaX * 0.5) % 360 + 360) % 360;
    map.setHeading(nextHeading);
  };

  const endDragRotate = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId) return;
    dragStateRef.current = { pointerId: null, startX: 0, startHeading: 0, dragging: false };
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const setModelHeading = (degrees: number) => {
    const activeInstanceId = activeModelInstanceIdRef.current;
    const loaded =
      modelManagerRef.current.getModel(activeInstanceId) ?? currentModelRef.current;

    if (!loaded) return;

    const normalized = ((degrees % 360) + 360) % 360;
    modelManagerRef.current.setHeading(loaded, normalized);
    setModelHeadingDeg(normalized);
    setModelConfig(prev => {
      const updated = { ...(prev ?? loaded.config), heading: normalized };
      loaded.config = updated;
      modelConfigsRef.current.set(updated.instanceId, updated);
      modelConfigRef.current = updated;
      return updated;
    });
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

      {/* ── Top-left: Place / Move Model ── */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}>
        <button
          type="button"
          onClick={placementMode ? undefined : enterPlacementMode}
          title={placementMode ? "Click anywhere on the map to place the model" : modelConfig ? "Move model to a new location" : "Place model on the map"}
          style={{
            border: placementMode ? "1.5px solid rgba(251,191,36,0.7)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            padding: "9px 18px",
            background: placementMode ? "rgba(251,191,36,0.18)" : "rgba(10,18,35,0.78)",
            color: placementMode ? "#fbbf24" : "#e2e8f0",
            cursor: placementMode ? "crosshair" : "pointer",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
            display: "flex", alignItems: "center", gap: 7,
            transition: "background 0.2s, color 0.2s, border 0.2s",
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: 15 }}>{placementMode ? "📍" : "✦"}</span>
          {placementMode ? "Click map to place…" : "Move Model"}
        </button>
      </div>

      {/* ── Top-right: Map rotation ── */}
      <div style={{
        position: "absolute", top: 16, right: 16, zIndex: 10,
        display: "flex", flexDirection: "column", gap: 6,
        alignItems: "center",
      }}>
        <div style={{
          background: "rgba(10, 18, 35, 0.78)",
          backdropFilter: "blur(12px)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          padding: "6px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textAlign: "center", paddingBottom: 2 }}>ROTATE</div>
          <button type="button" onClick={() => rotateMap(-45)}
            title="Rotate left"
            style={{ border: "none", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "#e2e8f0", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >⟲</button>
          <button type="button" onClick={() => rotateMap(45)}
            title="Rotate right"
            style={{ border: "none", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "#e2e8f0", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >⟳</button>
        </div>

        <div style={{
          background: "rgba(10, 18, 35, 0.78)",
          backdropFilter: "blur(12px)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          padding: "6px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textAlign: "center", paddingBottom: 2 }}>TILT</div>
          <button type="button" onClick={() => tiltMap(8)}
            title="Tilt up"
            style={{ border: "none", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "#e2e8f0", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >▲</button>
          <button type="button" onClick={() => tiltMap(-8)}
            title="Tilt down"
            style={{ border: "none", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "#e2e8f0", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >▼</button>
        </div>
      </div>

      {/* ── Bottom-right: Drag to rotate ── */}
      <button
        type="button"
        onPointerDown={startDragRotate}
        onPointerMove={moveDragRotate}
        onPointerUp={endDragRotate}
        onPointerCancel={endDragRotate}
        onLostPointerCapture={endDragRotate}
        title="Drag horizontally to rotate the map"
        style={{
          position: "absolute", bottom: 16, right: 16, zIndex: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "9px 16px",
          borderRadius: 999,
          background: "rgba(10,18,35,0.78)",
          color: "#e2e8f0",
          cursor: "grab",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          display: "flex", alignItems: "center", gap: 7,
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 15 }}>↔</span> Drag to rotate 360°
      </button>

      {/* ── Bottom-left: Model heading compass ── */}
      <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 10 }}>
        <button
          type="button"
          onClick={() => setCompassOpen(o => !o)}
          title="Model heading"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            padding: "9px 16px",
            background: compassOpen ? "rgba(99,179,237,0.92)" : "rgba(10,18,35,0.78)",
            color: compassOpen ? "#0f172a" : "#e2e8f0",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
            display: "flex", alignItems: "center", gap: 7,
            transition: "background 0.2s, color 0.2s",
          }}
        >
          <span style={{
            fontSize: 16,
            display: "inline-block",
            transform: `rotate(${modelHeadingDeg}deg)`,
            transition: "transform 0.35s cubic-bezier(.4,0,.2,1)",
          }}>🧭</span>
          Model Direction &nbsp;<span style={{ opacity: 0.7, fontWeight: 400 }}>{modelHeadingDeg}°</span>
        </button>

        {compassOpen && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 10px)", left: 0,
            background: "rgba(10,18,35,0.94)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 18,
            padding: "14px 14px 12px",
            backdropFilter: "blur(16px)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            minWidth: 160,
          }}>
            <div style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              textAlign: "center", marginBottom: 10,
            }}>MODEL HEADING</div>

            {([
              [{ label: "NW", deg: 315 }, { label: "N", deg: 0 }, { label: "NE", deg: 45 }],
              [{ label: "W", deg: 270 }, { label: "·", deg: -1 }, { label: "E", deg: 90 }],
              [{ label: "SW", deg: 225 }, { label: "S", deg: 180 }, { label: "SE", deg: 135 }],
            ] as { label: string; deg: number }[][]).map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: 5, marginBottom: ri < 2 ? 5 : 0, justifyContent: "center" }}>
                {row.map((cell) => {
                  const isActive = cell.deg !== -1 && modelHeadingDeg === cell.deg;
                  const isCenter = cell.deg === -1;
                  return (
                    <button
                      key={cell.label}
                      type="button"
                      disabled={isCenter}
                      onClick={() => !isCenter && setModelHeading(cell.deg)}
                      title={!isCenter ? `${cell.label} — ${cell.deg}°` : undefined}
                      style={{
                        width: 42, height: 42, borderRadius: 11,
                        border: isActive ? "1.5px solid rgba(99,179,237,0.8)" : "1px solid rgba(255,255,255,0.07)",
                        background: isActive
                          ? "rgba(99,179,237,0.22)"
                          : isCenter ? "transparent" : "rgba(255,255,255,0.05)",
                        color: isActive ? "#63b3ed" : isCenter ? "rgba(255,255,255,0.2)" : "#cbd5e1",
                        cursor: isCenter ? "default" : "pointer",
                        fontSize: isCenter ? 20 : 11,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        transition: "background 0.15s, border 0.15s, color 0.15s",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onMouseEnter={e => { if (!isCenter && !isActive) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                      onMouseLeave={e => { if (!isCenter && !isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    >
                      {cell.label}
                    </button>
                  );
                })}
              </div>
            ))}

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range" min={0} max={359} step={1}
                value={modelHeadingDeg}
                onChange={e => setModelHeading(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#63b3ed", height: 4 }}
              />
              <span style={{
                color: "#63b3ed", fontSize: 12, fontWeight: 700,
                minWidth: 38, textAlign: "right",
              }}>{modelHeadingDeg}°</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Property popup ── */}
      {propertyPopup && (
        <div style={{
          position: "absolute",
          left: Math.min(propertyPopup.x + 16, window.innerWidth - 280),
          top: Math.min(propertyPopup.y + 16, window.innerHeight - 180),
          zIndex: 20,
          width: 240,
          background: "rgba(10,18,35,0.95)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: "14px 16px",
          color: "#f1f5f9",
          backdropFilter: "blur(16px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{propertyPopup.meshName}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: "#f8fafc" }}>{propertyPopup.details.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.45)" }}>Type</span>
              <span style={{ fontWeight: 600 }}>{propertyPopup.details.bhk}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.45)" }}>Area</span>
              <span style={{ fontWeight: 600 }}>{propertyPopup.details.area} sq ft</span>
            </div>
            <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(99,179,237,0.15)", border: "1px solid rgba(99,179,237,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Price</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#63b3ed" }}>{propertyPopup.details.price}</span>
            </div>
          </div>
        </div>
      )}

      <div ref={mapDiv} onClick={handleScenePick} style={{ width: "100%", height: "100%", cursor: placementMode ? "crosshair" : "default" }} />

      {/* Completely separate canvas/renderer/camera — mounted only while open. */}
      {viewerModel && (
        <ModelViewerOverlay
          model={viewerModel}
          onBack={() => setViewerModel(null)}
        />
      )}
    </div>
  );
}

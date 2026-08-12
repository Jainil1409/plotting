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
const DEFAULT_ANCHOR = DEFAULT_MODEL_CONFIG.anchor;
const MODEL_HEADING = DEFAULT_MODEL_CONFIG.heading;

// Cardinal compass dial mapping (0° = N, clockwise)
const COMPASS_DIAL: { label: string; deg: number; x: number; y: number }[] = [
  { label: "N", deg: 0, x: 75, y: 16 },
  { label: "NE", deg: 45, x: 116, y: 32 },
  { label: "E", deg: 90, x: 132, y: 75 },
  { label: "SE", deg: 135, x: 116, y: 116 },
  { label: "S", deg: 180, x: 75, y: 132 },
  { label: "SW", deg: 225, x: 32, y: 116 },
  { label: "W", deg: 270, x: 16, y: 75 },
  { label: "NW", deg: 315, x: 32, y: 32 },
];

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

interface ModelSummary {
  instanceId: string;
  label: string;
  heading: number;
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
  const [, setModelConfig] = useState<ModelConfig | null>(() =>
    cloneModelConfig(DEFAULT_MODEL_CONFIG)
  );
  const [placementMode, setPlacementMode] = useState(false);
  const placementModeRef = useRef(false);
  const [propertyPopup, setPropertyPopup] = useState<PropertyPopup | null>(null);
  const [, setModelHeadingDeg] = useState(MODEL_HEADING);
  const [compassOpen, setCompassOpen] = useState(false);

  // Collapsible state for Tactical Viewport Command Deck
  const [deckOpen, setDeckOpen] = useState(true);

  const [loadedModelSummaries, setLoadedModelSummaries] = useState<ModelSummary[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const selectedModelIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedModelIdsRef.current = selectedModelIds;
  }, [selectedModelIds]);

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
        rotateControl: false,
        gestureHandling: "greedy",
        keyboardShortcuts: true,
        mapTypeId: "roadmap",
      });
      mapRef.current = map;

      const renderer = new GoogleMapsThreeRenderer();
      renderer.setAnchor(DEFAULT_ANCHOR);
      renderer.setOnDraw(() => {
        const t = clockRef.current.getElapsedTime();
        hotspotManager.update(t);
      });
      renderer.attachToMap(map);
      rendererRef.current = renderer;

      interactionManagerRef.current = new ModelInteractionManager([], PROPERTY_DETAILS);

      const sceneAnchor = anchorRef.current ?? DEFAULT_ANCHOR;
      const loadedModels: LoadedModel[] = [];

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
        modelManager.getModel(activeModelInstanceIdRef.current) ?? loadedModels[0] ?? null;

      const summaries: ModelSummary[] = loadedModels.map((m) => ({
        instanceId: m.instanceId,
        label: m.config.label ?? m.instanceId,
        heading: m.config.heading,
      }));
      setLoadedModelSummaries(summaries);
      const defaultSelection = new Set<string>(
        summaries.some((s) => s.instanceId === activeModelInstanceIdRef.current)
          ? [activeModelInstanceIdRef.current]
          : summaries.slice(0, 1).map((s) => s.instanceId)
      );
      setSelectedModelIds(defaultSelection);
      selectedModelIdsRef.current = defaultSelection;

      interactionManagerRef.current?.setMeshes(modelManager.getAllMeshes());
      renderer.requestRedraw();
    })();

    return () => {
      canceled = true;
      if (placementListenerRef.current) {
        window.google?.maps?.event?.removeListener(placementListenerRef.current);
        placementListenerRef.current = null;
      }

      modelManager.disposeAll();
      currentModelRef.current = null;
      hotspotManager.dispose();

      rendererRef.current?.dispose();
      rendererRef.current = null;

      mapRef.current = null;
      anchorRef.current = null;
      interactionManagerRef.current = null;
    };
  }, []);

  const toggleModelCheckbox = (instanceId: string) => {
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }
      return next;
    });
  };

  const enterPlacementMode = () => {
    const map = mapRef.current;
    if (!map) return;

    const ids = Array.from(selectedModelIdsRef.current);
    if (ids.length === 0) return;

    if (placementListenerRef.current) {
      window.google.maps.event.removeListener(placementListenerRef.current);
      placementListenerRef.current = null;
    }
    placementModeRef.current = true;
    setPlacementMode(true);

    const startAnchors = new Map<string, { lat: number; lng: number; altitude: number }>();
    ids.forEach((instanceId) => {
      const config = modelConfigsRef.current.get(instanceId);
      if (config) startAnchors.set(instanceId, { ...config.anchor });
    });

    const referenceId = ids[0];
    const referenceStart = startAnchors.get(referenceId);

    placementListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !referenceStart) return;

      const clickLat = e.latLng.lat();
      const clickLng = e.latLng.lng();
      const deltaLat = clickLat - referenceStart.lat;
      const deltaLng = clickLng - referenceStart.lng;

      ids.forEach((instanceId) => {
        const start = startAnchors.get(instanceId);
        const loaded = modelManagerRef.current.getModel(instanceId);
        if (!start || !loaded) return;

        const anchor = {
          lat: start.lat + deltaLat,
          lng: start.lng + deltaLng,
          altitude: start.altitude,
        };
        const newConfig: ModelConfig = { ...loaded.config, anchor };
        loaded.config = newConfig;
        modelConfigsRef.current.set(instanceId, newConfig);

        if (instanceId === activeModelInstanceIdRef.current) {
          modelConfigRef.current = newConfig;
          setModelConfig(newConfig);
        }
      });

      const newSceneAnchor = { lat: clickLat, lng: clickLng, altitude: 0 };
      anchorRef.current = newSceneAnchor;
      mapRef.current?.setCenter({ lat: clickLat, lng: clickLng });
      mapRef.current?.setZoom(18);
      mapRef.current?.setTilt(45);
      rendererRef.current?.setAnchor(newSceneAnchor);
      modelManagerRef.current.setSceneOrigin(newSceneAnchor);
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
    if (!renderer || !mapElement) return;

    const nativeEvent = event.nativeEvent;
    const camera = renderer.camera;

    if (event.altKey && currentModelRef.current) {
      const local = interactionManagerRef.current?.calibrateLocalPosition(
        nativeEvent,
        camera,
        currentModelRef.current.pivot,
        mapElement
      );
      if (local) console.info("Calibration position:", [local.x, local.y, local.z]);
      return;
    }

    const hotspot = hotspotManagerRef.current.pickHotspotAt(nativeEvent, camera, mapElement);

    if (hotspot) {
      const nextModel = getModelDefinition(hotspot.nextModelId);
      if (nextModel) setViewerModel(nextModel);
      return;
    }

    const result = interactionManagerRef.current?.handleClick(nativeEvent, camera, mapElement);

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
    map.setHeading(((currentHeading + deltaDegrees) % 360 + 360) % 360);
  };

  const tiltMap = (deltaDegrees: number) => {
    const map = mapRef.current;
    if (!map) return;
    const currentTilt = map.getTilt?.() ?? 0;
    map.setTilt(Math.min(67.5, Math.max(0, currentTilt + deltaDegrees)));
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
    map.setHeading(((state.startHeading + deltaX * 0.5) % 360 + 360) % 360);
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

  const setModelHeadingForSelection = (degrees: number) => {
    const ids = selectedModelIdsRef.current;
    if (ids.size === 0) return;

    const normalized = ((degrees % 360) + 360) % 360;

    setLoadedModelSummaries((prev) =>
      prev.map((summary) => {
        if (!ids.has(summary.instanceId)) return summary;

        const loaded = modelManagerRef.current.getModel(summary.instanceId);
        if (loaded) {
          modelManagerRef.current.setHeading(loaded, normalized);
          const updatedConfig = { ...loaded.config, heading: normalized };
          loaded.config = updatedConfig;
          modelConfigsRef.current.set(summary.instanceId, updatedConfig);

          if (summary.instanceId === activeModelInstanceIdRef.current) {
            modelConfigRef.current = updatedConfig;
            setModelConfig(updatedConfig);
          }
        }

        return { ...summary, heading: normalized };
      })
    );

    setModelHeadingDeg(normalized);
    rendererRef.current?.requestRedraw();
  };

  const selectedSummaries = loadedModelSummaries.filter((m) => selectedModelIds.has(m.instanceId));
  const headingsMatch =
    selectedSummaries.length > 0 &&
    selectedSummaries.every((m) => m.heading === selectedSummaries[0].heading);
  const compassDisplayDeg = selectedSummaries.length === 0 ? 0 : headingsMatch ? selectedSummaries[0].heading : 0;
  const controlsDisabled = selectedModelIds.size === 0;

  return (
    <div className="spatial-ui-root relative w-full h-full font-sans select-none overflow-hidden bg-slate-950 text-slate-100">
      <style>{`
        .hud-glass {
          background: rgba(11, 19, 36, 0.72);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(56, 189, 248, 0.18);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .hud-glow {
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);
        }

        .hud-chip-active {
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.08));
          border-color: rgba(56, 189, 248, 0.6);
          color: #38bdf8;
        }

        .hud-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 10px #38bdf8;
          cursor: pointer;
        }

        /* Tactical Compass Dial Ring */
        .compass-dial-wrap {
          position: relative;
          width: 150px;
          height: 150px;
          margin: 4px auto;
        }

        .compass-dial-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px dashed rgba(56, 189, 248, 0.3);
          background: radial-gradient(circle at center, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.4) 60%, transparent 70%);
        }

        .compass-needle {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 3px;
          height: 42px;
          background: linear-gradient(180deg, #38bdf8, rgba(56, 189, 248, 0.1));
          border-radius: 3px;
          transform-origin: 50% 100%;
          box-shadow: 0 0 8px #38bdf8;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .compass-hub {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #38bdf8;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 10px #38bdf8;
        }

        .compass-dial-btn {
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid rgba(56, 189, 248, 0.2);
          background: rgba(15, 23, 42, 0.85);
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translate(-50%, -50%);
          transition: all 0.15s ease;
        }

        .compass-dial-btn:hover {
          background: rgba(56, 189, 248, 0.2);
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.5);
        }

        .compass-dial-btn.is-active {
          background: #38bdf8;
          color: #0f172a;
          border-color: #38bdf8;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);
        }
      `}</style>

      {/* ── TOP-LEFT: SPATIAL HUD COMMAND DECK (COLLAPSIBLE) ── */}
      <div className="absolute top-5 left-5 z-20 w-80 flex flex-col gap-3">
        <div className="hud-glass rounded-3xl p-4 flex flex-col gap-3 transition-all duration-300">
          
          {/* Collapsible Header Toggle */}
          <button
            type="button"
            onClick={() => setDeckOpen((prev) => !prev)}
            className="flex items-center justify-between w-full border-b border-sky-500/15 pb-2.5 outline-none group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
              <span className="text-[11px] font-black tracking-widest text-sky-400/90 uppercase group-hover:text-sky-300 transition-colors">
                Tactical Viewport
              </span>
            </div>
            <span className="text-xs text-sky-400/80 font-mono font-bold transition-transform duration-300">
              {deckOpen ? "▲" : "▼"}
            </span>
          </button>

          {deckOpen && (
            <>
              {/* Active Targets Checkbox List */}
              <div className="flex flex-col gap-1.5 pt-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Targets
                </label>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {loadedModelSummaries.map((m) => {
                    const isChecked = selectedModelIds.has(m.instanceId);
                    return (
                      <label
                        key={m.instanceId}
                        onClick={() => toggleModelCheckbox(m.instanceId)}
                        className={`flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-2xl border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-sky-500/15 border-sky-500/50 text-sky-200"
                            : "bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by wrapper label
                            className="w-3.5 h-3.5 rounded accent-sky-400 cursor-pointer"
                          />
                          <span className="truncate">{m.label}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{m.heading}°</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Dual Action Dock */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={placementMode || controlsDisabled ? undefined : enterPlacementMode}
                  disabled={controlsDisabled && !placementMode}
                  className={`flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-3 rounded-2xl border transition-all ${
                    placementMode
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-300 hud-glow animate-pulse"
                      : "bg-slate-900/80 border-slate-800 text-slate-200 hover:border-sky-500/40 hover:text-sky-300"
                  }`}
                >
                  <span className="text-sm">{placementMode ? "📍" : "✦"}</span>
                  <span>{placementMode ? "Relocating..." : "Move Object"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => !controlsDisabled && setCompassOpen((v) => !v)}
                  disabled={controlsDisabled}
                  className={`flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-3 rounded-2xl border transition-all ${
                    compassOpen
                      ? "hud-chip-active hud-glow"
                      : "bg-slate-900/80 border-slate-800 text-slate-200 hover:border-sky-500/40 hover:text-sky-300"
                  }`}
                >
                  <span
                    style={{ transform: `rotate(${compassDisplayDeg}deg)` }}
                    className="inline-block transition-transform duration-300"
                  >
                    🧭
                  </span>
                  <span>Orientation</span>
                </button>
              </div>

              {/* Tactical Compass Dial with Cardinal Points & Slider */}
              {compassOpen && !controlsDisabled && (
                <div className="flex flex-col items-center gap-3 pt-3 border-t border-sky-500/15">
                  <div className="compass-dial-wrap">
                    <div className="compass-dial-ring" />
                    <div
                      className="compass-needle"
                      style={{ transform: `translate(-50%, -100%) rotate(${compassDisplayDeg}deg)` }}
                    />
                    <div className="compass-hub" />

                    {COMPASS_DIAL.map((cell) => {
                      const isActive = compassDisplayDeg === cell.deg;
                      return (
                        <button
                          key={cell.label}
                          type="button"
                          className={`compass-dial-btn ${isActive ? "is-active" : ""}`}
                          style={{ left: cell.x, top: cell.y }}
                          onClick={() => setModelHeadingForSelection(cell.deg)}
                          title={`${cell.label} — ${cell.deg}°`}
                        >
                          {cell.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-full flex items-center gap-3 px-1">
                    <input
                      type="range"
                      min={0}
                      max={359}
                      value={compassDisplayDeg}
                      onChange={(e) => setModelHeadingForSelection(Number(e.target.value))}
                      className="hud-slider flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                    <span className="text-xs font-mono font-bold text-sky-400 min-w-[32px] text-right">
                      {compassDisplayDeg}°
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── TOP-RIGHT: TACTICAL CAMERA STACK ── */}
      <div className="absolute top-5 right-5 z-20">
        <div className="hud-glass rounded-2xl p-1.5 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => rotateMap(-45)}
            title="Rotate Left 45°"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900/50 hover:bg-sky-500/20 text-sky-400 border border-slate-800 hover:border-sky-500/40 transition-all"
          >
            ⟲
          </button>
          <button
            type="button"
            onClick={() => rotateMap(45)}
            title="Rotate Right 45°"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900/50 hover:bg-sky-500/20 text-sky-400 border border-slate-800 hover:border-sky-500/40 transition-all"
          >
            ⟳
          </button>
          <div className="h-px bg-sky-500/15 my-0.5" />
          <button
            type="button"
            onClick={() => tiltMap(15)}
            title="Tilt Angle Up"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900/50 hover:bg-sky-500/20 text-sky-400 border border-slate-800 hover:border-sky-500/40 transition-all text-xs"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => tiltMap(-15)}
            title="Tilt Angle Down"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900/50 hover:bg-sky-500/20 text-sky-400 border border-slate-800 hover:border-sky-500/40 transition-all text-xs"
          >
            ▼
          </button>
        </div>
      </div>

      {/* ── BOTTOM-RIGHT: ORBIT GESTURE PILL ── */}
      <div className="absolute bottom-6 right-5 z-20">
        <button
          type="button"
          onPointerDown={startDragRotate}
          onPointerMove={moveDragRotate}
          onPointerUp={endDragRotate}
          onPointerCancel={endDragRotate}
          onLostPointerCapture={endDragRotate}
          className="hud-glass px-5 py-3 rounded-full text-xs font-bold text-slate-200 hover:text-sky-300 flex items-center gap-2.5 cursor-grab active:cursor-grabbing hover:border-sky-500/40 transition-all shadow-2xl"
        >
          <span className="text-sky-400 text-sm animate-pulse">↔</span> Drag to Orbit 360°
        </button>
      </div>

      {/* ── PROPERTY METRICS POPUP ── */}
      {propertyPopup && (
        <div
          className="hud-glass absolute z-30 w-64 rounded-3xl p-4 pointer-events-none transition-all duration-200"
          style={{
            left: Math.min(propertyPopup.x + 16, window.innerWidth - 280),
            top: Math.min(propertyPopup.y + 16, window.innerHeight - 200),
          }}
        >
          <div className="text-[9px] font-black tracking-widest text-sky-400 uppercase mb-1">
            {propertyPopup.meshName}
          </div>
          <div className="text-base font-extrabold text-slate-100 mb-2">
            {propertyPopup.details.name}
          </div>
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Class</span>
              <span className="font-semibold text-slate-200">{propertyPopup.details.bhk}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Footprint</span>
              <span className="font-semibold text-slate-200">{propertyPopup.details.area} sq ft</span>
            </div>
            <div className="mt-3 p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valuation</span>
              <span className="text-sky-400 font-black text-sm">{propertyPopup.details.price}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── THREE.JS Google Map Container ── */}
      <div
        ref={mapDiv}
        onClick={handleScenePick}
        className={`w-full h-full ${placementMode ? "cursor-crosshair" : "cursor-default"}`}
      />

      {/* Secondary Overlay Canvas */}
      {viewerModel && (
        <ModelViewerOverlay
          model={viewerModel}
          onBack={() => setViewerModel(null)}
        />
      )}
    </div>
  );
}
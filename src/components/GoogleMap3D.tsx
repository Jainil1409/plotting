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
import { MapHotspotConfig } from "@/src/types/hotspot";
import { getInitialModelConfigs, getModelDefinition } from "@/src/data/models";

import ModelViewerOverlay from "@/src/components/ModelViewerOverlay";
import Box from "@mui/material/Box";

import {
  DEFAULT_MODEL_CONFIG,
  DEFAULT_ANCHOR,
  MODEL_HEADING,
  MIN_INTERACTION_ZOOM,
  cloneModelConfig,
  createInitialModelConfigMap,
  ModelSummary,
} from "@/src/components/googleMap3d/googleMap3dConfig";
import { loadGoogleMaps } from "@/src/components/googleMap3d/loadGoogleMaps";
import MiniRailSidebar from "@/src/components/googleMap3d/MiniRailSidebar";
import ExpandedDrawer, { DrawerModelSummary } from "@/src/components/googleMap3d/ExpandedDrawer";
import MapControls from "@/src/components/googleMap3d/MapControls";
import PropertyPopupView from "@/src/components/googleMap3d/PropertyPopup";

export default function GoogleMap3D() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const rendererRef = useRef<GoogleMapsThreeRenderer | null>(null);
  const modelManagerRef = useRef(new ModelManager());
  const hotspotManagerRef = useRef(new HotspotManager());
  const interactionManagerRef = useRef<ModelInteractionManager | null>(null);

  const currentModelRef = useRef<LoadedModel | null>(null);
  const activeModelInstanceIdRef = useRef<string>(DEFAULT_MODEL_CONFIG.instanceId);
  const modelConfigsRef = useRef<Map<string, ModelConfig>>(createInitialModelConfigMap());
  const clockRef = useRef(new THREE.Timer());

  const anchorRef = useRef<{ lat: number; lng: number; altitude: number } | null>(DEFAULT_ANCHOR);
  const placementListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const modelConfigRef = useRef<ModelConfig | null>(cloneModelConfig(DEFAULT_MODEL_CONFIG));
  const [, setModelConfig] = useState<ModelConfig | null>(() => cloneModelConfig(DEFAULT_MODEL_CONFIG));
  const [placementMode, setPlacementMode] = useState(false);
  const placementModeRef = useRef(false);

  const [hotspotPlacementMode, setHotspotPlacementMode] = useState(false);
  const hotspotPlacementModeRef = useRef(false);
  const [hotspotNextModelId, setHotspotNextModelId] = useState<string>(DEFAULT_MODEL_CONFIG.modelId);
  const hotspotNextModelIdRef = useRef<string>(DEFAULT_MODEL_CONFIG.modelId);
  useEffect(() => { hotspotNextModelIdRef.current = hotspotNextModelId; }, [hotspotNextModelId]);

  const createdHotspotsRef = useRef<MapHotspotConfig[]>([]);
  const [createdHotspots, setCreatedHotspots] = useState<MapHotspotConfig[]>([]);
  const lastCreatedHotspotIdRef = useRef<string | null>(null);

  const [hotspotEditMode, setHotspotEditMode] = useState(false);
  const hotspotEditModeRef = useRef(false);
  const [editingHotspotId, setEditingHotspotId] = useState<string | null>(null);
  const [editingHotspotLink, setEditingHotspotLink] = useState<string>(DEFAULT_MODEL_CONFIG.modelId);
  const editingHotspotLinkRef = useRef<string>(DEFAULT_MODEL_CONFIG.modelId);
  useEffect(() => { editingHotspotLinkRef.current = editingHotspotLink; }, [editingHotspotLink]);

  const [propertyPopup, setPropertyPopup] = useState<PropertyPopup | null>(null);
  const [, setModelHeadingDeg] = useState(MODEL_HEADING);
  const [compassOpen, setCompassOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);

  const [loadedModelSummaries, setLoadedModelSummaries] = useState<ModelSummary[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const selectedModelIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { selectedModelIdsRef.current = selectedModelIds; }, [selectedModelIds]);

  const [viewerModel, setViewerModel] = useState<ModelDefinition | null>(null);

  const [mapZoom, setMapZoom] = useState(18);
  const mapZoomRef = useRef(18);
  const modelMarkersRef = useRef<google.maps.Marker[]>([]);

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
    modelConfigsRef.current = new Map(initialConfigs.map((config) => [config.instanceId, config]));
    modelConfigRef.current = modelConfigsRef.current.get(activeModelInstanceIdRef.current) ?? initialConfigs[0] ?? null;
    setModelConfig(modelConfigRef.current);
    setModelHeadingDeg(modelConfigRef.current?.heading ?? MODEL_HEADING);

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

      map.addListener("zoom_changed", () => {
        const zoom = map.getZoom() ?? 18;
        mapZoomRef.current = zoom;
        setMapZoom(zoom);
        const showMarkers = zoom < MIN_INTERACTION_ZOOM;
        modelMarkersRef.current.forEach((marker) => marker.setVisible(showMarkers));
      });

      const renderer = new GoogleMapsThreeRenderer();
      renderer.setAnchor(DEFAULT_ANCHOR);
      renderer.setOnDraw(() => {
        clockRef.current.update();
        const t = clockRef.current.getElapsed();
        hotspotManager.update(t);
      });
      renderer.attachToMap(map);
      rendererRef.current = renderer;

      interactionManagerRef.current = new ModelInteractionManager([], PROPERTY_DETAILS);

      const sceneAnchor = anchorRef.current ?? DEFAULT_ANCHOR;
      const loadedModels: LoadedModel[] = [];

      for (const config of initialConfigs) {
        const loaded = await modelManager.loadModel(config);
        if (canceled) { modelManager.dispose(loaded); return; }

        modelManager.setAnchor(loaded, config.anchor, sceneAnchor);
        modelManager.addModel(renderer.scene, loaded);
        loadedModels.push(loaded);

        const marker = new g.maps.Marker({
          position: { lat: config.anchor.lat, lng: config.anchor.lng },
          map,
          visible: false,
          title: config.label,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#0284c7"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
            ),
            scaledSize: new g.maps.Size(32, 32),
            anchor: new g.maps.Point(16, 32),
          },
        });
        modelMarkersRef.current.push(marker);

        // Log the loaded model's structural details.
        const box = new THREE.Box3().setFromObject(loaded.model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        console.log("Bounding Box:", box);
        console.log("Size:", size);
        console.log("Center:", center);
        loaded.model.traverse((child) => console.log(child.name, child.type));

        const modelHotspots = HOTSPOTS[config.hotspotSetId] ?? [];
        for (const hotspotConfig of modelHotspots) {
          const hotspot = hotspotManager.createHotspot(hotspotConfig);
          hotspotManager.attachHotspot(loaded.pivot, hotspot);
        }
      }

      currentModelRef.current = modelManager.getModel(activeModelInstanceIdRef.current) ?? loadedModels[0] ?? null;

      setLoadedModelSummaries(loadedModels.map((m) => ({
        instanceId: m.instanceId,
        label: m.config.label ?? m.instanceId,
        heading: m.config.heading,
      })));

      const defaultSelection = new Set<string>();
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
      modelMarkersRef.current.forEach((marker) => marker.setMap(null));
      modelMarkersRef.current = [];
      rendererRef.current?.dispose();
      rendererRef.current = null;
      mapRef.current = null;
      anchorRef.current = null;
      interactionManagerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleModelCheckbox = (instanceId: string) => {
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const exitPlacementMode = () => {
    if (placementListenerRef.current) {
      window.google?.maps?.event?.removeListener(placementListenerRef.current);
      placementListenerRef.current = null;
    }
    placementModeRef.current = false;
    setPlacementMode(false);
  };

  const togglePlacementMode = () => {
    if (placementMode) { exitPlacementMode(); return; }
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
        const anchor = { lat: start.lat + deltaLat, lng: start.lng + deltaLng, altitude: start.altitude };
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
      if (placementListener) window.google.maps.event.removeListener(placementListener);
      placementListenerRef.current = null;
      placementModeRef.current = false;
      setPlacementMode(false);
    });
  };

  const getHotspotSourceLabel = (hotspot: MapHotspotConfig) =>
    loadedModelSummaries.find((m) => m.instanceId === hotspot.modelInstanceId)?.label ?? hotspot.modelInstanceId;

  const getHotspotTargetLabel = (hotspot: MapHotspotConfig) =>
    getModelDefinition(hotspot.nextModelId)?.label ?? hotspot.nextModelId;

  const beginEditHotspot = (hotspot: MapHotspotConfig) => {
    if (placementListenerRef.current) {
      window.google?.maps?.event?.removeListener(placementListenerRef.current);
      placementListenerRef.current = null;
    }
    placementModeRef.current = false;
    hotspotPlacementModeRef.current = false;
    hotspotEditModeRef.current = true;
    setPlacementMode(false);
    setHotspotPlacementMode(false);
    setHotspotEditMode(true);
    setEditingHotspotId(hotspot.id);
    setEditingHotspotLink(hotspot.nextModelId);
  };

  const updateCreatedHotspotLink = (hotspotId: string, nextModelId: string) => {
    hotspotManagerRef.current.updateHotspotLink(hotspotId, nextModelId);
    setCreatedHotspots((prev) => prev.map((h) => (h.id === hotspotId ? { ...h, nextModelId } : h)));
    createdHotspotsRef.current = createdHotspotsRef.current.map((h) => (h.id === hotspotId ? { ...h, nextModelId } : h));
    if (editingHotspotId === hotspotId) setEditingHotspotLink(nextModelId);
    rendererRef.current?.requestRedraw();
  };

  const deleteCreatedHotspot = (hotspotId: string) => {
    const manager = hotspotManagerRef.current as HotspotManager & { removeHotspot?: (id: string) => void };
    manager.removeHotspot?.(hotspotId);
    createdHotspotsRef.current = createdHotspotsRef.current.filter((h) => h.id !== hotspotId);
    setCreatedHotspots((prev) => prev.filter((h) => h.id !== hotspotId));
    if (lastCreatedHotspotIdRef.current === hotspotId) {
      lastCreatedHotspotIdRef.current = createdHotspotsRef.current.at(-1)?.id ?? null;
    }
    if (editingHotspotId === hotspotId) {
      setEditingHotspotId(null);
      setHotspotEditMode(false);
      hotspotEditModeRef.current = false;
    }
    rendererRef.current?.requestRedraw();
  };

  const enterHotspotPlacementMode = () => {
    if (placementListenerRef.current) {
      window.google.maps.event.removeListener(placementListenerRef.current);
      placementListenerRef.current = null;
    }
    placementModeRef.current = false;
    setPlacementMode(false);
    hotspotPlacementModeRef.current = true;
    setHotspotPlacementMode(true);
  };

  const exitHotspotPlacementMode = () => {
    hotspotPlacementModeRef.current = false;
    setHotspotPlacementMode(false);
  };

  const exitHotspotEditMode = () => {
    hotspotEditModeRef.current = false;
    setHotspotEditMode(false);
    setEditingHotspotId(null);
  };

  const handleScenePick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (placementModeRef.current) return;
    if (mapZoomRef.current < MIN_INTERACTION_ZOOM) return;
    const renderer = rendererRef.current;
    const mapElement = mapDiv.current;
    if (!renderer || !mapElement) return;

    const nativeEvent = event.nativeEvent;
    const camera = renderer.camera;

    if (event.altKey && currentModelRef.current) {
      const local = interactionManagerRef.current?.calibrateLocalPosition(nativeEvent, camera, currentModelRef.current.pivot, mapElement);
      if (local) console.info("Calibration position:", [local.x, local.y, local.z]);
      return;
    }

    const hotspot = hotspotManagerRef.current.pickHotspotAt(nativeEvent, camera, mapElement);
    if (hotspot) {
      if (hotspotEditModeRef.current) {
        setEditingHotspotId(hotspot.id);
        setEditingHotspotLink(hotspot.nextModelId);
        return;
      }
      const nextModel = getModelDefinition(hotspot.nextModelId);
      if (nextModel) setViewerModel(nextModel);
      return;
    }

    if (hotspotPlacementModeRef.current) {
      const selectedIds = Array.from(selectedModelIdsRef.current);
      const candidates = selectedIds.length > 0
        ? selectedIds.map((id) => modelManagerRef.current.getModel(id)).filter((m): m is LoadedModel => m !== null)
        : modelManagerRef.current.getAllModels();

      let target: LoadedModel | null = null;
      let local: THREE.Vector3 | null = null;
      for (const candidate of candidates) {
        const hit = interactionManagerRef.current?.calibrateLocalPosition(nativeEvent, camera, candidate.pivot, mapElement);
        if (hit) { target = candidate; local = hit; break; }
      }
      if (!target || !local) return;

      const id = typeof window !== "undefined" ? `map-hotspot-${Date.now()}` : `map-hotspot-${Math.floor(Math.random() * 1e9)}`;
      const newHotspot: MapHotspotConfig = {
        id,
        modelInstanceId: target.instanceId,
        position: { x: local.x, y: local.y, z: local.z },
        nextModelId: hotspotNextModelIdRef.current,
      };
      const handle = hotspotManagerRef.current.createHotspot(newHotspot);
      hotspotManagerRef.current.attachHotspot(target.pivot, handle);
      clockRef.current.update();
      hotspotManagerRef.current.update(clockRef.current.getElapsed());

      createdHotspotsRef.current = [...createdHotspotsRef.current, newHotspot];
      setCreatedHotspots((prev) => [...prev, newHotspot]);
      lastCreatedHotspotIdRef.current = id;
      renderer.requestRedraw();
      return;
    }

    const pickedInfo = interactionManagerRef.current?.pickMeshName(nativeEvent, camera, mapElement);
    if (pickedInfo) {
      console.log("Clicked on mesh/object:", pickedInfo.meshName, "of model:", pickedInfo.modelInstanceId || pickedInfo.modelId || "unknown");
    }

    const result = interactionManagerRef.current?.handleClick(nativeEvent, camera, mapElement);
    if (result?.type === "property") setPropertyPopup(result.popup);
    else setPropertyPopup(null);
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
    dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startHeading: map.getHeading?.() ?? 0, dragging: true };
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
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
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
  const headingsMatch = selectedSummaries.length > 0 && selectedSummaries.every((m) => m.heading === selectedSummaries[0].heading);
  const compassDisplayDeg = selectedSummaries.length === 0 ? 0 : headingsMatch ? selectedSummaries[0].heading : 0;
  const controlsDisabled = selectedModelIds.size === 0;

  const drawerSummaries: DrawerModelSummary[] = loadedModelSummaries.map((m) => ({
    ...m,
    isChecked: selectedModelIds.has(m.instanceId),
  }));

  return (
    <Box
      className="spatial-ui-root"
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        bgcolor: "#f4f6f9",
        color: "#1e293b",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: "none",
      }}
    >
      {!viewerModel && (
        <>
          <MiniRailSidebar
            deckOpen={deckOpen}
            selectedCount={selectedModelIds.size}
            placementMode={placementMode}
            compassOpen={compassOpen}
            hotspotPlacementMode={hotspotPlacementMode}
            controlsDisabled={controlsDisabled}
            onToggleDeck={() => setDeckOpen((v) => !v)}
            onOpenDeck={() => setDeckOpen(true)}
            onTogglePlacement={() => { setDeckOpen(true); togglePlacementMode(); }}
            onToggleCompass={() => { setDeckOpen(true); setCompassOpen((v) => !v); }}
            onToggleHotspotPlacement={() => { setDeckOpen(true); if (!hotspotPlacementMode) enterHotspotPlacementMode(); }}
          />

          <ExpandedDrawer
            deckOpen={deckOpen}
            onCloseDeck={() => setDeckOpen(false)}
            modelSummaries={drawerSummaries}
            onToggleModel={toggleModelCheckbox}
            placementMode={placementMode}
            controlsDisabled={controlsDisabled}
            onTogglePlacement={togglePlacementMode}
            compassOpen={compassOpen}
            onToggleCompass={() => setCompassOpen((v) => !v)}
            compassDisplayDeg={compassDisplayDeg}
            onHeadingChange={setModelHeadingForSelection}
            hotspotPlacementMode={hotspotPlacementMode}
            onToggleHotspotPlacement={enterHotspotPlacementMode}
            onExitHotspotPlacement={exitHotspotPlacementMode}
            hotspotNextModelId={hotspotNextModelId}
            onHotspotNextModelChange={(id) => {
              setHotspotNextModelId(id);
              if (lastCreatedHotspotIdRef.current) updateCreatedHotspotLink(lastCreatedHotspotIdRef.current, id);
            }}
            createdHotspots={createdHotspots}
            editingHotspotId={editingHotspotId}
            onEditHotspot={beginEditHotspot}
            onUpdateHotspotLink={updateCreatedHotspotLink}
            onDeleteHotspot={deleteCreatedHotspot}
            onExitHotspotEdit={exitHotspotEditMode}
            getHotspotSourceLabel={getHotspotSourceLabel}
            getHotspotTargetLabel={getHotspotTargetLabel}
          />
        </>
      )}

      <MapControls
        onRotateMap={rotateMap}
        onTiltMap={tiltMap}
        onPointerDownRotate={startDragRotate}
        onPointerMoveRotate={moveDragRotate}
        onPointerUpRotate={endDragRotate}
        onPointerCancelRotate={endDragRotate}
        onLostPointerCaptureRotate={endDragRotate}
      />

      {propertyPopup && (
        <PropertyPopupView
          popup={{
            x: propertyPopup.x,
            y: propertyPopup.y,
            meshName: propertyPopup.meshName,
            details: propertyPopup.details,
          }}
        />
      )}

      <Box
        ref={mapDiv}
        onClick={handleScenePick}
        sx={{ width: "100%", height: "100%", cursor: placementMode || hotspotPlacementMode ? "crosshair" : "default" }}
      />

      {viewerModel && <ModelViewerOverlay model={viewerModel} onBack={() => setViewerModel(null)} />}
    </Box>
  );
}

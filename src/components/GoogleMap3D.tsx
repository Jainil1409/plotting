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
import {
  DEFAULT_MODEL_INSTANCE_ID,
  MODELS,
  getInitialModelConfigs,
  getModelConfig,
  getModelDefinition,
} from "@/src/data/models";

import ModelViewerOverlay from "@/src/components/ModelViewerOverlay";

import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";

import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import ExploreIcon from "@mui/icons-material/Explore";
import LinkIcon from "@mui/icons-material/Link";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import LayersIcon from "@mui/icons-material/Layers";
import TuneIcon from "@mui/icons-material/Tune";

const GOOGLE_MAPS_API_KEY = "AIzaSyBCswT9ODeUU9ByGUjbRg1KzV-nUF3BFkU"; // demo key

const defaultModelConfig = getModelConfig(DEFAULT_MODEL_INSTANCE_ID);
if (!defaultModelConfig) {
  throw new Error(`Missing default model instance: ${DEFAULT_MODEL_INSTANCE_ID}`);
}

const DEFAULT_MODEL_CONFIG: ModelConfig = defaultModelConfig;
const DEFAULT_ANCHOR = DEFAULT_MODEL_CONFIG.anchor;
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

  const [hotspotPlacementMode, setHotspotPlacementMode] = useState(false);
  const hotspotPlacementModeRef = useRef(false);
  const [hotspotNextModelId, setHotspotNextModelId] = useState<string>(
    DEFAULT_MODEL_CONFIG.modelId
  );
  const hotspotNextModelIdRef = useRef<string>(DEFAULT_MODEL_CONFIG.modelId);
  useEffect(() => {
    hotspotNextModelIdRef.current = hotspotNextModelId;
  }, [hotspotNextModelId]);

  const createdHotspotsRef = useRef<MapHotspotConfig[]>([]);
  const [createdHotspots, setCreatedHotspots] = useState<MapHotspotConfig[]>([]);
  const lastCreatedHotspotIdRef = useRef<string | null>(null);

  const [hotspotEditMode, setHotspotEditMode] = useState(false);
  const hotspotEditModeRef = useRef(false);
  const [editingHotspotId, setEditingHotspotId] = useState<string | null>(null);
  const [editingHotspotLink, setEditingHotspotLink] = useState<string>(
    DEFAULT_MODEL_CONFIG.modelId
  );
  const editingHotspotLinkRef = useRef<string>(DEFAULT_MODEL_CONFIG.modelId);
  useEffect(() => {
    editingHotspotLinkRef.current = editingHotspotLink;
  }, [editingHotspotLink]);

  const [propertyPopup, setPropertyPopup] = useState<PropertyPopup | null>(null);
  const [, setModelHeadingDeg] = useState(MODEL_HEADING);
  const [compassOpen, setCompassOpen] = useState(false);

  // Expanded sidebar is CLOSED on initial website run
  const [deckOpen, setDeckOpen] = useState(false);

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

  const exitPlacementMode = () => {
    if (placementListenerRef.current) {
      window.google?.maps?.event?.removeListener(placementListenerRef.current);
      placementListenerRef.current = null;
    }
    placementModeRef.current = false;
    setPlacementMode(false);
  };

  const togglePlacementMode = () => {
    // If already in placement mode, clicking again exits placement mode
    if (placementMode) {
      exitPlacementMode();
      return;
    }

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

  const getHotspotSourceLabel = (hotspot: MapHotspotConfig) =>
    loadedModelSummaries.find((model) => model.instanceId === hotspot.modelInstanceId)?.label ??
    hotspot.modelInstanceId;

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

    setCreatedHotspots((prev) =>
      prev.map((hotspot) =>
        hotspot.id === hotspotId ? { ...hotspot, nextModelId } : hotspot
      )
    );

    createdHotspotsRef.current = createdHotspotsRef.current.map((hotspot) =>
      hotspot.id === hotspotId ? { ...hotspot, nextModelId } : hotspot
    );

    if (editingHotspotId === hotspotId) {
      setEditingHotspotLink(nextModelId);
    }

    rendererRef.current?.requestRedraw();
  };

  const deleteCreatedHotspot = (hotspotId: string) => {
    const manager = hotspotManagerRef.current as HotspotManager & {
      removeHotspot?: (id: string) => void;
    };
    manager.removeHotspot?.(hotspotId);

    createdHotspotsRef.current = createdHotspotsRef.current.filter(
      (hotspot) => hotspot.id !== hotspotId
    );
    setCreatedHotspots((prev) => prev.filter((hotspot) => hotspot.id !== hotspotId));

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
      const candidates =
        selectedIds.length > 0
          ? selectedIds
              .map((id) => modelManagerRef.current.getModel(id))
              .filter((m): m is LoadedModel => m !== null)
          : modelManagerRef.current.getAllModels();

      let target: LoadedModel | null = null;
      let local: THREE.Vector3 | null = null;

      for (const candidate of candidates) {
        const hit = interactionManagerRef.current?.calibrateLocalPosition(
          nativeEvent,
          camera,
          candidate.pivot,
          mapElement
        );
        if (hit) {
          target = candidate;
          local = hit;
          break;
        }
      }

      if (!target || !local) return;

      const id =
        typeof window !== "undefined"
          ? `map-hotspot-${Date.now()}`
          : `map-hotspot-${Math.floor(Math.random() * 1e9)}`;

      const newHotspot: MapHotspotConfig = {
        id,
        modelInstanceId: target.instanceId,
        position: { x: local.x, y: local.y, z: local.z },
        nextModelId: hotspotNextModelIdRef.current,
      };

      const handle = hotspotManagerRef.current.createHotspot(newHotspot);
      hotspotManagerRef.current.attachHotspot(target.pivot, handle);
      hotspotManagerRef.current.update(
        clockRef.current.getElapsedTime()
      );

      createdHotspotsRef.current = [...createdHotspotsRef.current, newHotspot];
      setCreatedHotspots((prev) => [...prev, newHotspot]);
      lastCreatedHotspotIdRef.current = id;

      renderer.requestRedraw();
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
      {/* Sidebars only show when viewer overlay is NOT open */}
      {!viewerModel && (
        <>
          {/* ── GOOGLE MAPS STYLE MINI RAIL SIDEBAR ── */}
          <Paper
            elevation={4}
            sx={{
              position: "absolute",
              top: 16,
              left: 16,
              zIndex: 1300,
              width: 58,
              height: "calc(100% - 32px)",
              borderRadius: 3,
              bgcolor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 2.5,
              boxShadow: "0 8px 32px rgba(15, 23, 42, 0.12)",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Toggle Menu Button */}
            <Tooltip title={deckOpen ? "Collapse Sidebar" : "Expand Sidebar"} placement="right">
              <IconButton
                onClick={() => setDeckOpen((prev) => !prev)}
                sx={{
                  width: 42,
                  height: 42,
                  bgcolor: deckOpen ? "#0284c7" : "#f1f5f9",
                  color: deckOpen ? "#ffffff" : "#0f172a",
                  "&:hover": {
                    bgcolor: deckOpen ? "#0369a1" : "#e2e8f0",
                  },
                  transition: "all 0.2s ease",
                }}
              >
                {deckOpen ? <ChevronLeftIcon /> : <MenuIcon />}
              </IconButton>
            </Tooltip>

            <Divider sx={{ width: 32, borderColor: "#e2e8f0", my: 2.5 }} />

            {/* Quick Action Icons */}
            <Stack spacing={3.5} sx={{ alignItems: "center" }}>
              <Tooltip title="Target Models" placement="right">
                <IconButton
                  onClick={() => setDeckOpen(true)}
                  sx={{
                    width: 42,
                    height: 42,
                    color: selectedModelIds.size > 0 ? "#0284c7" : "#64748b",
                    bgcolor: selectedModelIds.size > 0 ? "#e0f2fe" : "transparent",
                    "&:hover": { bgcolor: "#f1f5f9" },
                  }}
                >
                  <LayersIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Move Object" placement="right">
                <IconButton
                  disabled={controlsDisabled}
                  onClick={() => {
                    setDeckOpen(true);
                    togglePlacementMode();
                  }}
                  sx={{
                    width: 42,
                    height: 42,
                    color: placementMode ? "#d97706" : "#64748b",
                    bgcolor: placementMode ? "#fef3c7" : "transparent",
                    "&:hover": { bgcolor: "#f1f5f9" },
                  }}
                >
                  <OpenWithIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Orientation Controls" placement="right">
                <IconButton
                  disabled={controlsDisabled}
                  onClick={() => {
                    setDeckOpen(true);
                    setCompassOpen((v) => !v);
                  }}
                  sx={{
                    width: 42,
                    height: 42,
                    color: compassOpen ? "#0284c7" : "#64748b",
                    bgcolor: compassOpen ? "#e0f2fe" : "transparent",
                    "&:hover": { bgcolor: "#f1f5f9" },
                  }}
                >
                  <TuneIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Hotspots Operations" placement="right">
                <IconButton
                  disabled={controlsDisabled}
                  onClick={() => {
                    setDeckOpen(true);
                    if (!hotspotPlacementMode) enterHotspotPlacementMode();
                  }}
                  sx={{
                    width: 42,
                    height: 42,
                    color: hotspotPlacementMode ? "#0284c7" : "#64748b",
                    bgcolor: hotspotPlacementMode ? "#e0f2fe" : "transparent",
                    "&:hover": { bgcolor: "#f1f5f9" },
                  }}
                >
                  <AddLocationIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
            </Stack>

            <Box sx={{ flexGrow: 1 }} />

            {/* Active Target Count Badge */}
            <Tooltip title={`${selectedModelIds.size} Models Selected`} placement="right">
              <Chip
                label={selectedModelIds.size}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: 11,
                  bgcolor: "#0284c7",
                  color: "#ffffff",
                  height: 26,
                  minWidth: 26,
                }}
              />
            </Tooltip>
          </Paper>

          {/* ── EXPANDED DETAIL SIDEBAR DRAWER ── */}
          <Drawer
            anchor="left"
            variant="persistent"
            open={deckOpen}
            sx={{
              "& .MuiDrawer-paper": {
                position: "absolute",
                top: 16,
                left: 86,
                width: 380,
                height: "calc(100% - 32px)",
                borderRadius: 3,
                boxSizing: "border-box",
                border: "1px solid #e2e8f0",
                bgcolor: "#ffffff",
                color: "#0f172a",
                boxShadow: "0 12px 36px rgba(15, 23, 42, 0.14)",
                overflow: "hidden",
                zIndex: 1250,
              },
            }}
          >
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#ffffff" }}>
              {/* Header */}
              <Box
                sx={{
                  p: 3,
                  pb: 2.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 800,
                      fontSize: 18,
                      letterSpacing: "-0.01em",
                      color: "#0f172a",
                      lineHeight: 1.2,
                    }}
                  >
                    Plotting Viewport
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#64748b",
                      mt: 0.6,
                      display: "block",
                    }}
                  >
                    Model Control & Hotspot Operations
                  </Typography>
                </Box>

                <Tooltip title="Collapse Side Panel">
                  <IconButton
                    size="small"
                    onClick={() => setDeckOpen(false)}
                    sx={{
                      color: "#64748b",
                      bgcolor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      "&:hover": { bgcolor: "#f1f5f9", color: "#0f172a" },
                    }}
                  >
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Scrollable Content */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  p: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3.5,
                  "&::-webkit-scrollbar": { width: 6 },
                  "&::-webkit-scrollbar-track": { bgcolor: "#f8fafc" },
                  "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: 3 },
                }}
              >
                {/* SECTION 1: Active Targets */}
                <Stack spacing={1.5}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography
                      variant="overline"
                      sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: "#475569",
                        textTransform: "uppercase",
                      }}
                    >
                      Active Targets
                    </Typography>
                    <Chip
                      size="small"
                      label={`${selectedModelIds.size} ACTIVE`}
                      sx={{
                        height: 22,
                        fontSize: 10,
                        fontWeight: 800,
                        bgcolor: selectedModelIds.size ? "#e0f2fe" : "#f1f5f9",
                        color: selectedModelIds.size ? "#0369a1" : "#64748b",
                      }}
                    />
                  </Box>

                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 2.5,
                      borderColor: "#e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    <List disablePadding>
                      {loadedModelSummaries.map((m, index) => {
                        const isChecked = selectedModelIds.has(m.instanceId);
                        return (
                          <ListItemButton
                            key={m.instanceId}
                            onClick={() => toggleModelCheckbox(m.instanceId)}
                            sx={{
                              py: 1.5,
                              px: 2,
                              borderBottom: index < loadedModelSummaries.length - 1 ? "1px solid #f1f5f9" : "none",
                              bgcolor: isChecked ? "#f0f9ff" : "transparent",
                              "&:hover": { bgcolor: isChecked ? "#e0f2fe" : "#f8fafc" },
                            }}
                          >
                            <Checkbox
                              checked={isChecked}
                              tabIndex={-1}
                              disableRipple
                              size="small"
                              sx={{
                                p: 0,
                                mr: 1.75,
                                color: "#cbd5e1",
                                "&.Mui-checked": { color: "#0284c7" },
                              }}
                            />

                            <ListItemText
                              primary={m.label}
                              secondary={`Heading: ${Math.round(m.heading)}°`}
                              slotProps={{
                                primary: {
                                  sx: {
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: isChecked ? "#0369a1" : "#1e293b",
                                  },
                                },
                                secondary: {
                                  sx: {
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: "#64748b",
                                    mt: 0.25,
                                  },
                                },
                              }}
                            />

                            {isChecked && (
                              <Chip
                                label="ACTIVE"
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: "#0284c7",
                                  bgcolor: "#e0f2fe",
                                }}
                              />
                            )}
                          </ListItemButton>
                        );
                      })}
                    </List>
                  </Paper>
                </Stack>

                <Divider sx={{ borderColor: "#f1f5f9" }} />

                {/* SECTION 2: Model Controls */}
                <Stack spacing={1.75}>
                  <Box>
                    <Typography
                      variant="overline"
                      sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: "#475569",
                        textTransform: "uppercase",
                      }}
                    >
                      Model Controls
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: 12, color: "#64748b", mt: 0.3 }}>
                      Position and orient active models on map
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1.5}>
                    <Button
                      fullWidth
                      variant={placementMode ? "contained" : "outlined"}
                      disabled={controlsDisabled && !placementMode}
                      onClick={togglePlacementMode}
                      startIcon={<OpenWithIcon />}
                      sx={{
                        py: 1.4,
                        borderRadius: 2.5,
                        textTransform: "none",
                        fontSize: 12,
                        fontWeight: 700,
                        borderColor: placementMode ? "#d97706" : "#cbd5e1",
                        bgcolor: placementMode ? "#d97706" : "#ffffff",
                        color: placementMode ? "#ffffff" : "#334155",
                        "&:hover": {
                          borderColor: placementMode ? "#b45309" : "#0284c7",
                          bgcolor: placementMode ? "#b45309" : "#f0f9ff",
                        },
                      }}
                    >
                      {placementMode ? "Relocating" : "Move Object"}
                    </Button>

                    <Button
                      fullWidth
                      variant={compassOpen ? "contained" : "outlined"}
                      disabled={controlsDisabled}
                      onClick={() => !controlsDisabled && setCompassOpen((v) => !v)}
                      startIcon={
                        <ExploreIcon
                          sx={{
                            transform: `rotate(${compassDisplayDeg}deg)`,
                            transition: "transform 0.2s ease",
                          }}
                        />
                      }
                      sx={{
                        py: 1.4,
                        borderRadius: 2.5,
                        textTransform: "none",
                        fontSize: 12,
                        fontWeight: 700,
                        borderColor: compassOpen ? "#0284c7" : "#cbd5e1",
                        bgcolor: compassOpen ? "#0284c7" : "#ffffff",
                        color: compassOpen ? "#ffffff" : "#334155",
                        "&:hover": {
                          borderColor: "#0284c7",
                          bgcolor: compassOpen ? "#0369a1" : "#f0f9ff",
                        },
                      }}
                    >
                      Orientation
                    </Button>
                  </Stack>

                  {/* Slider / Preset Buttons */}
                  {compassOpen && !controlsDisabled && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2.25,
                        borderRadius: 2.5,
                        borderColor: "#e2e8f0",
                        bgcolor: "#f8fafc",
                        mt: 0.5,
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                          HEADING
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontSize: 16, fontWeight: 800, color: "#0284c7" }}>
                          {Math.round(compassDisplayDeg)}°
                        </Typography>
                      </Box>

                      <Slider
                        value={compassDisplayDeg}
                        min={0}
                        max={359}
                        onChange={(_, value) => setModelHeadingForSelection(value as number)}
                        sx={{
                          color: "#0284c7",
                          py: 1.25,
                          "& .MuiSlider-thumb": { width: 18, height: 18 },
                        }}
                      />

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        {[0, 90, 180, 270].map((deg) => (
                          <Button
                            key={deg}
                            size="small"
                            fullWidth
                            onClick={() => setModelHeadingForSelection(deg)}
                            sx={{
                              py: 0.6,
                              borderRadius: 1.5,
                              color: "#475569",
                              fontSize: 10,
                              fontWeight: 700,
                              bgcolor: "#ffffff",
                              border: "1px solid #cbd5e1",
                              "&:hover": { bgcolor: "#e0f2fe", borderColor: "#38bdf8", color: "#0284c7" },
                            }}
                          >
                            {deg === 0 ? "N 0°" : deg === 90 ? "E 90°" : deg === 180 ? "S 180°" : "W 270°"}
                          </Button>
                        ))}
                      </Stack>
                    </Paper>
                  )}
                </Stack>

                <Divider sx={{ borderColor: "#f1f5f9" }} />

                {/* SECTION 3: Hotspot Editor */}
                <Stack spacing={1.75}>
                  <Box>
                    <Typography
                      variant="overline"
                      sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: "#475569",
                        textTransform: "uppercase",
                      }}
                    >
                      Hotspot Editor
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: 12, color: "#64748b", mt: 0.3 }}>
                      Add interactive hotspots linking to target models
                    </Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant={hotspotPlacementMode ? "contained" : "outlined"}
                    disabled={controlsDisabled && !hotspotPlacementMode}
                    onClick={
                      hotspotPlacementMode
                        ? exitHotspotPlacementMode
                        : placementMode || controlsDisabled
                        ? undefined
                        : enterHotspotPlacementMode
                    }
                    startIcon={<AddLocationIcon />}
                    sx={{
                      py: 1.4,
                      borderRadius: 2.5,
                      textTransform: "none",
                      fontSize: 12,
                      fontWeight: 700,
                      color: hotspotPlacementMode ? "#ffffff" : "#0284c7",
                      bgcolor: hotspotPlacementMode ? "#0284c7" : "#ffffff",
                      borderColor: hotspotPlacementMode ? "#0284c7" : "#38bdf8",
                      "&:hover": {
                        bgcolor: hotspotPlacementMode ? "#0369a1" : "#f0f9ff",
                        borderColor: "#0284c7",
                      },
                    }}
                  >
                    {hotspotPlacementMode ? "Click Model to Place Hotspot" : "Add Hotspot"}
                  </Button>

                  {hotspotPlacementMode && (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, borderColor: "#e2e8f0", bgcolor: "#f8fafc" }}>
                      <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: "#475569", mb: 1, display: "block" }}>
                        LINKS TO MODEL
                      </Typography>

                      <FormControl fullWidth size="small">
                        <Select
                          value={hotspotNextModelId}
                          onChange={(e) => {
                            const next = e.target.value;
                            setHotspotNextModelId(next);
                            if (lastCreatedHotspotIdRef.current) {
                              updateCreatedHotspotLink(lastCreatedHotspotIdRef.current, next);
                            }
                          }}
                          sx={{
                            borderRadius: 1.5,
                            bgcolor: "#ffffff",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {Object.values(MODELS).map((model) => (
                            <MenuItem key={model.id} value={model.id}>
                              {model.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Paper>
                  )}

                  {/* Created Hotspots List */}
                  <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                        CREATED HOTSPOTS
                      </Typography>
                      <Chip
                        label={createdHotspots.length}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 800,
                          bgcolor: createdHotspots.length ? "#e0f2fe" : "#f1f5f9",
                          color: createdHotspots.length ? "#0369a1" : "#64748b",
                        }}
                      />
                    </Box>

                    <Paper variant="outlined" sx={{ borderRadius: 2.5, borderColor: "#e2e8f0", overflow: "hidden" }}>
                      {createdHotspots.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: "center" }}>
                          <Typography variant="body2" sx={{ fontSize: 12, color: "#94a3b8" }}>
                            No hotspots added yet. Click &quot;Add Hotspot&quot; above to place one.
                          </Typography>
                        </Box>
                      ) : (
                        <List disablePadding>
                          {createdHotspots.map((hotspot, index) => {
                            const isEditing = editingHotspotId === hotspot.id;

                            return (
                              <Box
                                key={hotspot.id}
                                sx={{
                                  p: 1.75,
                                  borderBottom: index < createdHotspots.length - 1 ? "1px solid #f1f5f9" : "none",
                                  bgcolor: isEditing ? "#f0f9ff" : "transparent",
                                }}
                              >
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.85 }}>
                                      <RadioButtonCheckedIcon sx={{ fontSize: 15, color: "#0284c7" }} />
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: "#1e293b",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {hotspot.id}
                                      </Typography>
                                    </Box>

                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: 11,
                                        color: "#64748b",
                                        display: "block",
                                        mt: 0.4,
                                        pl: 2.85,
                                      }}
                                    >
                                      {getHotspotSourceLabel(hotspot)} → <span style={{ color: "#0284c7", fontWeight: 700 }}>{getHotspotTargetLabel(hotspot)}</span>
                                    </Typography>
                                  </Box>

                                  <Stack direction="row" spacing={0.75}>
                                    <Tooltip title="Edit Destination">
                                      <IconButton
                                        size="small"
                                        onClick={() => beginEditHotspot(hotspot)}
                                        sx={{
                                          color: isEditing ? "#0284c7" : "#64748b",
                                          bgcolor: isEditing ? "#e0f2fe" : "#f8fafc",
                                          border: "1px solid #e2e8f0",
                                          "&:hover": { bgcolor: "#f1f5f9" },
                                        }}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>

                                    <Tooltip title="Delete Hotspot">
                                      <IconButton
                                        size="small"
                                        onClick={() => deleteCreatedHotspot(hotspot.id)}
                                        sx={{
                                          color: "#ef4444",
                                          bgcolor: "#fef2f2",
                                          border: "1px solid #fecaca",
                                          "&:hover": { bgcolor: "#fee2e2" },
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                </Box>

                                {isEditing && (
                                  <Box sx={{ mt: 1.5, pl: 2.85, display: "flex", gap: 1 }}>
                                    <FormControl fullWidth size="small">
                                      <Select
                                        value={hotspot.nextModelId}
                                        onChange={(e) => updateCreatedHotspotLink(hotspot.id, e.target.value)}
                                        sx={{ borderRadius: 1.5, fontSize: 11, fontWeight: 600, bgcolor: "#ffffff" }}
                                      >
                                        {Object.values(MODELS).map((model) => (
                                          <MenuItem key={model.id} value={model.id}>
                                            {model.label}
                                          </MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>

                                    <IconButton size="small" onClick={exitHotspotEditMode} sx={{ border: "1px solid #cbd5e1" }}>
                                      <CloseIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                        </List>
                      )}
                    </Paper>
                  </Stack>

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.75,
                      borderRadius: 2.5,
                      borderColor: "#bae6fd",
                      bgcolor: "#f0f9ff",
                      display: "flex",
                      gap: 1.5,
                      alignItems: "flex-start",
                    }}
                  >
                    <LinkIcon sx={{ fontSize: 18, color: "#0284c7", mt: 0.2 }} />
                    <Typography variant="caption" sx={{ fontSize: 11, color: "#0369a1", lineHeight: 1.5 }}>
                      Hotspots attach directly to model surfaces. Select destinations from the editor list above.
                    </Typography>
                  </Paper>
                </Stack>
              </Box>
            </Box>
          </Drawer>
        </>
      )}

      {/* ── TOP-RIGHT: CAMERA & MAP CONTROLS ── */}
      <Paper
        elevation={3}
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 20,
          p: 0.75,
          borderRadius: 2.5,
          bgcolor: "#ffffff",
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}
      >
        {[
          { label: "Rotate Left", onClick: () => rotateMap(-45), text: "⟲" },
          { label: "Rotate Right", onClick: () => rotateMap(45), text: "⟳" },
          { label: "Tilt Up", onClick: () => tiltMap(15), text: "▲" },
          { label: "Tilt Down", onClick: () => tiltMap(-15), text: "▼" },
        ].map((item, index) => (
          <Tooltip title={item.label} key={item.label} placement="left">
            <IconButton
              onClick={item.onClick}
              size="small"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                color: "#0284c7",
                bgcolor: index < 2 ? "#f0f9ff" : "#f8fafc",
                border: "1px solid #e2e8f0",
                "&:hover": { bgcolor: "#e0f2fe", borderColor: "#38bdf8" },
              }}
            >
              <Typography sx={{ fontSize: index < 2 ? 18 : 12, fontWeight: 800, lineHeight: 1 }}>{item.text}</Typography>
            </IconButton>
          </Tooltip>
        ))}
      </Paper>

      {/* ── BOTTOM-RIGHT: ORBIT GESTURE PILL ── */}
      <Button
        onPointerDown={startDragRotate}
        onPointerMove={moveDragRotate}
        onPointerUp={endDragRotate}
        onPointerCancel={endDragRotate}
        onLostPointerCapture={endDragRotate}
        startIcon={<ExploreIcon sx={{ color: "#0284c7", fontSize: 18 }} />}
        sx={{
          position: "absolute",
          bottom: 20,
          right: 16,
          zIndex: 20,
          px: 2.5,
          py: 1.2,
          minHeight: 42,
          borderRadius: 99,
          textTransform: "none",
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          bgcolor: "#ffffff",
          border: "1px solid #cbd5e1",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
          cursor: "grab",
          "&:hover": { bgcolor: "#f8fafc", color: "#0284c7" },
          "&:active": { cursor: "grabbing" },
        }}
      >
        Drag to Orbit 360°
      </Button>

      {/* ── PROPERTY POPUP ── */}
      {propertyPopup && (
        <Paper
          elevation={4}
          sx={{
            position: "absolute",
            zIndex: 30,
            width: 260,
            borderRadius: 3,
            p: 2,
            bgcolor: "#ffffff",
            border: "1px solid #e2e8f0",
            pointerEvents: "none",
          }}
          style={{
            left: Math.min(propertyPopup.x + 16, window.innerWidth - 280),
            top: Math.min(propertyPopup.y + 16, window.innerHeight - 200),
          }}
        >
          <Typography variant="overline" sx={{ fontSize: 10, fontWeight: 800, color: "#0284c7", letterSpacing: "0.08em" }}>
            {propertyPopup.meshName}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontSize: 15, fontWeight: 700, color: "#0f172a", mb: 1 }}>
            {propertyPopup.details.name}
          </Typography>
          <Stack spacing={0.5}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ color: "#64748b" }}>Class</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{propertyPopup.details.bhk}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ color: "#64748b" }}>Footprint</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{propertyPopup.details.area} sq ft</Typography>
            </Box>
            <Paper variant="outlined" sx={{ mt: 1, p: 1, borderRadius: 1.5, bgcolor: "#f0f9ff", borderColor: "#bae6fd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#0369a1" }}>Valuation</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0284c7" }}>{propertyPopup.details.price}</Typography>
            </Paper>
          </Stack>
        </Paper>
      )}

      {/* ── THREE.JS Google Map Container ── */}
      <Box
        ref={mapDiv}
        onClick={handleScenePick}
        sx={{ width: "100%", height: "100%", cursor: placementMode || hotspotPlacementMode ? "crosshair" : "default" }}
      />

      {viewerModel && <ModelViewerOverlay model={viewerModel} onBack={() => setViewerModel(null)} />}
    </Box>
  );
}
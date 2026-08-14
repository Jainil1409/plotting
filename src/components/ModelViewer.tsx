"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { ViewerScene } from "../three/ViewerScene";
import { ModelLoader } from "../three/ModelLoader";
import { CameraController } from "../three/CameraController";
import { HotspotManager } from "../three/HotspotManager";

import HotspotEditorPanel from "./HotspotEditorPanel";
import HotspotNavBar from "./Hotspotnavbar";

import { HotspotConfig } from "../types/hotspot";
import { getViewerHotspotsForModel } from "../data/viewerHotspots";

// Material UI Components
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";

// Material UI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

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
  const resolvedHotspots = initialHotspots ?? getViewerHotspotsForModel(modelUrl);
  const mountRef = useRef<HTMLDivElement>(null);
  const hotspotManagerRef = useRef<HotspotManager | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [hotspots, setHotspots] = useState<HotspotConfig[]>(resolvedHotspots);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Which hotspot the bottom nav bar currently shows/points at. Separate
  // from selectedId (that's the editor panel's selection) — this one
  // matters in normal viewing mode. Defaults to the same hotspot the
  // camera opens on (resolvedHotspots[0], matching the initial
  // cameraController.setCameraPreset(...) call below).
  const [viewingHotspotId, setViewingHotspotId] = useState<string | null>(
    resolvedHotspots[0]?.id ?? null
  );

  const editModeRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedId(null);
    hotspotManagerRef.current?.clearSelection();
  };

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
          cameraController.setCameraPreset(resolvedHotspots[0]);
        } else {
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

      cameraController.cancelTransition();

      const result = hotspotManager.handleClick(
        event,
        viewer.renderer,
        cameraController.camera,
        editModeRef.current
      );

      if (result.type === "navigate") {
        if (result.hotspot) {
          cameraController.goToHotspot(result.hotspot);
          // Keep the nav bar in sync with whatever the user just clicked
          // directly in the 3D scene, not just arrow-key navigation.
          setViewingHotspotId(result.hotspot.id);
        }
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

    const handleWheel = () => {
      cameraController.cancelTransition();
    };
    viewer.renderer.domElement.addEventListener("wheel", handleWheel, true);
    viewer.renderer.domElement.addEventListener("pointerdown", handlePointerDown, true);

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      cameraController.update();

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
    // If the hotspot the nav bar was pointing at just got deleted, clear
    // it — HotspotNavBar falls back to the first hotspot on its own when
    // currentId doesn't match anything, so this isn't strictly required,
    // but it avoids briefly holding a stale id.
    setViewingHotspotId((prev) => (prev === id ? null : prev));
  };

  const exportJSON = () => {
    hotspotManagerRef.current?.exportJSON(modelUrl.split("/").pop() ?? "model.glb");
  };

  // Same camera-transition call the 3D-scene click path already uses
  // (cameraController.goToHotspot), just triggered from the nav bar's
  // arrows instead of a raycast hit.
  const handleNavigate = (id: string) => {
    const hotspot = hotspotManagerRef.current?.getHotspots().find((h) => h.id === id);
    if (!hotspot || !cameraControllerRef.current) return;

    cameraControllerRef.current.cancelTransition();
    cameraControllerRef.current.goToHotspot(hotspot);
    setViewingHotspotId(id);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        bgcolor: "#090d16",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ── TOP-LEFT: BACK BUTTON ── */}
      <Button
        variant="outlined"
        startIcon={<ArrowBackIcon fontSize="small" />}
        onClick={onBack}
        sx={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 60,
          px: 2.25,
          py: 1,
          borderRadius: 99,
          textTransform: "none",
          fontSize: 12.5,
          fontWeight: 700,
          color: "#f8fafc",
          bgcolor: "rgba(15, 23, 42, 0.75)",
          borderColor: "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.36)",
          "&:hover": {
            bgcolor: "rgba(15, 23, 42, 0.9)",
            borderColor: "rgba(255, 255, 255, 0.3)",
          },
        }}
      >
        Back to Map
      </Button>

      {/* ── TOP-RIGHT: EDIT HOTSPOTS TOGGLE ── */}
      <Button
        variant={editMode ? "contained" : "outlined"}
        startIcon={editMode ? <CheckCircleIcon fontSize="small" /> : <EditLocationAltIcon fontSize="small" />}
        onClick={() => (editMode ? exitEditMode() : setEditMode(true))}
        sx={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 60,
          px: 2.25,
          py: 1,
          borderRadius: 99,
          textTransform: "none",
          fontSize: 12.5,
          fontWeight: 700,
          color: editMode ? "#ffffff" : "#f8fafc",
          bgcolor: editMode ? "#0284c7" : "rgba(15, 23, 42, 0.75)",
          borderColor: editMode ? "#0284c7" : "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.36)",
          "&:hover": {
            bgcolor: editMode ? "#0369a1" : "rgba(15, 23, 42, 0.9)",
            borderColor: editMode ? "#0369a1" : "rgba(255, 255, 255, 0.3)",
          },
        }}
      >
        {editMode ? "Editing hotspots: ON" : "Edit hotspots"}
      </Button>

      {/* ── CENTER: LOADING STATE ── */}
      {loading && !error && (
        <Paper
          elevation={4}
          sx={{
            position: "absolute",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            px: 2.5,
            py: 1.25,
            borderRadius: 99,
            bgcolor: "rgba(15, 23, 42, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <CircularProgress size={16} sx={{ color: "#38bdf8" }} />
          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600, color: "#f8fafc" }}>
            Loading model…
          </Typography>
        </Paper>
      )}

      {/* ── CENTER: ERROR OVERLAY ── */}
      {error && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 55,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            bgcolor: "rgba(9, 13, 22, 0.92)",
          }}
        >
          <Stack spacing={2} sx={{ alignItems: "center", maxWidth: 360 }}>
            <Alert severity="error" variant="filled" sx={{ borderRadius: 2.5, fontWeight: 600 }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              size="small"
              onClick={onBack}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
            >
              Return to Map
            </Button>
          </Stack>
        </Box>
      )}

      {/* ── HOTSPOT EDITOR SIDE PANEL ── */}
      {editMode && (
        <HotspotEditorPanel
          hotspots={hotspots}
          selectedId={selectedId}
          onSelect={selectHotspot}
          onRename={renameHotspot}
          onDelete={deleteHotspot}
          onExport={exportJSON}
          onClose={exitEditMode}
        />
      )}

      {/* ── BOTTOM NAV BAR: prev/next through hotspots (view mode only) ── */}
      {!loading && !error && !editMode && hotspots.length > 0 && (
        <HotspotNavBar
          hotspots={hotspots}
          currentId={viewingHotspotId}
          onNavigate={handleNavigate}
        />
      )}

      {/* ── THREE.JS CANVAS CONTAINER ── */}
      <Box ref={mountRef} sx={{ width: "100%", height: "100%" }} />
    </Box>
  );
}
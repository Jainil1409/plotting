import * as THREE from "three";
import { HotspotConfig } from "../types/hotspot";
import apartmentHotspots from "./hotspots.json";

export type ViewerHotspotsJson = {
  model: string;
  hotspots: Array<{
    id: string;
    label: string;
    position: { x: number; y: number; z: number };
    cameraPosition: { x: number; y: number; z: number };
    cameraTarget: { x: number; y: number; z: number };
  }>;
};

function parseJsonHotspots(data: ViewerHotspotsJson): HotspotConfig[] {
  return data.hotspots.map((h) => ({
    id: h.id,
    label: h.label,
    position: new THREE.Vector3(h.position.x, h.position.y, h.position.z),
    cameraPosition: new THREE.Vector3(
      h.cameraPosition.x,
      h.cameraPosition.y,
      h.cameraPosition.z
    ),
    cameraTarget: new THREE.Vector3(
      h.cameraTarget.x,
      h.cameraTarget.y,
      h.cameraTarget.z
    ),
  }));
}

// Keyed by the same URL used in MODELS.apartment.modelUrl so the viewer
// can resolve the right hotspot camera presets for whatever GLB loads.
const VIEWER_HOTSPOTS_BY_MODEL_URL: Record<string, HotspotConfig[]> = {
  "/model/appartement.glb": parseJsonHotspots(apartmentHotspots),
};

// Returns the camera presets registered for a model URL. Always returns
// fresh clones so no two viewer mounts share the same Vector3 objects.
export function getViewerHotspotsForModel(modelUrl: string): HotspotConfig[] {
  const hotspots = VIEWER_HOTSPOTS_BY_MODEL_URL[modelUrl] ?? [];

  return hotspots.map((h) => ({
    id: h.id,
    label: h.label,
    position: h.position.clone(),
    cameraPosition: h.cameraPosition.clone(),
    cameraTarget: h.cameraTarget.clone(),
  }));
}
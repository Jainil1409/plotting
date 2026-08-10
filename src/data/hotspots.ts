import { HotspotConfig } from "../three/hotspots/hotspotTypes";

export const HOTSPOTS: Record<string, HotspotConfig[]> = {
  house: [
    {
      id: "house-entry",
      position: { x: 3.5, y: 12.0, z: 2.2 },
      nextModelUrl: "/model/appartement.glb",
    },
  ],

  apartment: [
    {
      id: "apartment-exit",
      position: { x: 0, y: 5, z: 0 },
      nextModelUrl: "/model/modern_house_06.glb",
    },
  ],
};
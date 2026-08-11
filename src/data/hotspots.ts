import type { MapHotspotConfig } from "@/src/types/hotspot";

export const HOTSPOTS: Record<string, MapHotspotConfig[]> = {
  "house-main": [
    {
      id: "house-entry",
      modelInstanceId: "house-main",
      position: { x: 3.5, y: 12.0, z: 2.2 },
      nextModelId: "apartment",
    },
  ],
};

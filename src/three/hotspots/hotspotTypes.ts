import * as THREE from "three";

export type HotspotConfig = {
  id: string;

  position: {
    x: number;
    y: number;
    z: number;
  };

  nextModelUrl: string;
};

export type HotspotHandle = {
  id: string;
  group: THREE.Group;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  nextModelUrl: string;
  /** Original local position (before any parent rotation) — used to keep
   *  the hotspot at a fixed world position when the model heading changes. */
  originalPosition: THREE.Vector3;
};

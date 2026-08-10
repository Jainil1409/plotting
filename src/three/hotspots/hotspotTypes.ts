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
};
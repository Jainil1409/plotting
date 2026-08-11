import * as THREE from "three";

export type Vector3Like = {
  x: number;
  y: number;
  z: number;
};

export interface ViewerHotspotConfig {
  id: string;
  label: string;
  position: THREE.Vector3;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
}

export type HotspotConfig = ViewerHotspotConfig;

export type MapHotspotConfig = {
  id: string;
  modelInstanceId: string;
  position: Vector3Like;
  nextModelId: string;
  nextModelInstanceId?: string;
};

export type MapHotspotHandle = {
  id: string;
  modelInstanceId: string;
  group: THREE.Group;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  nextModelId: string;
  nextModelInstanceId?: string;
  /** Original local position before any parent rotation. */
  originalPosition: THREE.Vector3;
};

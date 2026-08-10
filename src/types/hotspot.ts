import * as THREE from "three";

export interface HotspotConfig {
  id: string;
  label: string;
  position: THREE.Vector3;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
}
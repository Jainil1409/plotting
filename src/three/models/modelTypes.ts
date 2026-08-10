import * as THREE from "three";

export type ModelAnchor = {
  lat: number;
  lng: number;
  altitude: number;
};

export type ModelConfig = {
  id: string;
  modelUrl: string;
  anchor: ModelAnchor;
  heading: number;
  scale: number;
};

export type LoadedModel = {
  id: string;
  model: THREE.Object3D;
  pivot: THREE.Group;
  meshes: THREE.Mesh[];
  config: ModelConfig;
};
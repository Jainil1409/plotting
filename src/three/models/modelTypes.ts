import * as THREE from "three";

export type ModelAnchor = {
  lat: number;
  lng: number;
  altitude: number;
};

export type ModelDefinition = {
  id: string;
  label: string;
  modelUrl: string;
  defaultHeading: number;
  defaultScale: number;
};

export type ModelInstanceDefinition<TModelId extends string = string> = {
  instanceId: string;
  modelId: TModelId;
  anchor: ModelAnchor;
  heading?: number;
  scale?: number;
  hotspotSetId?: string;
};

export type ModelConfig = {
  id: string;
  instanceId: string;
  modelId: string;
  label: string;
  modelUrl: string;
  anchor: ModelAnchor;
  heading: number;
  scale: number;
  hotspotSetId: string;
};

export type LoadedModel = {
  id: string;
  instanceId: string;
  modelId: string;
  model: THREE.Object3D;
  pivot: THREE.Group;
  meshes: THREE.Mesh[];
  config: ModelConfig;
};

import type {
  ModelAnchor,
  ModelConfig,
  ModelDefinition,
  ModelInstanceDefinition,
} from "@/src/three/models/modelTypes";

export const DEFAULT_MODEL_ANCHOR: ModelAnchor = {
  lat: 23.0225,
  lng: 72.5714,
  altitude: 0,
};

export const MODELS = {
  house: {
    id: "house",
    label: "House",
    modelUrl: "/model/modern_house_06.glb",
    defaultScale: 90,
    defaultHeading: 0,
  },

  apartment: {
    id: "apartment",
    label: "Apartment",
    modelUrl: "/model/appartement.glb",
    defaultScale: 90,
    defaultHeading: 0,
  },

  // realistic_house_with_interior: {
  //   id: "realistic_house_with_interior",
  //   label: "Realistic House with Interior",
  //   modelUrl: "/model/realistic_house_with_interior.glb",
  //   defaultScale: 90,
  //   defaultHeading: 0,
  // },

} as const satisfies Record<string, ModelDefinition>;

export type ModelId = keyof typeof MODELS;

export const MODEL_INSTANCES = {
  "house-main": {
    instanceId: "house-main",
    modelId: "house",
    anchor: DEFAULT_MODEL_ANCHOR,
    hotspotSetId: "house-main",
  },
  // "realistic_house_with_interior-main": {
  //   instanceId: "realistic_house_with_interior-main",
  //   modelId: "realistic_house_with_interior",
  //   anchor:{
  //     lat: 23.0235,
  //     lng: 72.5714,
  //     altitude: 0,
  //   },
  //   hotspotSetId: "realistic_house_with_interior-main",
  // },
} as const satisfies Record<string, ModelInstanceDefinition<ModelId>>;

export type ModelInstanceId = keyof typeof MODEL_INSTANCES;

export const DEFAULT_MODEL_INSTANCE_ID: ModelInstanceId = "house-main";

export function getModelDefinition(modelId: string): ModelDefinition | null {
  return MODELS[modelId as ModelId] ?? null;
}

export function getModelConfig(instanceId: string): ModelConfig | null {
  const instance: ModelInstanceDefinition<ModelId> | undefined =
    MODEL_INSTANCES[instanceId as ModelInstanceId];

  if (!instance) return null;

  const normalizedInstance: ModelInstanceDefinition<ModelId> = instance;
  const model = MODELS[instance.modelId];

  return {
    id: instance.instanceId,
    instanceId: instance.instanceId,
    modelId: instance.modelId,
    label: model.label,
    modelUrl: model.modelUrl,
    anchor: { ...instance.anchor },
    heading: normalizedInstance.heading ?? model.defaultHeading,
    scale: normalizedInstance.scale ?? model.defaultScale,
    hotspotSetId: instance.hotspotSetId ?? instance.instanceId,
  };    
}

export function getInitialModelConfigs(): ModelConfig[] {
  return Object.keys(MODEL_INSTANCES)
    .map((instanceId) => getModelConfig(instanceId))
    .filter((config): config is ModelConfig => config !== null);
}

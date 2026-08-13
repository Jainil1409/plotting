import { ModelConfig } from "@/src/three/models/modelTypes";
import {
  DEFAULT_MODEL_INSTANCE_ID,
  getInitialModelConfigs,
  getModelConfig,
} from "@/src/data/models";

export const GOOGLE_MAPS_API_KEY = "AIzaSyBCswT9ODeUU9ByGUjbRg1KzV-nUF3BFkU"; // demo key

// Below this zoom level, model/hotspot interactions are disabled and a
// location marker is shown instead.
export const MIN_INTERACTION_ZOOM = 15;

const defaultModelConfig = getModelConfig(DEFAULT_MODEL_INSTANCE_ID);
if (!defaultModelConfig) {
  throw new Error(`Missing default model instance: ${DEFAULT_MODEL_INSTANCE_ID}`);
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = defaultModelConfig;
export const DEFAULT_ANCHOR = DEFAULT_MODEL_CONFIG.anchor;
export const MODEL_HEADING = DEFAULT_MODEL_CONFIG.heading;

export function cloneModelConfig(config: ModelConfig): ModelConfig {
  return { ...config, anchor: { ...config.anchor } };
}

export function createInitialModelConfigMap() {
  return new Map(
    getInitialModelConfigs().map((config) => [
      config.instanceId,
      cloneModelConfig(config),
    ])
  );
}

export interface ModelSummary {
  instanceId: string;
  label: string;
  heading: number;
}
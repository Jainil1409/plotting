export const MODELS = {
  house: {
    id: "house",
    modelUrl: "/model/modern_house_06.glb",
    scale: 90,
    heading: 0,
  },

  apartment: {
    id: "apartment",
    modelUrl: "/model/appartement.glb",
    scale: 90,
    heading: 0,
  } 
} as const;

export type ModelId = keyof typeof MODELS;
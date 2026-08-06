// types/scene.ts

/** Which model is currently active in the shared <Canvas>. */
export type SceneView = "house" | "apartment";

/** A clickable 3D hotspot anchored to a position in model space. */
export interface HotspotConfig {
  id: string;
  /** [x, y, z] in the SAME coordinate space as the GLB it's attached to. */
  position: [number, number, number];
  label: string;
  /** View to navigate to when this hotspot is clicked. */
  target: SceneView;
}
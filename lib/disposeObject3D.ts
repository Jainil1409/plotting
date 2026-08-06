// lib/disposeObject3D.ts
//
// Three.js does NOT automatically free GPU-side memory (geometry buffers,
// texture data) just because an object is removed from the scene graph or
// its component unmounts. On a low-VRAM GPU with multiple heavy models,
// this is the difference between "fine" and a driver-level device reset —
// see README "VRAM budget on low-end GPUs".

import * as THREE from "three";

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;

    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = (mesh as THREE.Mesh).material as
      | THREE.Material
      | THREE.Material[]
      | undefined;

    if (material) {
      const materials = Array.isArray(material) ? material : [material];
      materials.forEach((mat) => {
        // Dispose every texture map attached to the material (map,
        // normalMap, roughnessMap, etc.) — these are usually the largest
        // GPU memory consumers, not the geometry.
        Object.values(mat as unknown as Record<string, unknown>).forEach(
          (value) => {
            if (
              value &&
              typeof value === "object" &&
              "isTexture" in (value as object)
            ) {
              (value as THREE.Texture).dispose();
            }
          }
        );
        mat.dispose();
      });
    }
  });
}
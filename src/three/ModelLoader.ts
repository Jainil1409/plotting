import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface LoadedModelAsset {
  model: THREE.Object3D;
  size: THREE.Vector3;
  center: THREE.Vector3;
  box: THREE.Box3;
}

export type LoadedModel = LoadedModelAsset;

export type ModelLoaderOptions = {
  debug?: boolean;
};

export class ModelLoader {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
  }

  load(url: string, options: ModelLoaderOptions = {}): Promise<LoadedModelAsset> {
    const { debug = true } = options;

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          model.updateMatrixWorld(true);

          // Preserve the original debug logging behavior — bounding box,
          // size, center, and node-name traversal are useful for
          // calibrating hotspot coordinates against the actual model.
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          if (debug) {
            console.log("Bounding Box:", box);
            console.log("Size:", size);
            console.log("Center:", center);

            // Dev-only: dump the GLB's node names before trusting any
            // hand-placed HOTSPOTS coordinates. If this logs named nodes
            // like "Bedroom" / "Kitchen" / "LivingRoom", anchoring hotspots
            // to those objects' bounding-box centers is more robust than
            // either the hardcoded Vector3s or manual click-placement.
            model.traverse((child) => {
              console.log(child.name, child.type);
            });
          }

          resolve({ model, size, center, box });
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }
}

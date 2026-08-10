import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import {
  normalizeMaterialsAndCollectMeshes,
  buildPivotFromModel,
} from "./modelUtils";

import {
  ModelConfig,
  LoadedModel,
} from "./modelTypes";

export class ModelManager {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
  }

  async loadModel(config: ModelConfig): Promise<LoadedModel> {
    const gltf = await this.loader.loadAsync(config.modelUrl);

    const model = gltf.scene;

    const meshes = normalizeMaterialsAndCollectMeshes(model);

    const pivot = buildPivotFromModel(
      model,
      config.heading,
      config.scale
    );

    return {
      id: config.id,
      model,
      pivot,
      meshes,
      config,
    };
  }

  addModel(scene: THREE.Scene, loadedModel: LoadedModel) {
    scene.add(loadedModel.pivot);
  }

  removeModel(scene: THREE.Scene, loadedModel: LoadedModel) {
    scene.remove(loadedModel.pivot);
  }

  setHeading(loadedModel: LoadedModel, heading: number) {
    loadedModel.pivot.rotation.z = THREE.MathUtils.degToRad(heading);
    loadedModel.config.heading = heading;
  }

  dispose(loadedModel: LoadedModel) {
    loadedModel.model.traverse((child) => {
      const mesh = child as THREE.Mesh;

      if (!mesh.isMesh) return;

      mesh.geometry?.dispose();

      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      materials.forEach((material: THREE.Material) => {
        material.dispose();
      });
    });
  }
}
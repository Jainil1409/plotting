import * as THREE from "three";

import {
  anchorToSceneOffset,
  normalizeMaterialsAndCollectMeshes,
  buildPivotFromModel,
} from "./modelUtils";

import {
  ModelAnchor,
  ModelConfig,
  LoadedModel,
} from "./modelTypes";
import { ModelLoader } from "../ModelLoader";

export class ModelManager {
  private loader: ModelLoader;
  private loadedModels = new Map<string, LoadedModel>();

  constructor(loader = new ModelLoader()) {
    this.loader = loader;
  }

  async loadModel(config: ModelConfig): Promise<LoadedModel> {
    const { model } = await this.loader.load(config.modelUrl, { debug: false });

    const meshes = normalizeMaterialsAndCollectMeshes(model);

    model.userData.modelInstanceId = config.instanceId;
    model.userData.modelId = config.modelId;

    meshes.forEach((mesh) => {
      mesh.userData.modelInstanceId = config.instanceId;
      mesh.userData.modelId = config.modelId;
    });

    const pivot = buildPivotFromModel(
      model,
      config.heading,
      config.scale
    );

    pivot.userData.modelInstanceId = config.instanceId;
    pivot.userData.modelId = config.modelId;

    const loadedModel = {
      id: config.instanceId,
      instanceId: config.instanceId,
      modelId: config.modelId,
      model,
      pivot,
      meshes,
      config,
    };

    this.loadedModels.set(config.instanceId, loadedModel);

    return loadedModel;
  }

  addModel(scene: THREE.Scene, loadedModel: LoadedModel) {
    if (!loadedModel.pivot.parent) {
      scene.add(loadedModel.pivot);
    }
  }

  removeModel(scene: THREE.Scene, loadedModel: LoadedModel | string) {
    const model =
      typeof loadedModel === "string"
        ? this.loadedModels.get(loadedModel)
        : loadedModel;

    if (!model) return;

    scene.remove(model.pivot);
    model.pivot.removeFromParent();
  }

  setSceneOrigin(sceneAnchor: ModelAnchor) {
    this.loadedModels.forEach((loadedModel) => {
      this.setAnchor(loadedModel, loadedModel.config.anchor, sceneAnchor);
    });
  }

  setAnchor(
    loadedModel: LoadedModel,
    anchor: ModelAnchor,
    sceneAnchor: ModelAnchor
  ) {
    loadedModel.config.anchor = { ...anchor };
    loadedModel.pivot.position.copy(anchorToSceneOffset(sceneAnchor, anchor));
  }

  getModel(instanceId: string) {
    return this.loadedModels.get(instanceId) ?? null;
  }

  getAllModels() {
    return Array.from(this.loadedModels.values());
  }

  getAllMeshes() {
    return this.getAllModels().flatMap((loadedModel) => loadedModel.meshes);
  }

  dispose(loadedModel: LoadedModel) {
    loadedModel.pivot.removeFromParent();

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

    this.loadedModels.delete(loadedModel.instanceId);
  }

  disposeAll() {
    this.getAllModels().forEach((loadedModel) => {
      this.dispose(loadedModel);
    });
  }

  clear(scene: THREE.Scene) {
    this.getAllModels().forEach((loadedModel) => {
      this.removeModel(scene, loadedModel);
      this.dispose(loadedModel);
    });
  }

  unloadModel(scene: THREE.Scene, instanceId: string) {
    const loadedModel = this.loadedModels.get(instanceId);

    if (!loadedModel) return;

    scene.remove(loadedModel.pivot);
    this.dispose(loadedModel);
  }

  setHeading(loadedModel: LoadedModel, heading: number) {
    loadedModel.pivot.rotation.z = THREE.MathUtils.degToRad(heading);
    loadedModel.config.heading = heading;
  }
}

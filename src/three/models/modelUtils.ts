import * as THREE from "three";
import { ModelAnchor } from "./modelTypes";

const EARTH_RADIUS_METERS = 6378137;

type NormalizedModelMaterial = THREE.Material & {
  vertexColors?: boolean;
  opacity?: number;
  alphaMap?: THREE.Texture | null;
  isMeshStandardMaterial?: boolean;
  isMeshPhysicalMaterial?: boolean;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
};

export function normalizeMaterialsAndCollectMeshes(
  model: THREE.Object3D
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;

    const mesh = child as THREE.Mesh;

    meshes.push(mesh);

    mesh.frustumCulled = false;

    const materials = (Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) as NormalizedModelMaterial[];

    materials.forEach((mat) => {
      if (mat.vertexColors && !mesh.geometry?.attributes?.color) {
        mat.vertexColors = false;
      }

      mat.side = THREE.DoubleSide;

      if (mat.transparent && mat.opacity >= 1 && !mat.alphaMap) {
        mat.transparent = false;
      }

      if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        mat.roughness = mat.roughness ?? 0.6;
        mat.metalness = mat.metalness ?? 0.1;
        mat.envMapIntensity = 1.2;
      }

      mat.needsUpdate = true;
    });
  });

  return meshes;
}

export function buildPivotFromModel(
  model: THREE.Object3D,
  headingDeg: number,
  targetMaxDim: number
): THREE.Group {
  const box = new THREE.Box3().setFromObject(model);

  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);

  model.scale.setScalar(maxDim > 0 ? targetMaxDim / maxDim : 1);

  model.rotation.x = Math.PI / 2;

  model.updateMatrixWorld(true);

  const alignedBox = new THREE.Box3().setFromObject(model);

  const alignedCenter = new THREE.Vector3();

  alignedBox.getCenter(alignedCenter);

  const centerGroup = new THREE.Group();

  centerGroup.add(model);

  centerGroup.position.set(
    -alignedCenter.x,
    -alignedCenter.y,
    -alignedBox.min.z
  );

  model.position.set(0, 0, 0);

  const pivot = new THREE.Group();

  pivot.add(centerGroup);

  pivot.rotation.z = THREE.MathUtils.degToRad(headingDeg);

  return pivot;
}

export function anchorToSceneOffset(
  sceneAnchor: ModelAnchor,
  modelAnchor: ModelAnchor
): THREE.Vector3 {
  const latDelta = THREE.MathUtils.degToRad(modelAnchor.lat - sceneAnchor.lat);
  const lngDelta = THREE.MathUtils.degToRad(modelAnchor.lng - sceneAnchor.lng);
  const sceneLatRad = THREE.MathUtils.degToRad(sceneAnchor.lat);

  return new THREE.Vector3(
    lngDelta * EARTH_RADIUS_METERS * Math.cos(sceneLatRad),
    latDelta * EARTH_RADIUS_METERS,
    modelAnchor.altitude - sceneAnchor.altitude
  );
}

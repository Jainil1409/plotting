import * as THREE from "three";

export function normalizeMaterialsAndCollectMeshes(
  model: THREE.Object3D
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;

    const mesh = child as THREE.Mesh;

    meshes.push(mesh);

    mesh.frustumCulled = false;

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    materials.forEach((mat: any) => {
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
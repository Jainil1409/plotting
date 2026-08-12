import * as THREE from "three";

export type PropertyDetails = {
  name: string;
  bhk: string;
  area: number;
  price: string;
};

export type PropertyPopup = {
  x: number;
  y: number;
  modelInstanceId: string;
  modelId: string;
  meshName: string;
  details: PropertyDetails;
};

export type InteractionResult =
  | { type: "property"; popup: PropertyPopup }
  | { type: "none" };

export class ModelInteractionManager {
  private raycaster = new THREE.Raycaster();

  constructor(
    private meshes: THREE.Mesh[],
    private propertyDetails: Record<string, Record<string, PropertyDetails>>
  ) {}

  setMeshes(meshes: THREE.Mesh[]) {
    this.meshes = meshes;
  }

  // Pick a mesh by raycasting, with a screen-projection fallback
  // for Google Maps WebGLOverlayView projection mismatches.
  pickMesh(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    mapElement: HTMLElement
  ): THREE.Mesh | null {
    const rect = mapElement.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    // Ensure world matrices are up to date before raycasting
    for (const mesh of this.meshes) {
      mesh.updateMatrixWorld(true);
    }

    const intersections = this.raycaster.intersectObjects(this.meshes, true);

    if (intersections.length > 0) {
      return intersections[0].object as THREE.Mesh;
    }

    // Fallback: screen-projection based picking
    return this.pickMeshByProjectedCenter(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      camera
    );
  }

  handleClick(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    mapElement: HTMLElement
  ): InteractionResult {
    const picked = this.pickMesh(event, camera, mapElement);

    if (!picked) {
      return { type: "none" };
    }

    const meshName = picked.name || "(no name)";
    const modelInstanceId = picked.userData.modelInstanceId as string | undefined;
    const modelId = picked.userData.modelId as string | undefined;
    const details = modelInstanceId
      ? this.propertyDetails[modelInstanceId]?.[meshName]
      : undefined;

    if (!details) {
      return { type: "none" };
    }

    const rect = mapElement.getBoundingClientRect();

    return {
      type: "property",
      popup: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        modelInstanceId: modelInstanceId ?? "",
        modelId: modelId ?? "",
        meshName,
        details,
      },
    };
  }

  // Calibration helper: Alt+click to log pivot-local coordinates.
  // Returns the local position or null if no model geometry was hit.
  calibrateLocalPosition(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    pivot: THREE.Group,
    mapElement: HTMLElement
  ): THREE.Vector3 | null {
    const rect = mapElement.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    // Refresh the pivot's world matrix AND its whole descendant subtree
    // BEFORE raycasting, just like pickMesh() does. The Google Maps
    // WebGLOverlayView sets the camera projection matrix per frame, and
    // the model sits under a nested pivot -> centerGroup -> model chain.
    // If the meshes' world matrices are stale, intersectObject() returns
    // zero hits and we'd never be able to place a hotspot on the surface.
    pivot.updateMatrixWorld(true);

    const hits = this.raycaster.intersectObject(pivot, true);

    if (hits.length > 0) {
      return pivot.worldToLocal(hits[0].point.clone());
    }

    // ── Google Maps WebGLOverlayView projection fallback ──
    // Raycasting against the model is unreliable under Google's
    // transformer-driven camera (same reason hotspot picking and mesh
    // picking both use screen-space distance checks). Fall back to the
    // proven technique: project each mesh's bounding-sphere center onto
    // the screen, find the mesh nearest to the click, and use its
    // surface point (converted to pivot-local space) as the hotspot
    // position.
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    const meshes: THREE.Mesh[] = [];
    pivot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
    });

    let bestMesh: THREE.Mesh | null = null;
    let bestScore = Infinity;

    for (const mesh of meshes) {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      if (!geometry) continue;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      if (!geometry.boundingSphere) continue;

      const centerWorld = geometry.boundingSphere.center
        .clone()
        .applyMatrix4(mesh.matrixWorld);

      const clip = centerWorld.clone().applyMatrix4(camera.projectionMatrix);

      if (clip.z < -1 || clip.z > 1) continue;

      const screenX = (clip.x * 0.5 + 0.5) * rect.width;
      const screenY = (-clip.y * 0.5 + 0.5) * rect.height;

      const dist = Math.hypot(screenX - localX, screenY - localY);
      if (dist > 60) continue;

      if (dist < bestScore) {
        bestScore = dist;
        bestMesh = mesh;
      }
    }

    if (!bestMesh) return null;

    const bestGeometry = bestMesh.geometry as THREE.BufferGeometry;
    const surfaceWorld = bestGeometry.boundingSphere!.center
      .clone()
      .applyMatrix4(bestMesh.matrixWorld);

    return pivot.worldToLocal(surfaceWorld.clone());
  }

  private pickMeshByProjectedCenter(
    localX: number,
    localY: number,
    viewportWidth: number,
    viewportHeight: number,
    camera: THREE.PerspectiveCamera
  ): THREE.Mesh | null {
    let bestMatch: { mesh: THREE.Mesh; score: number } | null = null;

    for (const mesh of this.meshes) {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      if (!geometry) continue;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      if (!geometry.boundingSphere) continue;

      const centerWorld = geometry.boundingSphere.center
        .clone()
        .applyMatrix4(mesh.matrixWorld);

      const clipCenter = centerWorld.clone().applyMatrix4(camera.projectionMatrix);

      if (clipCenter.z < -1 || clipCenter.z > 1) continue;

      const centerX = (clipCenter.x * 0.5 + 0.5) * viewportWidth;
      const centerY = (-clipCenter.y * 0.5 + 0.5) * viewportHeight;

      const edgeWorld = centerWorld
        .clone()
        .add(new THREE.Vector3(geometry.boundingSphere.radius, 0, 0));

      const clipEdge = edgeWorld.applyMatrix4(camera.projectionMatrix);

      const edgeX = (clipEdge.x * 0.5 + 0.5) * viewportWidth;
      const edgeY = (-clipEdge.y * 0.5 + 0.5) * viewportHeight;

      const radiusPx = Math.hypot(edgeX - centerX, edgeY - centerY);
      const distancePx = Math.hypot(centerX - localX, centerY - localY);
      const hitRadius = Math.min(Math.max(16, radiusPx * 1.35), 60);

      if (distancePx > hitRadius) continue;

      const score = distancePx / hitRadius;

      if (!bestMatch || score < bestMatch.score) {
        bestMatch = { mesh, score };
      }
    }

    return bestMatch?.mesh ?? null;
  }
}
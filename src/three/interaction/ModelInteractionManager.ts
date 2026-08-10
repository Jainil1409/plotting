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
    private propertyDetails: Record<string, PropertyDetails>
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
    const details = this.propertyDetails[meshName];

    if (!details) {
      return { type: "none" };
    }

    const rect = mapElement.getBoundingClientRect();

    return {
      type: "property",
      popup: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
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

    const hits = this.raycaster.intersectObject(pivot, true);

    if (hits.length === 0) return null;

    return pivot.worldToLocal(hits[0].point.clone());
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
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

export type ModelSurfaceHit = {
  localPoint: THREE.Vector3;
  worldPoint: THREE.Vector3;
  worldNormal: THREE.Vector3 | null;
  distance: number;
  mesh: THREE.Mesh;
};

export class ModelInteractionManager {
  private raycaster = new THREE.Raycaster();

  constructor(
    private meshes: THREE.Mesh[],
    private propertyDetails: Record<string, Record<string, PropertyDetails>>
  ) {}

  setMeshes(meshes: THREE.Mesh[]) {
    this.meshes = meshes;
  }

  /**
   * Pick a mesh in the Google Maps WebGLOverlayView.
   *
   * Important:
   * Google supplies a view-projection matrix to the Three.js camera, but
   * camera.matrixWorld is not a normal Three.js camera transform. Therefore
   * setFromCamera() is not reliable here. We build the world-space ray
   * manually from Google's projection matrix instead.
   */
  pickMesh(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    mapElement: HTMLElement
  ): THREE.Mesh | null {
    const rect = mapElement.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const ray = this.buildWorldRay(event, camera, mapElement);

    this.raycaster.ray.copy(ray);

    this.updateMeshMatrices(this.meshes);

    const intersections = this.raycaster.intersectObjects(this.meshes, true);

    if (intersections.length > 0) {
      return this.findMeshAncestor(intersections[0].object);
    }

    // Keep the old screen-projection fallback for normal property picking.
    // It is deliberately NOT used for hotspot placement because a projected
    // center is not a real surface hit and can place a hotspot on the wrong
    // side/base of a model.
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

  /**
   * Return the actual surface hit for one model.
   *
   * This method intentionally has NO projected-center fallback. Hotspot
   * placement must always use a real triangle intersection. Otherwise a
   * failed raycast can fall back to a nearby/base mesh and create the marker
   * in the wrong place.
   */
  /**
   * Pick an actual visible surface of one model.
   *
   * Google Maps WebGLOverlayView does not expose a normal Three.js camera
   * matrixWorld. Because of that, a normal setFromCamera() ray can fail even
   * though the model is visibly under the cursor.
   *
   * We therefore use two independent strategies:
   *   1. Google view-projection unprojection + Three.js raycast.
   *   2. Exact screen-space triangle picking as a fallback.
   *
   * The fallback is NOT a mesh-center fallback. It projects the real GLTF
   * triangles and reconstructs the clicked point with barycentric coordinates.
   * This means the hotspot is still attached to the actual model surface.
   */
  pickModelSurface(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    pivot: THREE.Group,
    mapElement: HTMLElement
  ): ModelSurfaceHit | null {
    if (!pivot) return null;

    const rect = mapElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    pivot.updateMatrixWorld(true);

    const meshes: THREE.Mesh[] = [];
    pivot.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) meshes.push(mesh);
    });

    if (meshes.length === 0) return null;

    // Strategy 1: exact world-space ray.
    const ray = this.buildWorldRay(event, camera, mapElement);
    this.raycaster.ray.copy(ray);

    const intersections = this.raycaster.intersectObjects(meshes, true);
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const mesh = this.findMeshAncestor(intersection.object);

      if (mesh) {
        return this.makeSurfaceHit(
          pivot,
          mesh,
          intersection.point.clone(),
          intersection.distance,
          intersection.face?.normal ?? null
        );
      }
    }

    // Strategy 2: Google projection fallback using the REAL triangles.
    return this.pickSurfaceByProjectedTriangles(
      event,
      camera,
      pivot,
      meshes,
      mapElement
    );
  }

  private makeSurfaceHit(
    pivot: THREE.Group,
    mesh: THREE.Mesh,
    worldPoint: THREE.Vector3,
    distance: number,
    localFaceNormal: THREE.Vector3 | null
  ): ModelSurfaceHit {
    let worldNormal: THREE.Vector3 | null = null;

    if (localFaceNormal) {
      worldNormal = localFaceNormal
        .clone()
        .applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld))
        .normalize();
    }

    const localPoint = pivot.worldToLocal(worldPoint.clone());

    return {
      localPoint,
      worldPoint,
      worldNormal,
      distance,
      mesh,
    };
  }

  /**
   * Exact screen-space triangle picker.
   *
   * Each GLTF triangle is projected into map pixels. If the mouse is inside
   * the projected triangle, barycentric coordinates are used to reconstruct
   * the corresponding 3D point in the mesh's local coordinate system.
   */
  private pickSurfaceByProjectedTriangles(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    pivot: THREE.Group,
    meshes: THREE.Mesh[],
    mapElement: HTMLElement
  ): ModelSurfaceHit | null {
    const rect = mapElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let best: {
      mesh: THREE.Mesh;
      localPoint: THREE.Vector3;
      worldPoint: THREE.Vector3;
      localNormal: THREE.Vector3;
      depth: number;
      screenDistance: number;
    } | null = null;

    // First pass: only inspect meshes whose projected bounding sphere contains
    // the cursor. This keeps the triangle fallback practical for large GLBs.
    for (const mesh of meshes) {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      if (!position || position.count < 3) continue;

      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      if (!geometry.boundingSphere) continue;

      const sphereCenterWorld = geometry.boundingSphere.center
        .clone()
        .applyMatrix4(mesh.matrixWorld);
      const sphereClip = sphereCenterWorld.clone().applyMatrix4(camera.projectionMatrix);

      const centerX = (sphereClip.x * 0.5 + 0.5) * rect.width;
      const centerY = (-sphereClip.y * 0.5 + 0.5) * rect.height;

      const sphereEdgeWorld = sphereCenterWorld
        .clone()
        .add(new THREE.Vector3(geometry.boundingSphere.radius, 0, 0));
      const sphereEdgeClip = sphereEdgeWorld.clone().applyMatrix4(camera.projectionMatrix);
      const edgeX = (sphereEdgeClip.x * 0.5 + 0.5) * rect.width;
      const edgeY = (-sphereEdgeClip.y * 0.5 + 0.5) * rect.height;
      const radiusPx = Math.max(8, Math.hypot(edgeX - centerX, edgeY - centerY));

      if (Math.hypot(mouseX - centerX, mouseY - centerY) > radiusPx + 4) {
        continue;
      }

      const index = geometry.getIndex();
      const triangleCount = index ? index.count / 3 : position.count / 3;

      for (let triangle = 0; triangle < triangleCount; triangle++) {
        const ia = index ? index.getX(triangle * 3) : triangle * 3;
        const ib = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
        const ic = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;

        const a = new THREE.Vector3().fromBufferAttribute(position, ia);
        const b = new THREE.Vector3().fromBufferAttribute(position, ib);
        const c = new THREE.Vector3().fromBufferAttribute(position, ic);

        const aw = a.clone().applyMatrix4(mesh.matrixWorld);
        const bw = b.clone().applyMatrix4(mesh.matrixWorld);
        const cw = c.clone().applyMatrix4(mesh.matrixWorld);

        const as = aw.clone().applyMatrix4(camera.projectionMatrix);
        const bs = bw.clone().applyMatrix4(camera.projectionMatrix);
        const cs = cw.clone().applyMatrix4(camera.projectionMatrix);

        const ax = (as.x * 0.5 + 0.5) * rect.width;
        const ay = (-as.y * 0.5 + 0.5) * rect.height;
        const bx = (bs.x * 0.5 + 0.5) * rect.width;
        const by = (-bs.y * 0.5 + 0.5) * rect.height;
        const cx = (cs.x * 0.5 + 0.5) * rect.width;
        const cy = (-cs.y * 0.5 + 0.5) * rect.height;

        const bary = this.barycentric2D(
          mouseX,
          mouseY,
          ax,
          ay,
          bx,
          by,
          cx,
          cy
        );

        if (!bary) continue;

        const localPoint = a
          .multiplyScalar(bary.u)
          .add(b.clone().multiplyScalar(bary.v))
          .add(c.clone().multiplyScalar(bary.w));

        const worldPoint = localPoint.clone().applyMatrix4(mesh.matrixWorld);

        const localNormal = b
          .clone()
          .sub(a)
          .cross(c.clone().sub(a))
          .normalize();

        if (localNormal.lengthSq() < 1e-12) continue;

        // NDC z: closer geometry is normally smaller. Prefer the front-most
        // triangle when multiple overlapping triangles contain the cursor.
        const depth =
          as.z * bary.u + bs.z * bary.v + cs.z * bary.w;

        const candidate = {
          mesh,
          localPoint,
          worldPoint,
          localNormal,
          depth,
          screenDistance: 0,
        };

        if (!best || depth < best.depth) {
          best = candidate;
        }
      }
    }

    if (!best) return null;

    return this.makeSurfaceHit(
      pivot,
      best.mesh,
      best.worldPoint,
      0,
      best.localNormal
    );
  }

  private barycentric2D(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number
  ): { u: number; v: number; w: number } | null {
    const denominator =
      (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);

    if (Math.abs(denominator) < 1e-8) return null;

    const u =
      ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) /
      denominator;
    const v =
      ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) /
      denominator;
    const w = 1 - u - v;

    const epsilon = 0.002;
    if (u < -epsilon || v < -epsilon || w < -epsilon) return null;

    return { u, v, w };
  }

  /**
   * Alt+click calibration / compatibility API.
   *
   * allowProjectedFallback remains true by default so existing calibration
   * behavior is preserved. Hotspot creation calls this with false and uses
   * only a real surface intersection.
   */
  calibrateLocalPosition(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    pivot: THREE.Group,
    mapElement: HTMLElement,
    allowProjectedFallback = true
  ): THREE.Vector3 | null {
    const exactHit = this.pickModelSurface(
      event,
      camera,
      pivot,
      mapElement
    );

    if (exactHit) {
      return exactHit.localPoint;
    }

    if (!allowProjectedFallback) {
      return null;
    }

    return this.pickLocalPositionByProjectedCenter(
      event,
      camera,
      pivot,
      mapElement
    );
  }

  /**
   * Builds a world-space ray from a screen click using Google's
   * view-projection matrix stored in camera.projectionMatrix.
   *
   * camera.matrixWorld is intentionally not used because Google controls the
   * camera transform inside WebGLOverlayView.
   */
  private buildWorldRay(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    mapElement: HTMLElement
  ): THREE.Ray {
    const rect = mapElement.getBoundingClientRect();

    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Make sure the inverse is current before unprojection.
    camera.projectionMatrixInverse.copy(
      camera.projectionMatrix
    ).invert();

    const clipNear = new THREE.Vector3(ndcX, ndcY, -1);
    const clipFar = new THREE.Vector3(ndcX, ndcY, 1);

    const worldNear = clipNear.applyMatrix4(camera.projectionMatrixInverse);
    const worldFar = clipFar.applyMatrix4(camera.projectionMatrixInverse);

    const direction = worldFar.sub(worldNear).normalize();

    return new THREE.Ray(worldNear, direction);
  }

  private updateMeshMatrices(meshes: THREE.Mesh[]) {
    const roots = new Set<THREE.Object3D>();

    for (const mesh of meshes) {
      let root: THREE.Object3D = mesh;
      while (root.parent) {
        root = root.parent;
      }
      roots.add(root);
    }

    roots.forEach((root) => root.updateMatrixWorld(true));
  }

  /**
   * Convert an arbitrary intersected Object3D back to its mesh ancestor.
   * GLTF models can contain nested Object3D nodes, so returning the raw
   * intersection object is not always safe for property lookup.
   */
  private findMeshAncestor(object: THREE.Object3D): THREE.Mesh | null {
    let current: THREE.Object3D | null = object;

    while (current) {
      if ((current as THREE.Mesh).isMesh) {
        return current as THREE.Mesh;
      }
      current = current.parent;
    }

    return null;
  }

  /**
   * Compatibility fallback used only when an exact raycast fails in normal
   * property selection or Alt+click calibration.
   */
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

      if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
      }

      if (!geometry.boundingSphere) continue;

      const centerWorld = geometry.boundingSphere.center
        .clone()
        .applyMatrix4(mesh.matrixWorld);

      const clipCenter = centerWorld
        .clone()
        .applyMatrix4(camera.projectionMatrix);

      if (clipCenter.z < -1 || clipCenter.z > 1) continue;

      const centerX = (clipCenter.x * 0.5 + 0.5) * viewportWidth;
      const centerY = (-clipCenter.y * 0.5 + 0.5) * viewportHeight;

      const edgeWorld = centerWorld
        .clone()
        .add(new THREE.Vector3(geometry.boundingSphere.radius, 0, 0));

      const clipEdge = edgeWorld.applyMatrix4(camera.projectionMatrix);

      const edgeX = (clipEdge.x * 0.5 + 0.5) * viewportWidth;
      const edgeY = (-clipEdge.y * 0.5 + 0.5) * viewportHeight;

      const radiusPx = Math.hypot(
        edgeX - centerX,
        edgeY - centerY
      );

      const distancePx = Math.hypot(
        centerX - localX,
        centerY - localY
      );

      const hitRadius = Math.min(
        Math.max(16, radiusPx * 1.35),
        60
      );

      if (distancePx > hitRadius) continue;

      const score = distancePx / hitRadius;

      if (!bestMatch || score < bestMatch.score) {
        bestMatch = { mesh, score };
      }
    }

    return bestMatch?.mesh ?? null;
  }

  private pickLocalPositionByProjectedCenter(
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    pivot: THREE.Group,
    mapElement: HTMLElement
  ): THREE.Vector3 | null {
    const rect = mapElement.getBoundingClientRect();

    pivot.updateMatrixWorld(true);

    const meshes: THREE.Mesh[] = [];
    pivot.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        meshes.push(mesh);
      }
    });

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    let bestMesh: THREE.Mesh | null = null;
    let bestScore = Infinity;

    for (const mesh of meshes) {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      if (!geometry) continue;

      if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
      }

      if (!geometry.boundingSphere) continue;

      const centerWorld = geometry.boundingSphere.center
        .clone()
        .applyMatrix4(mesh.matrixWorld);

      const clip = centerWorld.clone().applyMatrix4(camera.projectionMatrix);

      if (clip.z < -1 || clip.z > 1) continue;

      const screenX = (clip.x * 0.5 + 0.5) * rect.width;
      const screenY = (-clip.y * 0.5 + 0.5) * rect.height;

      const dist = Math.hypot(
        screenX - localX,
        screenY - localY
      );

      if (dist > 60) continue;

      if (dist < bestScore) {
        bestScore = dist;
        bestMesh = mesh;
      }
    }

    if (!bestMesh) {
      return null;
    }

    const geometry = bestMesh.geometry as THREE.BufferGeometry;

    if (!geometry.boundingSphere) {
      geometry.computeBoundingSphere();
    }

    if (!geometry.boundingSphere) {
      return null;
    }

    const surfaceWorld = geometry.boundingSphere.center
      .clone()
      .applyMatrix4(bestMesh.matrixWorld);

    return pivot.worldToLocal(surfaceWorld.clone());
  }
}
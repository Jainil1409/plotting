import * as THREE from "three";

import {
  HotspotConfig,
  HotspotHandle,
} from "./hotspotTypes";

const HOTSPOT_ACCENT = 0x22d3ee;

export class HotspotManager {
  private hotspots = new Map<string, HotspotHandle>();

  createHotspot(config: HotspotConfig): HotspotHandle {
    const group = new THREE.Group();

    const originalPosition = new THREE.Vector3(
      config.position.x,
      config.position.y,
      config.position.z
    );

    group.position.copy(originalPosition);

    group.userData.type = "hotspot";
    group.userData.hotspotId = config.id;
    group.userData.modelInstanceId = config.modelInstanceId;

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 32, 32),
      new THREE.MeshBasicMaterial({
        color: HOTSPOT_ACCENT,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      })
    );

    core.renderOrder = 999;

    group.add(core);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 32),
      new THREE.MeshBasicMaterial({
        color: HOTSPOT_ACCENT,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthTest: false,
      })
    );

    ring.rotation.x = -Math.PI / 2;

    ring.renderOrder = 999;

    group.add(ring);

    const edgeRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.5, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthTest: false,
      })
    );

    edgeRing.rotation.x = -Math.PI / 2;

    edgeRing.renderOrder = 999;

    group.add(edgeRing);

    const handle: HotspotHandle = {
      id: config.id,
      modelInstanceId: config.modelInstanceId,
      group,
      core,
      ring,
      nextModelId: config.nextModelId,
      nextModelInstanceId: config.nextModelInstanceId,
      originalPosition,
    };

    this.hotspots.set(config.id, handle);

    return handle;
  }

  attachHotspot(parent: THREE.Object3D, hotspot: HotspotHandle) {
    parent.add(hotspot.group);

    hotspot.group.updateMatrixWorld(true);
  }

  removeHotspot(hotspotId: string) {
    const hotspot = this.hotspots.get(hotspotId);

    if (!hotspot) return;

    hotspot.group.removeFromParent();

    this.hotspots.delete(hotspotId);
  }

  removeHotspotsForModel(modelInstanceId: string) {
    this.getHotspotsForModel(modelInstanceId).forEach((hotspot) => {
      this.removeHotspot(hotspot.id);
    });
  }

  getHotspot(hotspotId: string) {
    return this.hotspots.get(hotspotId) ?? null;
  }

  getAllHotspots() {
    return Array.from(this.hotspots.values());
  }

  getHotspotsForModel(modelInstanceId: string) {
    return this.getAllHotspots().filter(
      (hotspot) => hotspot.modelInstanceId === modelInstanceId
    );
  }

  // Detect which hotspot (if any) was clicked, using only userData.
  // Returns the HotspotHandle, or null if no hotspot was hit.
  pickHotspotAt(
    event: MouseEvent,
    camera: THREE.Camera,
    mapElement: HTMLElement
  ): HotspotHandle | null {
    const rect = mapElement.getBoundingClientRect();

    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();

    raycaster.setFromCamera(mouse, camera);

    const objects: THREE.Object3D[] = [];

    this.hotspots.forEach((hotspot) => {
      objects.push(hotspot.group);
    });

    const intersections = raycaster.intersectObjects(objects, true);

    if (intersections.length === 0) {
      // Fallback: screen-space distance check to handle
      // Google Maps WebGLOverlayView projection mismatches.
      return this.pickHotspotByScreenDistance(
        event,
        rect,
        camera
      );
    }

    let current: THREE.Object3D | null = intersections[0].object;

    while (current) {
      if (current.userData.type === "hotspot") {
        const hotspotId = current.userData.hotspotId as string;

        return this.getHotspot(hotspotId);
      }

      current = current.parent;
    }

    return null;
  }

  private pickHotspotByScreenDistance(
    event: MouseEvent,
    rect: DOMRect,
    camera: THREE.Camera
  ): HotspotHandle | null {
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    let bestMatch: HotspotHandle | null = null;
    let bestDist = Infinity;

    this.hotspots.forEach((hotspot) => {
      const worldPos = new THREE.Vector3();

      hotspot.group.getWorldPosition(worldPos);

      // Use the stored local position projected onto the screen
      // via getWorldPosition. In WebGLOverlayView the projection
      // matrix is already set on the camera, so we can project.
      const screenPos = worldPos.clone();

      // Convert world position to NDC using the camera's view-projection
      // matrix (which comes from Google Maps transformer).
      const ndc = screenPos.project(camera);

      if (ndc.z < 0 || ndc.z > 1) return;

      const screenX = (ndc.x * 0.5 + 0.5) * rect.width;
      const screenY = (-ndc.y * 0.5 + 0.5) * rect.height;

      const distPx = Math.hypot(screenX - clickX, screenY - clickY);

      if (distPx <= 50 && distPx < bestDist) {
        bestDist = distPx;
        bestMatch = hotspot;
      }
    });

    return bestMatch;
  }

  update(time: number) {
    this.hotspots.forEach((hotspot) => {
      const pulse = (time * 0.9) % 1;

      hotspot.ring.scale.setScalar(1 + pulse * 1.4);

      (hotspot.ring.material as THREE.MeshBasicMaterial).opacity =
        (1 - pulse) * 0.6;

      hotspot.core.scale.setScalar(1 + Math.sin(time * 3) * 0.12);

      const parent = hotspot.group.parent;
      if (!parent) return;

      // ── Keep the hotspot at a FIXED world position regardless of the
      //    model's heading rotation. The hotspot's local position is
      //    counter-rotated around the parent's origin so that the world
      //    position stays the same even when the pivot rotates. ──
      const parentWorldQuat = new THREE.Quaternion();
      parent.getWorldQuaternion(parentWorldQuat);

      // Counter-rotate the local position around the parent's origin.
      // The original local position was defined in the model's un-rotated
      // frame; applying the inverse parent rotation brings it back to the
      // world frame the hotspot was originally placed in.
      hotspot.group.position
        .copy(hotspot.originalPosition)
        .applyQuaternion(parentWorldQuat.clone().invert());

      // Counter-rotate so hotspot stays upright regardless of parent rotation
      hotspot.group.quaternion.copy(parentWorldQuat.clone().invert());
    });
  }

  dispose() {
    this.hotspots.forEach((hotspot) => {
      hotspot.group.removeFromParent();

      hotspot.core.geometry.dispose();

      (hotspot.core.material as THREE.Material).dispose();

      hotspot.ring.geometry.dispose();

      (hotspot.ring.material as THREE.Material).dispose();

      // Dispose edge ring too
      const edgeRing = hotspot.group.children.find(
        (child) => (child as THREE.Mesh).isMesh && child !== hotspot.core && child !== hotspot.ring
      ) as THREE.Mesh | undefined;

      if (edgeRing) {
        edgeRing.geometry.dispose();

        (edgeRing.material as THREE.Material).dispose();
      }
    });

    this.hotspots.clear();
  }
}

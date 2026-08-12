import * as THREE from "three";
import { HotspotConfig } from "../types/hotspot";

export type ClickResult =
  | { type: "select" | "navigate" | "created"; hotspot: HotspotConfig }
  | { type: "nothing" };

const UNSELECTED_COLOR = 0x00aaff;
const SELECTED_COLOR = 0xffaa00;

export class HotspotManager {
  private model: THREE.Object3D;
  private raycaster = new THREE.Raycaster();
  private surfaceRaycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hotspotObjects: THREE.Object3D[] = [];
  private hotspots: HotspotConfig[];
  private selectedId: string | null = null;
  private hotspotMeshes = new Map<string, THREE.Mesh>();

  // Distance the flat marker disc is lifted off the surface it's anchored
  // to, ALONG THE SURFACE NORMAL. Must be larger than the disc radius
  // (0.18) so the billboarded disc NEVER intersects the wall/floor plane
  // at any viewing angle. That geometric separation is what permanently
  // kills the z-fighting / half-in-half-out wall clipping flicker during
  // a 360° rotation, while depth testing still handles wall occlusion.
  private static readonly HOTSPOT_LIFT = 0.25;
  private static readonly DEFAULT_NORMAL = new THREE.Vector3(0, 1, 0);

  constructor(model: THREE.Object3D, initialHotspots: HotspotConfig[] = []) {
    this.model = model;

    this.hotspots = initialHotspots.map((hotspot) => ({
      ...hotspot,
      position: hotspot.position.clone(),
      cameraPosition: hotspot.cameraPosition.clone(),
      cameraTarget: hotspot.cameraTarget.clone(),
    }));

    this.hotspots.forEach((hotspot) => {
      this.createHotspotObject(hotspot);
    });
  }

  // Creates the anchor+disc pair and registers it as raycast-able.
  // Used both for the seeded hotspots at load time and for hotspots
  // placed dynamically in edit mode — one code path, not two.
  private createHotspotObject(config: HotspotConfig, localNormal?: THREE.Vector3) {
    const anchor = new THREE.Object3D();
    anchor.name = `anchor-${config.id}`;
    anchor.position.copy(config.position);
    anchor.userData.roomId = config.id;
    // Local (model-space) surface normal the hotspot sits on. Used to lift
    // the marker off the surface along its normal (see updateMarkers).
    anchor.userData.normal = (localNormal ?? this.findSurfaceNormal(config.position)).clone();
    this.model.add(anchor);

    const mesh = new THREE.Mesh(
      // UNCHANGED shape: same flat 2D circle marker as before.
      new THREE.CircleGeometry(0.18, 32),
      new THREE.MeshBasicMaterial({
        color: UNSELECTED_COLOR,
        side: THREE.DoubleSide,
        // depthTest:true -> the GPU depth buffer correctly hides markers
        // behind walls (a bedroom hotspot is never visible from the living
        // room). depthWrite:false -> the marker never writes depth, so it
        // can't occlude other markers / geometry.
        // No z-fighting: updateMarkers() lifts the disc off the surface
        // along its normal by HOTSPOT_LIFT (> disc radius), so the disc
        // physically cannot intersect the wall/floor plane while depth
        // testing against all OTHER geometry still works correctly.
        depthTest: true,
        depthWrite: false,
      })
    );
    mesh.name = `hotspot-${config.id}`;
    mesh.userData.roomId = config.id;
    mesh.userData.label = config.label;
    // Initial flat orientation; updateMarkers() billboards it toward the
    // camera every frame so it always renders as a clean flat 2D circle.
    mesh.rotation.x = -Math.PI / 2;
    anchor.add(mesh);

    this.hotspotObjects.push(mesh);
    this.hotspotMeshes.set(config.id, mesh);
  }

  // Updates the circle color so the currently selected hotspot is visually
  // distinct from the rest. Called on every selection change.
  private updateSelectionVisuals() {
    this.hotspotMeshes.forEach((mesh, id) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.setHex(id === this.selectedId ? SELECTED_COLOR : UNSELECTED_COLOR);
    });
  }

  // Billboard every hotspot marker toward the camera (keeps it a flat 2D
  // circle from any angle) and lift it off the surface along the stored
  // surface normal, so it never clips the wall/floor while rotating.
  updateMarkers(camera: THREE.Camera) {
    this.model.updateWorldMatrix(true, true);

    this.hotspotMeshes.forEach((mesh) => {
      const anchor = mesh.parent;
      if (!anchor) return;

      // Get the anchor's world position, then orient the disc so its
      // +Z normal points from the anchor toward the camera.
      const worldPos = new THREE.Vector3();
      anchor.getWorldPosition(worldPos);

      const direction = new THREE.Vector3().subVectors(camera.position, worldPos);
      if (direction.lengthSq() < 1e-6) {
        // Degenerate: camera exactly on the marker. Keep current facing.
        return;
      }
      direction.normalize();

      // The disc's local +Z is its face normal (CircleGeometry lies in
      // the XY plane, so after the -PI/2 X rotation the normal is +Z).
      // Build a quaternion that rotates +Z to point at the camera.
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        direction
      );

      // Apply in world space: the anchor may be nested inside the model
      // which itself may be transformed. Convert the world quaternion to
      // the anchor's local frame.
      const parentWorldQuat = new THREE.Quaternion();
      anchor.getWorldQuaternion(parentWorldQuat);
      mesh.quaternion.copy(parentWorldQuat.clone().invert().multiply(quaternion));

      // Lift the disc off the surface along its NORMAL (not towards the
      // camera). Lifting towards the camera would still let the disc clip
      // the wall at grazing angles; lifting along the surface normal by
      // more than the disc radius guarantees the whole circle stays in
      // front of the wall for every camera angle. This is what eliminates
      // the flicker/glitch during a 360° rotation.
      const normalLocal =
        (anchor.userData.normal as THREE.Vector3 | undefined) ?? HotspotManager.DEFAULT_NORMAL;
      const normalWorld = normalLocal.clone().transformDirection(this.model.matrixWorld);
      const normalInAnchor = normalWorld.clone().applyQuaternion(parentWorldQuat.clone().invert());
      mesh.position.copy(normalInAnchor).multiplyScalar(HotspotManager.HOTSPOT_LIFT);
    });
  }

  // Estimates the surface normal under a hotspot position by raycasting
  // straight down from above (mainly for seeded hotspots loaded from JSON,
  // which don't carry a stored normal). Falls back to "up".
  private findSurfaceNormal(localPosition: THREE.Vector3): THREE.Vector3 {
    const origin = localPosition.clone();
    origin.y += 2;

    this.surfaceRaycaster.set(origin, new THREE.Vector3(0, -1, 0));

    const hits = this.surfaceRaycaster.intersectObject(this.model, true);
    if (hits.length > 0 && hits[0].face) {
      return this.toModelLocalDirection(hits[0].face.normal, hits[0].object);
    }

    return HotspotManager.DEFAULT_NORMAL.clone();
  }

  // Converts a direction from a mesh's local space to this.model's local
  // space (the space the hotspot anchors live in).
  private toModelLocalDirection(
    meshLocalDir: THREE.Vector3,
    meshObj: THREE.Object3D
  ): THREE.Vector3 {
    this.model.updateWorldMatrix(true, true);

    const worldDir = meshLocalDir.clone().transformDirection(meshObj.matrixWorld);

    const modelWorldQuat = new THREE.Quaternion();
    this.model.getWorldQuaternion(modelWorldQuat);

    return worldDir.applyQuaternion(modelWorldQuat.clone().invert()).normalize();
  }

  getHotspots(): HotspotConfig[] {
    return this.hotspots.map((hotspot) => ({
      ...hotspot,
      position: hotspot.position.clone(),
      cameraPosition: hotspot.cameraPosition.clone(),
      cameraTarget: hotspot.cameraTarget.clone(),
    }));
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  select(id: string) {
    this.selectedId = id;
    this.updateSelectionVisuals();
  }

  clearSelection() {
    this.selectedId = null;
    this.updateSelectionVisuals();
  }

  getSelectedHotspot(): HotspotConfig | null {
    return this.hotspots.find((hotspot) => hotspot.id === this.selectedId) ?? null;
  }

  handleClick(
    event: PointerEvent,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    editMode: boolean
  ): ClickResult {
    const rect = renderer.domElement.getBoundingClientRect();

    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);

    // 1. Did we click an existing hotspot marker?
    const hotspotHits = this.raycaster.intersectObjects(this.hotspotObjects, true);
    if (hotspotHits.length > 0) {
      const roomId = hotspotHits[0].object.userData.roomId as string;

      const hotspot = this.hotspots.find((item) => item.id === roomId);
      if (!hotspot) return { type: "nothing" };

      if (editMode) {
        this.selectedId = roomId;
        this.updateSelectionVisuals();
        return { type: "select", hotspot };
      }

      return { type: "navigate", hotspot };
    }

    // 2. Not editing -> clicking empty space/model does nothing else.
    if (!editMode) return { type: "nothing" };

    // 3. Editing and no hotspot hit -> place a new one where the
    //    click actually lands on the model surface.
    const modelHits = this.raycaster.intersectObject(this.model, true);
    if (modelHits.length === 0) return { type: "nothing" };

    // IMPORTANT: model.worldToLocal() mutates its argument in
    // place and returns the same reference. Clone BEFORE
    // converting, or the "worldPoint" you think you still have
    // silently becomes a local-space point too.
    const worldPoint = modelHits[0].point.clone();
    const localPoint = this.model.worldToLocal(worldPoint.clone());

    // Capture the surface normal where the user clicked so the marker can
    // be lifted along it (no clipping/flicker during rotation).
    const localNormal = modelHits[0].face
      ? this.toModelLocalDirection(modelHits[0].face.normal, modelHits[0].object)
      : this.findSurfaceNormal(localPoint);

    // Save the CURRENT camera position, not a synthetic close-up.
    // The previous behavior computed a fixed 2.5-unit offset from
    // the clicked point — so if the user placed the hotspot from a
    // farther view, clicking it later flew the camera in much
    // closer than the view they actually created it in (an
    // unexpected "zoom in" jump). Using the real camera position
    // preserves the exact distance/zoom at creation time.
    const defaultCameraPosition = camera.position.clone();

    const id = `hotspot-${Date.now()}`;
    const newHotspot: HotspotConfig = {
      id,
      label: `New Hotspot ${this.hotspots.length + 1}`,
      position: localPoint,
      cameraPosition: defaultCameraPosition,
      cameraTarget: worldPoint.clone(),
    };

    this.hotspots = [...this.hotspots, newHotspot];
    this.createHotspotObject(newHotspot, localNormal);
    this.selectedId = id;
    this.updateSelectionVisuals();

    return { type: "created", hotspot: newHotspot };
  }

  rename(id: string, label: string) {
    this.hotspots = this.hotspots.map((h) => (h.id === id ? { ...h, label } : h));

    const anchor = this.model.getObjectByName(`anchor-${id}`);
    const mesh = anchor?.getObjectByName(`hotspot-${id}`);
    if (mesh) mesh.userData.label = label;
  }

  captureCamera(id: string, camera: THREE.Camera, controls: { target: THREE.Vector3 }) {
    this.hotspots = this.hotspots.map((h) =>
      h.id === id
        ? { ...h, cameraPosition: camera.position.clone(), cameraTarget: controls.target.clone() }
        : h
    );
  }

  delete(id: string) {
    const anchor = this.model.getObjectByName(`anchor-${id}`);
    if (anchor) {
      anchor.traverse((object) => {
        const mesh = object as THREE.Mesh;

        if (!mesh.isMesh) return;

        mesh.geometry?.dispose();

        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((m: THREE.Material) => m.dispose());
        }
      });
      anchor.parent?.remove(anchor);
    }

    this.hotspotObjects = this.hotspotObjects.filter((obj) => obj.userData.roomId !== id);
    this.hotspotMeshes.delete(id);
    this.hotspots = this.hotspots.filter((h) => h.id !== id);

    if (this.selectedId === id) {
      this.selectedId = null;
      this.updateSelectionVisuals();
    }
  }

  exportJSON(modelName: string) {
    const data = {
      model: modelName,
      hotspots: this.hotspots.map((h) => ({
        id: h.id,
        label: h.label,
        position: { x: h.position.x, y: h.position.y, z: h.position.z },
        cameraPosition: { x: h.cameraPosition.x, y: h.cameraPosition.y, z: h.cameraPosition.z },
        cameraTarget: { x: h.cameraTarget.x, y: h.cameraTarget.y, z: h.cameraTarget.z },
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hotspots.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  dispose() {
    this.hotspotObjects = [];
    this.hotspotMeshes.clear();
    this.hotspots = [];
    this.selectedId = null;
  }
}
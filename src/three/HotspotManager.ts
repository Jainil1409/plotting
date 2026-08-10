import * as THREE from "three";
import { HotspotConfig } from "../types/hotspot";

export type ClickResult =
  | { type: "select" | "navigate" | "created"; hotspot: HotspotConfig }
  | { type: "nothing" };

export class HotspotManager {
  private model: THREE.Object3D;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hotspotObjects: THREE.Object3D[] = [];
  private hotspots: HotspotConfig[];
  private selectedId: string | null = null;

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

  // Creates the anchor+sphere pair and registers it as raycast-able.
  // Used both for the seeded hotspots at load time and for hotspots
  // placed dynamically in edit mode — one code path, not two.
  private createHotspotObject(config: HotspotConfig) {
    const anchor = new THREE.Object3D();
    anchor.name = `anchor-${config.id}`;
    anchor.position.copy(config.position);
    anchor.userData.roomId = config.id;
    this.model.add(anchor);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x00aaff })
    );
    mesh.name = `hotspot-${config.id}`;
    mesh.userData.roomId = config.id;
    mesh.userData.label = config.label;
    anchor.add(mesh);

    this.hotspotObjects.push(mesh);
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
  }

  clearSelection() {
    this.selectedId = null;
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

    // 1. Did we click an existing hotspot sphere?
    const hotspotHits = this.raycaster.intersectObjects(this.hotspotObjects, true);
    if (hotspotHits.length > 0) {
      const roomId = hotspotHits[0].object.userData.roomId as string;

      const hotspot = this.hotspots.find((item) => item.id === roomId);
      if (!hotspot) return { type: "nothing" };

      if (editMode) {
        this.selectedId = roomId;
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

    // Default the camera preset to a close-up view CENTERED ON
    // the exact point you clicked — not whatever the camera
    // happened to be doing at click time.
    const defaultDistance = 2.5;
    const viewDirection = new THREE.Vector3().subVectors(camera.position, worldPoint);
    if (viewDirection.lengthSq() < 1e-6) {
      // Degenerate case: camera sitting exactly on the clicked
      // point. Fall back to a generic "slightly above and in
      // front" direction instead of producing a NaN offset.
      viewDirection.set(0, 0.4, 1);
    }
    viewDirection.normalize();

    const defaultCameraPosition = worldPoint.clone().addScaledVector(viewDirection, defaultDistance);
    defaultCameraPosition.y += 0.4; // slight eye-level lift

    const id = `hotspot-${Date.now()}`;
    const newHotspot: HotspotConfig = {
      id,
      label: `New Hotspot ${this.hotspots.length + 1}`,
      position: localPoint,
      cameraPosition: defaultCameraPosition,
      cameraTarget: worldPoint.clone(),
    };

    this.hotspots = [...this.hotspots, newHotspot];
    this.createHotspotObject(newHotspot);
    this.selectedId = id;

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
      anchor.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m: THREE.Material) => m.dispose());
        }
      });
      anchor.parent?.remove(anchor);
    }

    this.hotspotObjects = this.hotspotObjects.filter((obj) => obj.userData.roomId !== id);
    this.hotspots = this.hotspots.filter((h) => h.id !== id);

    if (this.selectedId === id) {
      this.selectedId = null;
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
    this.hotspots = [];
    this.selectedId = null;
  }
}
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
  private mouse = new THREE.Vector2();
  private hotspotObjects: THREE.Object3D[] = [];
  private hotspots: HotspotConfig[];
  private selectedId: string | null = null;
  private hotspotMeshes = new Map<string, THREE.Mesh>();

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
      new THREE.CircleGeometry(0.18, 32),
      new THREE.MeshBasicMaterial({
        color: UNSELECTED_COLOR,
        side: THREE.DoubleSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    mesh.name = `hotspot-${config.id}`;
    mesh.userData.roomId = config.id;
    mesh.userData.label = config.label;
    mesh.rotation.x = -Math.PI / 2;
    anchor.add(mesh);

    this.hotspotObjects.push(mesh);
    this.hotspotMeshes.set(config.id, mesh);
  }

  // Updates the sphere color so the currently selected hotspot is visually
  // distinct from the rest. Called on every selection change.
  private updateSelectionVisuals() {
    this.hotspotMeshes.forEach((mesh, id) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.setHex(id === this.selectedId ? SELECTED_COLOR : UNSELECTED_COLOR);
    });
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

    // 1. Did we click an existing hotspot sphere?
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
    this.createHotspotObject(newHotspot);
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

# Plotting Project — File & Flow Documentation

This document describes every file in the project, what functionality it provides, and how the data flows through the application.

---

## 1. Project Overview

This is a **Next.js** application that renders **3D models on a Google Map** using the Google Maps JavaScript API's `WebGLOverlayView` combined with **Three.js**. It supports:

- Placing a 3D house model on a real-world map (Ahmedabad, India by default).
- Moving the model to any map location via a "Move Model" placement mode.
- Rotating/tilting the map and adjusting the model's heading (compass direction).
- Clicking on individual model meshes to show **property details** (price, BHK, area) in a popup.
- Clicking **hotspots** (pulsing 3D markers) attached to the model to open a **full-screen apartment viewer**.
- The apartment viewer supports **hotspot editing** (create, rename, capture camera, delete, export JSON).

---

## 2. Directory Structure

```
plotting/
├── app/
│   └── page.tsx                     # Next.js entry point
├── public/
│   └── model/                       # GLB model files (house, apartment, etc.)
└── src/
    ├── components/
    │   ├── GoogleMap3D.tsx          # Main map + 3D model component
    │   ├── ModelViewerOverlay.tsx   # Overlay wrapper for the apartment viewer
    │   ├── ModelViewer.tsx          # Full-screen 3D apartment viewer
    │   ├── HotspotEditorPanel.tsx   # UI panel for editing hotspots
    │   └── ObjectSymbol3DMap.tsx    # (Alternative) ArcGIS-based 3D map
    ├── data/
    │   ├── models.ts                # Model registry (id → URL/scale/heading)
    │   ├── properties.ts            # Property details keyed by mesh name
    │   ├── hotspots.ts              # Map-model hotspots (house ↔ apartment)
    │   └── hotspots.json            # Seed hotspot data for the apartment viewer
    ├── three/
    │   ├── scene/
    │   │   ├── createScene.ts       # Creates a Three.js Scene
    │   │   ├── createCamera.ts      # Creates a PerspectiveCamera
    │   │   ├── createLighting.ts    # Adds ambient/hemisphere/directional lights
    │   │   └── GoogleMapsThreeRenderer.ts  # Bridges Three.js with Google Maps WebGLOverlayView
    │   ├── models/
    │   │   ├── modelTypes.ts        # TypeScript types for model config/loaded model
    │   │   ├── modelUtils.ts        # Material normalization + pivot building
    │   │   └── ModelManager.ts      # Loads, adds, removes, rotates, disposes GLB models
    │   ├── hotspots/
    │   │   ├── hotspotTypes.ts      # Types for map-model hotspots
    │   │   └── HotspotManager.ts    # Creates/attaches/picks/animates map hotspots
    │   ├── interaction/
    │   │   └── ModelInteractionManager.ts  # Raycast picking for property selection
    │   ├── ModelLoader.ts           # Loads GLB for the apartment viewer
    │   ├── CameraController.ts      # OrbitControls + camera framing + GSAP transitions
    │   ├── ViewerScene.ts           # Scene/renderer/lights for the apartment viewer
    │   └── HotspotManager.ts        # Hotspot create/select/navigate for the apartment viewer
    └── types/
        └── hotspot.ts               # HotspotConfig type for the apartment viewer
```

---

## 3. File-by-File Functionality

### 3.1 Entry Point

| File | Purpose |
|------|---------|
| `app/page.tsx` | Renders the `GoogleMap3D` component full-screen. This is the single page of the app. |

---

### 3.2 Components (`src/components/`)

#### `GoogleMap3D.tsx` — **Main Map + 3D Model Component**

This is the heart of the application. It:

1. **Loads the Google Maps API** dynamically (injects a `<script>` tag with the API key).
2. **Creates a Google Map** centered on Ahmedabad (23.0225, 72.5714) at zoom 18, tilt 45°.
3. **Creates a `GoogleMapsThreeRenderer`** which attaches a Three.js scene to the map's `WebGLOverlayView`.
4. **Loads the house model** (`/model/modern_house_06.glb`) via `ModelManager` and adds it to the scene.
5. **Creates hotspots** for the house from `HOTSPOTS["house"]` and attaches them to the model's pivot.
6. **Handles clicks** on the map:
   - **Alt+Click** → calibration mode (logs pivot-local coordinates of the clicked point).
   - **Hotspot click** → opens the `ModelViewerOverlay` (apartment viewer).
   - **Model mesh click** → shows a property popup via `ModelInteractionManager`.
7. **UI Controls** (all styled as floating glassmorphism buttons):
   - **Move Model** (top-left) → enters placement mode; clicking the map re-anchors the model.
   - **Rotate** (top-right) → rotates the map heading by ±45°.
   - **Tilt** (top-right) → tilts the map up/down by 8°.
   - **Drag to rotate 360°** (bottom-right) → pointer-drag rotates the map heading.
   - **Model Direction compass** (bottom-left) → opens a compass popup to set the model's heading (N/NE/E/SE/S/SW/W/NW + slider).
8. **Property popup** — displays name, BHK, area, and price when a mesh is clicked.

#### `ModelViewerOverlay.tsx` — **Overlay Wrapper**

- A thin wrapper that renders `<ModelViewer>` with a given `modelUrl` and an `onBack` callback.
- Mounted/unmounted by `GoogleMap3D` when `apartmentOpen` is toggled.

#### `ModelViewer.tsx` — **Full-Screen Apartment Viewer**

A completely independent 3D viewer (separate canvas, renderer, camera) that:

1. **Creates a `ViewerScene`** (scene + renderer + lights).
2. **Creates a `CameraController`** (OrbitControls + auto-framing).
3. **Loads the apartment model** (`/model/appartement.glb`) via `ModelLoader`.
4. **Creates a `HotspotManager`** seeded from `hotspots.json`.
5. **Handles pointer clicks**:
   - In **view mode**: clicking a hotspot navigates the camera to that hotspot's saved position/target (GSAP animation).
   - In **edit mode**: clicking a hotspot selects it; clicking the model surface creates a new hotspot.
6. **UI**:
   - **← Back to house** button → calls `onBack()` to unmount the viewer.
   - **Edit hotspots** toggle → shows/hides the `HotspotEditorPanel`.
   - **Loading** indicator while the model loads.
7. **Animation loop** — `requestAnimationFrame` updates the camera controls and renders each frame.
8. **Resize handling** — updates renderer size and camera aspect on window resize.
9. **Cleanup** — disposes the hotspot manager, camera controller, and viewer scene on unmount.

#### `HotspotEditorPanel.tsx` — **Hotspot Editing UI**

A bottom panel shown in edit mode that provides:

- A **list of hotspots** (click to select).
- **Rename** input for the selected hotspot.
- **Capture Camera** button — saves the current camera position/target to the selected hotspot.
- **Delete** button — removes the selected hotspot.
- **Export JSON** button — downloads the current hotspots as a JSON file.

#### `ObjectSymbol3DMap.tsx` — **ArcGIS Alternative (Not Used in Main Flow)**

- An alternative implementation using **ArcGIS JS API** (`@arcgis/core`).
- Creates a `SceneView` with a `GraphicsLayer` and places a 3D GLB model (`brutalist_building.glb`) as an `ObjectSymbol3DLayer`.
- Not wired into the main page; kept as a separate experiment.

---

### 3.3 Data (`src/data/`)

| File | Purpose |
|------|---------|
| `models.ts` | Registry of available models (`house`, `apartment`, `clubhouse`) with their URLs, scale, and heading. |
| `properties.ts` | Maps **mesh names** (e.g., `Object_2`) to property details (`name`, `bhk`, `area`, `price`). Used by `ModelInteractionManager` to show popups. |
| `hotspots.ts` | Defines **map-model hotspots** keyed by model id. `house` has a hotspot at `(3.5, 12.0, 2.2)` that points to `/model/appartement.glb`. |
| `hotspots.json` | Seed data for the **apartment viewer** — 4 hotspots with positions, camera positions, and camera targets. |

---

### 3.4 Three.js Scene Layer (`src/three/scene/`)

| File | Purpose |
|------|---------|
| `createScene.ts` | Returns a new `THREE.Scene`. |
| `createCamera.ts` | Returns a new `THREE.PerspectiveCamera`. |
| `createLighting.ts` | Adds ambient, hemisphere, and two directional lights to the scene. |
| `GoogleMapsThreeRenderer.ts` | **Bridges Three.js with Google Maps.** Creates a `WebGLOverlayView`, reuses the map's WebGL context for a `THREE.WebGLRenderer`, sets up PBR environment mapping, and on each `onDraw` frame: updates the camera projection matrix from the map's transformer, calls the `onDrawCallback` (for hotspot animation), and renders the scene. |

---

### 3.5 Model Management (`src/three/models/`)

| File | Purpose |
|------|---------|
| `modelTypes.ts` | Defines `ModelAnchor`, `ModelConfig`, and `LoadedModel` types. |
| `modelUtils.ts` | `normalizeMaterialsAndCollectMeshes` — traverses the model, collects meshes, disables frustum culling, sets double-sided materials, and normalizes PBR properties. `buildPivotFromModel` — scales the model to a target max dimension, rotates it upright, centers it, and wraps it in a pivot group that can be rotated for heading. |
| `ModelManager.ts` | Loads a GLB via `GLTFLoader`, normalizes materials, builds the pivot, and provides `addModel`, `removeModel`, `setHeading`, and `dispose` methods. |

---

### 3.6 Map Hotspots (`src/three/hotspots/`)

| File | Purpose |
|------|---------|
| `hotspotTypes.ts` | Defines `HotspotConfig` (id, position, nextModelUrl) and `HotspotHandle` (group, core mesh, ring mesh). |
| `HotspotManager.ts` | Creates a hotspot as a `THREE.Group` with a **core sphere** + **pulsing ring** + **edge ring**. Provides: `createHotspot`, `attachHotspot`, `removeHotspot`, `getHotspot`, `getAllHotspots`, `pickHotspotAt` (raycast + screen-distance fallback), `update` (pulse animation + counter-rotation to stay upright), and `dispose`. |

---

### 3.7 Interaction (`src/three/interaction/`)

| File | Purpose |
|------|---------|
| `ModelInteractionManager.ts` | Handles **property selection** on the map model. `pickMesh` raycasts against the model's meshes (with a screen-projection fallback for Google Maps projection mismatches). `handleClick` returns a `PropertyPopup` with the mesh name and its property details. `calibrateLocalPosition` is a dev helper for Alt+click calibration. |

---

### 3.8 Apartment Viewer Layer (`src/three/`)

| File | Purpose |
|------|---------|
| `ModelLoader.ts` | Loads a GLB model and returns `{ model, size, center }` (bounding box info). Logs the bounding box and node names for calibration. |
| `CameraController.ts` | Wraps `OrbitControls`. Provides `frameModel` (auto-frames the camera at the living room area), `goToHotspot` (GSAP-animates the camera to a hotspot's saved position/target), `capture` (returns current camera position/target), and `dispose`. |
| `ViewerScene.ts` | Creates the scene, renderer (with ACES tone mapping), and lights for the apartment viewer. Handles WebGL context loss and disposes all geometries/materials/textures on cleanup. |
| `HotspotManager.ts` | Manages hotspots **inside the apartment viewer**. Creates anchor + sphere objects, handles clicks (select in edit mode, navigate in view mode, create new on model surface in edit mode), renames, captures camera, deletes, exports JSON, and disposes. |

---

### 3.9 Types (`src/types/`)

| File | Purpose |
|------|---------|
| `hotspot.ts` | Defines `HotspotConfig` for the apartment viewer: `id`, `label`, `position`, `cameraPosition`, `cameraTarget` (all `THREE.Vector3`). |

---

## 4. Application Flow

### 4.1 Initial Load Flow

```
app/page.tsx
    └── <GoogleMap3D />
            │
            ├── 1. Load Google Maps API script (dynamic <script> injection)
            │
            ├── 2. Create google.maps.Map (center: Ahmedabad, zoom 18, tilt 45)
            │
            ├── 3. Create GoogleMapsThreeRenderer
            │       ├── createScene() → THREE.Scene
            │       ├── createCamera() → THREE.PerspectiveCamera
            │       ├── createLighting(scene) → ambient + hemisphere + 2 directional
            │       └── attachToMap(map) → WebGLOverlayView
            │               ├── onContextRestored → THREE.WebGLRenderer (reuses map GL context)
            │               └── onDraw → update camera projection + render scene
            │
            ├── 4. Create ModelInteractionManager (property selection)
            │
            ├── 5. ModelManager.loadModel(config) → LoadedModel
            │       ├── GLTFLoader.loadAsync("/model/modern_house_06.glb")
            │       ├── normalizeMaterialsAndCollectMeshes(model)
            │       └── buildPivotFromModel(model, heading, scale)
            │
            ├── 6. addModel(scene, loadedModel) → scene.add(pivot)
            │
            ├── 7. interactionManager.setMeshes(loaded.meshes)
            │
            ├── 8. For each hotspot in HOTSPOTS["house"]:
            │       ├── hotspotManager.createHotspot(config)
            │       └── hotspotManager.attachHotspot(pivot, hotspot)
            │
            └── 9. renderer.requestRedraw()
```

### 4.2 Click Interaction Flow (on the map)

```
User clicks on the map
    └── handleScenePick(event)
            │
            ├── Is placement mode active? → ignore (placement click handled by map listener)
            │
            ├── Alt+Click? → calibrateLocalPosition() → log pivot-local coords
            │
            ├── hotspotManager.pickHotspotAt(event, camera, mapElement)
            │       ├── Raycast against hotspot groups
            │       └── Fallback: screen-distance check (≤50px)
            │
            │   ┌── Hotspot hit? → setApartmentOpen(true) → mounts <ModelViewerOverlay>
            │   │
            │   └── No hotspot hit ↓
            │
            └── interactionManager.handleClick(event, camera, mapElement)
                    ├── pickMesh() → raycast + screen-projection fallback
                    ├── Look up mesh name in PROPERTY_DETAILS
                    └── If found → setPropertyPopup({x, y, meshName, details})
```

### 4.3 Move Model Flow

```
User clicks "Move Model" button
    └── enterPlacementMode()
            ├── placementMode = true
            └── map.addListener("click", ...)
                    │
                    └── User clicks map
                            ├── Get lat/lng from click
                            ├── Update anchorRef / modelConfigRef
                            ├── map.setCenter(lat, lng), setZoom(18), setTilt(45)
                            ├── renderer.setAnchor(anchor)
                            ├── renderer.requestRedraw()
                            └── placementMode = false
```

### 4.4 Model Heading Flow

```
User opens compass (bottom-left) and picks a direction (e.g., "N" = 0°)
    └── setModelHeading(degrees)
            ├── modelManager.setHeading(loadedModel, degrees)
            │       └── pivot.rotation.z = degToRad(degrees)
            ├── setModelHeadingDeg(degrees)  → updates compass UI
            └── setModelConfig({...prev, heading: degrees})
```

### 4.5 Apartment Viewer Flow (Hotspot Click)

```
Hotspot clicked on map model
    └── setApartmentOpen(true)
            └── <ModelViewerOverlay modelUrl="/model/appartement.glb" onBack={...} />
                    └── <ModelViewer modelUrl onBack />
                            │
                            ├── 1. Create ViewerScene (scene + renderer + lights)
                            ├── 2. Create CameraController (OrbitControls)
                            ├── 3. ModelLoader.load("/model/appartement.glb")
                            │       └── returns { model, size, center }
                            ├── 4. viewer.scene.add(model)
                            ├── 5. Create HotspotManager(model, seedHotspots from hotspots.json)
                            ├── 6. cameraController.frameModel(size, center)
                            ├── 7. Start animation loop (requestAnimationFrame)
                            │
                            ├── User clicks a hotspot (view mode)
                            │       └── cameraController.goToHotspot(hotspot)
                            │               └── GSAP animates camera.position + controls.target
                            │
                            ├── User toggles "Edit hotspots"
                            │       └── <HotspotEditorPanel> appears
                            │               ├── Click model surface → creates new hotspot
                            │               ├── Click hotspot → selects it
                            │               ├── Rename / Capture Camera / Delete / Export JSON
                            │
                            └── User clicks "← Back to house"
                                    └── onBack() → setApartmentOpen(false) → unmounts viewer
```

---

## 5. Data Dependencies

| Data Source | Used By | Purpose |
|-------------|---------|---------|
| `PROPERTY_DETAILS` (`data/properties.ts`) | `GoogleMap3D` → `ModelInteractionManager` | Maps mesh names to property info for popups. |
| `HOTSPOTS` (`data/hotspots.ts`) | `GoogleMap3D` | Map-model hotspots (house → apartment navigation). |
| `hotspots.json` | `ModelViewer` | Seed hotspots for the apartment viewer. |
| `MODELS` (`data/models.ts`) | (Registry) | Available model definitions. |
| `/model/modern_house_06.glb` | `GoogleMap3D` | The house model placed on the map. |
| `/model/appartement.glb` | `ModelViewer` | The apartment model shown in the full-screen viewer. |

---

## 6. Key Design Decisions

1. **Two separate Three.js pipelines**:
   - **Map pipeline** (`GoogleMapsThreeRenderer` + `ModelManager` + map `HotspotManager`) — renders inside Google Maps' `WebGLOverlayView`.
   - **Viewer pipeline** (`ViewerScene` + `ModelLoader` + `CameraController` + viewer `HotspotManager`) — a standalone full-screen canvas.

2. **Hotspot click → overlay mount** — clicking a map hotspot does NOT swap scenes inside the map's WebGL overlay. Instead, it flips a React state (`apartmentOpen`) that mounts a completely independent `<ModelViewerOverlay>`.

3. **Raycast fallbacks** — both `HotspotManager.pickHotspotAt` and `ModelInteractionManager.pickMesh` include a **screen-projection fallback** to handle Google Maps `WebGLOverlayView` projection mismatches.

4. **Pivot-based model placement** — the model is wrapped in a pivot group so heading rotation and map anchoring are independent.

5. **Full resource disposal** — every manager (`ModelManager`, `HotspotManager`, `ViewerScene`, `CameraController`) explicitly disposes geometries, materials, textures, and renderers on unmount to prevent memory leaks.

---

## 7. How to Run

```bash
cd plotting
npm install
npm run dev
```

Then open `http://localhost:3000` in a browser.
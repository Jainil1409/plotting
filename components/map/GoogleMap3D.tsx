/// <reference types="@types/google.maps" />
"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const GOOGLE_MAPS_API_KEY = "AIzaSyBCswT9ODeUU9ByGUjbRg1KzV-nUF3BFkU"; // demo key

// Default anchor — model is visible here on load. User can move it via "Move Model".
const DEFAULT_ANCHOR = { lat: 23.0225, lng: 72.5714, altitude: 0 }; // Ahmedabad
const MODEL_HEADING = 0;

// Describes a placed model instance. Designed to support multiple models later.
type ModelConfig = {
  id: string;
  modelUrl: string;
  anchor: { lat: number; lng: number; altitude: number };
  heading: number;
  scale: number;
};

type PropertyDetails = {
  name: string;
  bhk: string;
  area: number;
  price: string;
};

type PropertyPopup = {
  x: number;
  y: number;
  meshName: string;
  details: PropertyDetails;
};

const PROPERTY_DETAILS: Record<string, PropertyDetails> = {
  Object_2: { name: "Plot A", bhk: "2 BHK", area: 1240, price: "Rs 68 Lakh" },
  Object_3: { name: "Plot B", bhk: "3 BHK", area: 1680, price: "Rs 92 Lakh" },
  Object_4: { name: "Plot C", bhk: "2 BHK", area: 1320, price: "Rs 74 Lakh" },
  Object_5: { name: "Plot D", bhk: "3 BHK", area: 1760, price: "Rs 98 Lakh" },
  Object_6: { name: "Plot E", bhk: "4 BHK", area: 2210, price: "Rs 1.24 Cr" },
  Object_7: { name: "Plot F", bhk: "4 BHK", area: 2300, price: "Rs 1.28 Cr" },
  Object_8: { name: "Plot G", bhk: "3 BHK", area: 1800, price: "Rs 1.02 Cr" },
  Object_9: { name: "Plot H", bhk: "2 BHK", area: 1400, price: "Rs 78 Lakh" },
  Object_10: { name: "Plot I", bhk: "3 BHK", area: 1720, price: "Rs 95 Lakh" },
  Object_11: { name: "Plot J", bhk: "4 BHK", area: 2380, price: "Rs 1.32 Cr" },
  Object_12: { name: "Plot K", bhk: "3 BHK", area: 1780, price: "Rs 99 Lakh" },
  Object_13: { name: "Plot L", bhk: "2 BHK", area: 1300, price: "Rs 72 Lakh" },
  Object_14: { name: "Plot M", bhk: "4 BHK", area: 2400, price: "Rs 1.34 Cr" },
  Object_15: { name: "Plot N", bhk: "3 BHK", area: 1820, price: "Rs 1.04 Cr" },
  Object_16: { name: "Plot O", bhk: "2 BHK", area: 1340, price: "Rs 76 Lakh" },
  Object_17: { name: "Plot P", bhk: "4 BHK", area: 2420, price: "Rs 1.36 Cr" },
};

const getPropertyDetailsForMesh = (meshName: string): PropertyDetails | null => {
  return PROPERTY_DETAILS[meshName] ?? null;
};

const pickMeshByProjectedCenter = (
  meshes: THREE.Mesh[],
  camera: THREE.PerspectiveCamera,
  localX: number,
  localY: number,
  viewportWidth: number,
  viewportHeight: number
): THREE.Mesh | null => {
  let bestMatch: { mesh: THREE.Mesh; score: number } | null = null;

  for (const mesh of meshes) {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    if (!geometry) continue;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    if (!geometry.boundingSphere) continue;

    const centerWorld = geometry.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld);
    const clipCenter = centerWorld.clone().applyMatrix4(camera.projectionMatrix);

    if (clipCenter.z < -1 || clipCenter.z > 1) continue;

    const centerX = (clipCenter.x * 0.5 + 0.5) * viewportWidth;
    const centerY = (-clipCenter.y * 0.5 + 0.5) * viewportHeight;

    const edgeWorld = centerWorld.clone().add(new THREE.Vector3(geometry.boundingSphere.radius, 0, 0));
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
};

export default function GoogleMap3D() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const selectableMeshesRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const overlayRef = useRef<any>(null);

  // anchorRef is read every frame inside onDraw — using a ref avoids
  // re-registering the overlay whenever the anchor state changes.
  const anchorRef = useRef<{ lat: number; lng: number; altitude: number } | null>(DEFAULT_ANCHOR);
  const placementListenerRef = useRef<any>(null);

  const modelConfigRef = useRef<ModelConfig | null>({
    id: "brutalist_building",
    modelUrl: "/model/brutalist_building.glb",
    anchor: DEFAULT_ANCHOR,
    heading: MODEL_HEADING,
    scale: 90,
  });
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(modelConfigRef.current);
  const [placementMode, setPlacementMode] = useState(false);
  const placementModeRef = useRef(false);
  const [propertyPopup, setPropertyPopup] = useState<PropertyPopup | null>(null);
  const [modelHeadingDeg, setModelHeadingDeg] = useState(MODEL_HEADING);
  const [compassOpen, setCompassOpen] = useState(false);
  const dragStateRef = useRef<{ pointerId: number | null; startX: number; startHeading: number; dragging: boolean }>({
    pointerId: null,
    startX: 0,
    startHeading: 0,
    dragging: false,
  });

  useEffect(() => {
    let canceled = false;
    // Re-apply default anchor in case cleanup from a previous
    // StrictMode cycle set it to null.
    anchorRef.current = DEFAULT_ANCHOR;

    const printHierarchy = (object: THREE.Object3D, level = 0) => {
      console.log(`${" ".repeat(level * 2)}${object.name || "(no name)"} - ${object.type}`);
      object.children.forEach((child) => printHierarchy(child, level + 1));
    };

    const loadGoogleMaps = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (typeof window === "undefined") return;
        if ((window as any).google?.maps?.Map) { resolve(); return; }
        const existing = document.getElementById("gmaps-script");
        if (existing) {
          const poll = setInterval(() => {
            if ((window as any).google?.maps?.Map) { clearInterval(poll); resolve(); }
          }, 50);
          return;
        }
        const script = document.createElement("script");
        script.id = "gmaps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=beta`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google Maps script"));
        document.head.appendChild(script);
      });
    };

    (async () => {
      await loadGoogleMaps();
      if (canceled || !mapDiv.current) return;

      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment");
      if (canceled) return;

      const g = (window as any).google as typeof globalThis.google;

      const map = new g.maps.Map(mapDiv.current, {
        center: { lat: DEFAULT_ANCHOR.lat, lng: DEFAULT_ANCHOR.lng },
        zoom: 18,
        tilt: 45,
        heading: 0,
        mapId: "8e0a97af9386fef",
        disableDefaultUI: true,
        rotateControl: true,
        gestureHandling: "greedy",
        keyboardShortcuts: true,
        mapTypeId: "roadmap",
      });
      mapRef.current = map;

      // ── Pre-load the GLB before attaching the overlay so the model is
      // already in the scene when the very first onDraw fires. This is the
      // definitive fix for the hard-refresh partial-model bug.
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xf0f4ff, 0.6));
      const hemi = new THREE.HemisphereLight(0xc9d8f0, 0x8a7f72, 0.8);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
      sun.position.set(2, 4, 3);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
      fill.position.set(-2, 1, -1);
      scene.add(fill);

      const camera = new THREE.PerspectiveCamera();
      cameraRef.current = camera;

      await new Promise<void>((resolve) => {
        const loader = new GLTFLoader();
        loader.load(
          modelConfigRef.current!.modelUrl,
          (gltf) => {
            if (canceled) { resolve(); return; }
            const model = gltf.scene;
            selectableMeshesRef.current = [];
            console.log("GLB hierarchy:");
            printHierarchy(model);
            model.traverse((child: any) => {
              if (!child.isMesh) return;
              selectableMeshesRef.current.push(child as THREE.Mesh);
              child.frustumCulled = false;
              const mats: any[] = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat: any) => {
                if (mat.vertexColors && !child.geometry?.attributes?.color) mat.vertexColors = false;
                mat.side = THREE.DoubleSide;
                if (mat.transparent && mat.opacity >= 1 && !mat.alphaMap) mat.transparent = false;
                if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                  mat.roughness = mat.roughness ?? 0.6;
                  mat.metalness = mat.metalness ?? 0.1;
                  mat.envMapIntensity = 1.2;
                }
                mat.needsUpdate = true;
              });
            });

            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            model.scale.setScalar(maxDim > 0 ? 90 / maxDim : 1);
            model.rotation.x = Math.PI / 2;
            model.updateMatrixWorld(true);

            const alignedBox = new THREE.Box3().setFromObject(model);
            const alignedCenter = new THREE.Vector3();
            alignedBox.getCenter(alignedCenter);

            const centerGroup = new THREE.Group();
            centerGroup.add(model);
            centerGroup.position.set(-alignedCenter.x, -alignedCenter.y, -alignedBox.min.z);
            model.position.set(0, 0, 0);

            const pivot = new THREE.Group();
            pivot.add(centerGroup);
            pivot.rotation.z = THREE.MathUtils.degToRad(MODEL_HEADING);
            pivotRef.current = pivot;
            scene.add(pivot);
            resolve();
          },
          undefined,
          (err) => { console.error("GLTFLoader error:", err); resolve(); }
        );
      });

      if (canceled) return;

      const overlay = new g.maps.WebGLOverlayView();
      let renderer: THREE.WebGLRenderer | null = null;

      overlay.onAdd = () => { /* scene & camera already built above */ };

      overlay.onContextRestored = ({ gl }) => {
        renderer = new THREE.WebGLRenderer({
          canvas: gl.canvas as HTMLCanvasElement,
          context: gl,
          ...gl.getContextAttributes(),
        });
        renderer.autoClear = false;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const envScene = new RoomEnvironment();
        scene.environment = pmremGenerator.fromScene(envScene).texture;
        envScene.dispose();
        pmremGenerator.dispose();
      };

      overlay.onDraw = ({ gl, transformer }: google.maps.WebGLDrawOptions) => {
        overlay.requestRedraw();
        if (!renderer || !anchorRef.current) return;

        const matrix = transformer.fromLatLngAltitude(
          anchorRef.current,
          new Float32Array(16)
        );

        camera.projectionMatrix.fromArray(matrix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        gl.disable(gl.SCISSOR_TEST);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        renderer.resetState();
        renderer.render(scene, camera);
        renderer.resetState();
      };

      overlay.setMap(map);
      overlayRef.current = overlay;
    })();

    return () => {
      canceled = true;
      if (placementListenerRef.current) {
        (window as any).google?.maps?.event?.removeListener(placementListenerRef.current);
        placementListenerRef.current = null;
      }
      mapRef.current = null;
      cameraRef.current = null;
      pivotRef.current = null;
      overlayRef.current = null;
      anchorRef.current = null;
      selectableMeshesRef.current = [];
    };
  }, []);

  const enterPlacementMode = () => {
    const map = mapRef.current;
    if (!map) return;
    // Remove any existing listener first
    if (placementListenerRef.current) {
      (window as any).google.maps.event.removeListener(placementListenerRef.current);
      placementListenerRef.current = null;
    }
    placementModeRef.current = true;
    setPlacementMode(true);
    placementListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      const anchor = { lat, lng, altitude: 0 };
      anchorRef.current = anchor;
      const newConfig = {
        id: "brutalist_building",
        modelUrl: modelConfigRef.current!.modelUrl,
        anchor,
        heading: modelHeadingDeg,
        scale: 90,
      };
      modelConfigRef.current = newConfig;
      setModelConfig(newConfig);
      // Zoom in and tilt toward the placed location
      mapRef.current?.setCenter({ lat, lng });
      mapRef.current?.setZoom(18);
      mapRef.current?.setTilt(45);
      overlayRef.current?.requestRedraw();
      // Exit placement mode
      (window as any).google.maps.event.removeListener(placementListenerRef.current);
      placementListenerRef.current = null;
      placementModeRef.current = false;
      setPlacementMode(false);
    });
  };

  const handleScenePick = (event: any) => {
    // Ignore scene picks while waiting for a placement click
    if (placementModeRef.current) return;
    const camera = cameraRef.current;
    const mapElement = mapDiv.current;
    if (!camera || !mapElement || selectableMeshesRef.current.length === 0) {
      console.log("Raycast click ignored: scene is not ready yet");
      return;
    }

    const rect = mapElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), camera);
    const intersections = raycasterRef.current.intersectObjects(selectableMeshesRef.current, true);

    // Keep mesh transforms current before fallback screen-space picking.
    for (const mesh of selectableMeshesRef.current) {
      mesh.updateMatrixWorld(true);
    }

    let pickedObject: THREE.Object3D | null = null;
    let pickedBy: "raycast" | "screen-projection" | null = null;

    if (intersections.length > 0) {
      pickedObject = intersections[0].object;
      pickedBy = "raycast";
    } else {
      const projectedHit = pickMeshByProjectedCenter(
        selectableMeshesRef.current,
        camera,
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height
      );
      if (projectedHit) {
        pickedObject = projectedHit;
        pickedBy = "screen-projection";
      }
    }

    if (!pickedObject) {
      console.log("Clicked object: none");
      setPropertyPopup(null);
      return;
    }

    const meshName = pickedObject.name || "(no name)";
    const details = getPropertyDetailsForMesh(meshName);

    console.log("Clicked object:", {
      name: meshName,
      type: pickedObject.type,
      uuid: pickedObject.uuid,
      method: pickedBy,
    });

    if (!details) {
      setPropertyPopup(null);
      return;
    }

    setPropertyPopup({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      meshName,
      details,
    });
  };

  const rotateMap = (deltaDegrees: number) => {
    const map = mapRef.current;
    if (!map) return;
    const currentHeading = map.getHeading?.() ?? 0;
    const nextHeading = ((currentHeading + deltaDegrees) % 360 + 360) % 360;
    map.setHeading(nextHeading);
  };

  const tiltMap = (deltaDegrees: number) => {
    const map = mapRef.current;
    if (!map) return;
    const currentTilt = map.getTilt?.() ?? 0;
    const nextTilt = Math.min(67.5, Math.max(0, currentTilt + deltaDegrees));
    map.setTilt(nextTilt);
  };

  const startDragRotate = (event: any) => {
    const map = mapRef.current;
    if (!map) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startHeading: map.getHeading?.() ?? 0,
      dragging: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDragRotate = (event: any) => {
    const state = dragStateRef.current;
    const map = mapRef.current;
    if (!map || !state.dragging || state.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - state.startX;
    const nextHeading = ((state.startHeading + deltaX * 0.5) % 360 + 360) % 360;
    map.setHeading(nextHeading);
  };

  const endDragRotate = (event: any) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId) return;
    dragStateRef.current = { pointerId: null, startX: 0, startHeading: 0, dragging: false };
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  // Rotates the model to face the given heading (degrees).
  // 0 = North, 90 = East, 180 = South, 270 = West.
  // Does NOT move the model — it stays at TARGET_LAT / TARGET_LNG.
  // Does NOT affect the Google Maps camera heading.
  const setModelHeading = (degrees: number) => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    const normalized = ((degrees % 360) + 360) % 360;
    pivot.rotation.z = THREE.MathUtils.degToRad(normalized);
    setModelHeadingDeg(normalized);
    setModelConfig(prev => {
      const updated = prev ? { ...prev, heading: normalized } : prev;
      modelConfigRef.current = updated;
      return updated;
    });
  };



  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

      {/* ── Top-left: Place / Move Model ── */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}>
        <button
          type="button"
          onClick={placementMode ? undefined : enterPlacementMode}
          title={placementMode ? "Click anywhere on the map to place the model" : modelConfig ? "Move model to a new location" : "Place model on the map"}
          style={{
            border: placementMode ? "1.5px solid rgba(251,191,36,0.7)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            padding: "9px 18px",
            background: placementMode ? "rgba(251,191,36,0.18)" : "rgba(10,18,35,0.78)",
            color: placementMode ? "#fbbf24" : "#e2e8f0",
            cursor: placementMode ? "crosshair" : "pointer",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
            display: "flex", alignItems: "center", gap: 7,
            transition: "background 0.2s, color 0.2s, border 0.2s",
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: 15 }}>{placementMode ? "📍" : "✦"}</span>
          {placementMode ? "Click map to place…" : "Move Model"}
        </button>
      </div>

      {/* ── Top-right: Map rotation ── */}
      <div style={{
        position: "absolute", top: 16, right: 16, zIndex: 10,
        display: "flex", flexDirection: "column", gap: 6,
        alignItems: "center",
      }}>
        <div style={{
          background: "rgba(10, 18, 35, 0.78)",
          backdropFilter: "blur(12px)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          padding: "6px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textAlign: "center", paddingBottom: 2 }}>ROTATE</div>
          <button type="button" onClick={() => rotateMap(-45)}
            title="Rotate left"
            style={{ border: "none", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "#e2e8f0", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >⟲</button>
          <button type="button" onClick={() => rotateMap(45)}
            title="Rotate right"
            style={{ border: "none", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "#e2e8f0", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >⟳</button>
        </div>

        {/* Tilt */}
        <div style={{
          background: "rgba(10, 18, 35, 0.78)",
          backdropFilter: "blur(12px)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          padding: "6px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textAlign: "center", paddingBottom: 2 }}>TILT</div>
          <button type="button" onClick={() => tiltMap(8)}
            title="Tilt up"
            style={{ border: "none", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "#e2e8f0", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >▲</button>
          <button type="button" onClick={() => tiltMap(-8)}
            title="Tilt down"
            style={{ border: "none", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "#e2e8f0", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >▼</button>
        </div>
      </div>

      {/* ── Bottom-right: Drag to rotate ── */}
      <button
        type="button"
        onPointerDown={startDragRotate}
        onPointerMove={moveDragRotate}
        onPointerUp={endDragRotate}
        onPointerCancel={endDragRotate}
        onLostPointerCapture={endDragRotate}
        title="Drag horizontally to rotate the map"
        style={{
          position: "absolute", bottom: 16, right: 16, zIndex: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "9px 16px",
          borderRadius: 999,
          background: "rgba(10,18,35,0.78)",
          color: "#e2e8f0",
          cursor: "grab",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          display: "flex", alignItems: "center", gap: 7,
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 15 }}>↔</span> Drag to rotate 360°
      </button>

      {/* ── Bottom-left: Model heading compass ── */}
      <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 10 }}>
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setCompassOpen(o => !o)}
          title="Model heading"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            padding: "9px 16px",
            background: compassOpen ? "rgba(99,179,237,0.92)" : "rgba(10,18,35,0.78)",
            color: compassOpen ? "#0f172a" : "#e2e8f0",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
            display: "flex", alignItems: "center", gap: 7,
            transition: "background 0.2s, color 0.2s",
          }}
        >
          <span style={{
            fontSize: 16,
            display: "inline-block",
            transform: `rotate(${modelHeadingDeg}deg)`,
            transition: "transform 0.35s cubic-bezier(.4,0,.2,1)",
          }}>🧭</span>
          Model Direction &nbsp;<span style={{ opacity: 0.7, fontWeight: 400 }}>{modelHeadingDeg}°</span>
        </button>

        {/* Compass panel — opens upward */}
        {compassOpen && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 10px)", left: 0,
            background: "rgba(10,18,35,0.94)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 18,
            padding: "14px 14px 12px",
            backdropFilter: "blur(16px)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            minWidth: 160,
          }}>
            <div style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              textAlign: "center", marginBottom: 10,
            }}>MODEL HEADING</div>

            {/* 3×3 compass grid */}
            {([
              [{ label: "NW", deg: 315 }, { label: "N", deg: 0   }, { label: "NE", deg: 45  }],
              [{ label: "W",  deg: 270 }, { label: "·", deg: -1  }, { label: "E",  deg: 90  }],
              [{ label: "SW", deg: 225 }, { label: "S", deg: 180 }, { label: "SE", deg: 135 }],
            ] as { label: string; deg: number }[][]).map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: 5, marginBottom: ri < 2 ? 5 : 0, justifyContent: "center" }}>
                {row.map((cell) => {
                  const isActive = cell.deg !== -1 && modelHeadingDeg === cell.deg;
                  const isCenter = cell.deg === -1;
                  return (
                    <button
                      key={cell.label}
                      type="button"
                      disabled={isCenter}
                      onClick={() => !isCenter && setModelHeading(cell.deg)}
                      title={!isCenter ? `${cell.label} — ${cell.deg}°` : undefined}
                      style={{
                        width: 42, height: 42, borderRadius: 11,
                        border: isActive ? "1.5px solid rgba(99,179,237,0.8)" : "1px solid rgba(255,255,255,0.07)",
                        background: isActive
                          ? "rgba(99,179,237,0.22)"
                          : isCenter ? "transparent" : "rgba(255,255,255,0.05)",
                        color: isActive ? "#63b3ed" : isCenter ? "rgba(255,255,255,0.2)" : "#cbd5e1",
                        cursor: isCenter ? "default" : "pointer",
                        fontSize: isCenter ? 20 : 11,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        transition: "background 0.15s, border 0.15s, color 0.15s",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onMouseEnter={e => { if (!isCenter && !isActive) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                      onMouseLeave={e => { if (!isCenter && !isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    >
                      {cell.label}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Fine-tune slider */}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range" min={0} max={359} step={1}
                value={modelHeadingDeg}
                onChange={e => setModelHeading(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#63b3ed", height: 4 }}
              />
              <span style={{
                color: "#63b3ed", fontSize: 12, fontWeight: 700,
                minWidth: 38, textAlign: "right",
              }}>{modelHeadingDeg}°</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Property popup ── */}
      {propertyPopup && (
        <div style={{
          position: "absolute",
          left: Math.min(propertyPopup.x + 16, window.innerWidth - 280),
          top: Math.min(propertyPopup.y + 16, window.innerHeight - 180),
          zIndex: 20,
          width: 240,
          background: "rgba(10,18,35,0.95)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: "14px 16px",
          color: "#f1f5f9",
          backdropFilter: "blur(16px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{propertyPopup.meshName}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: "#f8fafc" }}>{propertyPopup.details.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.45)" }}>Type</span>
              <span style={{ fontWeight: 600 }}>{propertyPopup.details.bhk}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.45)" }}>Area</span>
              <span style={{ fontWeight: 600 }}>{propertyPopup.details.area} sq ft</span>
            </div>
            <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(99,179,237,0.15)", border: "1px solid rgba(99,179,237,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Price</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#63b3ed" }}>{propertyPopup.details.price}</span>
            </div>
          </div>
        </div>
      )}

      <div ref={mapDiv} onClick={handleScenePick} style={{ width: "100%", height: "100%", cursor: placementMode ? "crosshair" : "default" }} />
    </div>
  );
}

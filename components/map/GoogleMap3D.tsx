/// <reference types="@types/google.maps" />
"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const GOOGLE_MAPS_API_KEY = "AIzaSyBCswT9ODeUU9ByGUjbRg1KzV-nUF3BFkU"; // demo key
const TARGET_LAT = 25.0000;
const TARGET_LNG = 16.0000;
// Initial model heading in degrees. 0 = North, 90 = East, 180 = South, 270 = West.
// Change this value to set the default orientation of the model at load time.
const MODEL_HEADING = 0;

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
  // pivotRef holds the outer Group whose rotation.z controls model heading.
  // The inner gltf.scene only ever has rotation.x = PI/2 (Y-up -> Z-up fix).
  const pivotRef = useRef<THREE.Group | null>(null);
  const selectableMeshesRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
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

    const printHierarchy = (object: THREE.Object3D, level = 0) => {
      console.log(`${" ".repeat(level * 2)}${object.name || "(no name)"} - ${object.type}`);
      object.children.forEach((child) => printHierarchy(child, level + 1));
    };

    const loadGoogleMaps = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (typeof window === "undefined") return;
        if ((window as any).google?.maps?.Map) { resolve(); return; }
        const existing = document.getElementById("gmaps-script");
        if (existing) { existing.addEventListener("load", () => resolve()); return; }
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
        center: { lat: TARGET_LAT, lng: TARGET_LNG },
        zoom: 18,
        tilt: 60,
        heading: 0,
        mapId: "8e0a97af9386fef",
        disableDefaultUI: true,
        rotateControl: true,
        gestureHandling: "greedy",
        keyboardShortcuts: true,
        mapTypeId: "roadmap",
      });
      mapRef.current = map;

      const overlay = new g.maps.WebGLOverlayView();

      let renderer: THREE.WebGLRenderer | null = null;
      let scene: THREE.Scene | null = null;
      let camera: THREE.PerspectiveCamera | null = null;
      let model: THREE.Object3D | null = null;
      let pmremGenerator: THREE.PMREMGenerator | null = null;

      overlay.onAdd = () => {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera();
        cameraRef.current = camera;

        // Ambient: soft neutral fill matching Google Maps diffuse base
        scene.add(new THREE.AmbientLight(0xf0f4ff, 0.6));

        // Hemisphere: sky (light blue) → ground (warm grey) like Google Maps
        const hemi = new THREE.HemisphereLight(0xc9d8f0, 0x8a7f72, 0.8);
        scene.add(hemi);

        // Primary sun: warm white, high angle (Google Maps midday look)
        const sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
        sun.position.set(2, 4, 3);
        scene.add(sun);

        // Soft fill from opposite side to reduce harsh shadows
        const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
        fill.position.set(-2, 1, -1);
        scene.add(fill);

        const loader = new GLTFLoader();
        loader.load(
          "/model/brutalist_building.glb",
          (gltf) => {
            if (canceled) return;
            model = gltf.scene;
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

            // ── Step 1: scale to ~90m ──────────────────────────────────────
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            model.scale.setScalar(maxDim > 0 ? 90 / maxDim : 1);

            // ── Step 2: Y-up → Z-up correction (ONLY on the inner model) ──
            model.rotation.x = Math.PI / 2;

            // ── Step 3: center + ground via a centering wrapper ────────────
            // We must NOT put any XY offset on the pivot's direct child,
            // because pivot.rotation.z would then orbit that offset around
            // the world origin instead of spinning in place.
            //
            // Solution: wrap the model in a centering Group that absorbs the
            // XY/Z offset. The centering group sits inside the pivot at (0,0,0).
            // The pivot itself stays at (0,0,0) = the geographic anchor.
            model.updateMatrixWorld(true);
            const alignedBox = new THREE.Box3().setFromObject(model);
            const alignedCenter = new THREE.Vector3();
            alignedBox.getCenter(alignedCenter);

            const centerGroup = new THREE.Group();
            centerGroup.add(model);
            // Offset the centering group so the model's XY center and bottom
            // face sit exactly at the pivot origin (0, 0, 0).
            centerGroup.position.set(
              -alignedCenter.x,
              -alignedCenter.y,
              -alignedBox.min.z
            );
            // Reset any position that was previously set on the model itself
            model.position.set(0, 0, 0);

            // ── Step 4: pivot Group — only rotation.z ever changes ─────────
            // pivot sits at (0,0,0) in overlay space = TARGET_LAT/TARGET_LNG.
            // Rotating pivot.rotation.z is a pure yaw: the centerGroup offset
            // is (0,0,0) relative to the pivot, so there is no orbit.
            const pivot = new THREE.Group();
            pivot.add(centerGroup);
            pivot.rotation.z = THREE.MathUtils.degToRad(MODEL_HEADING);
            pivotRef.current = pivot;

            scene!.add(pivot);
            overlay.requestRedraw();
          },
          undefined,
          (err) => console.error("GLTFLoader error:", err)
        );
      };

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

        // Build a procedural HDR environment via PMREMGenerator
        pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const envScene = new RoomEnvironment();
        const envTexture = pmremGenerator.fromScene(envScene).texture;
        if (scene) {
          scene.environment = envTexture;
        }
        envScene.dispose();
      };

      overlay.onDraw = ({ gl, transformer }: google.maps.WebGLDrawOptions) => {
        if (!renderer || !scene || !camera || !pivotRef.current) return;

        const matrix = transformer.fromLatLngAltitude(
          { lat: TARGET_LAT, lng: TARGET_LNG, altitude: 0 },
          new Float32Array(16)
        );

        camera.projectionMatrix.fromArray(matrix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        gl.disable(gl.SCISSOR_TEST);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        renderer.resetState();
        renderer.render(scene, camera);
        overlay.requestRedraw();
      };

      overlay.setMap(map);
    })();

    return () => {
      canceled = true;
      mapRef.current = null;
      cameraRef.current = null;
      pivotRef.current = null;
      selectableMeshesRef.current = [];
    };
  }, []);

  const handleScenePick = (event: any) => {
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
  };



  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

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

      <div ref={mapDiv} onClick={handleScenePick} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

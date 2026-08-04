/// <reference types="@types/google.maps" />
"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const GOOGLE_MAPS_API_KEY = "AIzaSyBCswT9ODeUU9ByGUjbRg1KzV-nUF3BFkU"; // demo key
const TARGET_LAT = 23.0225;
const TARGET_LNG = 72.5714;

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
};

const getPropertyDetailsForMesh = (meshName: string): PropertyDetails => {
  const mapped = PROPERTY_DETAILS[meshName];
  if (mapped) return mapped;

  const index = Number(meshName.match(/\d+/)?.[0] ?? "1");
  const bhkValue = 2 + (index % 3);
  const area = 1100 + index * 35;
  const basePriceLakh = 60 + index * 2;

  return {
    name: `Property ${meshName}`,
    bhk: `${bhkValue} BHK`,
    area,
    price: `Rs ${basePriceLakh} Lakh`,
  };
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
    const hitRadius = Math.max(16, radiusPx * 1.35);
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
  const selectableMeshesRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const [propertyPopup, setPropertyPopup] = useState<PropertyPopup | null>(null);
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
          "/model/countryside_plot_with_scenic_mountain_views.glb",
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
                // Ensure physically-based shading
                if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                  mat.roughness = mat.roughness ?? 0.6;
                  mat.metalness = mat.metalness ?? 0.1;
                  mat.envMapIntensity = 1.2;
                }
                mat.needsUpdate = true;
              });
            });

            // Scale model to ~100m
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? 90 / maxDim : 1;
            model.scale.setScalar(scale);

            // Rotate GLB Y-up → Z-up
            model.rotation.x = Math.PI / 2;

            // Recenter after rotation so the full model stays inside the view.
            model.updateMatrixWorld(true);
            const rotatedBox = new THREE.Box3().setFromObject(model);
            const rotatedCenter = new THREE.Vector3();
            rotatedBox.getCenter(rotatedCenter);
            model.position.set(-rotatedCenter.x, -rotatedCenter.y, -rotatedBox.min.z);

            scene!.add(model);
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
        if (!renderer || !scene || !camera || !model) return;

        // Get the world-space matrix for the target lat/lng at ground level
        const matrix = transformer.fromLatLngAltitude(
          { lat: TARGET_LAT, lng: TARGET_LNG, altitude: 0 },
          new Float32Array(16)
        );

        camera.projectionMatrix.fromArray(matrix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        gl.disable(gl.SCISSOR_TEST);
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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 2, display: "flex", gap: 8, padding: 8, borderRadius: 16, background: "rgba(15, 23, 42, 0.72)", backdropFilter: "blur(10px)", boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)" }}>
        <button type="button" onClick={() => rotateMap(-36)} style={{ border: "none", width: 40, height: 40, borderRadius: 12, background: "rgba(255, 255, 255, 0.12)", color: "#fff", cursor: "pointer", fontSize: 18 }} aria-label="Rotate left 36 degrees" title="Rotate left 36 degrees">⟲</button>
        <button type="button" onClick={() => rotateMap(36)} style={{ border: "none", width: 40, height: 40, borderRadius: 12, background: "rgba(255, 255, 255, 0.12)", color: "#fff", cursor: "pointer", fontSize: 18 }} aria-label="Rotate right 36 degrees" title="Rotate right 36 degrees">⟳</button>
      </div>
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 2, display: "flex", gap: 8, padding: 8, borderRadius: 16, background: "rgba(15, 23, 42, 0.72)", backdropFilter: "blur(10px)", boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)" }}>
        <button type="button" onClick={() => tiltMap(8)} style={{ border: "none", width: 40, height: 40, borderRadius: 12, background: "rgba(255, 255, 255, 0.12)", color: "#fff", cursor: "pointer", fontSize: 18 }} aria-label="Tilt up" title="Tilt up">▲</button>
        <button type="button" onClick={() => tiltMap(-8)} style={{ border: "none", width: 40, height: 40, borderRadius: 12, background: "rgba(255, 255, 255, 0.12)", color: "#fff", cursor: "pointer", fontSize: 18 }} aria-label="Tilt down" title="Tilt down">▼</button>
      </div>
      <button
        type="button"
        onPointerDown={startDragRotate}
        onPointerMove={moveDragRotate}
        onPointerUp={endDragRotate}
        onPointerCancel={endDragRotate}
        onLostPointerCapture={endDragRotate}
        style={{
          position: "absolute",
          left: 16,
          bottom: 16,
          zIndex: 2,
          border: "none",
          padding: "10px 14px",
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.72)",
          color: "#fff",
          cursor: "grab",
          backdropFilter: "blur(10px)",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
          fontSize: 13,
          fontWeight: 600,
        }}
        aria-label="Drag horizontally to rotate the map"
        title="Drag horizontally to rotate the map"
      >
        Drag to rotate 360°
      </button>
      {propertyPopup && (
        <div
          style={{
            position: "absolute",
            left: propertyPopup.x + 14,
            top: propertyPopup.y + 14,
            zIndex: 3,
            minWidth: 220,
            maxWidth: 260,
            background: "rgba(15, 23, 42, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 12,
            padding: "12px 14px",
            color: "#fff",
            backdropFilter: "blur(8px)",
            boxShadow: "0 16px 30px rgba(0, 0, 0, 0.3)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>Mesh: {propertyPopup.meshName}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{propertyPopup.details.name}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>Type: {propertyPopup.details.bhk}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>Area: {propertyPopup.details.area} sq ft</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>Price: {propertyPopup.details.price}</div>
        </div>
      )}
      <div ref={mapDiv} onClick={handleScenePick} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

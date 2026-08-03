/// <reference types="@types/google.maps" />
"use client";
import { useEffect, useRef } from "react";
import type * as THREE from "three";

const GOOGLE_MAPS_API_KEY = "AIzaSyBCswT9ODeUU9ByGUjbRg1KzV-nUF3BFkU"; // demo key
const TARGET_LAT = 23.0225;
const TARGET_LNG = 72.5714;

export default function GoogleMap3D() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const dragStateRef = useRef<{ pointerId: number | null; startX: number; startHeading: number; dragging: boolean }>({
    pointerId: null,
    startX: 0,
    startHeading: 0,
    dragging: false,
  });

  useEffect(() => {
    let canceled = false;

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

      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader");
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

      overlay.onAdd = () => {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera();

        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const hemi = new THREE.HemisphereLight(0xfafcff, 0xb9b9b9, 0.6);
        scene.add(hemi);

        const sun = new THREE.DirectionalLight(0xfff7eb, 1.45);
        sun.position.set(1.25, 2.75, 3.25);
        scene.add(sun);

        const loader = new GLTFLoader();
        loader.load(
          "/model/brutalist_building.glb",
          (gltf) => {
            if (canceled) return;
            model = gltf.scene;
            model.traverse((child: any) => {
              if (!child.isMesh) return;
              child.frustumCulled = false;
              const mats: any[] = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat: any) => {
                if (mat.vertexColors && !child.geometry?.attributes?.color) mat.vertexColors = false;
                mat.side = THREE.DoubleSide;
                if (mat.transparent && mat.opacity >= 1 && !mat.alphaMap) mat.transparent = false;
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
        renderer.toneMappingExposure = 1.15;
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
    };
  }, []);

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
      <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

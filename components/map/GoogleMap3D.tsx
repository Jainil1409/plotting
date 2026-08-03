/// <reference types="@types/google.maps" />
"use client";
import { useEffect, useRef } from "react";
import type * as THREE from "three";

const GOOGLE_MAPS_API_KEY = "AIzaSyBCswT9ODeUU9ByGUjbRg1KzV-nUF3BFkU"; // demo key
const TARGET_LAT = 23.0225;
const TARGET_LNG = 72.5714;

export default function GoogleMap3D() {
  const mapDiv = useRef<HTMLDivElement>(null);

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
        mapTypeId: "roadmap",
      });

      const overlay = new g.maps.WebGLOverlayView();

      let renderer: THREE.WebGLRenderer | null = null;
      let scene: THREE.Scene | null = null;
      let camera: THREE.PerspectiveCamera | null = null;
      let model: THREE.Object3D | null = null;

      overlay.onAdd = () => {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera();

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(0.5, 1, 2);
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
            const scale = maxDim > 0 ? 100 / maxDim : 1;
            model.scale.setScalar(scale);

            // Rotate GLB Y-up → Z-up
            model.rotation.x = Math.PI / 2;
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

        // Position the model at the target coordinate origin
        model.position.set(0, 0, 0);

        gl.disable(gl.SCISSOR_TEST);
        renderer.resetState();
        renderer.render(scene, camera);
        overlay.requestRedraw();
      };

      overlay.setMap(map);
    })();

    return () => {
      canceled = true;
    };
  }, []);

  return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
}

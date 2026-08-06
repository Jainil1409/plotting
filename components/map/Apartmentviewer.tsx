"use client";

// components/ApartmentViewer.tsx
//
// Deliberately NOT sharing anything with GoogleMap3D's WebGLOverlayView —
// own canvas, own renderer, own camera, own render loop. The apartment is
// an interior walkthrough; it has no real-world lat/lng, so there's no
// reason to force it through the map's geo-anchored projection matrix.
// This is the same standalone-viewer pattern as the earlier
// react-three-fiber project, rebuilt in plain Three.js since that's what
// this codebase uses.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const APARTMENT_MODEL_URL = "/model/appartement.glb";

interface ApartmentViewerProps {
  onBack: () => void;
}

export default function ApartmentViewer({ onBack }: ApartmentViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: any = null;
    let animationId = 0;
    let resizeHandler: (() => void) | null = null;
    let contextLostHandler: ((e: Event) => void) | null = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(5, 5, 5);

    (async () => {
      if (!mountRef.current) return;

      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls");
      if (canceled || !mountRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        // same hybrid-GPU driver mitigation learned the hard way on the
        // earlier react-three-fiber project's WebGL context-loss debugging
        powerPreference: "default",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      mountRef.current.appendChild(renderer.domElement);

      contextLostHandler = (e: Event) => {
        e.preventDefault();
        console.warn("ApartmentViewer: WebGL context lost");
        setError("WebGL context was lost.");
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLostHandler);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(5, 8, 5);
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.4);
      fillLight.position.set(-3, 2, -2);
      scene.add(fillLight);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;

      const loader = new GLTFLoader();
    //   loader.load(
    //     APARTMENT_MODEL_URL,
    //     (gltf) => {
    //       if (canceled) return;
    //       const model = gltf.scene;
    //       scene.add(model);
    //       console.log(gltf.scene);
    //       console.log(new THREE.Box3().setFromObject(gltf.scene));

    //       // Fit camera to the model's real bounding box instead of
    //       // guessing — same reasoning/math as fitCameraToObject in the
    //       // earlier project: don't know this model's export scale/origin
    //       // in advance.
    //       const box = new THREE.Box3().setFromObject(model);
    //       const size = box.getSize(new THREE.Vector3());
    //       const center = box.getCenter(new THREE.Vector3());
    //       const maxDim = Math.max(size.x, size.y, size.z);
    //       const fov = camera.fov * (Math.PI / 180);
    //       const distance = Math.max((maxDim / 2 / Math.tan(fov / 2)) * 1.4, 0.1);
    //       const direction = new THREE.Vector3(1, 0.6, 1).normalize();
    //       camera.position.copy(center).addScaledVector(direction, distance);
    //       camera.near = Math.max(distance / 100, 0.01);
    //       camera.far = distance * 100;
    //       camera.updateProjectionMatrix();
    //       camera.lookAt(center);
    //       controls.target.copy(center);
    //       controls.update();

    //       console.info("ApartmentViewer: bounding box size", size, "center", center);
    //       setLoading(false);
    //     },
    //     undefined,
    //     (err) => {
    //       console.error("ApartmentViewer GLTFLoader error:", err);
    //       setError("Failed to load apartment.glb — check the file exists at " + APARTMENT_MODEL_URL);
    //       setLoading(false);
    //     }
    //   );

    loader.load(
  APARTMENT_MODEL_URL,
  (gltf) => {
    if (canceled) return;

    const model = gltf.scene;

    // IMPORTANT
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    console.log("Bounding Box:", box);
    console.log("Size:", size);
    console.log("Center:", center);

    scene.add(model);

    // Position camera to point directly at the living room / main room area from front eye-level
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 0.8;

    // Target slightly shifted towards the living room (front-left portion of bounding center)
    const livingRoomTarget = new THREE.Vector3(
      center.x - size.x * 0.15,
      center.y + size.y * 0.05,
      center.z + size.z * 0.1
    );

    camera.position.set(
      livingRoomTarget.x - distance * 0.65,
      livingRoomTarget.y + distance * 0.45,
      livingRoomTarget.z + distance * 0.75
    );

    camera.lookAt(livingRoomTarget);
    camera.updateProjectionMatrix();

    controls.target.copy(livingRoomTarget);
    controls.update();

    setLoading(false);
  },
  undefined,
  (err) => {
    console.error(err);
  }
);





      const animate = () => {
        animationId = requestAnimationFrame(animate);
        controls?.update();
        if (renderer) renderer.render(scene, camera);
      };
      animate();

      resizeHandler = () => {
        if (!mountRef.current || !renderer) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", resizeHandler);
    })();

    return () => {
      canceled = true;
      cancelAnimationFrame(animationId);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      controls?.dispose();

      // Free every geometry/material/texture — same lesson as
      // disposeObject3D in GoogleMap3D.tsx: Three.js won't do this
      // automatically just because the component unmounts.
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        const material = obj.material;
        if (material) {
          const materials = Array.isArray(material) ? material : [material];
          materials.forEach((mat: THREE.Material) => {
            Object.values(mat as unknown as Record<string, unknown>).forEach((v) => {
              if (v && typeof v === "object" && "isTexture" in (v as object)) {
                (v as THREE.Texture).dispose();
              }
            });
            mat.dispose();
          });
        }
      });

      if (renderer) {
        if (contextLostHandler) {
          renderer.domElement.removeEventListener("webglcontextlost", contextLostHandler);
        }
        renderer.dispose();
        if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#0b1120" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 60,
          padding: "9px 18px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10,18,35,0.85)",
          color: "#e2e8f0",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        ← Back to house
      </button>

      {loading && !error && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            padding: "9px 16px",
            borderRadius: 999,
            background: "rgba(10,18,35,0.85)",
            color: "#e2e8f0",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Loading apartment…
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 55,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "sans-serif",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div>{error}</div>
        </div>
      )}

      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
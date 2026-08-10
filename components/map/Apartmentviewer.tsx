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
//
// EDIT MODE (dynamic hotspots) — scope actually implemented here:
//   - click the model            -> place a new hotspot at that exact
//                                    intersection point, converted into
//                                    the model's local space
//   - click an existing hotspot  -> select it (for rename/capture/delete)
//   - "Capture Camera" button    -> saves the CURRENT camera pose as that
//                                    hotspot's cameraPosition/cameraTarget
//   - "Export JSON" button       -> downloads hotspots.json in the shape
//                                    described in the hotspot-editor doc
//
// FIX (this revision): a freshly click-placed hotspot's cameraTarget used
// to default to whatever controls.target already was — usually the wide
// initial apartment view — so navigating to that hotspot didn't actually
// zoom in, and orbiting afterward swung across the whole model instead of
// staying tight around the hotspot. Now it defaults to a close-up view
// centered on the exact clicked point. Existing hotspots created before
// this fix still carry their old, far-away camera presets — use "Capture
// Camera" on them individually to fix each one; this doesn't retroactively
// touch anything already saved.
//
// NOT implemented (real scope, not folded in silently):
//   - dragging an existing hotspot to reposition it
//   - loading a different hotspots.json per model on mount
//   - persisting to a backend/DB
//   - a separate HotspotEditor.tsx / hotspotManager.ts split
//   - floating 3D text labels over hotspots

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap"; // npm install gsap — not installed yet, add it before building

const APARTMENT_MODEL_URL = "/model/appartement.glb";

interface HotspotConfig {
  id: string;
  label: string;
  position: THREE.Vector3;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
}

interface ApartmentViewerProps {
  onBack: () => void;
}

// Seed data. Treat these as placeholders, not ground truth — see the
// console traverse log at load time and the edit-mode placement tool
// below instead of hand-tuning these Vector3s by eye.
const HOTSPOTS: HotspotConfig[] = [
  {
    id: "hotspot-1786341743501",
    label: "New Hotspot 1",
    position: new THREE.Vector3( -5.392106384828472, 0.3944730106100103, 2.501692735984334),
    cameraPosition: new THREE.Vector3(-5.066538186206817, 1.7832685395508698, 4.7746398867101965),
    cameraTarget: new THREE.Vector3(-5.392106384828472, 0.3944730106100103, 2.501692735984334),
  },
  {
    id: "hotspot-1786341794775",
    label: "New Hotspot 2",
    position: new THREE.Vector3(-2.3800279796133963, 0.754345715045929, 2.0768459200639438),
    cameraPosition: new THREE.Vector3( -0.11765477181638762, 2.0961870957518456, 2.571418748100671),
    cameraTarget: new THREE.Vector3(-2.3800279796133963, 0.754345715045929, 2.0768459200639438),
  },
  {
    id: "hotspot-1786341845174",
    label: "New Hotspot 3",
    position: new THREE.Vector3(-1.655448188775882,  0.5243509457205998, -2.0541196739791294),
    cameraPosition: new THREE.Vector3(0.06305329339113319, 1.5539082690719854,  -3.757178754693715),
    cameraTarget: new THREE.Vector3(-1.655448188775882, 0.5243509457205998, -2.0541196739791294),
  },

  {
    id: "hotspot-1786341912364",
    label: "New Hotspot 4",
    position: new THREE.Vector3(-5.5514296855365055,2.6289108223664925e-8,-2.2844067139953315),
    cameraPosition: new THREE.Vector3(-7.78529469723726, 1.5097690000811408, -2.116299800670009),
    cameraTarget: new THREE.Vector3(-5.5514296855365055, 2.6289108223664925e-8, -2.2844067139953315),
  }
];

function cloneHotspot(h: HotspotConfig): HotspotConfig {
  return {
    id: h.id,
    label: h.label,
    position: h.position.clone(),
    cameraPosition: h.cameraPosition.clone(),
    cameraTarget: h.cameraTarget.clone(),
  };
}

interface SceneActions {
  captureCamera: (id: string) => void;
  renameHotspot: (id: string, label: string) => void;
  deleteHotspot: (id: string) => void;
  exportJSON: () => void;
}

export default function ApartmentViewer({ onBack }: ApartmentViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cloned per-mount so two instances of this component never share the
  // same underlying Vector3 objects from the module-level HOTSPOTS const.
  const hotspotsRef = useRef<HotspotConfig[]>(HOTSPOTS.map(cloneHotspot));
  const [hotspotList, setHotspotList] = useState<HotspotConfig[]>(hotspotsRef.current);

  const [editMode, setEditMode] = useState(false);
  const editModeRef = useRef(false);
  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Imperative Three.js actions (capture/rename/delete/export) live inside
  // the main effect's closure, where camera/controls/model/scene actually
  // exist. This ref is how the JSX buttons (outside that closure) reach
  // them without re-running the whole effect.
  const sceneActionsRef = useRef<SceneActions | null>(null);

  useEffect(() => {
    let canceled = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: any = null;
    let animationId = 0;
    let resizeHandler: (() => void) | null = null;
    let contextLostHandler: ((e: Event) => void) | null = null;
    let pointerDownHandler: ((e: PointerEvent) => void) | null = null;
    let model: THREE.Object3D | null = null;
    let selectableHotspots: THREE.Object3D[] = [];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(5, 5, 5);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Camera preset transition — moves the camera/controls target, never
    // the apartment model. Model stays fixed; camera rotates around it.
    const goToRoom = (config: HotspotConfig) => {
      if (!controls) return;
      gsap.to(camera.position, {
        x: config.cameraPosition.x,
        y: config.cameraPosition.y,
        z: config.cameraPosition.z,
        duration: 1.2,
        ease: "power2.inOut",
      });
      gsap.to(controls.target, {
        x: config.cameraTarget.x,
        y: config.cameraTarget.y,
        z: config.cameraTarget.z,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => {
          controls?.update();
        },
      });
    };

    // Creates the anchor+sphere pair and registers it as raycast-able.
    // Used both for the seeded HOTSPOTS at load time and for hotspots
    // placed dynamically in edit mode — one code path, not two.
    const createHotspotObject = (config: HotspotConfig) => {
      if (!model) return;

      const anchor = new THREE.Object3D();
      anchor.name = `anchor-${config.id}`;
      anchor.position.copy(config.position);
      anchor.userData.roomId = config.id;
      model.add(anchor);

      const hotspot = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0x00aaff })
      );
      hotspot.name = `hotspot-${config.id}`;
      hotspot.userData.roomId = config.id;
      hotspot.userData.label = config.label;
      anchor.add(hotspot);

      selectableHotspots.push(hotspot);
    };

    const captureCamera = (id: string) => {
      if (!controls) return;
      hotspotsRef.current = hotspotsRef.current.map((h) =>
        h.id === id
          ? { ...h, cameraPosition: camera.position.clone(), cameraTarget: controls.target.clone() }
          : h
      );
      setHotspotList(hotspotsRef.current.map(cloneHotspot));
    };

    const renameHotspot = (id: string, label: string) => {
      hotspotsRef.current = hotspotsRef.current.map((h) => (h.id === id ? { ...h, label } : h));
      setHotspotList(hotspotsRef.current.map(cloneHotspot));

      const anchor = model?.getObjectByName(`anchor-${id}`);
      const mesh = anchor?.getObjectByName(`hotspot-${id}`);
      if (mesh) mesh.userData.label = label;
    };

    const deleteHotspot = (id: string) => {
      const anchor = model?.getObjectByName(`anchor-${id}`);
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

      selectableHotspots = selectableHotspots.filter((obj) => obj.userData.roomId !== id);
      hotspotsRef.current = hotspotsRef.current.filter((h) => h.id !== id);
      setHotspotList(hotspotsRef.current.map(cloneHotspot));

      if (selectedIdRef.current === id) {
        selectedIdRef.current = null;
        setSelectedId(null);
      }
    };

    const exportJSON = () => {
      const data = {
        model: APARTMENT_MODEL_URL.split("/").pop(),
        hotspots: hotspotsRef.current.map((h) => ({
          id: h.id,
          label: h.label,
          position: { x: h.position.x, y: h.position.y, z: h.position.z },
          cameraPosition: { x: h.cameraPosition.x, y: h.cameraPosition.y, z: h.cameraPosition.z },
          cameraTarget: { x: h.cameraTarget.x, y: h.cameraTarget.y, z: h.cameraTarget.z },
        })),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hotspots.json";
      a.click();
      URL.revokeObjectURL(url);
    };

    sceneActionsRef.current = { captureCamera, renameHotspot, deleteHotspot, exportJSON };

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
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.minDistance = 1;
      controls.maxDistance = 30;
      controls.minPolarAngle = 0.2;
      // Prevents rotating below the floor plane. Test against your actual
      // model before trusting this — if you ever want to look up at
      // fixtures/high shelving this clamp is wrong.
      controls.maxPolarAngle = Math.PI / 2;

      const loader = new GLTFLoader();

      loader.load(
        APARTMENT_MODEL_URL,
        (gltf) => {
          if (canceled) return;

          model = gltf.scene;
          model.updateMatrixWorld(true);

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          console.log("Bounding Box:", box);
          console.log("Size:", size);
          console.log("Center:", center);

          // Dev-only: dump the GLB's node names before trusting any
          // hand-placed HOTSPOTS coordinates. If this logs named nodes
          // like "Bedroom" / "Kitchen" / "LivingRoom", anchoring hotspots
          // to those objects' bounding-box centers is more robust than
          // either the hardcoded Vector3s or manual click-placement.
          model.traverse((child) => {
            console.log(child.name, child.type);
          });

          scene.add(model);

          // Hotspots are parented to `anchor`, which is parented to
          // `model` — NOT to a scene-level group — so config.position
          // stays valid in the model's local space regardless of the
          // model's own root transform.
          hotspotsRef.current.forEach((config) => createHotspotObject(config));

          const handlePointerDown = (event: PointerEvent) => {
            if (!renderer || !model) return;

            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            // 1. Did we click an existing hotspot sphere?
            const hotspotHits = raycaster.intersectObjects(selectableHotspots, true);
            if (hotspotHits.length > 0) {
              const roomId = hotspotHits[0].object.userData.roomId as string;

              if (editModeRef.current) {
                selectedIdRef.current = roomId;
                setSelectedId(roomId);
              } else {
                const config = hotspotsRef.current.find((item) => item.id === roomId);
                if (config) goToRoom(config);
              }
              return;
            }

            // 2. Not editing -> clicking empty space/model does nothing else.
            if (!editModeRef.current) return;

            // 3. Editing and no hotspot hit -> place a new one where the
            //    click actually lands on the model surface.
            const modelHits = raycaster.intersectObject(model, true);
            if (modelHits.length === 0) return;

            // IMPORTANT: model.worldToLocal() mutates its argument in
            // place and returns the same reference. Clone BEFORE
            // converting, or the "worldPoint" you think you still have
            // silently becomes a local-space point too.
            const worldPoint = modelHits[0].point.clone();
            const localPoint = model.worldToLocal(worldPoint.clone());

            // Default the camera preset to a close-up view CENTERED ON
            // the exact point you clicked — not whatever the camera
            // happened to be doing at click time. This is the fix for
            // "rotating swings the whole model": previously a freshly
            // placed hotspot's cameraTarget was just copied from
            // whatever controls.target already was (usually the wide
            // initial apartment view), so navigating to that hotspot
            // never actually zoomed in, and orbiting from there swung
            // across the whole model instead of staying tight around
            // this specific point.
            const defaultDistance = 2.5;
            const viewDir = new THREE.Vector3().subVectors(camera.position, worldPoint);
            if (viewDir.lengthSq() < 1e-6) {
              // Degenerate case: camera sitting exactly on the clicked
              // point. Fall back to a generic "slightly above and in
              // front" direction instead of producing a NaN offset.
              viewDir.set(0, 0.4, 1);
            }
            viewDir.normalize();

            const defaultCameraPosition = worldPoint.clone().addScaledVector(viewDir, defaultDistance);
            defaultCameraPosition.y += 0.4; // slight eye-level lift

            const id = `hotspot-${Date.now()}`;
            const newConfig: HotspotConfig = {
              id,
              label: `New Hotspot ${hotspotsRef.current.length + 1}`,
              position: localPoint,
              cameraPosition: defaultCameraPosition,
              cameraTarget: worldPoint.clone(),
            };

            hotspotsRef.current = [...hotspotsRef.current, newConfig];
            createHotspotObject(newConfig);
            setHotspotList(hotspotsRef.current.map(cloneHotspot));

            selectedIdRef.current = id;
            setSelectedId(id);
          };

          if (!renderer) return;

          pointerDownHandler = handlePointerDown;
          renderer.domElement.addEventListener("pointerdown", handlePointerDown);

          // Position camera to point directly at the living room / main room area from front eye-level
          const maxDim = Math.max(size.x, size.y, size.z);
          const distance = maxDim * 0.8;

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
      gsap.killTweensOf(camera.position);
      if (controls) gsap.killTweensOf(controls.target);
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
        if (pointerDownHandler) {
          renderer.domElement.removeEventListener("pointerdown", pointerDownHandler);
        }
        renderer.dispose();
        if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }

      sceneActionsRef.current = null;
    };
  }, []);

  const selectedHotspot = hotspotList.find((h) => h.id === selectedId) ?? null;

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

      <button
        type="button"
        onClick={() => setEditMode((v) => !v)}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 60,
          padding: "9px 18px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.08)",
          background: editMode ? "rgba(0,170,255,0.85)" : "rgba(10,18,35,0.85)",
          color: "#e2e8f0",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {editMode ? "Editing hotspots: ON" : "Edit hotspots"}
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

      {editMode && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 60,
            display: "flex",
            gap: 12,
            padding: 16,
            borderRadius: 16,
            background: "rgba(10,18,35,0.9)",
            color: "#e2e8f0",
            fontFamily: "sans-serif",
            fontSize: 12,
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Click the model to place a hotspot. Click a dot to select it.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflowY: "auto" }}>
              {hotspotList.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedId(h.id)}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: h.id === selectedId ? "rgba(0,170,255,0.35)" : "rgba(255,255,255,0.05)",
                    color: "#e2e8f0",
                    cursor: "pointer",
                  }}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {selectedHotspot && (
            <div style={{ flex: "1 1 240px", minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Name
                <input
                  value={selectedHotspot.label}
                  onChange={(e) => sceneActionsRef.current?.renameHotspot(selectedHotspot.id, e.target.value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#e2e8f0",
                  }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => sceneActionsRef.current?.captureCamera(selectedHotspot.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(0,170,255,0.35)",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Capture Camera
                </button>
                <button
                  type="button"
                  onClick={() => sceneActionsRef.current?.deleteHotspot(selectedHotspot.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(220,60,60,0.35)",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              onClick={() => sceneActionsRef.current?.exportJSON()}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.1)",
                color: "#e2e8f0",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Export JSON
            </button>
          </div>
        </div>
      )}

      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
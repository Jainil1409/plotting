"use client";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";

type LoadState = "loading" | "loaded" | "error";

export default function ArcGISThreeMap() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const modelAltitudeRef = useRef(0);
  const [status, setStatus] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let canceled = false;
    let view: any;
    let externalRenderersModule: any;
    let renderObject: any;

    (async () => {
      const [Map, SceneView, externalRenderers, THREE, { GLTFLoader }, Point] =
        await Promise.all([
          import("@arcgis/core/Map").then((m) => m.default),
          import("@arcgis/core/views/SceneView").then((m) => m.default),
          (import("@arcgis/core/views/3d/externalRenderers") as Promise<any>),
          import("three"),
          import("three/examples/jsm/loaders/GLTFLoader"),
          import("@arcgis/core/geometry/Point").then((m) => m.default),
        ]);

      if (canceled || !mapDiv.current) return;
      externalRenderersModule = externalRenderers;

      const map = new Map({ basemap: "streets", ground: "world-elevation" });
      view = new SceneView({
        container: mapDiv.current,
        map,
        camera: { position: { longitude: 72.5714, latitude: 23.0225, z: 500 } },
      });
      view.ui.components = [];
      viewRef.current = view;

      await view.when();
      await map.ground.load();
      await Promise.all(map.ground.layers.map((layer: any) => layer.load()));
      if (canceled) {
        view.destroy();
        return;
      }

      const glbUrl = "/model/brutalist_building.glb";
      const fileCheck = await fetch(glbUrl, { method: "HEAD" });
      if (!fileCheck.ok) {
        if (!canceled) {
          setErrorMessage(`Model file not found (HTTP ${fileCheck.status})`);
          setStatus("error");
        }
        return;
      }

      const targetLon = 72.5714;
      const targetLat = 23.0225;
      // A renderer positioned at z: 0 is at sea level, not necessarily at the
      // ground. Placing the GLB there lets terrain depth-hide part of the model.
      const groundPoint = new Point({
        longitude: targetLon,
        latitude: targetLat,
        z: 0,
        spatialReference: { wkid: 4326 },
      });
      let targetAlt = 0;
      try {
        const elevation = await map.ground.queryElevation(groundPoint, {
          noDataValue: 0,
        });
        if (elevation.geometry.type === "point") {
          targetAlt = (elevation.geometry as any).z ?? 0;
        }
      } catch (err) {
        // The model can still load if the elevation service is unavailable.
        console.warn("Could not determine ground elevation; using z: 0", err);
      }
      // Keep a tiny clearance above terrain to prevent depth-buffer z-fighting.
      targetAlt += 0.25;
      modelAltitudeRef.current = targetAlt;

      if (canceled) return;

      renderObject = {
        renderer: null as InstanceType<typeof THREE.WebGLRenderer> | null,
        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(),
        model: null as THREE.Object3D | null,
        placement: null as THREE.Group | null,

        setup(context: any) {
          this.renderer = new THREE.WebGLRenderer({
            context: context.gl,
            premultipliedAlpha: false,
          });
          this.renderer.autoClear = false;
          this.renderer.outputColorSpace = THREE.SRGBColorSpace;
          this.renderer.toneMapping = THREE.NoToneMapping;

          // Neutral ambient so all faces get equal base light without color tinting
          this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
          const sun = new THREE.DirectionalLight(0xffffff, 1.0);
          sun.position.set(1, 2, 2);
          this.scene.add(sun);

          const loader = new GLTFLoader();
          loader.load(
            glbUrl,
            (gltf) => {
              this.model = gltf.scene;

              // Normalize all materials so colors render correctly across any GLB:
              // - disable vertexColors if no vertex color attribute exists (prevents black faces)
              // - ensure double-sided rendering (prevents missing faces from backface culling)
              // - fix transparency: only enable if material actually uses it
              this.model.traverse((child: any) => {
                if (!child.isMesh) return;
                // ArcGIS owns the camera/frustum. Disable Three.js' separate
                // per-mesh culling, which can reject parts of a georeferenced
                // GLB while the SceneView camera is being rotated.
                child.frustumCulled = false;
                const materials: THREE.Material[] = Array.isArray(child.material)
                  ? child.material
                  : [child.material];
                materials.forEach((mat: any) => {
                  // If no COLOR_0 vertex attribute, vertexColors causes black mesh
                  if (mat.vertexColors && !child.geometry?.attributes?.color) {
                    mat.vertexColors = false;
                  }
                  // Show both sides so no faces vanish due to winding order
                  mat.side = THREE.DoubleSide;
                  // Only mark transparent if opacity < 1 or alphaMap exists
                  if (mat.transparent && mat.opacity >= 1 && !mat.alphaMap) {
                    mat.transparent = false;
                  }
                  mat.needsUpdate = true;
                });
              });

              // FIXED: this was previously a mangled/nonexistent method name
              // (rHjQdbJsfW6tJAwi8rKnPjxUGCn1kpaQ7b) that would have thrown
              // a TypeError here, silently aborting everything below it.
              const transform = new THREE.Matrix4();
              externalRenderersModule.renderCoordinateTransformAt(
                view,
                [targetLon, targetLat, targetAlt],
                { wkid: 4326 },
                transform.elements
              );

              const pos = new THREE.Vector3();
              const quat = new THREE.Quaternion();
              const scl = new THREE.Vector3();
              transform.decompose(pos, quat, scl);

              // Auto-scale: fit the model inside TARGET_SIZE meters so any
              // GLB loads visibly regardless of its internal unit scale.
              const TARGET_SIZE = 100;
              const rawBox = new THREE.Box3().setFromObject(this.model);
              const rawSize = new THREE.Vector3();
              rawBox.getSize(rawSize);
              const maxRaw = Math.max(rawSize.x, rawSize.y, rawSize.z);
              const autoScale = maxRaw > 0 ? TARGET_SIZE / maxRaw : 1;

              // Combine geo-orientation (quat) with -90° X rotation to convert
              // Y-up (GLB/Blender) → Z-up (ArcGIS render space)
              // Keep the geographic transform separate from the GLB transform.
              // Moving the GLB by its local bottom makes its base sit on the
              // sampled terrain even when the file's origin is not at its base.
              this.placement = new THREE.Group();
              this.placement.position.copy(pos);
              this.placement.quaternion.copy(quat);
              this.placement.scale.copy(scl);

              this.model.rotation.x = Math.PI / 2;
              this.model.position.set(0, -rawBox.min.y, 0);
              this.model.scale.setScalar(autoScale);
              this.placement.add(this.model);
              this.scene.add(this.placement);
              this.placement.updateMatrixWorld(true);

              const box = new THREE.Box3().setFromObject(this.placement);
              const size = new THREE.Vector3();
              box.getSize(size);
              console.log("model size (meters):", size);
              console.log("model position (render space):", this.model.position);

              externalRenderersModule.requestRender(view);
              if (!canceled) setStatus("loaded");

              const maxDim = Math.max(size.x, size.y, size.z);
              view
                .goTo({
                  target: {
                    type: "point",
                    x: targetLon,
                    y: targetLat,
                    z: targetAlt,
                    spatialReference: { wkid: 4326 },
                  },
                  scale: Math.max(maxDim * 4, 500),
                  tilt: 60,
                })
                .catch((err: unknown) => console.warn("goTo interrupted:", err));
            },
            undefined,
            (err) => {
              console.error("GLTFLoader failed:", err);
              if (!canceled) {
                setErrorMessage("Model failed to parse");
                setStatus("error");
              }
            }
          );

          context.resetWebGLState();
        },

        render(context: any) {
          if (!this.renderer) return;

          // Clear ArcGIS's bound shader program before Three.js renders.
          // This renderer version needs the direct bindings reset before it
          // creates and binds the GLB's own vertex-array state.
          const gl = context.gl as WebGL2RenderingContext;
          gl.useProgram(null);
          gl.bindVertexArray(null);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
          // Keep ArcGIS' depth buffer so the map stays visible, but restore
          // the depth settings required for a normal Three.js model draw.
          gl.enable(gl.DEPTH_TEST);
          gl.depthFunc(gl.LEQUAL);
          gl.depthMask(true);
          gl.colorMask(true, true, true, true);

          const cam = context.camera;
          this.camera.position.set(cam.eye[0], cam.eye[1], cam.eye[2]);
          this.camera.up.set(cam.up[0], cam.up[1], cam.up[2]);
          this.camera.lookAt(new THREE.Vector3(cam.center[0], cam.center[1], cam.center[2]));
          this.camera.projectionMatrix.fromArray(cam.projectionMatrix);
          this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

          this.renderer.render(this.scene, this.camera);

          // Hand state back to ArcGIS cleanly after Three.js is done.
          gl.bindVertexArray(null);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
          gl.useProgram(null);
          context.resetWebGLState();
          externalRenderersModule.requestRender(view);
        },
      };

      externalRenderersModule.add(view, renderObject);
    })();

    return () => {
      canceled = true;
      viewRef.current = null;
      if (externalRenderersModule && renderObject && view) {
        externalRenderersModule.remove(view, renderObject);
      }
      view?.destroy();
      if (mapDiv.current) mapDiv.current.innerHTML = "";
    };
  }, []);

  const handleResetView = () => {
    viewRef.current?.goTo({
      target: { type: "point", x: 72.5714, y: 23.0225, z: modelAltitudeRef.current, spatialReference: { wkid: 4326 } },
      scale: 1800,
      tilt: 60,
    });
  };

  const handleHomeView = () => {
    viewRef.current?.goTo({ position: { longitude: 72.5714, latitude: 23.0225, z: 500 }, tilt: 0, heading: 0 });
  };

  const badgeCopy =
    status === "loading" ? "Loading 3D model..." : status === "loaded" ? "Model loaded via external renderer" : `Failed: ${errorMessage}`;
  const badgeColor =
    status === "loaded" ? "rgba(16, 185, 129, 0.92)" : status === "error" ? "rgba(220, 38, 38, 0.92)" : "rgba(17, 24, 39, 0.82)";

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 2, display: "flex", gap: 8, padding: 8, borderRadius: 16, background: "rgba(15, 23, 42, 0.72)", backdropFilter: "blur(10px)", boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)" }}>
        <button type="button" onClick={handleHomeView} style={{ border: "none", width: 40, height: 40, borderRadius: 12, background: "rgba(255, 255, 255, 0.12)", color: "#fff", cursor: "pointer", fontSize: 18 }} aria-label="Reset camera" title="Reset camera">⌂</button>
        <button type="button" onClick={handleResetView} style={{ border: "none", width: 40, height: 40, borderRadius: 12, background: "rgba(255, 255, 255, 0.12)", color: "#fff", cursor: "pointer", fontSize: 18 }} aria-label="Fit model" title="Fit model">↻</button>
      </div>
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1, padding: "8px 12px", borderRadius: 999, background: badgeColor, color: "white", fontSize: 14, fontWeight: 600, boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)", maxWidth: 420 }}>
        {badgeCopy}
      </div>
      <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
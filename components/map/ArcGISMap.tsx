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
      if (canceled) { view.destroy(); return; }

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
      const groundPoint = new Point({
        longitude: targetLon,
        latitude: targetLat,
        z: 0,
        spatialReference: { wkid: 4326 },
      });
      let targetAlt = 0;
      try {
        const elevation = await map.ground.queryElevation(groundPoint, { noDataValue: 0 });
        if (elevation.geometry.type === "point") {
          targetAlt = (elevation.geometry as any).z ?? 0;
        }
      } catch (err) {
        console.warn("Could not determine ground elevation; using z: 0", err);
      }
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
          // Use ACESFilmicToneMapping so PBR material colors match what the
          // GLB author intended — same pipeline ObjectSymbol3D uses internally.
          this.renderer.outputColorSpace = THREE.SRGBColorSpace;
          this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
          this.renderer.toneMappingExposure = 1.0;

          // Match the lighting ObjectSymbol3D uses: a moderate ambient +
          // one directional. Keep intensity low so PBR albedo isn't blown out.
          this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
          const sun = new THREE.DirectionalLight(0xffffff, 1.2);
          sun.position.set(1, 2, 3);
          this.scene.add(sun);

          const loader = new GLTFLoader();
          loader.load(
            glbUrl,
            (gltf) => {
              this.model = gltf.scene;

              this.model.traverse((child: any) => {
                if (!child.isMesh) return;
                // Disable Three.js frustum culling — ArcGIS controls the
                // camera/frustum and the georeferenced model can be incorrectly
                // culled when the view rotates.
                child.frustumCulled = false;
                const materials: any[] = Array.isArray(child.material)
                  ? child.material
                  : [child.material];
                materials.forEach((mat: any) => {
                  if (mat.vertexColors && !child.geometry?.attributes?.color) {
                    mat.vertexColors = false;
                  }
                  mat.side = THREE.DoubleSide;
                  const hasAlphaCutout = !!mat.alphaMap || !!mat.alphaTest || !!mat.transparent || (mat.map && mat.map.name?.toLowerCase?.().includes("leaf"));
                  if (hasAlphaCutout) {
                    mat.transparent = false;
                    mat.depthWrite = true;
                    mat.alphaTest = Math.max(mat.alphaTest ?? 0, 0.45);
                  } else if (mat.transparent && mat.opacity >= 1) {
                    mat.transparent = false;
                    mat.depthWrite = true;
                  }
                  mat.needsUpdate = true;
                });
              });

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

              const TARGET_SIZE = 100;
              const rawBox = new THREE.Box3().setFromObject(this.model);
              const rawSize = new THREE.Vector3();
              rawBox.getSize(rawSize);
              const maxRaw = Math.max(rawSize.x, rawSize.y, rawSize.z);
              const autoScale = maxRaw > 0 ? TARGET_SIZE / maxRaw : 1;

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
          if (!this.renderer || !this.model) return;

          const gl = context.gl as WebGL2RenderingContext;

          // Reset any state ArcGIS left bound so Three.js starts clean.
          gl.useProgram(null);
          gl.bindVertexArray(null);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
          gl.enable(gl.DEPTH_TEST);
          gl.depthFunc(gl.LEQUAL);
          gl.depthMask(true);
          gl.colorMask(true, true, true, true);

          // Sync the renderer size to the actual ArcGIS canvas every frame so
          // Three.js never clips the scene to a stale/default 300×150 size.
          const vp = context.camera.fullViewport;
          this.renderer.setSize(vp[2], vp[3], false);
          this.renderer.setViewport(vp[0], vp[1], vp[2], vp[3]);

          // Use ArcGIS's exact view matrix instead of recomputing from
          // position/up/lookAt — avoids camera drift during rotation.
          const cam = context.camera;
          this.camera.projectionMatrix.fromArray(cam.projectionMatrix);
          this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
          this.camera.matrixWorldInverse.fromArray(cam.viewMatrix);
          this.camera.matrixWorld.copy(this.camera.matrixWorldInverse).invert();
          this.camera.matrixAutoUpdate = false;

          this.renderer.render(this.scene, this.camera);

          // Restore GL state for ArcGIS to continue rendering cleanly.
          gl.bindVertexArray(null);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
          gl.useProgram(null);
          context.resetWebGLState();
          // Do NOT call requestRender here — that creates a feedback loop
          // causing flicker/glitch during rotation. ArcGIS calls render()
          // automatically whenever the camera or scene changes.
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

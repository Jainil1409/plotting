import * as THREE from "three";
import { createScene } from "./createScene";
import { createCamera } from "./createCamera";
import { createLighting } from "./createLighting";

export class GoogleMapsThreeRenderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  private renderer: THREE.WebGLRenderer | null = null;
  private overlay: google.maps.WebGLOverlayView | null = null;
  private map: google.maps.Map | null = null;
  private anchor: google.maps.LatLngAltitudeLiteral | null = null;
  private onDrawCallback: (() => void) | null = null;

  constructor() {
    this.scene = createScene();
    this.camera = createCamera();
    createLighting(this.scene);
  }

  setAnchor(anchor: google.maps.LatLngAltitudeLiteral) {
    this.anchor = anchor;
  }

  getAnchor() {
    return this.anchor;
  }

  setOnDraw(callback: () => void) {
    this.onDrawCallback = callback;
  }

  attachToMap(map: google.maps.Map) {
    this.map = map;

    const overlay = new window.google.maps.WebGLOverlayView();

    overlay.onAdd = () => {
      // scene & camera already built in constructor
    };

    overlay.onContextRestored = ({ gl }: google.maps.WebGLStateOptions) => {
      this.renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas as HTMLCanvasElement,
        context: gl,
        ...gl.getContextAttributes(),
      });

      this.renderer.autoClear = false;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      // Environment map for PBR materials
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();

      import("three/examples/jsm/environments/RoomEnvironment").then(
        ({ RoomEnvironment }) => {
          const envScene = new RoomEnvironment();
          this.scene.environment = pmremGenerator.fromScene(envScene).texture;
          envScene.dispose();
          pmremGenerator.dispose();
        }
      );
    };

    overlay.onDraw = ({ gl, transformer }: google.maps.WebGLDrawOptions) => {
      overlay.requestRedraw();

      if (!this.renderer || !this.anchor) return;

      const matrix = transformer.fromLatLngAltitude(
        this.anchor,
        new Float32Array(16)
      );

      this.camera.projectionMatrix.fromArray(matrix);
      this.camera.projectionMatrixInverse
        .copy(this.camera.projectionMatrix)
        .invert();

      // Allow external code to update hotspots etc. before render
      this.onDrawCallback?.();

      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.renderer.resetState();
    };

    overlay.setMap(map);

    this.overlay = overlay;
  }

  requestRedraw() {
    this.overlay?.requestRedraw();
  }

  dispose() {
    this.overlay?.setMap(null);
    this.overlay = null;
    this.map = null;
    this.renderer = null;
    this.anchor = null;
  }
}

import * as THREE from "three";

export class ViewerScene {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public onContextLost: ((message: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1120);

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      // same hybrid-GPU driver mitigation learned the hard way on the
      // earlier react-three-fiber project's WebGL context-loss debugging
      powerPreference: "default",
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost);

    this.addLights();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    console.warn("ModelViewer: WebGL context lost");
    this.onContextLost?.("WebGL context was lost.");
  };

  private addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(5, 8, 5);
    this.scene.add(directional);

    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
    fill.position.set(-3, 2, -2);
    this.scene.add(fill);
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height);
  }

  render(camera: THREE.Camera) {
    this.renderer.render(this.scene, camera);
  }

  dispose() {
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);

    // Free every geometry/material/texture — same lesson as
    // disposeObject3D in GoogleMap3D.tsx: Three.js won't do this
    // automatically just because the component unmounts.
    this.scene.traverse((object: any) => {
      if (object.geometry) object.geometry.dispose();

      const material = object.material;
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

    this.renderer.dispose();

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
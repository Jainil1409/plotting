import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import { HotspotConfig } from "../types/hotspot";

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);

    this.camera.position.set(5, 5, 5);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.enableRotate = true;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 30;
    this.controls.minPolarAngle = 0.2;
    // Prevents rotating below the floor plane. Test against your actual
    // model before trusting this — if you ever want to look up at
    // fixtures/high shelving this clamp is wrong.
    this.controls.maxPolarAngle = Math.PI / 2;
  }

  updateAspect(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update() {
    this.controls.update();
  }

  // Reproduces the original auto-framing: positions the camera to point
  // directly at the living room / main room area from front eye-level,
  // based on the loaded model's bounding box.
  frameModel(size: THREE.Vector3, center: THREE.Vector3) {
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 0.8;

    const livingRoomTarget = new THREE.Vector3(
      center.x - size.x * 0.15,
      center.y + size.y * 0.05,
      center.z + size.z * 0.1
    );

    this.camera.position.set(
      livingRoomTarget.x - distance * 0.65,
      livingRoomTarget.y + distance * 0.45,
      livingRoomTarget.z + distance * 0.75
    );

    this.camera.lookAt(livingRoomTarget);
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(livingRoomTarget);
    this.controls.update();
  }

  // Camera preset transition — moves the camera/controls target, never
  // the apartment model. Model stays fixed; camera rotates around it.
  goToHotspot(hotspot: HotspotConfig) {
    gsap.to(this.camera.position, {
      x: hotspot.cameraPosition.x,
      y: hotspot.cameraPosition.y,
      z: hotspot.cameraPosition.z,
      duration: 1.2,
      ease: "power2.inOut",
    });

    gsap.to(this.controls.target, {
      x: hotspot.cameraTarget.x,
      y: hotspot.cameraTarget.y,
      z: hotspot.cameraTarget.z,
      duration: 1.2,
      ease: "power2.inOut",
      onUpdate: () => {
        this.controls.update();
      },
    });
  }

  capture() {
    return {
      cameraPosition: this.camera.position.clone(),
      cameraTarget: this.controls.target.clone(),
    };
  }

  dispose() {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    this.controls.dispose();
  }
}
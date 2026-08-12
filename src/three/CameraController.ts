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
    // Slightly higher than the Three.js default (0.05) so manual
    // rotation/pan feels floaty and smooth rather than snappy/jittery.
    this.controls.dampingFactor = 0.12;
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

  // Immediately place the camera at a hotspot's recorded preset — used
  // when a model is first opened (e.g. from a map hotspot) so the viewer
  // "directly shows" that hotspot at its saved angle on load.
  setCameraPreset(hotspot: HotspotConfig) {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);

    this.camera.position.copy(hotspot.cameraPosition);
    this.controls.target.copy(hotspot.cameraTarget);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  // Camera preset transition — moves the camera/controls target, never
  // the apartment model. Model stays fixed; camera rotates around it.
  //
  // Smoothness notes:
  //  - A slower, gentler "expo.inOut" ease gives a cinematic settle
  //    instead of the old snappy power2 curve.
  //  - OrbitControls damping is temporarily disabled during the tween so
  //    the controls' momentum doesn't fight the animation (which is what
  //    made the previous 1.2s tween feel choppy while rotating). It is
  //    re-enabled once the transition completes.
  //  - Any in-flight tween is killed first, so rapid clicks always start
  //    from the CURRENT camera state rather than a stale one.
  goToHotspot(hotspot: HotspotConfig) {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);

    const duration = 1.6;
    const ease = "expo.inOut";

    this.controls.enableDamping = false;

    gsap.to(this.camera.position, {
      x: hotspot.cameraPosition.x,
      y: hotspot.cameraPosition.y,
      z: hotspot.cameraPosition.z,
      duration,
      ease,
      onUpdate: () => {
        this.controls.update();
      },
    });

    gsap.to(this.controls.target, {
      x: hotspot.cameraTarget.x,
      y: hotspot.cameraTarget.y,
      z: hotspot.cameraTarget.z,
      duration,
      ease,
      onComplete: () => {
        this.controls.enableDamping = true;
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
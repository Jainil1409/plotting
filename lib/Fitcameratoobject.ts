// lib/fitCameraToObject.ts
//
// Replaces guessed camera positions with a computed fit based on the
// model's actual bounding box. Solves the "model loaded fine but nothing
// is visible because the camera guess didn't match this model's real
// scale/position" problem — which is unavoidable when you don't know a
// model's export units/origin in advance.

import * as THREE from "three";

export interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

export function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  controls?: OrbitControlsLike,
  padding = 1.4
) {
  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    console.warn(
      "fitCameraToObject: bounding box is empty — model may have failed to load, or contains no visible geometry."
    );
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let distance = (maxDim / 2 / Math.tan(fov / 2)) * padding;
  distance = Math.max(distance, 0.1); // guard against zero/negative for degenerate boxes

  // Position camera along a pleasant 3/4 angle rather than straight-on.
  const direction = new THREE.Vector3(1, 0.6, 1).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(center);

  if (controls) {
    controls.target.copy(center);
    controls.update();
  }

  // Log once so you can see the real scale/position instead of guessing —
  // if `size` looks like [500, 300, 400] your model is probably in
  // centimeters; if it's [5, 3, 4] it's probably meters.
  console.info("fitCameraToObject: bounding box size", size, "center", center);
}
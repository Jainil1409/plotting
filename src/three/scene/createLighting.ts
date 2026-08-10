import * as THREE from "three";

export function createLighting(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xf0f4ff, 0.6));

  const hemi = new THREE.HemisphereLight(0xc9d8f0, 0x8a7f72, 0.8);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
  fill.position.set(-2, 1, -1);
  scene.add(fill);
}
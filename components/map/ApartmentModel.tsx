"use client";

// components/ApartmentModel.tsx
// Loads the apartment model. Purely presentational — "back" navigation
// lives in SceneViewer as an HTML overlay, not a 3D hotspot.

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { disposeObject3D } from "@/lib/disposeObject3D";
import { fitCameraToObject, type OrbitControlsLike } from "@/lib/Fitcameratoobject";

const MODEL_PATH = "/model/appartement.glb";

export default function ApartmentModel() {
  const { scene } = useGLTF(MODEL_PATH);
  const { camera, controls } = useThree();

  useEffect(() => {
    if (scene && camera instanceof THREE.PerspectiveCamera) {
      fitCameraToObject(
        camera,
        scene,
        controls as unknown as OrbitControlsLike | undefined
      );
    }
  }, [scene, camera, controls]);

  useEffect(() => {
    return () => {
      disposeObject3D(scene);
      useGLTF.clear(MODEL_PATH);
    };
  }, [scene]);

  return <primitive object={scene} />;
}
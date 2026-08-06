"use client";

// components/HouseModel.tsx
// Loads modern_house_06.glb and places a clickable hotspot on the door.

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Hotspot from "./Hotspot";
import { disposeObject3D } from "@/lib/disposeObject3D";
import { fitCameraToObject, type OrbitControlsLike } from "@/lib/Fitcameratoobject";
import type { HotspotConfig, SceneView } from "@/types/Scene";

const MODEL_PATH = "/model/modern_house_06.glb";

// Calibrated via Alt+click on the door (see README "Calibrating hotspot
// coordinates") — this is the real position, not a guess.
const DOOR_HOTSPOT: HotspotConfig = {
  id: "house-front-door",
  position: [466.36961790205766, 1.0205857995900758, -199.55877454376417],
  label: "Enter apartment",
  target: "apartment",
};

interface HouseModelProps {
  onNavigate: (target: SceneView) => void;
}

export default function HouseModel({ onNavigate }: HouseModelProps) {
  const { scene } = useGLTF(MODEL_PATH);
  const { camera, controls } = useThree();

  // Auto-frame the camera to this model's REAL bounding box instead of a
  // guessed position — fixes "model loaded fine but nothing was visible
  // because the camera wasn't pointed at it." Also logs the model's actual
  // size/center to the console so you can calibrate the door hotspot
  // position for real instead of guessing.
  useEffect(() => {
    if (scene && camera instanceof THREE.PerspectiveCamera) {
      fitCameraToObject(
        camera,
        scene,
        // useThree().controls is loosely typed by r3f (it doesn't know at
        // the type level that drei's OrbitControls is attached). Going
        // through `unknown` first is required here — TS won't allow a
        // direct cast between two types it can't prove overlap.
        controls as unknown as OrbitControlsLike | undefined
      );
    }
  }, [scene, camera, controls]);

  // Free this model's GPU memory when it's swapped out.
  useEffect(() => {
    return () => {
      disposeObject3D(scene);
      useGLTF.clear(MODEL_PATH);
    };
  }, [scene]);

  return (
    <group
      onClick={(e) => {
        // Calibration helper: Alt+click any point on the house to log its
        // exact world-space coordinate. Use this to find the real door
        // position instead of guessing — click the door, copy the logged
        // [x, y, z] into DOOR_HOTSPOT.position above, done.
        if (e.altKey) {
          e.stopPropagation();
          console.info(
            "Calibration — Alt+clicked world position:",
            [e.point.x, e.point.y, e.point.z]
          );
        }
      }}
    >
      <primitive object={scene} />
      <Hotspot config={DOOR_HOTSPOT} onSelect={onNavigate} />
    </group>
  );
}
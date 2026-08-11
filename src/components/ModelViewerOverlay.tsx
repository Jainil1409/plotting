"use client";

import type { ModelDefinition } from "@/src/three/models/modelTypes";
import ModelViewer from "./ModelViewer";

interface ModelViewerOverlayProps {
  model?: ModelDefinition;
  modelUrl?: string;
  onBack: () => void;
}

export default function ModelViewerOverlay({
  model,
  modelUrl,
  onBack,
}: ModelViewerOverlayProps) {
  const resolvedModelUrl = model?.modelUrl ?? modelUrl;

  if (!resolvedModelUrl) return null;

  return (
    <ModelViewer
      modelUrl={resolvedModelUrl}
      onBack={onBack}
    />
  );
}

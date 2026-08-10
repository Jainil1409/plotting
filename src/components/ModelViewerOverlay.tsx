"use client";

import ModelViewer from "./ModelViewer";

interface ModelViewerOverlayProps {
  modelUrl: string;
  onBack: () => void;
}

export default function ModelViewerOverlay({
  modelUrl,
  onBack,
}: ModelViewerOverlayProps) {
  return (
    <ModelViewer
      modelUrl={modelUrl}
      onBack={onBack}
    />
  );
}
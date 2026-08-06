import GoogleMap3D from "@/components/map/GoogleMap3D";
import SceneViewer from "@/components/map/Sceneviewer";
export default function Page() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <GoogleMap3D />
    </div>
  );
}
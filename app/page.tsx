"use client";

import dynamic from "next/dynamic";
//import { useState } from "react";
//import Navbar, { type Tab } from "@/components/Navbar";

const ArcGISMap = dynamic(() => import("@/components/map/ArcGISMap"), { ssr: false });
const ObjectSymbol3DMap = dynamic(() => import("@/components/map/ObjectSymbol3DMap"), { ssr: false });
const GoogleMap3D = dynamic(() => import("@/components/map/GoogleMap3D"), { ssr: false });

export default function Home() {
  //const [activeTab, setActiveTab] = useState<Tab>("external");

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* <Navbar active={activeTab} onChange={setActiveTab} />
      <div style={{ flex: 1, marginTop: 52, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: activeTab === "external" ? "block" : "none" }}>
          <ArcGISMap />
        </div>
        <div style={{ position: "absolute", inset: 0, display: activeTab === "symbol3d" ? "block" : "none" }}>
          <ObjectSymbol3DMap />
        </div>
        <div style={{ position: "absolute", inset: 0, display: activeTab === "googlemaps" ? "block" : "none" }}>
          <GoogleMap3D />
        </div>
      </div> */}
      <GoogleMap3D />
    </div>
  );
}

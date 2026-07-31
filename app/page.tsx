"use client";

import dynamic from "next/dynamic";

const ArcGISMap = dynamic(() => import("@/components/map/ArcGISMap"), {
  ssr: false,
});

export default function Home() {
  return <ArcGISMap />;
}

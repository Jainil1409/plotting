"use client";
import { useEffect, useRef } from "react";
import type SceneView from "@arcgis/core/views/SceneView";

export default function ObjectSymbol3DMap() {
  const mapDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let view: SceneView | undefined;
    let canceled = false;
    const container = mapDiv.current;

    (async () => {
      const [Map, SceneView, GraphicsLayer, Graphic, Point, PointSymbol3D, ObjectSymbol3DLayer] = await Promise.all([
        import("@arcgis/core/Map").then((m) => m.default),
        import("@arcgis/core/views/SceneView").then((m) => m.default),
        import("@arcgis/core/layers/GraphicsLayer").then((m) => m.default),
        import("@arcgis/core/Graphic").then((m) => m.default),
        import("@arcgis/core/geometry/Point").then((m) => m.default),
        import("@arcgis/core/symbols/PointSymbol3D").then((m) => m.default),
        import("@arcgis/core/symbols/ObjectSymbol3DLayer").then((m) => m.default),
      ]);

      if (canceled || !container) return;

      const map = new Map({ basemap: "streets", ground: "world-elevation" });

      view = new SceneView({
        container,
        map,
        camera: { position: { longitude: 72.5714, latitude: 23.0225, z: 500 } },
      });
      view.ui.components = [];

      const layer = new GraphicsLayer({ elevationInfo: { mode: "on-the-ground" } });
      map.add(layer);

      await view.when();
      if (canceled) return;

      const point = new Point({
        longitude: 72.5714,
        latitude: 23.0225,
        spatialReference: { wkid: 4326 },
      });

      const symbol = new PointSymbol3D({
        symbolLayers: [
          new ObjectSymbol3DLayer({
            resource: { href: "/model/brutalist_building.glb" },
            width: 100,
            height: 100,
            depth: 100,
            anchor: "bottom",
          }),
        ],
      });

      const graphic = new Graphic({ geometry: point, symbol });
      layer.add(graphic);

      view
        .goTo({
          target: { type: "point", x: 72.5714, y: 23.0225, spatialReference: { wkid: 4326 } },
          scale: 500,
          tilt: 60,
        })
        .catch((err: unknown) => console.warn("goTo interrupted:", err));
    })();

    return () => {
      canceled = true;
      view?.destroy();
      if (container) container.innerHTML = "";
    };
  }, []);

  return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
}

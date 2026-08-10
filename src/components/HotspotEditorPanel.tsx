"use client";

import { HotspotConfig } from "../types/hotspot";

interface Props {
  hotspots: HotspotConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onCapture: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
}

export default function HotspotEditorPanel({
  hotspots,
  selectedId,
  onSelect,
  onRename,
  onCapture,
  onDelete,
  onExport,
}: Props) {
  const selectedHotspot = hotspots.find((hotspot) => hotspot.id === selectedId) ?? null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 60,
        display: "flex",
        gap: 12,
        padding: 16,
        borderRadius: 16,
        background: "rgba(10,18,35,0.9)",
        color: "#e2e8f0",
        fontFamily: "sans-serif",
        fontSize: 12,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 200 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          Click the model to place a hotspot. Click a dot to select it.
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {hotspots.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect(h.id)}
              style={{
                textAlign: "left",
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: h.id === selectedId ? "rgba(0,170,255,0.35)" : "rgba(255,255,255,0.05)",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {selectedHotspot && (
        <div
          style={{
            flex: "1 1 240px",
            minWidth: 220,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Name
            <input
              value={selectedHotspot.label}
              onChange={(e) => onRename(selectedHotspot.id, e.target.value)}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "#e2e8f0",
              }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onCapture(selectedHotspot.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(0,170,255,0.35)",
                color: "#e2e8f0",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Capture Camera
            </button>
            <button
              type="button"
              onClick={() => onDelete(selectedHotspot.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(220,60,60,0.35)",
                color: "#e2e8f0",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
        <button
          type="button"
          onClick={onExport}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.1)",
            color: "#e2e8f0",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Export JSON
        </button>
      </div>
    </div>
  );
}
"use client";

type Tab = "external" | "symbol3d";

interface NavbarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function Navbar({ active, onChange }: NavbarProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "external", label: "External Renderer" },
    { id: "symbol3d", label: "ObjectSymbol3D" },
  ];

  return (
    <nav style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      height: 52,
      background: "rgba(10, 15, 30, 0.88)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      gap: 8,
    }}>
      <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginRight: 16, letterSpacing: "0.05em" }}>
        3D MAP
      </span>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          style={{
            border: "none",
            padding: "6px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.2s, color 0.2s",
            background: active === tab.id ? "rgba(99, 102, 241, 0.85)" : "rgba(255,255,255,0.07)",
            color: active === tab.id ? "#fff" : "#94a3b8",
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

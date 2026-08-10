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

type IconProps = { size?: number };

const PinIcon = ({ size = 14 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CameraIcon = ({ size = 14 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

const TrashIcon = ({ size = 14 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const DownloadIcon = ({ size = 14 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const formatVec = (v: number) => (Math.abs(v) < 0.001 ? "0" : v.toFixed(2));

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
    <>
      <style>{`
        .hs-panel {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 60;
          width: min(920px, calc(100% - 32px));
          padding: 1px;
          border-radius: 20px;
          background: linear-gradient(
            180deg,
            rgba(148,163,184,0.28),
            rgba(148,163,184,0.08) 35%,
            rgba(148,163,184,0.03)
          );
          box-shadow:
            0 18px 50px rgba(0,0,0,0.55),
            0 4px 14px rgba(0,0,0,0.3);
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, sans-serif;
          font-size: 13px;
          color: #e2e8f0;
          backdrop-filter: blur(20px) saturate(140%);
          -webkit-backdrop-filter: blur(20px) saturate(140%);
          animation: hs-rise 0.25s ease-out;
        }

        @keyframes hs-rise {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .hs-inner, .hs-inner * { box-sizing: border-box; }

        .hs-inner {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 18px 20px;
          border-radius: 19px;
          background: linear-gradient(180deg, rgba(18,27,48,0.96), rgba(10,16,32,0.96));
        }

        /* Header */
        .hs-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .hs-title-group { display: flex; align-items: center; gap: 11px; }
        .hs-title-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 11px;
          background: linear-gradient(135deg, rgba(56,189,248,0.28), rgba(14,165,233,0.12));
          border: 1px solid rgba(56,189,248,0.35);
          color: #7dd3fc;
          flex-shrink: 0;
        }
        .hs-title {
          font-size: 14.5px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: 0.2px;
        }
        .hs-subtitle {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .hs-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .hs-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(56,189,248,0.12);
          border: 1px solid rgba(56,189,248,0.25);
          color: #7dd3fc;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .hs-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 8px rgba(56,189,248,0.8);
        }

        /* Body layout */
        .hs-body {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .hs-col-list {
          flex: 1 1 240px;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .hs-col-details {
          flex: 1 1 300px;
          min-width: 260px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-left: 20px;
          border-left: 1px solid rgba(255,255,255,0.06);
        }

        .hs-eyebrow {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
        }

        /* Hotspot list */
        .hs-scroll {
          max-height: 152px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(148,163,184,0.35) transparent;
        }
        .hs-scroll::-webkit-scrollbar { width: 6px; }
        .hs-scroll::-webkit-scrollbar-track { background: transparent; }
        .hs-scroll::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,0.3);
          border-radius: 999px;
        }
        .hs-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.5); }

        .hs-list-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 10px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          color: #cbd5e1;
          font-size: 13px;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }
        .hs-list-item:hover {
          background: rgba(255,255,255,0.07);
          color: #f1f5f9;
        }
        .hs-list-item:focus-visible {
          outline: 2px solid rgba(56,189,248,0.5);
          outline-offset: 1px;
        }
        .hs-list-item.is-selected {
          background: linear-gradient(90deg, rgba(56,189,248,0.16), rgba(56,189,248,0.05));
          border-color: rgba(56,189,248,0.35);
          color: #f8fafc;
        }
        .hs-list-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          flex-shrink: 0;
        }
        .hs-list-item.is-selected .hs-list-index {
          background: rgba(56,189,248,0.25);
          border-color: rgba(56,189,248,0.4);
          color: #7dd3fc;
        }
        .hs-list-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Empty state */
        .hs-empty {
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px dashed rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.02);
          color: #94a3b8;
          font-size: 12.5px;
          line-height: 1.55;
        }

        /* Editor fields */
        .hs-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .hs-field-label {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.03em;
        }
        .hs-input {
          width: 100%;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: #e2e8f0;
          font-size: 13px;
          font-family: inherit;
          color-scheme: dark;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }
        .hs-input:hover { background: rgba(255,255,255,0.06); }
        .hs-input:focus {
          border-color: rgba(56,189,248,0.6);
          box-shadow: 0 0 0 3px rgba(56,189,248,0.15);
          background: rgba(255,255,255,0.05);
        }
        .hs-input::placeholder { color: #64748b; }

        /* Coordinate readout */
        .hs-coords {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .hs-coord {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 7px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          font-variant-numeric: tabular-nums;
          color: #94a3b8;
        }
        .hs-coord em {
          font-style: normal;
          font-weight: 700;
          color: #64748b;
        }

        /* Buttons */
        .hs-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid transparent;
          font-size: 12.5px;
          font-weight: 600;
          font-family: inherit;
          letter-spacing: 0.2px;
          white-space: nowrap;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.05s ease;
        }
        .hs-btn:active { transform: translateY(1px); }
        .hs-btn:focus-visible {
          outline: 2px solid rgba(56,189,248,0.6);
          outline-offset: 2px;
        }

        .hs-btn-primary {
          background: linear-gradient(180deg, #38bdf8, #0ea5e9);
          border-color: rgba(125,211,252,0.3);
          color: #052033;
          box-shadow: 0 2px 10px rgba(14,165,233,0.35),
            inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .hs-btn-primary:hover {
          background: linear-gradient(180deg, #4cc3fa, #21aceb);
          box-shadow: 0 4px 16px rgba(14,165,233,0.45),
            inset 0 1px 0 rgba(255,255,255,0.3);
        }

        .hs-btn-danger {
          background: rgba(220,60,60,0.14);
          border-color: rgba(248,113,113,0.28);
          color: #fca5a5;
        }
        .hs-btn-danger:hover {
          background: rgba(220,60,60,0.26);
          border-color: rgba(248,113,113,0.5);
          color: #fecaca;
        }

        .hs-btn-ghost {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.1);
          color: #cbd5e1;
        }
        .hs-btn-ghost:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.18);
          color: #f1f5f9;
        }

        .hs-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 2px;
        }

        @media (max-width: 640px) {
          .hs-col-details {
            padding-left: 0;
            border-left: none;
            padding-top: 12px;
            border-top: 1px solid rgba(255,255,255,0.06);
          }
        }
      `}</style>

      <div className="hs-panel">
        <div className="hs-inner">
          {/* Header */}
          <div className="hs-header">
            <div className="hs-title-group">
              <span className="hs-title-icon">
                <PinIcon size={16} />
              </span>
              <div>
                <div className="hs-title">Hotspot Editor</div>
                <div className="hs-subtitle">Click the model surface to place a hotspot</div>
              </div>
            </div>
            <div className="hs-header-actions">
              <span className="hs-badge">
                <span className="hs-badge-dot" />
                {hotspots.length} placed
              </span>
              <button type="button" className="hs-btn hs-btn-ghost" onClick={onExport}>
                <DownloadIcon /> Export JSON
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="hs-body">
            {/* Hotspot list */}
            <div className="hs-col hs-col-list">
              <div className="hs-eyebrow">Hotspots</div>
              {hotspots.length === 0 ? (
                <div className="hs-empty">
                  No hotspots yet. Click the model surface to place your first one.
                </div>
              ) : (
                <div className="hs-scroll">
                  {hotspots.map((h, i) => (
                    <button
                      key={h.id}
                      type="button"
                      className={`hs-list-item${h.id === selectedId ? " is-selected" : ""}`}
                      onClick={() => onSelect(h.id)}
                      title={h.label || "Untitled hotspot"}
                    >
                      <span className="hs-list-index">{String(i + 1).padStart(2, "0")}</span>
                      <span className="hs-list-label">{h.label || "Untitled hotspot"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selection editor */}
            {selectedHotspot ? (
              <div className="hs-col hs-col-details">
                <div className="hs-eyebrow">Selected hotspot</div>

                <label className="hs-field">
                  <span className="hs-field-label">Name</span>
                  <input
                    className="hs-input"
                    value={selectedHotspot.label}
                    onChange={(e) => onRename(selectedHotspot.id, e.target.value)}
                    placeholder="Untitled hotspot"
                    spellCheck={false}
                  />
                </label>

                <div className="hs-coords">
                  <span className="hs-coord">
                    <em>X</em>
                    {formatVec(selectedHotspot.position.x)}
                  </span>
                  <span className="hs-coord">
                    <em>Y</em>
                    {formatVec(selectedHotspot.position.y)}
                  </span>
                  <span className="hs-coord">
                    <em>Z</em>
                    {formatVec(selectedHotspot.position.z)}
                  </span>
                </div>

                <div className="hs-actions">
                  <button
                    type="button"
                    className="hs-btn hs-btn-primary"
                    onClick={() => onCapture(selectedHotspot.id)}
                  >
                    <CameraIcon /> Capture camera
                  </button>
                  <button
                    type="button"
                    className="hs-btn hs-btn-danger"
                    onClick={() => onDelete(selectedHotspot.id)}
                  >
                    <TrashIcon /> Delete
                  </button>
                </div>
              </div>
            ) : hotspots.length > 0 ? (
              <div className="hs-col hs-col-details">
                <div className="hs-eyebrow">Selected hotspot</div>
                <div className="hs-empty">
                  Select a hotspot from the list to rename it, capture the current camera
                  view, or delete it.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
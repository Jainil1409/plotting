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
  onClose: () => void;
}

type IconProps = { size?: number };

const LensIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="6.5" width="19" height="12.5" rx="2" />
    <path d="M8 6.5 9.4 4h5.2L16 6.5" />
    <circle cx="12" cy="12.5" r="3.4" />
  </svg>
);

const TrashIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 6.5h17" />
    <path d="M18 6.5v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-13" />
    <path d="M9 6.5V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2" />
  </svg>
);

const DismissIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
    <line x1="16.5" y1="7.5" x2="7.5" y2="16.5" />
    <line x1="7.5" y1="7.5" x2="16.5" y2="16.5" />
  </svg>
);

const ExportIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4.5 17.5v2A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
  </svg>
);

const formatVec = (v: number) => (Math.abs(v) < 0.001 ? "0.00" : v.toFixed(2));

export default function HotspotEditorPanel({
  hotspots,
  selectedId,
  onSelect,
  onRename,
  onCapture,
  onDelete,
  onExport,
  onClose,
}: Props) {
  const selectedHotspot = hotspots.find((hotspot) => hotspot.id === selectedId) ?? null;
  const total = hotspots.length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Work+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .ed-panel {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 60;
          width: min(340px, 100%);
          background: #f6f7f5;
          border-left: 1px solid #e2e4e1;
          box-shadow: -16px 0 36px rgba(15,20,18,0.14);
          font-family: "Work Sans", -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 13px;
          color: #14161a;
        }

        @media (prefers-reduced-motion: no-preference) {
          .ed-panel { animation: ed-slide-in 0.22s cubic-bezier(0.2, 0.7, 0.3, 1); }
        }
        @keyframes ed-slide-in {
          from { opacity: 0; transform: translateX(14px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 640px) {
          .ed-panel {
            top: auto; left: 0; right: 0; bottom: 0;
            width: 100%; max-height: 70vh;
            border-left: none;
            border-top: 1px solid #e2e4e1;
            border-radius: 16px 16px 0 0;
          }
        }

        .ed-inner, .ed-inner * { box-sizing: border-box; }
        .ed-inner { display: flex; flex-direction: column; height: 100%; overflow-y: auto; }

        /* ---- Header ---- */
        .ed-header {
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 18px 18px 14px;
        }
        .ed-title {
          font-family: "Sora", sans-serif;
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.01em;
          color: #14161a;
        }
        .ed-subtitle { font-size: 12px; color: #6b7280; margin-top: 3px; }
        .ed-header-right { display: flex; align-items: center; gap: 8px; }
        .ed-count {
          font-family: "JetBrains Mono", monospace;
          font-size: 11px;
          font-weight: 500;
          color: #0f7a72;
          background: rgba(15,122,114,0.1);
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .ed-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .ed-close:hover { background: #e9ebe8; color: #14161a; }
        .ed-close:focus-visible { outline: 2px solid #0f7a72; outline-offset: 2px; }

        .ed-divider { height: 1px; background: #e2e4e1; margin: 0 18px; }

        /* ---- Body ---- */
        .ed-body { flex: 1; display: flex; flex-direction: column; gap: 18px; padding: 16px 18px; }

        .ed-eyebrow {
          font-family: "JetBrains Mono", monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 10px;
        }

        /* ---- Log: numbered dots on a connecting path line ----
           Each row draws its OWN short connector segment down into the
           next row's dot, instead of one long overlay line spanning the
           whole list. A single overlay sized with top/bottom against
           .ed-log's capped max-height only ever spans that fixed
           viewport height, not the full scrollable content — which is
           exactly why the line stopped appearing after ~5 items. Per-row
           segments scale to any number of hotspots automatically. */
        .ed-log { position: relative; display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; }
        .ed-row:not(:last-child)::after {
          content: "";
          position: absolute;
          left: 20px; /* aligns with the 32px dot's center (4px padding-left + 16px half-width) */
          top: 40px;  /* bottom edge of this row's dot (8px padding-top + 32px dot height) */
          width: 1.5px;
          height: 26px; /* reaches through the row gap into the next row's dot, which sits above it via z-index */
          background: #dcdfdb;
          z-index: 0;
          transform: translateX(-0.75px);
        }
        .ed-row {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 10px 8px 4px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #14161a;
          font-family: inherit;
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .ed-row:hover { background: #eceeeb; }
        .ed-row:focus-visible { outline: 2px solid #0f7a72; outline-offset: -2px; }
        .ed-row.is-selected { background: #ffffff; box-shadow: 0 1px 2px rgba(15,20,18,0.08), 0 0 0 1px #e2e4e1; }

        .ed-dot {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border: 1.5px solid #dcdfdb;
          font-family: "JetBrains Mono", monospace;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
        }
        .ed-row.is-selected .ed-dot { border-color: #0f7a72; color: #0f7a72; background: rgba(15,122,114,0.08); }

        .ed-row-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
        .ed-row.is-selected .ed-row-label { color: #0f7a72; }

        .ed-empty {
          padding: 14px 12px;
          border: 1px dashed #dcdfdb;
          border-radius: 10px;
          color: #6b7280;
          font-size: 12.5px;
          line-height: 1.55;
        }

        /* ---- Detail card ---- */
        .ed-card { background: #ffffff; border: 1px solid #e2e4e1; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }

        .ed-field { display: flex; flex-direction: column; gap: 5px; }
        .ed-field-label { font-family: "JetBrains Mono", monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280; }
        .ed-input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #e2e4e1;
          border-radius: 8px;
          background: #f6f7f5;
          color: #14161a;
          font-family: "Sora", sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          outline: none;
          transition: border-color 0.12s ease, background 0.12s ease;
        }
        .ed-input:focus { border-color: #0f7a72; background: #ffffff; }
        .ed-input::placeholder { color: #9aa0a6; font-weight: 400; }

        .ed-coords { display: flex; gap: 6px; flex-wrap: wrap; }
        .ed-coord {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 6px;
          background: #f6f7f5;
          font-family: "JetBrains Mono", monospace;
          font-size: 11.5px;
          color: #14161a;
        }
        .ed-coord-axis { color: #9aa0a6; font-weight: 500; }

        .ed-actions { display: flex; gap: 8px; }
        .ed-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 12px;
          border-radius: 8px;
          border: none;
          font-family: "Work Sans", sans-serif;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
        }
        .ed-btn:focus-visible { outline: 2px solid #0f7a72; outline-offset: 2px; }

        .ed-btn-primary { flex: 1; background: #0f7a72; color: #ffffff; }
        .ed-btn-primary:hover { background: #0c645e; }

        .ed-btn-danger { background: transparent; color: #b3261e; padding: 9px 10px; }
        .ed-btn-danger:hover { background: rgba(179,38,30,0.08); }

        /* ---- Export ---- */
        .ed-export-wrap { margin-top: auto; padding: 14px 18px 18px; }
        .ed-btn-export {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1px solid #e2e4e1;
          background: #ffffff;
          color: #14161a;
          font-family: "Work Sans", sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.12s ease, box-shadow 0.12s ease;
        }
        .ed-btn-export:hover { border-color: #0f7a72; box-shadow: 0 1px 2px rgba(15,20,18,0.06); }
        .ed-btn-export:focus-visible { outline: 2px solid #0f7a72; outline-offset: 2px; }
      `}</style>

      <div className="ed-panel">
        <div className="ed-inner">
          <div className="ed-header">
            <div>
              <div className="ed-title">Hotspots</div>
              <div className="ed-subtitle">Tap the model to mark a point</div>
            </div>
            <div className="ed-header-right">
              <span className="ed-count">{String(total).padStart(2, "0")}</span>
              <button type="button" className="ed-close" onClick={onClose} title="Close editor" aria-label="Close hotspot editor">
                <DismissIcon size={14} />
              </button>
            </div>
          </div>

          <div className="ed-divider" />

          <div className="ed-body">
            <div>
              <div className="ed-eyebrow">Points</div>
              {total === 0 ? (
                <div className="ed-empty">No points yet. Tap anywhere on the model to add one.</div>
              ) : (
                <div className="ed-log">
                  {hotspots.map((h, i) => (
                    <button
                      // id+index, not just id: if two hotspots ever share
                      // an id (see the Date.now() collision note above),
                      // a bare key={h.id} causes React to reuse/misplace
                      // DOM nodes between them — this only fixes the
                      // rendering symptom, the underlying onSelect/onDelete
                      // calls still operate on the (possibly colliding) id.
                      key={`${h.id}::${i}`}
                      type="button"
                      className={`ed-row${h.id === selectedId ? " is-selected" : ""}`}
                      onClick={() => onSelect(h.id)}
                      title={h.label || "Unnamed point"}
                    >
                      <span className="ed-dot">{i + 1}</span>
                      <span className="ed-row-label">{h.label || "Unnamed point"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedHotspot ? (
              <div className="ed-card">
                <label className="ed-field">
                  <span className="ed-field-label">Name</span>
                  <input
                    className="ed-input"
                    value={selectedHotspot.label}
                    onChange={(e) => onRename(selectedHotspot.id, e.target.value)}
                    placeholder="Unnamed point"
                    spellCheck={false}
                  />
                </label>

                <div className="ed-coords">
                  <span className="ed-coord"><span className="ed-coord-axis">X</span>{formatVec(selectedHotspot.position.x)}</span>
                  <span className="ed-coord"><span className="ed-coord-axis">Y</span>{formatVec(selectedHotspot.position.y)}</span>
                  <span className="ed-coord"><span className="ed-coord-axis">Z</span>{formatVec(selectedHotspot.position.z)}</span>
                </div>

                <div className="ed-actions">
                  <button type="button" className="ed-btn ed-btn-primary" onClick={() => onCapture(selectedHotspot.id)}>
                    <LensIcon size={13} /> Capture camera
                  </button>
                  <button
                    type="button"
                    className="ed-btn ed-btn-danger"
                    onClick={(e) => {
                      // Defensive only — stops the click from bubbling in
                      // case something underneath this panel (e.g. the 3D
                      // canvas) is also listening. This is NOT a confirmed
                      // fix; I can't see your parent's onDelete wiring or
                      // your DOM structure from this file alone.
                      e.stopPropagation();
                      onDelete(selectedHotspot.id);
                    }}
                    aria-label="Delete point"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            ) : total > 0 ? (
              <div className="ed-empty">Select a point from the list to rename it, capture the current camera view, or remove it.</div>
            ) : null}
          </div>

          <div className="ed-export-wrap">
            <button type="button" className="ed-btn-export" onClick={onExport}>
              <ExportIcon size={14} /> Export JSON
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
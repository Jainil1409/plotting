import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import ExploreIcon from "@mui/icons-material/Explore";

interface MapControlsProps {
  onRotateMap: (deg: number) => void;
  onTiltMap: (deg: number) => void;
  onPointerDownRotate: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMoveRotate: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUpRotate: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancelRotate: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onLostPointerCaptureRotate: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export default function MapControls({
  onRotateMap,
  onTiltMap,
  onPointerDownRotate,
  onPointerMoveRotate,
  onPointerUpRotate,
  onPointerCancelRotate,
  onLostPointerCaptureRotate,
}: MapControlsProps) {
  return (
    <>
      {/* ── TOP-RIGHT: CAMERA & MAP CONTROLS ── */}
      <Paper
        elevation={3}
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 20,
          p: 0.75,
          borderRadius: 2.5,
          bgcolor: "#ffffff",
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}
      >
        {[
          { label: "Rotate Left", onClick: () => onRotateMap(-45), text: "⟲" },
          { label: "Rotate Right", onClick: () => onRotateMap(45), text: "⟳" },
          { label: "Tilt Up", onClick: () => onTiltMap(15), text: "▲" },
          { label: "Tilt Down", onClick: () => onTiltMap(-15), text: "▼" },
        ].map((item, index) => (
          <Tooltip title={item.label} key={item.label} placement="left">
            <IconButton
              onClick={item.onClick}
              size="small"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                color: "#0284c7",
                bgcolor: index < 2 ? "#f0f9ff" : "#f8fafc",
                border: "1px solid #e2e8f0",
                "&:hover": { bgcolor: "#e0f2fe", borderColor: "#38bdf8" },
              }}
            >
              <Typography sx={{ fontSize: index < 2 ? 18 : 12, fontWeight: 800, lineHeight: 1 }}>
                {item.text}
              </Typography>
            </IconButton>
          </Tooltip>
        ))}
      </Paper>

      {/* ── BOTTOM-RIGHT: ORBIT GESTURE PILL ── */}
      <Button
        onPointerDown={onPointerDownRotate}
        onPointerMove={onPointerMoveRotate}
        onPointerUp={onPointerUpRotate}
        onPointerCancel={onPointerCancelRotate}
        onLostPointerCapture={onLostPointerCaptureRotate}
        startIcon={<ExploreIcon sx={{ color: "#0284c7", fontSize: 18 }} />}
        sx={{
          position: "absolute",
          bottom: 20,
          right: 16,
          zIndex: 20,
          px: 2.5,
          py: 1.2,
          minHeight: 42,
          borderRadius: 99,
          textTransform: "none",
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          bgcolor: "#ffffff",
          border: "1px solid #cbd5e1",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
          cursor: "grab",
          "&:hover": { bgcolor: "#f8fafc", color: "#0284c7" },
          "&:active": { cursor: "grabbing" },
        }}
      >
        Drag to Orbit 360°
      </Button>
    </>
  );
}
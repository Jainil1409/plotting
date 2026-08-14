"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { HotspotConfig } from "../types/hotspot";

interface Props {
  hotspots: HotspotConfig[];
  // The hotspot currently being VIEWED — distinct from any "selectedId"
  // used by the editor panel. Pass null if nothing has been navigated to
  // yet; the bar will just show the first hotspot as a starting point.
  currentId: string | null;
  onNavigate: (id: string) => void;
}

export default function HotspotNavBar({ hotspots, currentId, onNavigate }: Props) {
  if (hotspots.length === 0) return null;

  const foundIndex = hotspots.findIndex((h) => h.id === currentId);
  const currentIndex = foundIndex === -1 ? 0 : foundIndex;
  const current = hotspots[currentIndex];

  const goTo = (delta: number) => {
    // Wraps around in both directions — clicking ► on the last hotspot
    // goes back to the first, and vice versa.
    const nextIndex = (currentIndex + delta + hotspots.length) % hotspots.length;
    onNavigate(hotspots[nextIndex].id);
  };

  return (
    <Box
      sx={{
        position: "absolute",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        bgcolor: "rgba(15, 23, 42, 0.82)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: 999,
        pl: 0.5,
        pr: 0.5,
        py: 0.5,
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        userSelect: "none",
      }}
    >
      <IconButton
        size="small"
        onClick={() => goTo(-1)}
        aria-label="Previous hotspot"
        sx={{ color: "#e2e8f0", "&:hover": { bgcolor: "rgba(255,255,255,0.12)" } }}
      >
        <Box component="span" sx={{ fontSize: 12, lineHeight: 1 }}>◀</Box>
      </IconButton>

      <Typography
        sx={{
          minWidth: 96,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
          color: "#f1f5f9",
          px: 1.5,
          textTransform: "lowercase",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {current?.label || "Unnamed point"}
      </Typography>

      <IconButton
        size="small"
        onClick={() => goTo(1)}
        aria-label="Next hotspot"
        sx={{ color: "#e2e8f0", "&:hover": { bgcolor: "rgba(255,255,255,0.12)" } }}
      >
        <Box component="span" sx={{ fontSize: 12, lineHeight: 1 }}>▶</Box>
      </IconButton>
    </Box>
  );
}
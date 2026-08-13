import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";

import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import ExploreIcon from "@mui/icons-material/Explore";
import LayersIcon from "@mui/icons-material/Layers";
import TuneIcon from "@mui/icons-material/Tune";

interface MiniRailSidebarProps {
  deckOpen: boolean;
  selectedCount: number;
  placementMode: boolean;
  compassOpen: boolean;
  hotspotPlacementMode: boolean;
  controlsDisabled: boolean;
  onToggleDeck: () => void;
  onOpenDeck: () => void;
  onTogglePlacement: () => void;
  onToggleCompass: () => void;
  onToggleHotspotPlacement: () => void;
}

export default function MiniRailSidebar({
  deckOpen,
  selectedCount,
  placementMode,
  compassOpen,
  hotspotPlacementMode,
  controlsDisabled,
  onToggleDeck,
  onOpenDeck,
  onTogglePlacement,
  onToggleCompass,
  onToggleHotspotPlacement,
}: MiniRailSidebarProps) {
  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 1300,
        width: 58,
        height: "calc(100% - 32px)",
        borderRadius: 3,
        bgcolor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 2.5,
        boxShadow: "0 8px 32px rgba(15, 23, 42, 0.12)",
        border: "1px solid #e2e8f0",
      }}
    >
      <Tooltip title={deckOpen ? "Collapse Sidebar" : "Expand Sidebar"} placement="right">
        <IconButton
          onClick={onToggleDeck}
          sx={{
            width: 42,
            height: 42,
            bgcolor: deckOpen ? "#0284c7" : "#f1f5f9",
            color: deckOpen ? "#ffffff" : "#0f172a",
            "&:hover": { bgcolor: deckOpen ? "#0369a1" : "#e2e8f0" },
            transition: "all 0.2s ease",
          }}
        >
          {deckOpen ? <ChevronLeftIcon /> : <MenuIcon />}
        </IconButton>
      </Tooltip>

      <Divider sx={{ width: 32, borderColor: "#e2e8f0", my: 2.5 }} />

      <Stack spacing={3.5} sx={{ alignItems: "center" }}>
        <Tooltip title="Target Models" placement="right">
          <IconButton
            onClick={onOpenDeck}
            sx={{
              width: 42,
              height: 42,
              color: selectedCount > 0 ? "#0284c7" : "#64748b",
              bgcolor: selectedCount > 0 ? "#e0f2fe" : "transparent",
              "&:hover": { bgcolor: "#f1f5f9" },
            }}
          >
            <LayersIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Move Object" placement="right">
          <IconButton
            disabled={controlsDisabled}
            onClick={onTogglePlacement}
            sx={{
              width: 42,
              height: 42,
              color: placementMode ? "#d97706" : "#64748b",
              bgcolor: placementMode ? "#fef3c7" : "transparent",
              "&:hover": { bgcolor: "#f1f5f9" },
            }}
          >
            <OpenWithIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Orientation Controls" placement="right">
          <IconButton
            disabled={controlsDisabled}
            onClick={onToggleCompass}
            sx={{
              width: 42,
              height: 42,
              color: compassOpen ? "#0284c7" : "#64748b",
              bgcolor: compassOpen ? "#e0f2fe" : "transparent",
              "&:hover": { bgcolor: "#f1f5f9" },
            }}
          >
            <TuneIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Hotspots Operations" placement="right">
          <IconButton
            disabled={controlsDisabled}
            onClick={onToggleHotspotPlacement}
            sx={{
              width: 42,
              height: 42,
              color: hotspotPlacementMode ? "#0284c7" : "#64748b",
              bgcolor: hotspotPlacementMode ? "#e0f2fe" : "transparent",
              "&:hover": { bgcolor: "#f1f5f9" },
            }}
          >
            <AddLocationIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      <Tooltip title={`${selectedCount} Models Selected`} placement="right">
        <Chip
          label={selectedCount}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: 11,
            bgcolor: "#0284c7",
            color: "#ffffff",
            height: 26,
            minWidth: 26,
          }}
        />
      </Tooltip>
    </Paper>
  );
}
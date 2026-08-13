import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import ExploreIcon from "@mui/icons-material/Explore";
import LinkIcon from "@mui/icons-material/Link";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";

import { MapHotspotConfig } from "@/src/types/hotspot";
import { MODELS } from "@/src/data/models";
import { ModelSummary } from "./googleMap3dConfig";

export interface DrawerModelSummary extends ModelSummary {
  isChecked: boolean;
}

interface ExpandedDrawerProps {
  deckOpen: boolean;
  onCloseDeck: () => void;
  modelSummaries: DrawerModelSummary[];
  onToggleModel: (instanceId: string) => void;
  placementMode: boolean;
  controlsDisabled: boolean;
  onTogglePlacement: () => void;
  compassOpen: boolean;
  onToggleCompass: () => void;
  compassDisplayDeg: number;
  onHeadingChange: (deg: number) => void;
  hotspotPlacementMode: boolean;
  onToggleHotspotPlacement: () => void;
  onExitHotspotPlacement: () => void;
  hotspotNextModelId: string;
  onHotspotNextModelChange: (id: string) => void;
  createdHotspots: MapHotspotConfig[];
  editingHotspotId: string | null;
  onEditHotspot: (hotspot: MapHotspotConfig) => void;
  onUpdateHotspotLink: (id: string, nextModelId: string) => void;
  onDeleteHotspot: (id: string) => void;
  onExitHotspotEdit: () => void;
  getHotspotSourceLabel: (hotspot: MapHotspotConfig) => string;
  getHotspotTargetLabel: (hotspot: MapHotspotConfig) => string;
}

export default function ExpandedDrawer({
  deckOpen,
  onCloseDeck,
  modelSummaries,
  onToggleModel,
  placementMode,
  controlsDisabled,
  onTogglePlacement,
  compassOpen,
  onToggleCompass,
  compassDisplayDeg,
  onHeadingChange,
  hotspotPlacementMode,
  onToggleHotspotPlacement,
  onExitHotspotPlacement,
  hotspotNextModelId,
  onHotspotNextModelChange,
  createdHotspots,
  editingHotspotId,
  onEditHotspot,
  onUpdateHotspotLink,
  onDeleteHotspot,
  onExitHotspotEdit,
  getHotspotSourceLabel,
  getHotspotTargetLabel,
}: ExpandedDrawerProps) {
  const activeCount = modelSummaries.filter((m) => m.isChecked).length;

  return (
    <Drawer
      anchor="left"
      variant="persistent"
      open={deckOpen}
      sx={{
        "& .MuiDrawer-paper": {
          position: "absolute",
          top: 16,
          left: 86,
          width: 380,
          height: "calc(100% - 32px)",
          borderRadius: 3,
          boxSizing: "border-box",
          border: "1px solid #e2e8f0",
          bgcolor: "#ffffff",
          color: "#0f172a",
          boxShadow: "0 12px 36px rgba(15, 23, 42, 0.14)",
          overflow: "hidden",
          zIndex: 1250,
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#ffffff" }}>
        {/* Header */}
        <Box
          sx={{
            p: 3,
            pb: 2.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: "#0f172a", lineHeight: 1.2 }}
            >
              Plotting Viewport
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 12, fontWeight: 500, color: "#64748b", mt: 0.6, display: "block" }}>
              Model Control & Hotspot Operations
            </Typography>
          </Box>

          <Tooltip title="Collapse Side Panel">
            <IconButton
              size="small"
              onClick={onCloseDeck}
              sx={{ color: "#64748b", bgcolor: "#f8fafc", border: "1px solid #e2e8f0", "&:hover": { bgcolor: "#f1f5f9", color: "#0f172a" } }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Scrollable Content */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 3,
            display: "flex",
            flexDirection: "column",
            gap: 3.5,
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-track": { bgcolor: "#f8fafc" },
            "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: 3 },
          }}
        >
          {/* SECTION 1: Active Targets */}
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="overline" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#475569", textTransform: "uppercase" }}>
                Active Targets
              </Typography>
              <Chip
                size="small"
                label={`${activeCount} ACTIVE`}
                sx={{ height: 22, fontSize: 10, fontWeight: 800, bgcolor: activeCount ? "#e0f2fe" : "#f1f5f9", color: activeCount ? "#0369a1" : "#64748b" }}
              />
            </Box>

            <Paper variant="outlined" sx={{ borderRadius: 2.5, borderColor: "#e2e8f0", overflow: "hidden" }}>
              <List disablePadding>
                {modelSummaries.map((m, index) => (
                  <ListItemButton
                    key={m.instanceId}
                    onClick={() => onToggleModel(m.instanceId)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      borderBottom: index < modelSummaries.length - 1 ? "1px solid #f1f5f9" : "none",
                      bgcolor: m.isChecked ? "#f0f9ff" : "transparent",
                      "&:hover": { bgcolor: m.isChecked ? "#e0f2fe" : "#f8fafc" },
                    }}
                  >
                    <Checkbox
                      checked={m.isChecked}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                      sx={{ p: 0, mr: 1.75, color: "#cbd5e1", "&.Mui-checked": { color: "#0284c7" } }}
                    />
                    <ListItemText
                      primary={m.label}
                      secondary={`Heading: ${Math.round(m.heading)}°`}
                      slotProps={{
                        primary: { sx: { fontSize: 13, fontWeight: 700, color: m.isChecked ? "#0369a1" : "#1e293b" } },
                        secondary: { sx: { fontSize: 11, fontWeight: 500, color: "#64748b", mt: 0.25 } },
                      }}
                    />
                    {m.isChecked && (
                      <Chip label="ACTIVE" size="small" sx={{ height: 20, fontSize: 9, fontWeight: 800, color: "#0284c7", bgcolor: "#e0f2fe" }} />
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Stack>

          <Divider sx={{ borderColor: "#f1f5f9" }} />

          {/* SECTION 2: Model Controls */}
          <Stack spacing={1.75}>
            <Box>
              <Typography variant="overline" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#475569", textTransform: "uppercase" }}>
                Model Controls
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 12, color: "#64748b", mt: 0.3 }}>
                Position and orient active models on map
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Button
                fullWidth
                variant={placementMode ? "contained" : "outlined"}
                disabled={controlsDisabled && !placementMode}
                onClick={onTogglePlacement}
                startIcon={<OpenWithIcon />}
                sx={{
                  py: 1.4, borderRadius: 2.5, textTransform: "none", fontSize: 12, fontWeight: 700,
                  borderColor: placementMode ? "#d97706" : "#cbd5e1",
                  bgcolor: placementMode ? "#d97706" : "#ffffff",
                  color: placementMode ? "#ffffff" : "#334155",
                  "&:hover": { borderColor: placementMode ? "#b45309" : "#0284c7", bgcolor: placementMode ? "#b45309" : "#f0f9ff" },
                }}
              >
                {placementMode ? "Relocating" : "Move Object"}
              </Button>

              <Button
                fullWidth
                variant={compassOpen ? "contained" : "outlined"}
                disabled={controlsDisabled}
                onClick={() => !controlsDisabled && onToggleCompass()}
                startIcon={
                  <ExploreIcon sx={{ transform: `rotate(${compassDisplayDeg}deg)`, transition: "transform 0.2s ease" }} />
                }
                sx={{
                  py: 1.4, borderRadius: 2.5, textTransform: "none", fontSize: 12, fontWeight: 700,
                  borderColor: compassOpen ? "#0284c7" : "#cbd5e1",
                  bgcolor: compassOpen ? "#0284c7" : "#ffffff",
                  color: compassOpen ? "#ffffff" : "#334155",
                  "&:hover": { borderColor: "#0284c7", bgcolor: compassOpen ? "#0369a1" : "#f0f9ff" },
                }}
              >
                Orientation
              </Button>
            </Stack>

            {compassOpen && !controlsDisabled && (
              <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5, borderColor: "#e2e8f0", bgcolor: "#f8fafc", mt: 0.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>HEADING</Typography>
                  <Typography variant="subtitle2" sx={{ fontSize: 16, fontWeight: 800, color: "#0284c7" }}>
                    {Math.round(compassDisplayDeg)}°
                  </Typography>
                </Box>
                <Slider
                  value={compassDisplayDeg}
                  min={0}
                  max={359}
                  onChange={(_, value) => onHeadingChange(value as number)}
                  sx={{ color: "#0284c7", py: 1.25, "& .MuiSlider-thumb": { width: 18, height: 18 } }}
                />
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {[0, 90, 180, 270].map((deg) => (
                    <Button
                      key={deg}
                      size="small"
                      fullWidth
                      onClick={() => onHeadingChange(deg)}
                      sx={{
                        py: 0.6, borderRadius: 1.5, color: "#475569", fontSize: 10, fontWeight: 700,
                        bgcolor: "#ffffff", border: "1px solid #cbd5e1",
                        "&:hover": { bgcolor: "#e0f2fe", borderColor: "#38bdf8", color: "#0284c7" },
                      }}
                    >
                      {deg === 0 ? "N 0°" : deg === 90 ? "E 90°" : deg === 180 ? "S 180°" : "W 270°"}
                    </Button>
                  ))}
                </Stack>
              </Paper>
            )}
          </Stack>

          <Divider sx={{ borderColor: "#f1f5f9" }} />

          {/* SECTION 3: Hotspot Editor */}
          <Stack spacing={1.75}>
            <Box>
              <Typography variant="overline" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#475569", textTransform: "uppercase" }}>
                Hotspot Editor
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 12, color: "#64748b", mt: 0.3 }}>
                Add interactive hotspots linking to target models
              </Typography>
            </Box>

            <Button
              fullWidth
              variant={hotspotPlacementMode ? "contained" : "outlined"}
              disabled={controlsDisabled && !hotspotPlacementMode}
              onClick={hotspotPlacementMode ? onExitHotspotPlacement : placementMode || controlsDisabled ? undefined : onToggleHotspotPlacement}
              startIcon={<AddLocationIcon />}
              sx={{
                py: 1.4, borderRadius: 2.5, textTransform: "none", fontSize: 12, fontWeight: 700,
                color: hotspotPlacementMode ? "#ffffff" : "#0284c7",
                bgcolor: hotspotPlacementMode ? "#0284c7" : "#ffffff",
                borderColor: hotspotPlacementMode ? "#0284c7" : "#38bdf8",
                "&:hover": { bgcolor: hotspotPlacementMode ? "#0369a1" : "#f0f9ff", borderColor: "#0284c7" },
              }}
            >
              {hotspotPlacementMode ? "Click Model to Place Hotspot" : "Add Hotspot"}
            </Button>

            {hotspotPlacementMode && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, borderColor: "#e2e8f0", bgcolor: "#f8fafc" }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: "#475569", mb: 1, display: "block" }}>
                  LINKS TO MODEL
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={hotspotNextModelId}
                    onChange={(e) => onHotspotNextModelChange(e.target.value)}
                    sx={{ borderRadius: 1.5, bgcolor: "#ffffff", fontSize: 12, fontWeight: 600 }}
                  >
                    {Object.values(MODELS).map((model) => (
                      <MenuItem key={model.id} value={model.id}>{model.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Paper>
            )}

            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>CREATED HOTSPOTS</Typography>
                <Chip
                  label={createdHotspots.length}
                  size="small"
                  sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: createdHotspots.length ? "#e0f2fe" : "#f1f5f9", color: createdHotspots.length ? "#0369a1" : "#64748b" }}
                />
              </Box>

              <Paper variant="outlined" sx={{ borderRadius: 2.5, borderColor: "#e2e8f0", overflow: "hidden" }}>
                {createdHotspots.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography variant="body2" sx={{ fontSize: 12, color: "#94a3b8" }}>
                      No hotspots added yet. Click "Add Hotspot" above to place one.
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {createdHotspots.map((hotspot, index) => {
                      const isEditing = editingHotspotId === hotspot.id;
                      return (
                        <Box key={hotspot.id} sx={{ p: 1.75, borderBottom: index < createdHotspots.length - 1 ? "1px solid #f1f5f9" : "none", bgcolor: isEditing ? "#f0f9ff" : "transparent" }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.85 }}>
                                <RadioButtonCheckedIcon sx={{ fontSize: 15, color: "#0284c7" }} />
                                <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {hotspot.id}
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ fontSize: 11, color: "#64748b", display: "block", mt: 0.4, pl: 2.85 }}>
                                {getHotspotSourceLabel(hotspot)} → <span style={{ color: "#0284c7", fontWeight: 700 }}>{getHotspotTargetLabel(hotspot)}</span>
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={0.75}>
                              <Tooltip title="Edit Destination">
                                <IconButton size="small" onClick={() => onEditHotspot(hotspot)} sx={{ color: isEditing ? "#0284c7" : "#64748b", bgcolor: isEditing ? "#e0f2fe" : "#f8fafc", border: "1px solid #e2e8f0", "&:hover": { bgcolor: "#f1f5f9" } }}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Hotspot">
                                <IconButton size="small" onClick={() => onDeleteHotspot(hotspot.id)} sx={{ color: "#ef4444", bgcolor: "#fef2f2", border: "1px solid #fecaca", "&:hover": { bgcolor: "#fee2e2" } }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                          {isEditing && (
                            <Box sx={{ mt: 1.5, pl: 2.85, display: "flex", gap: 1 }}>
                              <FormControl fullWidth size="small">
                                <Select
                                  value={hotspot.nextModelId}
                                  onChange={(e) => onUpdateHotspotLink(hotspot.id, e.target.value)}
                                  sx={{ borderRadius: 1.5, fontSize: 11, fontWeight: 600, bgcolor: "#ffffff" }}
                                >
                                  {Object.values(MODELS).map((model) => (
                                    <MenuItem key={model.id} value={model.id}>{model.label}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <IconButton size="small" onClick={onExitHotspotEdit} sx={{ border: "1px solid #cbd5e1" }}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </List>
                )}
              </Paper>
            </Stack>

            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, borderColor: "#bae6fd", bgcolor: "#f0f9ff", display: "flex", gap: 1.5, alignItems: "flex-start" }}>
              <LinkIcon sx={{ fontSize: 18, color: "#0284c7", mt: 0.2 }} />
              <Typography variant="caption" sx={{ fontSize: 11, color: "#0369a1", lineHeight: 1.5 }}>
                Hotspots attach directly to model surfaces. Select destinations from the editor list above.
              </Typography>
            </Paper>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
}
"use client";

import { useEffect, useRef } from "react";
import { HotspotConfig } from "../types/hotspot";

// Material UI Components
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Tooltip from "@mui/material/Tooltip";

// Material UI Icons
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import LocationOnIcon from "@mui/icons-material/LocationOn";

interface Props {
  hotspots: HotspotConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onClose: () => void;
}

const formatVec = (v: number) => (Math.abs(v) < 0.001 ? "0.00" : v.toFixed(2));

export default function HotspotEditorPanel({
  hotspots,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  onExport,
  onClose,
}: Props) {
  const selectedHotspot = hotspots.find((hotspot) => hotspot.id === selectedId) ?? null;
  const total = hotspots.length;
  const selectedCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the detail card into view when a hotspot is selected
  useEffect(() => {
    selectedCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedId, selectedHotspot]);

  return (
    <Drawer
      anchor="right"
      variant="persistent"
      open={true}
     sx={{
  "& .MuiDrawer-paper": {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 340,
    maxHeight: "100%",
    borderRadius: 0,
    borderLeft: "1px solid #e2e8f0",
    bgcolor: "#f8fafc",
    boxShadow: "-16px 0 36px rgba(15, 23, 42, 0.12)",
    zIndex: 1300,
    overflow: "hidden",
    // Clean responsive media query override
    "@media (max-width: 600px)": {
      top: "auto",
      width: "100%",
      maxHeight: "70vh",
      borderRadius: "16px 16px 0 0",
      borderLeft: "none",
    },
  },
}}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          bgcolor: "#f8fafc",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* ---- Header ---- */}
        <Box
          sx={{
            p: 2.5,
            pb: 2,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            bgcolor: "#ffffff",
          }}
        >
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "-0.01em",
                color: "#0f172a",
                lineHeight: 1.2,
              }}
            >
              Hotspots
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: 12,
                fontWeight: 500,
                color: "#64748b",
                mt: 0.5,
                display: "block",
              }}
            >
              Tap the model to mark a point
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Chip
              label={String(total).padStart(2, "0")}
              size="small"
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: 11,
                bgcolor: "#e0f2fe",
                color: "#0369a1",
                height: 24,
                borderRadius: 1.5,
              }}
            />
            <Tooltip title="Close editor">
              <IconButton
                size="small"
                onClick={onClose}
                aria-label="Close hotspot editor"
                sx={{
                  color: "#64748b",
                  bgcolor: "#f1f5f9",
                  "&:hover": { bgcolor: "#e2e8f0", color: "#0f172a" },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: "#e2e8f0" }} />

        {/* ---- Body (Scrollable Area) ---- */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-track": { bgcolor: "#f8fafc" },
            "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: 3 },
          }}
        >
          {/* Points List Section */}
          <Stack spacing={1.25}>
            <Typography
              variant="overline"
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#475569",
              }}
            >
              Points
            </Typography>

            {total === 0 ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  borderColor: "#cbd5e1",
                  borderStyle: "dashed",
                  bgcolor: "#ffffff",
                  textAlign: "center",
                }}
              >
                <Typography variant="body2" sx={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5 }}>
                  No points yet. Tap anywhere on the model to add one.
                </Typography>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2.5,
                  borderColor: "#e2e8f0",
                  bgcolor: "#ffffff",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                <List disablePadding>
                  {hotspots.map((h, i) => {
                    const isSelected = h.id === selectedId;
                    return (
                      <ListItemButton
                        key={`${h.id}::${i}`}
                        selected={isSelected}
                        onClick={() => onSelect(h.id)}
                        sx={{
                          py: 1.25,
                          px: 2,
                          gap: 1.5,
                          borderBottom: i < hotspots.length - 1 ? "1px solid #f1f5f9" : "none",
                          bgcolor: isSelected ? "#f0f9ff !important" : "transparent",
                          "&:hover": { bgcolor: isSelected ? "#e0f2fe" : "#f8fafc" },
                        }}
                      >
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: isSelected ? "#0284c7" : "#f1f5f9",
                            color: isSelected ? "#ffffff" : "#64748b",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </Box>

                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? "#0369a1" : "#1e293b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            fontSize: 13,
                          }}
                        >
                          {h.label || "Unnamed point"}
                        </Typography>
                      </ListItemButton>
                    );
                  })}
                </List>
              </Paper>
            )}
          </Stack>

          {/* ---- Selected Hotspot Detail Card ---- */}
          {selectedHotspot ? (
            <Paper
              ref={selectedCardRef}
              elevation={0}
              variant="outlined"
              sx={{
                p: 2.25,
                borderRadius: 2.5,
                borderColor: "#e2e8f0",
                bgcolor: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {/* Name Input */}
              <Stack spacing={0.75}>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: "#64748b",
                    textTransform: "uppercase",
                  }}
                >
                  Name
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={selectedHotspot.label}
                  onChange={(e) => onRename(selectedHotspot.id, e.target.value)}
                  placeholder="Unnamed point"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "#f8fafc",
                      fontSize: 13,
                      fontWeight: 600,
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#0284c7" },
                    },
                  }}
                />
              </Stack>

              {/* Coordinates */}
              <Stack spacing={0.75}>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: "#64748b",
                    textTransform: "uppercase",
                  }}
                >
                  Coordinates
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  {[
                    { axis: "X", val: selectedHotspot.position.x },
                    { axis: "Y", val: selectedHotspot.position.y },
                    { axis: "Z", val: selectedHotspot.position.z },
                  ].map((item) => (
                    <Paper
                      key={item.axis}
                      variant="outlined"
                      sx={{
                        px: 1.25,
                        py: 0.6,
                        borderRadius: 1.5,
                        bgcolor: "#f8fafc",
                        borderColor: "#e2e8f0",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.75,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11.5,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 700 }}>
                        {item.axis}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#0f172a", fontWeight: 600 }}>
                        {formatVec(item.val)}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Stack>

              {/* Action Buttons */}
              <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 0.5 }}>
                <Button
                  size="small"
                  color="error"
                  variant="text"
                  startIcon={<DeleteIcon fontSize="small" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(selectedHotspot.id);
                  }}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: 12,
                    py: 0.8,
                    px: 1.5,
                    color: "#ef4444",
                    "&:hover": { bgcolor: "#fef2f2" },
                  }}
                >
                  Delete Point
                </Button>
              </Box>
            </Paper>
          ) : total > 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2.5,
                borderColor: "#e2e8f0",
                bgcolor: "#ffffff",
                textAlign: "center",
              }}
            >
              <Typography variant="body2" sx={{ fontSize: 12, color: "#64748b" }}>
                Select a point from the list above to rename or remove it.
              </Typography>
            </Paper>
          ) : null}
        </Box>

        {/* ---- Footer (Export Action) ---- */}
        <Box
          sx={{
            p: 2.5,
            pt: 2,
            borderTop: "1px solid #f1f5f9",
            bgcolor: "#ffffff",
          }}
        >
          <Button
            fullWidth
            variant="outlined"
            onClick={onExport}
            startIcon={<FileDownloadIcon />}
            sx={{
              py: 1.25,
              borderRadius: 2.5,
              textTransform: "none",
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
              borderColor: "#cbd5e1",
              "&:hover": {
                borderColor: "#0284c7",
                bgcolor: "#f0f9ff",
                color: "#0284c7",
              },
            }}
          >
            Export JSON
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
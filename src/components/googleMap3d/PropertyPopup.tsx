import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";

export interface PropertyPopupData {
  x: number;
  y: number;
  meshName: string;
  details: { name: string; bhk: string; area: number; price: string };
}

interface PropertyPopupProps {
  popup: PropertyPopupData;
}

export default function PropertyPopup({ popup }: PropertyPopupProps) {
  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        zIndex: 30,
        width: 260,
        borderRadius: 3,
        p: 2,
        bgcolor: "#ffffff",
        border: "1px solid #e2e8f0",
        pointerEvents: "none",
      }}
      style={{
        left: Math.min(popup.x + 16, window.innerWidth - 280),
        top: Math.min(popup.y + 16, window.innerHeight - 200),
      }}
    >
      <Typography variant="overline" sx={{ fontSize: 10, fontWeight: 800, color: "#0284c7", letterSpacing: "0.08em" }}>
        {popup.meshName}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontSize: 15, fontWeight: 700, color: "#0f172a", mb: 1 }}>
        {popup.details.name}
      </Typography>
      <Stack spacing={0.5}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ color: "#64748b" }}>Class</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>{popup.details.bhk}</Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ color: "#64748b" }}>Footprint</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>{popup.details.area} sq ft</Typography>
        </Box>
        <Paper variant="outlined" sx={{ mt: 1, p: 1, borderRadius: 1.5, bgcolor: "#f0f9ff", borderColor: "#bae6fd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#0369a1" }}>Valuation</Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0284c7" }}>{popup.details.price}</Typography>
        </Paper>
      </Stack>
    </Paper>
  );
}
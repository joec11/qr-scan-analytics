import fetch from "node-fetch";
import "dotenv/config";

import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const HOVERCODE_API_TOKEN = process.env.HOVERCODE_API_TOKEN || "";
const QR_CODE_ID = process.env.QR_CODE_ID || "";

if (!HOVERCODE_API_TOKEN) console.warn("Warning: HOVERCODE_API_TOKEN is not set");
if (!QR_CODE_ID) console.warn("Warning: QR_CODE_ID is not set");

app.get("/api/scans", async (req, res) => {
  try {
    const response = await fetch(
      `https://hovercode.com/api/v2/hovercode/${QR_CODE_ID}/activity/`,
      {
        headers: {
          "Authorization": `Token ${HOVERCODE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`HoverCode API error ${response.status}:`, text);
      return res.status(response.status).json({ error: "HoverCode API error", detail: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching scans:", err);
    res.status(500).json({ error: "Failed to fetch scan data" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  // console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Scans endpoint: http://localhost:${PORT}/api/scans`);
});

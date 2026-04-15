import fetch from "node-fetch";
import "dotenv/config";

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json());

const HOVERCODE_API_TOKEN = process.env.HOVERCODE_API_TOKEN || "";
const QR_CODE_ID = process.env.QR_CODE_ID || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

app.use(
  "/api/insights",
  rateLimit({
    windowMs: 60 * 1000,
    max: 10,
  })
);

let cachedInsights = null;
let lastGenerated = 0;

/*
Fetch scans with range filtering
*/
app.get("/api/scans", async (req, res) => {
  try {
    const range = req.query.range || "7";

    const response = await fetch(
      `https://hovercode.com/api/v2/hovercode/${QR_CODE_ID}/activity/`,
      {
        headers: {
          Authorization: `Token ${HOVERCODE_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();

    let results = data.results || [];

    if (range !== "all") {
      const days = parseInt(range);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      results = results.filter(
        (s) => new Date(s.time_utc) >= cutoff
      );
    }

    res.json({
      ...data,
      results,
      count: results.length,
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scans" });
  }
});

/*
AI insights endpoint
*/
app.post("/api/insights", async (req, res) => {
  try {
    const now = Date.now();

    if (cachedInsights && now - lastGenerated < 5 * 60 * 1000) {
      return res.json({ insights: cachedInsights });
    }

    const { scans } = req.body;

    if (!scans || scans.length === 0) {
      return res.json({ insights: "No scan data available." });
    }

    const simplified = scans.slice(0, 100).map((s) => ({
      time: new Date(s.time_utc).toLocaleString(),
      device: s.device,
    }));

    const prompt = `
You are an analytics assistant and data analyst.

Analyze this QR scan dataset and provide:

Summary:
- Brief overview of activity

Key Insights:
- Peak usage times
- Device trends
- Any unusual patterns

Recommendations:
- 2-3 actionable insights

Keep response concise and in the below format:

<div style="margin-bottom: 1rem;margin-top: 1rem;">
<h2>Summary</h2>
<p><summary-text></p>
</div>

<div>
<h2>Key Insights</h2>
<p>
<b>Peak Usage Times:</b> <peak-usage-times-text><br><br>
<b>Device Trends:</b> <device-trends-text><br><br>
<b>Unusual Patterns:</b> <unusual-patterns-text>
</p>
</div>

<div style="margin-bottom: 1rem;margin-top: 1rem;">
<h2>Recommendations</h2>
<p>
<b><recommendation-1>:</b> <recommendation-1-text><br><br>
<b><recommendation-2>:</b> <recommendation-2-text><br><br>
<b><recommendation-3>:</b> <recommendation-3-text>
</p>
</div>

Data:
${JSON.stringify(simplified)}
`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const insights = result.text || "AI unavailable";

    cachedInsights = insights;
    lastGenerated = now;

    res.json({ insights });

  } catch (err) {
    res.json({
      insights: "AI is currently experiencing high demand. Please try again later.",
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});

import fetch from "node-fetch";
import "dotenv/config";

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json());

/* -------------------- ENV -------------------- */
const HOVERCODE_API_TOKEN = process.env.HOVERCODE_API_TOKEN || "";
const QR_CODE_ID = process.env.QR_CODE_ID || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

if (!HOVERCODE_API_TOKEN) console.warn("Missing HOVERCODE_API_TOKEN");
if (!QR_CODE_ID) console.warn("Missing QR_CODE_ID");
if (!GEMINI_API_KEY) console.warn("Missing GEMINI_API_KEY");

/* -------------------- GEMINI AI -------------------- */
const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

/* -------------------- RATE LIMIT -------------------- */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});
app.use("/api/insights", limiter);

/* -------------------- CACHE -------------------- */
let cachedInsights = null;
let lastGenerated = 0;

/* -------------------- FETCH SCANS -------------------- */
app.get("/api/scans", async (req, res) => {
  try {
    const response = await fetch(
      `https://hovercode.com/api/v2/hovercode/${QR_CODE_ID}/activity/`,
      {
        headers: {
          Authorization: `Token ${HOVERCODE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Hovercode error:", text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch scans" });
  }
});

/* -------------------- AI INSIGHTS -------------------- */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.post("/api/insights", async (req, res) => {
  try {
    const now = Date.now();

    /* ---------------- CACHE ---------------- */
    if (cachedInsights && now - lastGenerated < 5 * 60 * 1000) {
      return res.json({ insights: cachedInsights });
    }

    const { scans } = req.body;

    if (!scans || scans.length === 0) {
      return res.status(400).json({ error: "No scan data provided" });
    }

    /* ---------------- DATA PREP ---------------- */
    const simplified = scans.slice(0, 100).map((s) => ({
      time: new Date(s.time_utc).toLocaleString(),
      device: s.device,
      // location: s.location,
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

    /* ---------------- GEMINI CALL (WITH RETRY) ---------------- */
    let result;
    let attempts = 0;

    while (attempts < 3) {
      try {
        result = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        break;
      } catch (err) {
        attempts++;

        if (err?.status === 503 && attempts < 3) {
          console.warn(`Gemini overloaded. Retry ${attempts}/3`);
          await sleep(1000 * attempts);
        } else {
          throw err;
        }
      }
    }

    /* ---------------- SOFT FALLBACK ---------------- */
    if (!result?.text) {
      return res.json({
        insights:
          "AI insights are temporarily unavailable due to high demand. Please try again in a few moments.",
      });
    }

    const insights = result.text;

    /* ---------------- CACHE ---------------- */
    cachedInsights = insights;
    lastGenerated = now;

    return res.json({ insights });

  } catch (err) {
    console.error("AI error:", err);

    /* ---------------- SOFT FALLBACK (ERROR PATH) ---------------- */
    return res.json({
      insights:
        "AI is currently experiencing high demand. Please try again shortly for detailed insights.",
    });
  }
});

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Scans endpoint: http://127.0.0.1:${PORT}/api/scans`);
});

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

import DOMPurify from "dompurify";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";

const COLORS = ["#378ADD", "#63b89e", "#E24B4A", "#EF9F27", "#7F77DD"];

function MetricCard({ label, value }) {
  return (
    <div style={{ background: "#f5f5f5", borderRadius: 10, padding: "1rem", flex: 1 }}>
      <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 22 }}>{value}</div>
    </div>
  );
}

function groupByDate(scans) {
  const map = {};

  scans.forEach((s) => {
    const date = new Date(s.time_utc);

    const key = date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });

    map[key] = (map[key] || 0) + 1;
  });

  return Object.entries(map)
    .map(([date, count]) => ({
      date,
      count,
      sortDate: new Date(date),
    }))
    .sort((a, b) => b.sortDate - a.sortDate)
    .map(({ date, count }) => ({ date, count }));
}

function groupByDevice(scans) {
  const map = {};
  scans.forEach((s) => {
    const key = s.device?.split(",")[0] || "Unknown";
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

export default function QRDashboard() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/scans`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const scans = data?.results || [];

  const sortedScans = useMemo(
    () => [...scans].sort((a, b) => new Date(b.time_utc) - new Date(a.time_utc)),
    [scans]
  );

  const uniqueScanners = new Set(scans.map((s) => s.scanner_id)).size;

  const repeatRate = scans.length && data?.count
    ? ((data.count - uniqueScanners) / data.count * 100).toFixed(1)
    : "0";

  const timeData = useMemo(() => groupByDate(scans), [scans]);
  const deviceData = useMemo(() => groupByDevice(scans), [scans]);

  const lastScan = sortedScans[0];

  function generateInsights() {
    setLoadingInsights(true);

    fetch(`${API_URL}/api/insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scans }),
    })
      .then((res) => res.json())
      .then((data) => {
        setInsights(data.insights);
        setLoadingInsights(false);
      })
      .catch(() => setLoadingInsights(false));
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: "2rem" }}>QR Scan Analytics</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: "1.5rem" }}>
        QR Code <code style={{ fontSize: 12, background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>
          {scans?.[0]?.qr_code_id}
        </code>
      </p>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 10, marginBottom: "1.5rem" }}>
        <MetricCard label="Total Scans" value={data?.count || 0} />
        <MetricCard label="Unique Scanners" value={uniqueScanners} />
        <MetricCard label="Repeat Rate" value={`${repeatRate}%`} />
        <MetricCard
          label="Last Scan"
          value={lastScan ? new Date(lastScan.time_utc).toLocaleString() : "—"}
        />
      </div>

      {/* AI Insights */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button
          onClick={generateInsights}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "none",
            background: "#378ADD",
            color: "white",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            transition: "0.2s ease",
          }}
          onMouseOver={(e) => (e.target.style.background = "#2f74c9")}
          onMouseOut={(e) => (e.target.style.background = "#378ADD")}
        >
          Generate AI Insights
        </button>

        {loadingInsights && <p style={{ marginTop: "0.5rem" }}>Analyzing...</p>}

        {insights && (
          <div
            style={{
              marginTop: 10,
              fontSize: "13px",
              lineHeight: 1.6,
              color: "#333",
            }}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(insights),
            }}
          />
        )}
      </div>

      {/* Charts */}
      <div style={{ display: "flex", gap: 20, marginBottom: "2rem" }}>
        <ResponsiveContainer width="50%" height={300}>
          <BarChart data={timeData}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#378ADD" />
          </BarChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="50%" height={300}>
          <PieChart>
            <Pie data={deviceData} dataKey="value">
              {deviceData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div style={{ border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1rem 1.25rem" }}>
        <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: "0.25rem" }}>Scan History</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Time", "Device", "Scanner ID", "Location"].map((h) => (
                  <th key={h} style={{
                    padding: "8px 10px", fontSize: 11,
                    fontWeight: 500, textTransform: "uppercase",
                    letterSpacing: "0.04em", borderBottom: "0.5px solid #e0e0e0"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scans.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ padding: "10px", borderBottom: i < scans.length - 1 ? "0.5px solid #f0f0f0" : "none" }}>
                    {new Date(s.time_utc).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px", borderBottom: i < scans.length - 1 ? "0.5px solid #f0f0f0" : "none" }}>
                    {s.device}
                  </td>
                  <td style={{ padding: "10px", borderBottom: i < scans.length - 1 ? "0.5px solid #f0f0f0" : "none" }}>
                    <span style={{ background: "#E6F1FB", color: "#0C447C", fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>
                      {s.scanner_id}
                    </span>
                  </td>
                  <td style={{ padding: "10px", borderBottom: i < scans.length - 1 ? "0.5px solid #f0f0f0" : "none", color: "#aaa" }}>
                    {s.location || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

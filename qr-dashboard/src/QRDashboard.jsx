import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";

const COLORS = ["#378ADD", "#63b89e", "#E24B4A", "#EF9F27", "#7F77DD"];

function MetricCard({ label, value, sub }) {
  return (
    <div style={{
      background: "var(--color-bg-secondary, #f5f5f5)",
      borderRadius: 10,
      padding: "1rem",
      flex: "1 1 140px",
    }}>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function formatLocalDateTime(timeUtc, formatFields) {
  if (!timeUtc) return "—";

  const date = new Date(timeUtc);
  if (isNaN(date.getTime())) return "Invalid date";

  // Default date format options (if no `formatFields` provided)
  const dateFormatOptions = {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };

  // If no `formatFields` passed or is empty, use all default options
  const selectedOptions = formatFields && formatFields.length > 0
    ? formatFields.reduce((acc, field) => {
        if (dateFormatOptions[field]) {
          acc[field] = dateFormatOptions[field];
        }
        return acc;
      }, {})
    : dateFormatOptions;  // Default to all options if `formatFields` is empty or undefined

  // Format the date based on the selected fields
  const formattedDate = new Intl.DateTimeFormat(undefined, selectedOptions).format(date);

  // Return the formatted date with lowercase AM/PM
  return formattedDate.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
}

function groupByDate(scans) {
  const map = {};
  scans.forEach((s) => {
    const key = formatLocalDateTime(s.time_utc, ["month", "day"]);
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function groupByDevice(scans) {
  const map = {};
  scans.forEach((s) => {
    const parts = s.device.split(", ");
    const key = parts.slice(0, 2).join(" · ");
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

export default function QRDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/scans`)
      .then((r) => r.json())
      .then((json) => { setData(json); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading scan data…</div>;
  if (error) return <div style={{ padding: "2rem", color: "#c00" }}>Error: {error}</div>;
  if (!data) return null;

  const scans = data.results || [];
  const uniqueScanners = new Set(scans.map((s) => s.scanner_id)).size;
  const lastScan = scans[0];
  const timeData = groupByDate(scans);
  const deviceData = groupByDevice(scans);
  const topDevice = deviceData.sort((a, b) => b.value - a.value)[0]?.name || "—";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>QR Scan Analytics</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: "1.5rem" }}>
        QR Code <code style={{ fontSize: 12, background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>
          {scans[0]?.qr_code_id}
        </code>
      </p>

      {/* Metrics */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <MetricCard label="Total scans" value={data.count} sub="All Time" />
        <MetricCard label="Unique scanners" value={uniqueScanners} sub="Distinct IDs" />
        <MetricCard
          label="Last scanned"
          value={lastScan ? formatLocalDateTime(lastScan.time_utc, ["year", "month", "day"]) : "—"}
          sub={lastScan ? formatLocalDateTime(lastScan.time_utc, ["hour", "minute", "second"]) : "—"}
        />
        <MetricCard label="Top device" value={topDevice.split(" · ")[0]} sub={topDevice.split(" · ")[1] || ""} />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: "1rem" }}>Scans Over Time</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeData}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#378ADD" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: "1rem" }}>Devices</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={deviceData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={44}>
                {deviceData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend
                iconType="square"
                iconSize={10}
                formatter={(value) => <span style={{ fontSize: 12, color: "#555" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1rem 1.25rem" }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: "1rem" }}>Scan History</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Time", "Device", "Scanner ID", "Location"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "8px 10px", fontSize: 11,
                    fontWeight: 500, color: "#888", textTransform: "uppercase",
                    letterSpacing: "0.04em", borderBottom: "0.5px solid #e0e0e0"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scans.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ padding: "10px", borderBottom: i < scans.length - 1 ? "0.5px solid #f0f0f0" : "none" }}>
                    {formatLocalDateTime(s.time_utc)}
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

import { clientIP, json } from "./_ip-utils.js";

export { clientIP, json };

export async function ensureCheckTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS check_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      asn TEXT NOT NULL DEFAULT '',
      isp TEXT NOT NULL DEFAULT '',
      webrtc_status TEXT NOT NULL DEFAULT '',
      webrtc_ips TEXT NOT NULL DEFAULT '[]',
      avg_latency_ms REAL NOT NULL DEFAULT 0,
      min_latency_ms REAL NOT NULL DEFAULT 0,
      max_latency_ms REAL NOT NULL DEFAULT 0,
      jitter_ms REAL NOT NULL DEFAULT 0,
      download_mbps REAL NOT NULL DEFAULT 0,
      upload_mbps REAL NOT NULL DEFAULT 0,
      recommended_bitrate TEXT NOT NULL DEFAULT '',
      score INTEGER NOT NULL DEFAULT 0,
      rating TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT ''
    )
  `).run();
}

export function numberValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export function textValue(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function countryName(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!value) return "未知";

  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(value) || value;
  } catch {
    return value;
  }
}

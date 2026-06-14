import { ensureCheckTable, json, numberValue, textValue } from "../_check-utils.js";

export async function onRequestPost({ request, env }) {
  await ensureCheckTable(env);

  const data = await request.json();
  const webrtcIps = Array.isArray(data.webrtc_ips)
    ? data.webrtc_ips.map((item) => textValue(item, 80)).filter(Boolean).slice(0, 20)
    : [];

  const score = Math.max(0, Math.min(100, Math.round(numberValue(data.score))));
  const userAgent = textValue(data.user_agent || request.headers.get("user-agent"), 500);
  const unlockType = ["json", "text", ""].includes(data.unlock_result_type) ? data.unlock_result_type : "";
  const unlockSummary = typeof data.unlock_summary === "object" && data.unlock_summary
    ? JSON.stringify(data.unlock_summary).slice(0, 3000)
    : "{}";

  const result = await env.DB.prepare(`
    INSERT INTO check_results (
      ip, country_code, country, city, asn, isp, webrtc_status, webrtc_ips,
      avg_latency_ms, min_latency_ms, max_latency_ms, jitter_ms, packet_loss_percent,
      download_mbps, upload_mbps, recommended_bitrate, score, rating,
      browser_timezone, browser_languages, unlock_result_type, unlock_result_raw,
      unlock_result_json, unlock_summary, user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    textValue(data.ip, 80),
    textValue(data.country_code, 10).toUpperCase(),
    textValue(data.country, 100),
    textValue(data.city, 100),
    textValue(data.asn, 40),
    textValue(data.isp, 200),
    textValue(data.webrtc_status, 100),
    JSON.stringify(webrtcIps),
    numberValue(data.avg_latency_ms),
    numberValue(data.min_latency_ms),
    numberValue(data.max_latency_ms),
    numberValue(data.jitter_ms),
    numberValue(data.packet_loss_percent),
    numberValue(data.download_mbps),
    numberValue(data.upload_mbps),
    textValue(data.recommended_bitrate, 60),
    score,
    textValue(data.rating, 40),
    textValue(data.browser_timezone, 100),
    textValue(data.browser_languages, 300),
    unlockType,
    textValue(data.unlock_result_raw, 20000),
    textValue(data.unlock_result_json, 20000),
    unlockSummary,
    userAgent
  ).run();

  const id = result.meta?.last_row_id || result.meta?.lastRowId;

  return json({
    ok: true,
    id,
    report_url: `/report/${id}`,
  });
}

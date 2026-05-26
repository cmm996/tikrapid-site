import { clientIP, ensureIpTable, json, ruleMatches } from "../../_ip-utils.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  await ensureIpTable(env);

  const url = new URL(request.url);
  const ip = (url.searchParams.get("ip") || clientIP(request)).trim();
  if (!ip) return json({ error: "missing ip" }, 400);

  const result = await env.DB.prepare(`
    SELECT id, address, label, note, expires_at
    FROM ip_rules
    WHERE enabled = 1
      AND (expires_at = '' OR expires_at IS NULL OR date(expires_at) >= date('now'))
    ORDER BY id DESC
  `).all();

  const matched = (result.results || []).find((rule) => ruleMatches(rule.address, ip)) || null;

  return json({
    ip,
    allowed: Boolean(matched),
    matched,
  });
}

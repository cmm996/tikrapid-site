import { ensureIpTable, json, normalizeRule, requireAdmin } from "../../_ip-utils.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  await ensureIpTable(env);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status") || "";

  let sql = `
    SELECT id, address, label, note, enabled, created_at, updated_at
    FROM ip_rules
  `;
  const where = [];
  const params = [];

  if (q) {
    where.push(`(address LIKE ? OR label LIKE ? OR note LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (status === "enabled") where.push(`enabled = 1`);
  if (status === "disabled") where.push(`enabled = 0`);

  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` ORDER BY enabled DESC, id DESC LIMIT 500`;

  const result = await env.DB.prepare(sql).bind(...params).all();
  return json({ ips: result.results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  await ensureIpTable(env);

  try {
    const data = await request.json();
    const address = normalizeRule(data.address);
    const label = String(data.label || "").trim();
    const note = String(data.note || "").trim();

    await env.DB.prepare(`
      INSERT INTO ip_rules (address, label, note, enabled, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `).bind(address, label, note).run();

    return json({ success: true });
  } catch (err) {
    const message = err.message || "failed to create ip rule";
    const status = /UNIQUE/i.test(message) ? 409 : 400;
    return json({ error: message }, status);
  }
}

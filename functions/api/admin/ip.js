import { ensureIpTable, json, normalizeRule, requireAdmin } from "../../_ip-utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  await ensureIpTable(env);

  try {
    const data = await request.json();
    const id = Number(data.id);
    const action = String(data.action || "");

    if (!Number.isInteger(id) || id <= 0) {
      return json({ error: "missing id" }, 400);
    }

    if (action === "delete") {
      await env.DB.prepare(`DELETE FROM ip_rules WHERE id = ?`).bind(id).run();
      return json({ success: true });
    }

    if (action === "toggle") {
      await env.DB.prepare(`
        UPDATE ip_rules
        SET enabled = CASE enabled WHEN 1 THEN 0 ELSE 1 END,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(id).run();
      return json({ success: true });
    }

    if (action === "update") {
      const address = normalizeRule(data.address);
      const label = String(data.label || "").trim();
      const note = String(data.note || "").trim();
      const enabled = data.enabled ? 1 : 0;

      await env.DB.prepare(`
        UPDATE ip_rules
        SET address = ?, label = ?, note = ?, enabled = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(address, label, note, enabled, id).run();
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (err) {
    const message = err.message || "failed to update ip rule";
    const status = /UNIQUE/i.test(message) ? 409 : 400;
    return json({ error: message }, status);
  }
}

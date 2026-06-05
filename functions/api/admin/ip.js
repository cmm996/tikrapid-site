import { ensureIpTable, json, normalizeExpiryDate, normalizeRule, requireAdmin } from "../../_ip-utils.js";

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

    if (action === "renew") {
      const months = Number(data.months);
      if (![1, 3, 6, 12].includes(months)) {
        return json({ error: "续费时长不正确" }, 400);
      }

      const record = await env.DB.prepare(`
        SELECT expires_at
        FROM ip_rules
        WHERE id = ?
        LIMIT 1
      `).bind(id).first();

      if (!record) {
        return json({ error: "record not found" }, 404);
      }

      const expiresAt = addMonthsFromBase(record.expires_at, months);

      await env.DB.prepare(`
        UPDATE ip_rules
        SET expires_at = ?, enabled = 1, updated_at = datetime('now')
        WHERE id = ?
      `).bind(expiresAt, id).run();

      return json({ success: true, expires_at: expiresAt });
    }

    if (action === "update") {
      const address = normalizeRule(data.address);
      const label = String(data.label || "").trim();
      const businessType = String(data.business_type || "").trim();
      const price = String(data.price || "").trim();
      const contact = String(data.contact || "").trim();
      const source = String(data.source || "").trim();
      const note = String(data.note || "").trim();
      const expiresAt = normalizeExpiryDate(data.expires_at);
      const enabled = data.enabled ? 1 : 0;

      const existing = await env.DB.prepare(`
        SELECT id
        FROM ip_rules
        WHERE address = ? AND id != ?
        LIMIT 1
      `).bind(address, id).first();

      if (existing) {
        return json({
          error: "这条 IP / CIDR 已经存在",
          code: "duplicate_ip_rule",
        }, 409);
      }

      await env.DB.prepare(`
        UPDATE ip_rules
        SET address = ?, label = ?, business_type = ?, price = ?, contact = ?, source = ?, note = ?, expires_at = ?, enabled = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(address, label, businessType, price, contact, source, note, expiresAt, enabled, id).run();
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (err) {
    const message = err.message || "failed to update ip rule";
    if (/UNIQUE|SQLITE_CONSTRAINT/i.test(message)) {
      return json({
        error: "这条 IP / CIDR 已经存在",
        code: "duplicate_ip_rule",
      }, 409);
    }
    return json({ error: message }, 400);
  }
}

function addMonthsFromBase(expiresAt, months) {
  const today = todayISO();
  const base = expiresAt && expiresAt >= today ? expiresAt : today;
  const date = new Date(`${base}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

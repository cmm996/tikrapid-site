import { ensureDiagnosisTables } from "../../_diagnosis-utils.js";
import { json, requireAdmin } from "../../_ip-utils.js";

export async function onRequestGet({ request, env }) {
  const auth = requireAdmin(request, env);
  if (auth) return auth;

  await ensureDiagnosisTables(env);

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const status = url.searchParams.get("status") || "";

  let sql = `
    SELECT
      l.id, l.report_id, l.name, l.contact, l.business_type, l.target_market,
      l.business_goal, l.current_stage, l.budget_range, l.team_size, l.created_at,
      r.total_score, r.recommended_market, r.recommended_strategy,
      (
        SELECT status FROM diagnosis_followups f
        WHERE f.lead_id = l.id ORDER BY f.id DESC LIMIT 1
      ) AS status,
      (
        SELECT note FROM diagnosis_followups f
        WHERE f.lead_id = l.id ORDER BY f.id DESC LIMIT 1
      ) AS note,
      (
        SELECT next_followup_at FROM diagnosis_followups f
        WHERE f.lead_id = l.id ORDER BY f.id DESC LIMIT 1
      ) AS next_followup_at
    FROM diagnosis_leads l
    LEFT JOIN diagnosis_reports r ON r.lead_id = l.id
  `;

  const where = [];
  const params = [];
  if (q) {
    where.push(`(l.report_id LIKE ? OR l.name LIKE ? OR l.contact LIKE ? OR l.product_description LIKE ? OR l.business_goal LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    where.push(`COALESCE((SELECT status FROM diagnosis_followups f WHERE f.lead_id = l.id ORDER BY f.id DESC LIMIT 1), 'new') = ?`);
    params.push(status);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` ORDER BY l.id DESC LIMIT 200`;

  const result = await env.DB.prepare(sql).bind(...params).all();
  return json({ leads: result.results || [] });
}

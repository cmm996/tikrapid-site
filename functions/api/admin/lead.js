import { ensureDiagnosisTables } from "../../_diagnosis-utils.js";
import { json, requireAdmin } from "../../_ip-utils.js";

export async function onRequestPost({ request, env }) {
  const auth = requireAdmin(request, env);
  if (auth) return auth;

  await ensureDiagnosisTables(env);
  const data = await request.json();
  const reportId = String(data.report_id || "").trim();
  if (!reportId) return json({ error: "missing report_id" }, 400);

  const lead = await env.DB.prepare(`
    SELECT id FROM diagnosis_leads WHERE report_id = ?
  `).bind(reportId).first();
  if (!lead) return json({ error: "lead not found" }, 404);

  await env.DB.prepare(`
    INSERT INTO diagnosis_followups (lead_id, status, assigned_to, note, next_followup_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    lead.id,
    String(data.status || "new").slice(0, 40),
    String(data.assigned_to || "").slice(0, 80),
    String(data.note || "").slice(0, 1000),
    String(data.next_followup_at || "").slice(0, 20)
  ).run();

  return json({ ok: true });
}

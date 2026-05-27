import {
  ensureDiagnosisTables,
  generateDiagnosisReport,
  normalizeDiagnosisInput,
  renderDiagnosisReportHtml,
} from "../_diagnosis-utils.js";
import { json, textValue } from "../_check-utils.js";

export async function onRequestPost({ request, env }) {
  await ensureDiagnosisTables(env);

  const input = normalizeDiagnosisInput(await request.json());
  if (!input.contact || !input.business_type || !input.product_description) {
    return json({ error: "请填写联系方式、身份类型和产品/服务描述" }, 400);
  }

  const leadResult = await env.DB.prepare(`
    INSERT INTO diagnosis_leads (
      name, contact, business_type, target_market, business_goal,
      product_description, current_stage, main_pain_points, budget_range,
      team_size, need_live, has_material, network_status, conversion_tools,
      language_capability
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.name,
    input.contact,
    input.business_type,
    input.target_market,
    input.business_goal.join(", "),
    input.product_description,
    input.current_stage,
    input.main_pain_points.join(", "),
    input.budget_range,
    input.team_size,
    input.need_live,
    input.has_material.join(", "),
    input.network_status,
    input.conversion_tools.join(", "),
    input.language_capability
  ).run();

  const leadId = leadResult.meta?.last_row_id || leadResult.meta?.lastRowId;
  const reportId = makeReportId(leadId);
  const createdAt = new Date().toISOString();
  const report = generateDiagnosisReport(input, reportId, createdAt);
  const reportJson = JSON.stringify(report);
  const reportHtml = renderDiagnosisReportHtml({
    row: { ...input, id: 0, lead_id: leadId, report_id: reportId, created_at: createdAt },
    report,
  });

  await env.DB.prepare(`
    UPDATE diagnosis_leads
    SET report_id = ?
    WHERE id = ?
  `).bind(reportId, leadId).run();

  await env.DB.prepare(`
    INSERT INTO diagnosis_reports (
      report_id, lead_id, total_score, product_score, market_score,
      content_score, network_score, conversion_score, team_score,
      recommended_market, recommended_strategy, report_json, report_html
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    reportId,
    leadId,
    report.total_score,
    scoreOf(report, "产品出海适配度"),
    scoreOf(report, "市场选择清晰度"),
    scoreOf(report, "内容获客能力"),
    scoreOf(report, "网络环境成熟度"),
    scoreOf(report, "转化承接能力"),
    scoreOf(report, "团队执行能力"),
    textValue(report.market_recommendations?.[0]?.market, 100),
    textValue(report.strategy?.recommended, 200),
    reportJson,
    reportHtml
  ).run();

  await env.DB.prepare(`
    INSERT INTO diagnosis_followups (lead_id, status, note)
    VALUES (?, 'new', ?)
  `).bind(leadId, `新诊断报告：${reportId}`).run();

  return json({
    ok: true,
    report_id: reportId,
    report_url: `/report/${reportId}`,
  });
}

function makeReportId(leadId) {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `DX-${ymd}-${String(leadId || 0).padStart(4, "0")}`;
}

function scoreOf(report, name) {
  return report.score_cards.find((item) => item.name === name)?.score || 0;
}

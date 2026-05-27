import { loadDiagnosisReport, renderDiagnosisReportHtml } from "../../_diagnosis-utils.js";
import { requireAdmin } from "../../_ip-utils.js";

export async function onRequestGet({ params, request, env }) {
  const auth = requireAdmin(request, env, { basic: true });
  if (auth) return auth;

  const reportId = String(params.id || "").trim();
  const bundle = await loadDiagnosisReport(env, reportId);
  if (!bundle) {
    return new Response("Report not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(renderDiagnosisReportHtml(bundle, { admin: true }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

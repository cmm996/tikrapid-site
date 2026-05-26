import { ensureCheckTable, escapeHtml } from "../_check-utils.js";

export async function onRequestGet({ params, env }) {
  await ensureCheckTable(env);

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return html(notFound("报告编号不正确"), 400);
  }

  const row = await env.DB.prepare(`
    SELECT *
    FROM check_results
    WHERE id = ?
  `).bind(id).first();

  if (!row) {
    return html(notFound(`没有找到 #${id} 检测报告`), 404);
  }

  let webrtcIps = [];
  try {
    webrtcIps = JSON.parse(row.webrtc_ips || "[]");
  } catch {
    webrtcIps = [];
  }

  return html(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>线路检测报告 #${row.id} - tikrapid</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="/check.css" rel="stylesheet">
</head>
<body>
  <nav class="navbar navbar-expand-lg site-nav">
    <div class="container">
      <a class="navbar-brand fw-bold" href="/">tikrapid</a>
      <a class="btn btn-primary btn-sm" href="/check">再次检测</a>
    </div>
  </nav>

  <main class="container py-4 py-lg-5">
    <section class="page-head mb-4">
      <div>
        <p class="eyebrow mb-2">检测报告 #${row.id}</p>
        <h1 class="display-title mb-2">${escapeHtml(row.rating)}，综合评分 ${escapeHtml(row.score)}</h1>
        <p class="text-soft mb-0">检测时间：${escapeHtml(row.created_at)}</p>
      </div>
    </section>

    <section class="row g-3 mb-3">
      ${card("出口 IP", row.ip, `${row.country || "--"} / ${row.city || "--"}`)}
      ${card("ASN / 运营商", row.asn, row.isp)}
      ${card("WebRTC 状态", row.webrtc_status, webrtcIps.length ? webrtcIps.join(", ") : "未发现暴露 IP")}
      ${card("推荐直播码率", row.recommended_bitrate, "按上传、延迟和稳定性估算")}
    </section>

    <section class="row g-3">
      ${card("平均延迟", `${format(row.avg_latency_ms)} ms`, `最低 ${format(row.min_latency_ms)} ms / 最高 ${format(row.max_latency_ms)} ms`)}
      ${card("抖动", `${format(row.jitter_ms)} ms`, "越低越稳定")}
      ${card("下载速度", `${format(row.download_mbps, 2)} Mbps`, "测试文件下载")}
      ${card("上传速度", `${format(row.upload_mbps, 2)} Mbps`, "随机数据上传")}
    </section>

    <section class="panel mt-4">
      <h2 class="h5 mb-2">给客服看的排查信息</h2>
      <p class="text-soft mb-0">请把本页面链接发给客服，客服可以根据出口、WebRTC、延迟、抖动和带宽表现判断线路是否适合当前业务。</p>
    </section>
  </main>
</body>
</html>`);
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function card(label, value, detail) {
  return `<div class="col-md-6 col-xl-3">
    <div class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "--")}</strong>
      <small>${escapeHtml(detail || "--")}</small>
    </div>
  </div>`;
}

function format(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(digits);
}

function notFound(message) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(message)} - tikrapid</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="/check.css" rel="stylesheet">
</head>
<body>
  <main class="container py-5">
    <div class="panel">
      <h1 class="h3">${escapeHtml(message)}</h1>
      <p class="text-soft">可以重新检测生成新的报告。</p>
      <a class="btn btn-primary" href="/check">重新检测</a>
    </div>
  </main>
</body>
</html>`;
}

import { ensureCheckTable, escapeHtml } from "../_check-utils.js";
import { loadDiagnosisReport, renderDiagnosisReportHtml } from "../_diagnosis-utils.js";

const STATUS = {
  recommend: { label: "✅ 推荐使用", className: "status-good" },
  test: { label: "🟡 可测试", className: "status-test" },
  caution: { label: "⚠️ 谨慎使用", className: "status-warn" },
  avoid: { label: "❌ 不建议使用", className: "status-bad" },
};

export async function onRequestGet({ params, env }) {
  const rawId = String(params.id || "").trim();
  if (!/^\d+$/.test(rawId)) {
    const diagnosis = await loadDiagnosisReport(env, rawId);
    if (!diagnosis) {
      return html(notFound(`没有找到 ${rawId} 诊断报告`), 404);
    }
    return html(renderDiagnosisReportHtml(diagnosis));
  }

  await ensureCheckTable(env);

  const id = Number(rawId);
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

  const assessment = buildAssessment(row, webrtcIps);
  const unlock = getUnlockResult(row);

  return html(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>线路检测报告 ${assessment.reportCode} - tikrapid</title>
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
    <section class="report-hero panel mb-4">
      <div class="report-hero-main">
        <p class="eyebrow mb-2">报告编号：${escapeHtml(assessment.reportCode)}</p>
        <h1 class="display-title mb-2">当前环境综合评分 ${escapeHtml(score(row))} / 100</h1>
        <p class="text-soft mb-0">本报告基于当前网络环境，对 IP 地区、ASN 运营商、DNS、WebRTC、延迟、抖动、丢包及业务适配度进行综合评估。检测结果仅代表当前网络状态，适用于判断该环境是否适合 TikTok 直播、短视频运营、跨境电商、AI 工具访问及多账号矩阵等场景。</p>
      </div>
      <div class="report-score">
        <span>${escapeHtml(score(row))}</span>
        <strong>${escapeHtml(row.rating || "综合评估")}</strong>
      </div>
    </section>

    <section class="panel mb-4">
      <div class="section-line">
        <div>
          <h2 class="h4 mb-2">当前环境结论</h2>
          <p class="text-soft mb-0">${escapeHtml(assessment.summary)}</p>
        </div>
      </div>
      <div class="conclusion-grid mt-3">
        ${assessment.topConclusions.map(conclusionCard).join("")}
      </div>
    </section>

    <section class="panel mb-4">
      <h2 class="h4 mb-2">业务场景适配判断</h2>
      <p class="text-soft">不要只看“能不能打开网页”。跨境业务更重要的是地区一致性、IP 质量和长时间稳定性。</p>
      ${table(["使用场景", "适配结果", "建议"], assessment.scenarios.map((item) => [
        item.scene,
        statusBadge(item.status),
        item.reason,
      ]))}
    </section>

    <section class="panel mb-4">
      <div class="section-line">
        <div>
          <h2 class="h4 mb-2">地区一致性检测</h2>
          <p class="text-soft mb-0">地区一致性评分：${assessment.region.score} / 100。${escapeHtml(assessment.region.message)}</p>
        </div>
        <div class="mini-score">${assessment.region.score}</div>
      </div>
      ${table(["项目", "当前结果", "风险"], assessment.region.rows)}
    </section>

    <section class="row g-3 mb-4">
      <div class="col-lg-6">
        <div class="panel h-100">
          <h2 class="h4 mb-2">IP 质量判断</h2>
          <p class="text-soft">${escapeHtml(assessment.ipQuality.message)}</p>
          ${table(["检测项", "结果", "判断"], assessment.ipQuality.rows)}
        </div>
      </div>
      <div class="col-lg-6">
        <div class="panel h-100">
          <h2 class="h4 mb-2">直播推流稳定性</h2>
          <p class="text-soft">${escapeHtml(assessment.live.message)}</p>
          ${table(["指标", "结果", "参考"], assessment.live.rows)}
        </div>
      </div>
    </section>

    ${unlockSection(unlock)}

    <section class="panel mb-4">
      <h2 class="h4 mb-2">账号运营风险提示</h2>
      <p class="text-soft">跨境平台通常不会只根据 IP 国家判断账号环境，还会综合识别 DNS、WebRTC、设备语言、系统时区、账号行为、登录习惯和网络稳定性。若环境长期不一致，可能导致账号标签混乱、注册失败、限流、直播推流不稳定等问题。</p>
      <div class="risk-grid">
        ${assessment.risks.map((item) => `<div class="risk-item">${escapeHtml(item)}</div>`).join("")}
      </div>
    </section>

    <section class="panel mb-4">
      <h2 class="h4 mb-2">优化建议</h2>
      <div class="risk-grid">
        ${assessment.suggestions.map((item) => `<div class="risk-item">${escapeHtml(item)}</div>`).join("")}
      </div>
    </section>

    <section class="panel report-cta">
      <div>
        <p class="eyebrow mb-2">人工复核入口</p>
        <h2 class="h4 mb-2">不确定当前环境是否适合业务？</h2>
        <p class="text-soft mb-0">提交本报告编号，由我们根据你的目标国家和平台场景进行人工复核，并给出线路与账号环境优化方案。</p>
      </div>
      <div class="cta-buttons">
        <a class="btn btn-primary" href="${ticketUrl("人工复核报告", assessment.reportCode)}">免费人工复核报告</a>
        <a class="btn btn-outline-light" href="${ticketUrl("TikTok直播线路方案", assessment.reportCode)}">获取 TikTok 直播线路方案</a>
        <a class="btn btn-outline-light" href="${ticketUrl("跨境账号环境配置", assessment.reportCode)}">获取跨境账号环境配置方案</a>
      </div>
    </section>
  </main>
</body>
</html>`);
}

function buildAssessment(row, webrtcIps) {
  const countryCode = countryCodeValue(row);
  const reportCode = makeReportCode(row, countryCode);
  const region = assessRegion(row, webrtcIps, countryCode);
  const ipQuality = assessIpQuality(row);
  const live = assessLive(row);
  const scenarios = assessScenarios(row, region, ipQuality, live, webrtcIps);
  const topConclusions = [
    findScenario(scenarios, "TikTok 直播"),
    findScenario(scenarios, "TikTok 短视频运营"),
    findScenario(scenarios, "AI 跨境电商工具"),
    findScenario(scenarios, "海外社媒注册"),
  ];

  const usable = scenarios
    .filter((item) => item.status === "recommend")
    .slice(0, 3)
    .map((item) => item.scene.replace("TikTok ", ""));
  const risky = scenarios
    .filter((item) => item.status === "caution" || item.status === "avoid")
    .slice(0, 3)
    .map((item) => item.scene.replace("TikTok ", ""));

  const summary = `当前环境适合【${usable.length ? usable.join(" / ") : "基础访问"}】，但在【${risky.length ? risky.join(" / ") : "高价值账号场景"}】场景下仍存在一定风险。建议在正式运营前进一步优化 IP 质量、地区一致性及推流稳定性。`;

  return {
    reportCode,
    summary,
    region,
    ipQuality,
    live,
    scenarios,
    topConclusions,
    risks: buildRisks(row, webrtcIps, region, ipQuality, live),
    suggestions: buildSuggestions(row, region, ipQuality, live),
  };
}

function getUnlockResult(row) {
  const type = String(row.unlock_result_type || "").trim();
  const raw = String(row.unlock_result_raw || "").trim();
  let summary = {};
  try {
    summary = JSON.parse(row.unlock_summary || "{}");
  } catch {
    summary = {};
  }

  if (!type || !raw) {
    return { type: "", raw: "", summary: {} };
  }

  return { type, raw, summary };
}

function unlockSection(unlock) {
  if (!unlock.raw) {
    return "";
  }

  if (unlock.type === "json") {
    const rows = [
      ["IP", unlock.summary.ip || "未识别"],
      ["国家/地区", unlock.summary.country || "未识别"],
      ["ASN", unlock.summary.asn || "未识别"],
      ["组织", unlock.summary.organization || "未识别"],
      ["IP 类型", unlock.summary.ip_type || "未识别"],
      ["风险等级", unlock.summary.risk_level || "未识别"],
      ["TikTok", unlock.summary.tiktok || "未识别"],
      ["Netflix", unlock.summary.netflix || "未识别"],
      ["YouTube", unlock.summary.youtube || "未识别"],
      ["ChatGPT", unlock.summary.chatgpt || "未识别"],
      ["黑名单数量", unlock.summary.blacklist_count || "未识别"],
      ["25端口状态", unlock.summary.port_25 || "未识别"],
    ];

    return `<section class="panel mb-4">
      <h2 class="h4 mb-2">深度解锁检测</h2>
      <p class="unlock-scope mb-2">TikTok / ChatGPT / Netflix / YouTube / IP风险 / 黑名单</p>
      <p class="text-soft">以下结果来自客户本地命令输出粘贴。该项需要结合线路用途和出口环境人工判断，生成报告后可提交客服免费诊断。</p>
      ${table(["检测项", "结果"], rows)}
    </section>`;
  }

  return `<section class="panel mb-4">
    <h2 class="h4 mb-2">深度解锁检测</h2>
    <p class="unlock-scope mb-2">TikTok / ChatGPT / Netflix / YouTube / IP风险 / 黑名单</p>
    <p class="text-soft">客户粘贴的是非 JSON 输出，已作为纯文本报告保存。该项需要结合线路用途和出口环境人工判断，生成报告后可提交客服免费诊断。</p>
    <pre class="unlock-text-preview">${escapeHtml(unlock.raw.slice(0, 12000))}</pre>
  </section>`;
}

function assessScenarios(row, region, ipQuality, live, webrtcIps) {
  const hasWebrtcLeak = webrtcIps.length > 0;
  const basicStable = n(row.avg_latency_ms) > 0 && n(row.avg_latency_ms) < 260 && n(row.download_mbps) >= 3;
  const regionOk = region.score >= 80 && !hasWebrtcLeak;
  const regionTest = region.score >= 65 && !hasWebrtcLeak;

  return [
    {
      scene: "TikTok 直播",
      status: live.status,
      reason: live.status === "recommend"
        ? "延迟、抖动和上传表现较好，可用于直播前测试和正式推流。"
        : live.status === "test"
          ? "可测试，不建议直接长时间正式开播；建议先做 10-15 分钟试播。"
          : live.status === "caution"
            ? "当前线路存在推流波动风险，可能导致直播卡顿、音画不同步或推流不稳。"
            : "当前线路不适合作为正式直播环境，建议先优化线路后再开播。",
    },
    {
      scene: "TikTok 短视频运营",
      status: regionOk ? "recommend" : regionTest ? "test" : "caution",
      reason: regionOk
        ? "当前地区识别基本一致，适合日常发布、浏览和轻量运营。"
        : "地区或浏览器环境存在不一致，建议优化后再用于新号冷启动和高频运营。",
    },
    {
      scene: "TikTok Shop / 跨境电商",
      status: ipQuality.level === "datacenter" || region.score < 75 ? "test" : "recommend",
      reason: "建议进一步确认账号地区、设备语言、支付环境和后台登录习惯，避免长期环境标签混乱。",
    },
    {
      scene: "ADS 指纹浏览器",
      status: !hasWebrtcLeak && n(row.jitter_ms) < 25 ? "recommend" : "test",
      reason: "可用于指纹浏览器环境，但 SOCKS5、时区、语言和 DNS 需要长期保持一致。",
    },
    {
      scene: "AI 跨境电商工具",
      status: basicStable ? "recommend" : "test",
      reason: basicStable
        ? "访问稳定性较好，适合 ChatGPT、Midjourney、Canva 等 AI 工具访问。"
        : "基础访问可测试，但若频繁超时或地区异常，建议更换更稳定线路。",
    },
    {
      scene: "多账号矩阵",
      status: ipQuality.level === "datacenter" || hasWebrtcLeak ? "caution" : "test",
      reason: "当前 IP 纯净度和共享情况无法完全确认，建议一号一环境，不建议大规模共用同一出口。",
    },
    {
      scene: "独立站访问/运营",
      status: basicStable ? "recommend" : "test",
      reason: "当前网络可满足基础访问和后台管理，支付、广告账户等高敏感操作仍建议固定环境。",
    },
    {
      scene: "海外社媒注册",
      status: ipQuality.level === "datacenter" ? "caution" : "test",
      reason: "注册场景风控较高，如果当前 IP 为机房或共享代理，不建议用于高价值新号注册。",
    },
  ];
}

function assessRegion(row, webrtcIps, countryCode) {
  const timezone = String(row.browser_timezone || "").trim();
  const languages = String(row.browser_languages || "").trim();
  const timezoneResult = timezoneRisk(countryCode, timezone);
  const languageResult = languageRisk(countryCode, languages);
  const webrtcOk = webrtcIps.length === 0;

  let regionScore = 100;
  regionScore -= 8; // DNS country cannot be reliably confirmed from browser-only Pages Functions.
  if (!webrtcOk) regionScore -= 25;
  regionScore -= timezoneResult.penalty;
  regionScore -= languageResult.penalty;
  regionScore = Math.max(0, Math.min(100, regionScore));

  const message = regionScore >= 85
    ? `当前环境与 ${row.country || "目标地区"} 运营场景匹配度较好。`
    : regionScore >= 70
      ? `当前环境基本符合 ${row.country || "目标地区"} 运营场景，但 DNS 或浏览器环境存在轻微不一致，建议优化后再用于新号冷启动。`
      : "当前环境存在明显不一致，建议先优化 IP、DNS、时区、语言和 WebRTC 后再用于账号运营。";

  return {
    score: regionScore,
    message,
    rows: [
      ["出口 IP 国家", row.country || "未知", statusText("recommend", row.country || "未知")],
      ["DNS 国家", "未检测", "🟡 浏览器无法直接确认 DNS 出口，建议人工复核"],
      ["WebRTC 泄露", webrtcOk ? "未泄露" : webrtcIps.join(", "), webrtcOk ? statusText("recommend", "未发现公网 IP 泄露") : statusText("caution", "可能暴露真实网络")],
      ["系统时区", timezone || "未采集", timezoneResult.label],
      ["浏览器语言", languages || "未采集", languageResult.label],
      ["IP ASN", `${row.asn || "未知"} / ${row.isp || "未知"}`, "根据运营商类型和业务场景综合判断"],
    ],
  };
}

function assessIpQuality(row) {
  const org = `${row.asn || ""} ${row.isp || ""}`.toLowerCase();
  const datacenter = /(amazon|aws|google cloud|microsoft|azure|digitalocean|linode|vultr|ovh|hetzner|leaseweb|contabo|oracle|cloudflare|data ?center|hosting|server|cloud|colo|zenlayer|tencent|alibaba|huawei cloud|m247|choopa|sharktech)/i.test(org);
  const mobile = /(mobile|wireless|cellular|u mobile|celcom|digi|maxis|vodafone|verizon|t-mobile|telefonica|orange|ais|dtac|china mobile|softbank|kddi)/i.test(org);
  const fixedIsp = /(telecom|unicom|broadband|fiber|fibre|residential|cable|comcast|bt|sky|telstra|singtel|starhub|telekom|unifi|ntt|pldt|true|tm\b)/i.test(org);

  if (datacenter) {
    return {
      level: "datacenter",
      message: "当前 IP 更像机房或云服务器环境，适合基础访问和测试，不建议直接用于高价值账号注册或直播冷启动。",
      rows: [
        ["IP 类型", "机房 / 云服务器特征", "影响账号可信度"],
        ["ASN 运营商", `${row.asn || "未知"} / ${row.isp || "未知"}`, "不像普通本地家庭用户"],
        ["是否代理/VPN 特征", "可能存在", "注册和账号权重风险较高"],
        ["黑名单风险", "中到高", "建议人工复核 IP 纯净度"],
        ["共享风险", "中到高", "不建议多账号共用"],
      ],
    };
  }

  if (mobile || fixedIsp) {
    return {
      level: mobile ? "mobile" : "isp",
      message: mobile
        ? "当前 IP 具备移动网络特征，更接近真实用户环境，但仍需确认是否为共享出口。"
        : "当前 IP 接近本地住宅或商宽环境，更适合用于目标地区账号的长期运营。",
      rows: [
        ["IP 类型", mobile ? "移动网络特征" : "住宅 / 商宽特征", "更接近本地真实用户"],
        ["ASN 运营商", `${row.asn || "未知"} / ${row.isp || "未知"}`, "需结合目标国家判断"],
        ["是否代理/VPN 特征", "未知", "建议结合人工复核"],
        ["黑名单风险", "低到中", "取决于历史使用情况"],
        ["共享风险", "未知", "高价值账号建议一号一环境"],
      ],
    };
  }

  return {
    level: "unknown",
    message: "当前 IP 类型暂无法准确判断，适合基础访问和轻量测试，高价值账号建议先人工复核。",
    rows: [
      ["IP 类型", "未知", "影响账号可信度"],
      ["ASN 运营商", `${row.asn || "未知"} / ${row.isp || "未知"}`, "需要结合业务场景判断"],
      ["是否代理/VPN 特征", "未知", "建议人工复核"],
      ["黑名单风险", "未知", "无法仅凭当前检测确认"],
      ["共享风险", "未知", "不建议多账号直接共用"],
    ],
  };
}

function assessLive(row) {
  const latency = n(row.avg_latency_ms);
  const jitter = n(row.jitter_ms);
  const loss = n(row.packet_loss_percent);
  const upload = n(row.upload_mbps);

  let status = "recommend";
  if (loss >= 3 || upload < 4 || jitter > 35 || latency > 220) status = "avoid";
  else if (loss >= 1 || upload < 8 || jitter > 20 || latency > 150) status = "caution";
  else if (jitter > 10 || latency > 80 || upload < 12) status = "test";

  const uploadStability = upload >= 12 && jitter <= 10 && loss < 1 ? "良好" : upload >= 8 && jitter <= 20 && loss < 1.5 ? "一般" : "较差";
  const routeStability = jitter <= 10 && loss === 0 ? "稳定" : jitter <= 20 && loss < 1 ? "有波动" : "波动明显";
  const message = status === "recommend"
    ? "直播适配结果：✅ 推荐使用。当前线路延迟、抖动和上行表现较好，可先试播后正式开播。"
    : status === "test"
      ? "直播适配结果：🟡 可测试，不建议直接长时间开播。当前线路可接受，但抖动或上行余量仍需观察。"
      : status === "caution"
        ? "直播适配结果：⚠️ 谨慎使用。当前线路可能导致直播间画面卡顿、音画不同步或推流波动。"
        : "直播适配结果：❌ 不建议使用。当前线路不适合作为正式直播推流环境。";

  return {
    status,
    message,
    rows: [
      ["延迟 Ping", latency ? `${format(latency)} ms` : "请求失败", "越低越好"],
      ["抖动 Jitter", `${format(jitter)} ms`, "建议 < 10 ms"],
      ["丢包 Packet Loss", `${format(loss, 1)}%`, "建议 < 1%"],
      ["上行稳定性", uploadStability, "直播重点看这个"],
      ["路由稳定性", routeStability, "影响长时间直播"],
      ["推流建议码率", bitrateRange(row), "根据线路判断"],
    ],
  };
}

function buildRisks(row, webrtcIps, region, ipQuality, live) {
  const risks = [
    "DNS 出口暂未检测，平台可能结合 DNS 与 IP 地区判断账号环境。",
    "多账号共用同一出口可能增加关联风险，高价值账号建议一号一环境。",
  ];

  if (webrtcIps.length) risks.unshift("WebRTC 泄露可能暴露真实网络，建议先关闭或修复后再运营账号。");
  if (region.score < 85) risks.push("IP 地区、浏览器语言或系统时区存在不一致，可能影响账号地区判断。");
  if (ipQuality.level === "datacenter") risks.push("当前 IP 疑似机房或云服务器环境，不建议用于新号注册或直播冷启动。");
  if (live.status !== "recommend") risks.push("直播线路存在稳定性风险，可能导致画面卡顿、推流断开或观众进入率下降。");
  if (/zh-CN/i.test(row.browser_languages || "") && !["CN", "HK", "TW"].includes(countryCodeValue(row))) {
    risks.push("浏览器语言含 zh-CN，若目标地区不是中文区，建议根据目标国家调整语言环境。");
  }

  return risks;
}

function buildSuggestions(row, region, ipQuality, live) {
  const suggestions = [];
  if (region.score < 85) suggestions.push("先统一目标国家的 IP、DNS、系统时区、浏览器语言和账号资料，再进行新号冷启动。");
  if (ipQuality.level === "datacenter" || ipQuality.level === "unknown") suggestions.push("高价值账号注册、直播首播和矩阵批量操作前，建议人工复核 IP 类型、纯净度和共享风险。");
  if (live.status !== "recommend") suggestions.push("直播前先做 10-15 分钟试播，观察推流码率、卡顿、音画同步和观众进入情况。");
  suggestions.push("长期运营建议固定国家、固定设备、固定线路，避免频繁切换环境导致账号标签混乱。");
  return suggestions;
}

function timezoneRisk(countryCode, timezone) {
  if (!timezone) return { penalty: 8, label: "🟡 未采集，建议确认系统时区" };
  const expected = {
    MY: ["Asia/Kuala_Lumpur"],
    SG: ["Asia/Singapore"],
    JP: ["Asia/Tokyo"],
    KR: ["Asia/Seoul"],
    TH: ["Asia/Bangkok"],
    VN: ["Asia/Ho_Chi_Minh"],
    ID: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"],
    PH: ["Asia/Manila"],
    CN: ["Asia/Shanghai", "Asia/Chongqing", "Asia/Urumqi"],
    HK: ["Asia/Hong_Kong"],
    TW: ["Asia/Taipei"],
    GB: ["Europe/London"],
    DE: ["Europe/Berlin"],
    FR: ["Europe/Paris"],
    US: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"],
    AU: ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth", "Australia/Adelaide"],
  }[countryCode];

  if (!expected) return { penalty: 4, label: "🟡 目标地区时区规则未内置，建议人工复核" };
  if (expected.includes(timezone)) return { penalty: 0, label: "✅ 与出口国家基本一致" };
  return { penalty: 18, label: "⚠️ 与出口国家不一致，可能影响账号环境判断" };
}

function languageRisk(countryCode, languages) {
  if (!languages) return { penalty: 8, label: "🟡 未采集，建议确认浏览器语言" };
  const first = languages.split("/")[0].trim().toLowerCase();
  const expected = {
    MY: ["ms", "en"],
    SG: ["en", "zh", "ms", "ta"],
    JP: ["ja"],
    KR: ["ko"],
    TH: ["th"],
    VN: ["vi"],
    ID: ["id", "en"],
    PH: ["en", "fil", "tl"],
    CN: ["zh"],
    HK: ["zh", "en"],
    TW: ["zh"],
    US: ["en"],
    GB: ["en"],
    AU: ["en"],
  }[countryCode];

  if (!expected) return { penalty: 6, label: "🟡 需要结合目标国家人工判断" };
  if (expected.some((prefix) => first.startsWith(prefix))) return { penalty: 0, label: "✅ 首选语言与目标地区基本一致" };
  return { penalty: 10, label: "⚠️ 浏览器首选语言与目标地区不完全一致" };
}

function findScenario(scenarios, scene) {
  return scenarios.find((item) => item.scene === scene) || scenarios[0];
}

function conclusionCard(item) {
  return `<div class="result-card ${STATUS[item.status].className}">
    <span>${escapeHtml(item.scene)}</span>
    <strong>${escapeHtml(STATUS[item.status].label)}</strong>
    <p>${escapeHtml(item.reason)}</p>
  </div>`;
}

function table(headers, rows) {
  return `<div class="report-table-wrap">
    <table class="report-table">
      <thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cellHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  </div>`;
}

function statusBadge(status) {
  const item = STATUS[status] || STATUS.test;
  return `<span class="status-pill ${item.className}">${escapeHtml(item.label)}</span>`;
}

function statusText(status, text) {
  return `<span class="status-pill ${STATUS[status].className}">${escapeHtml(text)}</span>`;
}

function cellHtml(value) {
  const text = String(value ?? "");
  if (text.startsWith("<span class=\"status-pill")) return text;
  return escapeHtml(text);
}

function ticketUrl(type, reportCode) {
  return `/ticket.html?type=${encodeURIComponent(type)}&report=${encodeURIComponent(reportCode)}`;
}

function countryCodeValue(row) {
  const code = String(row.country_code || "").trim().toUpperCase();
  if (code) return code;
  const country = String(row.country || "").trim();
  const reverse = { "马来西亚": "MY", "新加坡": "SG", "日本": "JP", "韩国": "KR", "美国": "US", "中国": "CN", "香港": "HK", "台湾": "TW" };
  return reverse[country] || "NA";
}

function makeReportCode(row, countryCode) {
  const date = new Date(`${row.created_at || new Date().toISOString()}Z`);
  const ymd = Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10).replace(/-/g, "")
    : date.toISOString().slice(0, 10).replace(/-/g, "");
  return `TK-${countryCode || "NA"}-${ymd}-${String(row.id || 0).padStart(4, "0")}`;
}

function bitrateRange(row) {
  const value = Number.parseFloat(String(row.recommended_bitrate || ""));
  const mbps = Number.isFinite(value) && value > 0 ? value : n(row.upload_mbps) * 0.55;
  if (mbps >= 8) return "4500-8000 kbps";
  if (mbps >= 4) return "2500-4000 kbps";
  if (mbps >= 2) return "1200-2500 kbps";
  return "不建议推流";
}

function score(row) {
  return Math.max(0, Math.min(100, Math.round(n(row.score))));
}

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function format(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0.0";
  return number.toFixed(digits);
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

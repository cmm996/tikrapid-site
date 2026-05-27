import { escapeHtml } from "./_check-utils.js";

export async function ensureDiagnosisTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS diagnosis_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      business_type TEXT NOT NULL DEFAULT '',
      target_market TEXT NOT NULL DEFAULT '',
      business_goal TEXT NOT NULL DEFAULT '',
      product_description TEXT NOT NULL DEFAULT '',
      current_stage TEXT NOT NULL DEFAULT '',
      main_pain_points TEXT NOT NULL DEFAULT '',
      budget_range TEXT NOT NULL DEFAULT '',
      team_size TEXT NOT NULL DEFAULT '',
      need_live TEXT NOT NULL DEFAULT '',
      has_material TEXT NOT NULL DEFAULT '',
      network_status TEXT NOT NULL DEFAULT '',
      conversion_tools TEXT NOT NULL DEFAULT '',
      language_capability TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS diagnosis_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL UNIQUE,
      lead_id INTEGER NOT NULL,
      total_score INTEGER NOT NULL DEFAULT 0,
      product_score INTEGER NOT NULL DEFAULT 0,
      market_score INTEGER NOT NULL DEFAULT 0,
      content_score INTEGER NOT NULL DEFAULT 0,
      network_score INTEGER NOT NULL DEFAULT 0,
      conversion_score INTEGER NOT NULL DEFAULT 0,
      team_score INTEGER NOT NULL DEFAULT 0,
      recommended_market TEXT NOT NULL DEFAULT '',
      recommended_strategy TEXT NOT NULL DEFAULT '',
      report_json TEXT NOT NULL DEFAULT '{}',
      report_html TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS diagnosis_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_to TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      next_followup_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

export function normalizeDiagnosisInput(data) {
  return {
    name: text(data.name, 80),
    contact: text(data.contact, 120),
    business_type: text(data.business_type, 80),
    target_market: text(data.target_market, 80),
    business_goal: list(data.business_goal),
    product_description: text(data.product_description, 600),
    current_stage: text(data.current_stage, 120),
    main_pain_points: list(data.main_pain_points),
    budget_range: text(data.budget_range, 80),
    team_size: text(data.team_size, 80),
    need_live: text(data.need_live, 80),
    has_material: list(data.has_material),
    network_status: text(data.network_status, 120),
    conversion_tools: list(data.conversion_tools),
    language_capability: text(data.language_capability, 120),
  };
}

export function generateDiagnosisReport(input, reportId, createdAt = new Date().toISOString()) {
  const scores = scoreDiagnosis(input);
  const markets = recommendMarkets(input);
  const strategy = recommendStrategy(input, scores);
  const contentColumns = recommendContentColumns(input);
  const networkAdvice = recommendNetworkAdvice(input);
  const conversionAdvice = recommendConversionAdvice(input);
  const plan = buildThirtyDayPlan(input);
  const services = recommendServices(input, scores);
  const biggestGaps = findBiggestGaps(scores.cards);
  const summary = buildSummary(input, scores, markets, strategy, biggestGaps);

  return {
    report_id: reportId,
    created_at: createdAt,
    lead: input,
    summary,
    total_score: scores.total,
    level: scores.level,
    level_text: scores.levelText,
    score_cards: scores.cards,
    biggest_gaps: biggestGaps,
    market_recommendations: markets,
    strategy,
    content_columns: contentColumns,
    network_advice: networkAdvice,
    conversion_advice: conversionAdvice,
    thirty_day_plan: plan,
    service_recommendation: services,
    final_note: buildFinalNote(input, scores, biggestGaps),
  };
}

export async function loadDiagnosisReport(env, reportId) {
  await ensureDiagnosisTables(env);
  const row = await env.DB.prepare(`
    SELECT
      r.*,
      l.name, l.contact, l.business_type, l.target_market, l.business_goal,
      l.product_description, l.current_stage, l.main_pain_points, l.budget_range,
      l.team_size, l.need_live, l.has_material, l.network_status,
      l.conversion_tools, l.language_capability,
      (
        SELECT status FROM diagnosis_followups f
        WHERE f.lead_id = l.id
        ORDER BY f.id DESC LIMIT 1
      ) AS followup_status,
      (
        SELECT note FROM diagnosis_followups f
        WHERE f.lead_id = l.id
        ORDER BY f.id DESC LIMIT 1
      ) AS followup_note,
      (
        SELECT next_followup_at FROM diagnosis_followups f
        WHERE f.lead_id = l.id
        ORDER BY f.id DESC LIMIT 1
      ) AS next_followup_at
    FROM diagnosis_reports r
    JOIN diagnosis_leads l ON l.id = r.lead_id
    WHERE r.report_id = ?
  `).bind(reportId).first();

  if (!row) return null;

  let report = {};
  try {
    report = JSON.parse(row.report_json || "{}");
  } catch {
    report = {};
  }

  return { row, report };
}

export function renderDiagnosisReportHtml(bundle, options = {}) {
  const { row, report } = bundle;
  const lead = report.lead || {};
  const admin = Boolean(options.admin);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.report_id)} - TikRapid 跨境业务出海诊断报告</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link href="/diagnosis.css" rel="stylesheet">
</head>
<body>
  <main class="dx-shell">
    <section class="dx-cover">
      <div>
        <p class="dx-kicker">TikRapid 跨境业务出海诊断报告</p>
        <h1>海外获客可行性评估与 30 天执行建议</h1>
        <p class="dx-muted">基于业务类型、目标市场、内容能力、网络环境与转化链路的综合评估。</p>
        <div class="dx-meta">
          <span>报告编号：${escapeHtml(report.report_id)}</span>
          <span>生成时间：${escapeHtml(row.created_at || report.created_at || "")}</span>
          <span>业务类型：${escapeHtml(lead.business_type || row.business_type || "-")}</span>
          <span>目标市场：${escapeHtml(lead.target_market || row.target_market || "-")}</span>
        </div>
      </div>
      <div class="dx-score">
        <span>${escapeHtml(report.total_score)}</span>
        <strong>${escapeHtml(report.level)} 级</strong>
        <small>${escapeHtml(report.level_text)}</small>
      </div>
    </section>

    <section class="dx-panel dx-summary">
      <h2>一句话总诊断</h2>
      <p>${escapeHtml(report.summary)}</p>
      <div class="dx-warning">当前项目不是不能做，而是不建议盲目重投入。建议先用 30 天完成市场测试、账号环境搭建、内容验证和承接链路检查。</div>
    </section>

    <section class="dx-grid dx-score-grid">
      ${(report.score_cards || []).map(scoreCard).join("")}
    </section>

    <section class="dx-panel">
      <h2>目标市场推荐</h2>
      ${table(["推荐市场", "推荐指数", "原因"], (report.market_recommendations || []).map((item) => [
        item.market,
        "★".repeat(item.rating) + "☆".repeat(5 - item.rating),
        item.reason,
      ]))}
    </section>

    <section class="dx-panel">
      <h2>业务模式判断</h2>
      <div class="dx-two">
        <div class="dx-box good">
          <h3>推荐打法：${escapeHtml(report.strategy?.recommended || "-")}</h3>
          <ul>${(report.strategy?.reasons || []).map(li).join("")}</ul>
        </div>
        <div class="dx-box caution">
          <h3>暂不建议一开始这样做</h3>
          <ul>${(report.strategy?.not_recommended || []).map(li).join("")}</ul>
        </div>
      </div>
    </section>

    <section class="dx-panel">
      <h2>内容 / 账号打法建议</h2>
      <div class="dx-card-list">${(report.content_columns || []).map(contentCard).join("")}</div>
    </section>

    <section class="dx-panel">
      <h2>网络环境与工具配置建议</h2>
      <div class="dx-card-list">${(report.network_advice || []).map(simpleCard).join("")}</div>
    </section>

    <section class="dx-panel">
      <h2>官网 / 私域承接建议</h2>
      <p class="dx-muted">如果短视频负责种草，官网和私域负责转化。没有承接页，很多流量会浪费。</p>
      ${table(["承接工具", "建议"], (report.conversion_advice || []).map((item) => [item.tool, item.advice]))}
    </section>

    <section class="dx-panel">
      <h2>30 天执行计划</h2>
      <div class="dx-plan">${(report.thirty_day_plan || []).map(planWeek).join("")}</div>
    </section>

    <section class="dx-panel">
      <h2>推荐服务方案</h2>
      <div class="dx-card-list">${(report.service_recommendation || []).map(serviceCard).join("")}</div>
      <p class="dx-muted">具体方案会根据目标国家、设备数量、是否直播、是否需要专属线路和承接页面进一步确认。</p>
    </section>

    <section class="dx-panel dx-summary">
      <h2>下一步建议</h2>
      <p>${escapeHtml(report.final_note)}</p>
      <div class="dx-actions">
        <a href="/ticket.html?type=${encodeURIComponent("出海诊断人工复核")}&report=${encodeURIComponent(report.report_id)}">领取人工复核</a>
        <a href="/check">检测当前网络环境</a>
        <a href="/pricing.html">查看 TikRapid 方案</a>
      </div>
    </section>

    ${admin ? adminPanel(row, report) : ""}
  </main>
</body>
</html>`;
}

function scoreDiagnosis(input) {
  const goals = input.business_goal;
  const pains = input.main_pain_points;
  const materials = input.has_material;
  const tools = input.conversion_tools;

  let product = 42;
  if (input.product_description.length >= 12) product += 18;
  if (input.business_type && input.business_type !== "其他") product += 10;
  if (/(工厂|厂家|外贸|电商|课程|咨询|服务|直播|代运营|品牌|产品)/.test(input.product_description + input.business_type)) product += 12;
  if (input.current_stage.includes("已经有产品") || input.current_stage.includes("已经在出海") || input.current_stage.includes("已经有团队")) product += 10;

  let market = 38;
  if (input.target_market && !input.target_market.includes("不确定")) market += 22;
  if (input.language_capability.includes("英文") || input.language_capability.includes("本地化") || input.target_market.includes("马来西亚") || input.target_market.includes("台湾")) market += 10;
  if (input.target_market.includes("美国") && input.language_capability.includes("不会")) market -= 10;
  if (pains.includes("不知道选哪个国家")) market -= 8;

  let content = 34;
  if (materials.includes("有视频素材")) content += 16;
  if (materials.includes("有老板本人可出镜")) content += 16;
  if (materials.includes("有产品图")) content += 8;
  if (goals.includes("老板个人 IP") || goals.includes("TikTok 短视频获客")) content += 8;
  if (materials.includes("什么都没有")) content -= 12;
  if (pains.includes("不知道内容怎么做")) content -= 8;

  let network = 42;
  if (input.network_status.includes("稳定")) network += 20;
  if (input.network_status.includes("没有") || input.network_status.includes("不清楚")) network -= 8;
  if (pains.includes("网络/IP/线路不稳定")) network -= 12;
  if ((input.need_live.includes("已经") || input.need_live.includes("核心")) && !input.network_status.includes("直播")) network -= 10;
  if (input.team_size.includes("工作室") || input.team_size.includes("5 人以上")) network += 8;

  let conversion = 30;
  if (tools.includes("官网落地页")) conversion += 18;
  if (tools.includes("WhatsApp / LINE") || tools.includes("Email 表单") || tools.includes("微信私域")) conversion += 12;
  if (tools.includes("免费资料 / 表单")) conversion += 8;
  if (tools.includes("暂时没有")) conversion -= 10;
  if (pains.includes("没有官网/私域承接") || pains.includes("不会转化")) conversion -= 8;

  let team = 36;
  if (input.team_size.includes("1～2")) team += 14;
  if (input.team_size.includes("3～5")) team += 24;
  if (input.team_size.includes("5 人以上") || input.team_size.includes("工作室")) team += 32;
  if (input.current_stage.includes("规模化")) team += 10;
  if (pains.includes("没有团队执行")) team -= 10;

  const cards = [
    makeScore("产品出海适配度", clamp(product), "产品/服务是否适合海外市场"),
    makeScore("市场选择清晰度", clamp(market), "目标国家是否明确、是否匹配"),
    makeScore("内容获客能力", clamp(content), "素材、人设、短视频和本地化能力"),
    makeScore("网络环境成熟度", clamp(network), "IP、线路、设备和账号环境是否具备"),
    makeScore("转化承接能力", clamp(conversion), "官网、私域、客服和成交链路"),
    makeScore("团队执行能力", clamp(team), "是否有人长期执行和复盘"),
  ];

  const total = Math.round(
    cards[0].score * 0.2 +
    cards[1].score * 0.15 +
    cards[2].score * 0.2 +
    cards[3].score * 0.2 +
    cards[4].score * 0.15 +
    cards[5].score * 0.1
  );

  return { total, ...level(total), cards };
}

function makeScore(name, score, description) {
  return {
    name,
    score,
    description,
    comment: score >= 85 ? "基础较好，可进入执行或放大阶段" :
      score >= 70 ? "有基础，但需要优化关键环节" :
      score >= 55 ? "适合先做低成本测试" :
      score >= 40 ? "准备不足，建议先补基础" :
      "暂不建议直接投入，需要先补课",
  };
}

function recommendMarkets(input) {
  const textValue = `${input.product_description} ${input.business_type} ${input.business_goal.join(" ")}`;
  const target = input.target_market;
  const markets = [];

  if (target && !target.includes("不确定")) {
    markets.push({ market: target, rating: 4, reason: "你已经有明确目标市场，建议先围绕该地区做小规模验证。" });
  }

  if (/(中医|养生|茶|课程|咨询|老板|文化|华人)/.test(textValue)) {
    markets.push({ market: "马来西亚华人", rating: 5, reason: "中文接受度高，海外属性强，适合低成本教育和信任转化。" });
    markets.push({ market: "台湾", rating: 4, reason: "传统文化认知强，适合课程、咨询、老板 IP 和内容种草。" });
  } else if (/(工厂|厂家|灯具|户外|五金|机械|B2B|外贸)/i.test(textValue)) {
    markets.push({ market: "美国", rating: 4, reason: "市场容量大，适合产品测评、工厂实力展示和询盘获客。" });
    markets.push({ market: "欧洲", rating: 4, reason: "适合 B2B、品质型产品和独立站内容承接。" });
  } else {
    markets.push({ market: "东南亚", rating: 4, reason: "进入门槛相对低，适合 TikTok、直播和跨境电商测试。" });
    markets.push({ market: "马来西亚", rating: 4, reason: "华人市场和英文环境兼具，适合作为第一站低成本验证。" });
  }

  markets.push({ market: "美国", rating: target.includes("美国") ? 4 : 3, reason: "市场大但教育成本和内容本地化要求高，建议先低成本测试。" });

  return dedupeBy(markets, "market").slice(0, 4);
}

function recommendStrategy(input, scores) {
  const goals = input.business_goal;
  const reasons = [];
  const notRecommended = [];
  let recommended = "短视频获客 + 私域转化";

  if (goals.includes("老板个人 IP") || /(老板|创始人|专家|老师|课程|咨询)/.test(input.product_description + input.business_type)) {
    recommended = "老板 IP + 短视频获客 + 私域转化";
    reasons.push("产品或服务需要信任教育，用户需要先认识你再购买。");
    reasons.push("老板本人出镜能降低海外客户的信任成本。");
  } else if (goals.includes("TikTok 直播带货") || goals.includes("TikTok Shop")) {
    recommended = "TikTok 短视频测试 + 小场直播 + 店铺承接";
    reasons.push("直播需要流量、网络和供应链同时稳定，建议先用短视频测品。");
  } else if (goals.includes("独立站") || goals.includes("外贸询盘获客")) {
    recommended = "内容获客 + 官网落地页 + 询盘表单";
    reasons.push("B2B 和高客单产品更适合先建立可信官网与案例内容。");
  } else {
    reasons.push("先用低成本内容测试市场反馈，再决定是否进入直播、投流或独立站投入。");
  }

  if (scores.cards.find((item) => item.name === "转化承接能力")?.score < 60) notRecommended.push("不建议一开始重投流量，因为官网和私域承接还不完整。");
  if (input.target_market.includes("美国") && input.language_capability.includes("不会")) notRecommended.push("不建议过早重仓美区英文内容，先选择语言成本更低的市场测试。");
  if (input.need_live.includes("核心") && !input.network_status.includes("稳定")) notRecommended.push("不建议直接正式直播，先完成网络和推流稳定性测试。");
  notRecommended.push("不建议频繁更换账号国家、设备语言和网络环境。");

  return { recommended, reasons, not_recommended: notRecommended };
}

function recommendContentColumns(input) {
  const product = input.product_description;
  const type = input.business_type;
  if (/(中医|养生|课程|咨询|老师|文化)/.test(product + type)) {
    return [
      { title: "海外华人中式养生", advice: "围绕睡眠、情绪、家庭关系和亚健康，用中文内容降低教育成本。" },
      { title: "经典智慧生活化", advice: "把专业理论拆成现代生活建议，避免一上来讲太深。" },
      { title: "老板 IP 故事", advice: "讲经历、理念、客户案例和方法论，建立可信度。" },
      { title: "45+ 人群痛点", advice: "聚焦更年期、压力、睡眠、家庭沟通等高共鸣主题。" },
    ];
  }

  if (/(工厂|厂家|外贸|灯具|机械|五金|B2B)/i.test(product + type)) {
    return [
      { title: "工厂实拍", advice: "展示产线、质检、仓储和交付能力，建立供应链信任。" },
      { title: "产品测评", advice: "用真实场景展示功能、耐用度、规格和选购标准。" },
      { title: "客户案例", advice: "展示不同国家客户如何使用产品，降低询盘顾虑。" },
      { title: "选购避坑", advice: "讲海外买家常见误区和成本结构，建立专业形象。" },
    ];
  }

  return [
    { title: "产品使用场景", advice: "用具体场景表达价值，不要只讲参数。" },
    { title: "客户问题解答", advice: "把客户常问问题做成短视频栏目。" },
    { title: "幕后与团队", advice: "展示真实团队、交付过程和服务细节。" },
    { title: "市场教育内容", advice: "解释为什么需要你的产品或服务，降低陌生市场理解成本。" },
  ];
}

function recommendNetworkAdvice(input) {
  const advice = [
    { title: "固定目标国家环境", advice: "IP、DNS、WebRTC、系统时区和浏览器语言需要长期一致。" },
    { title: "一账号一环境", advice: "高价值账号不建议多个账号共用同一高风险出口。" },
  ];

  if (input.business_goal.includes("TikTok 直播带货") || input.need_live.includes("直播")) {
    advice.push({ title: "直播线路重点", advice: "正式开播前检测抖动、丢包和上行稳定性，晚高峰也要测试。" });
    advice.push({ title: "工作室部署", advice: "多人或多设备建议使用软路由统一接入，减少配置漂移。" });
  }

  if (input.business_goal.includes("海外社媒矩阵") || input.business_goal.includes("团队/工作室网络部署")) {
    advice.push({ title: "矩阵环境", advice: "每个账号独立浏览器环境，SOCKS5/HTTP 代理配置保持稳定。" });
  }

  return advice;
}

function recommendConversionAdvice(input) {
  const target = input.target_market;
  return [
    { tool: "官网落地页", advice: input.conversion_tools.includes("官网落地页") ? "已有基础，建议强化案例、信任背书和咨询入口。" : "建议搭建简版落地页，用于承接海外客户和报告咨询。" },
    { tool: "WhatsApp / LINE", advice: target.includes("马来") || target.includes("台湾") || target.includes("东南亚") ? "建议配置，适合东南亚和华人市场私域沟通。" : "可作为补充入口，视目标市场使用习惯决定。" },
    { tool: "Email 表单", advice: target.includes("美国") || target.includes("欧洲") || input.business_goal.includes("外贸询盘获客") ? "建议配置，适合欧美 B2B 和询盘场景。" : "可作为官网基础表单，方便沉淀线索。" },
    { tool: "微信私域", advice: target.includes("马来") || target.includes("台湾") || /华人|中文/.test(input.product_description) ? "华人市场可配置，适合课程、咨询和复购。" : "可保留给中文客户，不作为唯一承接方式。" },
    { tool: "免费资料 / 咨询表单", advice: "适合老板 IP、课程、咨询和高客单项目，用低门槛资料换取线索。" },
  ];
}

function buildThirtyDayPlan(input) {
  return [
    { week: "第 1 周：定位和环境", items: ["明确第一目标市场", "搭建账号网络环境", "统一设备语言和时区", "完成主页包装", "确定 3-5 个内容栏目"] },
    { week: "第 2 周：内容测试", items: ["发布 10-15 条短视频", "测试 3 个内容方向", "记录播放、完播、互动、主页点击", "先看反馈，不急于成交"] },
    { week: "第 3 周：承接搭建", items: ["搭建落地页或官网", "设置私域入口", "准备免费资料或咨询表单", "优化主页 CTA"] },
    { week: "第 4 周：复盘和放大", items: ["找出数据最好的选题", "复制高表现结构", "开始轻度引流", input.need_live.includes("直播") ? "评估是否进入试播阶段" : "评估是否进入投流或私域转化阶段"] },
  ];
}

function recommendServices(input, scores) {
  const services = [
    { name: "基础诊断版", fit: "适合还没开始、不确定方向的客户", includes: ["出海定位诊断", "目标市场建议", "网络环境检测", "基础执行建议"] },
  ];

  if (scores.total >= 55 || input.current_stage.includes("已经")) {
    services.push({ name: "冷启动服务版", fit: "适合想开始做账号和内容的客户", includes: ["账号环境搭建", "30 天内容选题", "脚本生成", "主页包装", "基础网络方案"] });
  }

  if (input.team_size.includes("3～5") || input.team_size.includes("5 人以上") || input.team_size.includes("工作室") || input.need_live.includes("核心")) {
    services.push({ name: "深度部署版", fit: "适合团队、工作室和直播客户", includes: ["多设备网络部署", "软路由/专线", "账号矩阵环境", "官网私域承接", "直播推流测试", "数据复盘"] });
  }

  return services;
}

function buildSummary(input, scores, markets, strategy, gaps) {
  const market = markets[0]?.market || input.target_market || "第一目标市场";
  const gapText = gaps.map((item) => item.name.replace("能力", "").replace("度", "")).join("和");
  if (scores.total >= 85) {
    return `你的项目已具备出海基础，建议以 ${market} 为第一站，采用「${strategy.recommended}」进入执行和放大阶段，同时继续优化 ${gapText || "内容和承接链路"}。`;
  }
  if (scores.total >= 70) {
    return `你的项目有出海测试价值，建议优先选择 ${market} 做低成本验证，用「${strategy.recommended}」降低试错成本，并补齐 ${gapText || "关键环节"}。`;
  }
  if (scores.total >= 55) {
    return `你的项目不是不能做，但暂不建议直接重投入。建议先用 30 天在 ${market} 完成市场、内容、网络和承接链路测试。`;
  }
  return `当前出海准备仍偏弱，建议先完成定位、内容素材、网络环境和私域承接基础建设，再考虑正式投入 ${market}。`;
}

function buildFinalNote(input, scores, gaps) {
  const gapText = gaps.map((item) => item.name).join("、") || "出海定位和执行路径";
  return `综合判断：当前环境和项目适合先做低成本验证，但在 ${gapText} 上仍需要优化。如果你不确定该从哪个国家、账号打法或网络环境开始，可以提交本报告编号，由我们进行人工复核并给出下一步方案。`;
}

function findBiggestGaps(cards) {
  return [...cards].sort((a, b) => a.score - b.score).slice(0, 2);
}

function level(score) {
  if (score >= 85) return { level: "A", levelText: "已具备出海基础，可进入执行/放大阶段" };
  if (score >= 70) return { level: "B", levelText: "有基础，但需要优化关键环节" };
  if (score >= 55) return { level: "C", levelText: "适合先做低成本测试，不建议重投入" };
  if (score >= 40) return { level: "D", levelText: "出海准备不足，建议先做定位和基础环境" };
  return { level: "E", levelText: "暂不建议直接出海，需先补齐产品/内容/环境" };
}

function scoreCard(item) {
  return `<div class="dx-score-card">
    <span>${escapeHtml(item.name)}</span>
    <strong>${escapeHtml(item.score)}</strong>
    <p>${escapeHtml(item.comment)}</p>
    <small>${escapeHtml(item.description)}</small>
  </div>`;
}

function contentCard(item) {
  return `<div class="dx-mini-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.advice)}</p></div>`;
}

function simpleCard(item) {
  return `<div class="dx-mini-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.advice)}</p></div>`;
}

function serviceCard(item) {
  return `<div class="dx-mini-card"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.fit)}</p><ul>${item.includes.map(li).join("")}</ul></div>`;
}

function planWeek(item) {
  return `<div class="dx-week"><h3>${escapeHtml(item.week)}</h3><ul>${item.items.map(li).join("")}</ul></div>`;
}

function adminPanel(row, report) {
  return `<section class="dx-panel dx-admin-panel">
    <h2>员工跟进</h2>
    <p class="dx-muted">当前状态：${escapeHtml(row.followup_status || "new")}；下次跟进：${escapeHtml(row.next_followup_at || "-")}</p>
    <div class="dx-admin-form">
      <input id="assignedTo" placeholder="跟进人" value="">
      <select id="leadStatus">
        <option value="new">新线索</option>
        <option value="contacted">已联系</option>
        <option value="qualified">有效线索</option>
        <option value="closed">已成交/关闭</option>
      </select>
      <input id="nextFollowup" type="date">
      <textarea id="followupNote" placeholder="跟进备注">${escapeHtml(row.followup_note || "")}</textarea>
      <button onclick="saveFollowup()">保存跟进</button>
    </div>
    <script>
      async function saveFollowup(){
        const res = await fetch('/api/admin/lead', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            report_id: ${JSON.stringify(report.report_id)},
            status: document.getElementById('leadStatus').value,
            assigned_to: document.getElementById('assignedTo').value,
            next_followup_at: document.getElementById('nextFollowup').value,
            note: document.getElementById('followupNote').value
          })
        });
        alert(res.ok ? '已保存' : '保存失败');
      }
    </script>
  </section>`;
}

function table(headers, rows) {
  return `<div class="dx-table-wrap"><table class="dx-table">
    <thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function li(item) {
  return `<li>${escapeHtml(item)}</li>`;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function text(value, max) {
  return String(value || "").trim().slice(0, max);
}

function list(value) {
  if (Array.isArray(value)) return value.map((item) => text(item, 80)).filter(Boolean);
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => text(item, 80))
    .filter(Boolean);
}

function dedupeBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

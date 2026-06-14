const state = {
  ip: "",
  country_code: "",
  country: "",
  city: "",
  asn: "",
  isp: "",
  webrtc_status: "",
  webrtc_ips: [],
  avg_latency_ms: 0,
  min_latency_ms: 0,
  max_latency_ms: 0,
  jitter_ms: 0,
  packet_loss_percent: 0,
  download_mbps: 0,
  upload_mbps: 0,
  recommended_bitrate: "",
  score: 0,
  rating: "",
  unlock_result_type: "",
  unlock_result_raw: "",
  unlock_result_json: "",
  unlock_summary: {},
  browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  browser_languages: (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).filter(Boolean).join(" / "),
  user_agent: navigator.userAgent
};

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const UNLOCK_FIELDS = [
  ["ip", "IP"],
  ["country", "国家/地区"],
  ["asn", "ASN"],
  ["organization", "组织"],
  ["ip_type", "IP 类型"],
  ["risk_level", "风险等级"],
  ["tiktok", "TikTok"],
  ["netflix", "Netflix"],
  ["youtube", "YouTube"],
  ["chatgpt", "ChatGPT"],
  ["blacklist_count", "黑名单数量"],
  ["port_25", "25端口状态"]
];

function setProgress(value, text) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  $("progressBar").style.width = `${pct}%`;
  $("progressBar").textContent = `${pct}%`;
  $("statusText").textContent = text;
}

function ms(value) {
  return `${value.toFixed(1)} ms`;
}

function mbps(value) {
  return `${value.toFixed(2)} Mbps`;
}

function isPrivateIp(ip) {
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;

  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254)
  );
}

async function getIpInfo() {
  setProgress(8, "正在识别出口 IP 和运营商...");
  const resp = await fetch("/api/ip", { cache: "no-store" });
  const data = await resp.json();
  Object.assign(state, data);
  $("ip").textContent = data.ip || "--";
  $("location").textContent = `国家 / 城市：${data.country || "--"} / ${data.city || "--"}`;
  $("asn").textContent = data.asn || "--";
  $("isp").textContent = data.isp || "--";
}

async function getWebRtcIps() {
  setProgress(24, "正在执行 WebRTC 泄露检测...");
  if (!window.RTCPeerConnection) return [];

  const ips = new Set();
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  const candidatePattern = /([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9:]{3,})/ig;
  pc.createDataChannel("check");
  pc.onicecandidate = (event) => {
    const candidate = event.candidate?.candidate || "";
    for (const match of candidate.matchAll(candidatePattern)) {
      const value = match[1];
      if (!value.includes(".local")) ips.add(value);
    }
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sleep(2600);
  } finally {
    pc.close();
  }

  return [...ips].filter((ip) => !ip.endsWith(":"));
}

async function runWebRtcTest() {
  const ips = await getWebRtcIps();
  const publicIps = ips.filter((ip) => !isPrivateIp(ip));
  state.webrtc_ips = publicIps;
  state.webrtc_status = publicIps.length ? "存在公网 IP 泄露" : "未发现公网 IP 泄露";
  $("webrtcStatus").textContent = state.webrtc_status;
  $("webrtcIps").textContent = publicIps.length ? publicIps.join(", ") : "未发现暴露 IP";
}

async function runLatencyTest() {
  setProgress(42, "正在测试 HTTP 延迟，连续请求 10 次...");
  const samples = [];
  let failures = 0;

  for (let i = 0; i < 10; i += 1) {
    const started = performance.now();
    try {
      const resp = await fetch(`/api/ping?t=${Date.now()}-${i}`, { cache: "no-store" });
      if (!resp.ok) throw new Error(`ping ${resp.status}`);
      samples.push(performance.now() - started);
    } catch (error) {
      failures += 1;
    }
    setProgress(42 + (i + 1) * 2, `正在测试 HTTP 延迟：${i + 1}/10`);
    await sleep(120);
  }

  state.packet_loss_percent = (failures / 10) * 100;
  if (samples.length) {
    const sum = samples.reduce((a, b) => a + b, 0);
    const diffs = samples.slice(1).map((value, index) => Math.abs(value - samples[index]));
    state.avg_latency_ms = sum / samples.length;
    state.min_latency_ms = Math.min(...samples);
    state.max_latency_ms = Math.max(...samples);
    state.jitter_ms = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  } else {
    state.avg_latency_ms = 0;
    state.min_latency_ms = 0;
    state.max_latency_ms = 0;
    state.jitter_ms = 0;
  }

  $("avgLatency").textContent = samples.length ? ms(state.avg_latency_ms) : "请求失败";
  $("latencyRange").textContent = samples.length ? `${ms(state.min_latency_ms)} / ${ms(state.max_latency_ms)}` : "--";
  $("jitter").textContent = samples.length ? ms(state.jitter_ms) : "--";
}

async function runDownloadTest() {
  setProgress(68, "正在测试下载速度...");
  const started = performance.now();
  const resp = await fetch(`/static/test.bin?t=${Date.now()}`, { cache: "no-store" });
  const blob = await resp.blob();
  const seconds = Math.max((performance.now() - started) / 1000, 0.001);
  state.download_mbps = (blob.size * 8) / seconds / 1_000_000;
  $("speed").textContent = `${mbps(state.download_mbps)} / --`;
}

async function runUploadTest() {
  setProgress(82, "正在测试上传速度...");
  const size = 4 * 1024 * 1024;
  const data = new Uint8Array(size);
  for (let offset = 0; offset < data.length; offset += 65536) {
    crypto.getRandomValues(data.subarray(offset, Math.min(offset + 65536, data.length)));
  }

  const started = performance.now();
  await fetch(`/api/upload-test?t=${Date.now()}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: data
  });
  const seconds = Math.max((performance.now() - started) / 1000, 0.001);
  state.upload_mbps = (size * 8) / seconds / 1_000_000;
  $("speed").textContent = `${mbps(state.download_mbps)} / ${mbps(state.upload_mbps)}`;
}

function calculateScore() {
  let score = 100;
  if (state.webrtc_ips.length) score -= 20;
  if (state.packet_loss_percent > 0) score -= Math.min(18, state.packet_loss_percent * 4);
  if (state.avg_latency_ms > 80) score -= Math.min(25, (state.avg_latency_ms - 80) / 8);
  if (state.jitter_ms > 15) score -= Math.min(20, (state.jitter_ms - 15) / 3);
  if (state.download_mbps < 20) score -= Math.min(20, (20 - state.download_mbps) * 0.8);
  if (state.upload_mbps < 8) score -= Math.min(20, (8 - state.upload_mbps) * 2);

  state.score = Math.max(0, Math.min(100, Math.round(score)));
  if (state.score >= 90) state.rating = "优秀";
  else if (state.score >= 75) state.rating = "良好";
  else if (state.score >= 60) state.rating = "一般";
  else state.rating = "较差";

  const stableUpload = state.upload_mbps * (state.jitter_ms > 25 ? 0.45 : state.jitter_ms > 12 ? 0.6 : 0.75);
  let bitrate = Math.max(1, Math.floor(stableUpload));
  if (state.avg_latency_ms > 180) bitrate = Math.min(bitrate, 4);
  state.recommended_bitrate = `${bitrate} Mbps`;

  $("scoreValue").textContent = state.score;
  $("ratingValue").textContent = state.rating;
  $("bitrate").textContent = state.recommended_bitrate;
}

async function saveResult() {
  setProgress(96, "正在保存检测结果...");
  const resp = await fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  const data = await resp.json();

  if (data.report_url) {
    $("reportLink").href = data.report_url;
    $("reportLink").classList.remove("disabled");
    $("reportLink").removeAttribute("aria-disabled");
  }
}

function setupUnlockTools() {
  const unlockPaste = $("unlockPaste");
  const saveUnlockReportBtn = $("saveUnlockReportBtn");

  document.querySelectorAll(".copy-command").forEach((button) => {
    button.addEventListener("click", async () => {
      const command = button.dataset.command || "";
      await navigator.clipboard.writeText(command);
      const oldText = button.textContent;
      button.textContent = "已复制";
      setTimeout(() => {
        button.textContent = oldText;
      }, 1400);
    });
  });

  if (!unlockPaste || !saveUnlockReportBtn) return;

  $("unlockPaste").addEventListener("input", () => {
    parseUnlockResult($("unlockPaste").value);
  });

  $("saveUnlockReportBtn").addEventListener("click", async () => {
    parseUnlockResult($("unlockPaste").value);
    if (!state.unlock_result_raw) {
      renderUnlockEmpty("请先粘贴本地解锁检测结果。");
      return;
    }
    $("saveUnlockReportBtn").disabled = true;
    $("saveUnlockReportBtn").textContent = "正在生成...";
    try {
      await saveResult();
      $("statusText").textContent = "解锁检测结果已保存，可以复制分享报告链接。";
    } finally {
      $("saveUnlockReportBtn").disabled = false;
      $("saveUnlockReportBtn").textContent = "生成分享报告";
    }
  });
}

function parseUnlockResult(rawValue) {
  const raw = String(rawValue || "").trim();
  state.unlock_result_raw = raw;

  if (!raw) {
    state.unlock_result_type = "";
    state.unlock_result_json = "";
    state.unlock_summary = {};
    renderUnlockEmpty("等待粘贴检测结果...");
    return;
  }

  const parsed = tryParseJson(raw);
  if (parsed.ok) {
    const summary = summarizeUnlockJson(parsed.value);
    state.unlock_result_type = "json";
    state.unlock_result_json = JSON.stringify(parsed.value);
    state.unlock_summary = summary;
    renderUnlockSummary(summary);
    return;
  }

  state.unlock_result_type = "text";
  state.unlock_result_json = "";
  state.unlock_summary = {};
  renderUnlockText(raw);
}

function tryParseJson(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return { ok: true, value: JSON.parse(raw.slice(start, end + 1)) };
      } catch {
        return { ok: false };
      }
    }
    return { ok: false };
  }
}

function summarizeUnlockJson(data) {
  const flat = flattenObject(data);
  const text = JSON.stringify(data).toLowerCase();
  return {
    ip: pick(flat, ["ip", "query", "address", "client_ip", "public_ip"]) || matchText(text, /\b(?:\d{1,3}\.){3}\d{1,3}\b/),
    country: pick(flat, ["country", "country_name", "region", "location.country", "ip.country"]),
    asn: pick(flat, ["asn", "as", "autonomous_system", "ip.asn"]),
    organization: pick(flat, ["org", "organization", "isp", "as_org", "asn_org", "company.name"]),
    ip_type: pick(flat, ["ip_type", "type", "usage_type", "proxy.type", "risk.type"]) || inferIpType(text),
    risk_level: pick(flat, ["risk", "risk_level", "threat.level", "fraud_score", "score"]) || inferRisk(text),
    tiktok: pickService(flat, text, ["tiktok", "tik_tok", "douyin"]),
    netflix: pickService(flat, text, ["netflix"]),
    youtube: pickService(flat, text, ["youtube", "google.youtube"]),
    chatgpt: pickService(flat, text, ["chatgpt", "openai", "chat_gpt"]),
    blacklist_count: pick(flat, ["blacklist", "blacklists", "blacklist_count", "security.blacklist_count"]) || inferBlacklist(text),
    port_25: pick(flat, ["port_25", "port25", "smtp", "smtp_port", "ports.25"]) || inferPort25(text)
  };
}

function flattenObject(value, prefix = "", output = {}) {
  if (value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenObject(item, `${prefix}${prefix ? "." : ""}${index}`, output));
    return output;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const next = `${prefix}${prefix ? "." : ""}${key}`;
      flattenObject(item, next, output);
    }
    return output;
  }
  output[prefix.toLowerCase()] = String(value);
  return output;
}

function pick(flat, keys) {
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (flat[lower]) return flat[lower];
  }
  for (const [key, value] of Object.entries(flat)) {
    if (keys.some((target) => key.endsWith(`.${target.toLowerCase()}`) || key.includes(target.toLowerCase()))) {
      return value;
    }
  }
  return "";
}

function pickService(flat, text, keys) {
  const direct = pick(flat, keys);
  if (direct) return normalizeUnlockValue(direct);
  const hit = keys.find((key) => text.includes(key.toLowerCase()));
  if (!hit) return "";
  const pattern = new RegExp(`${hit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]{0,12}(yes|no|unlock|unlocked|blocked|available|fail|failed|支持|解锁|不可|失败)`, "i");
  return normalizeUnlockValue(matchText(text, pattern));
}

function normalizeUnlockValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(true|yes|ok|unlock|unlocked|available|支持|解锁)$/i.test(text)) return "支持 / 可解锁";
  if (/^(false|no|blocked|fail|failed|不可|失败)$/i.test(text)) return "不支持 / 未解锁";
  return text;
}

function matchText(text, regex) {
  const match = text.match(regex);
  return match ? match[1] || match[0] : "";
}

function inferIpType(text) {
  if (/residential|住宅|家宽/.test(text)) return "住宅 / 家宽";
  if (/datacenter|hosting|机房|数据中心|cloud/.test(text)) return "机房 / 数据中心";
  if (/mobile|cellular|移动/.test(text)) return "移动网络";
  return "";
}

function inferRisk(text) {
  if (/high risk|高风险|danger|risky/.test(text)) return "高";
  if (/medium risk|中风险|warning/.test(text)) return "中";
  if (/low risk|低风险|clean/.test(text)) return "低";
  return "";
}

function inferBlacklist(text) {
  const match = text.match(/blacklist[^0-9]{0,20}(\d+)/i) || text.match(/黑名单[^0-9]{0,20}(\d+)/);
  return match ? match[1] : "";
}

function inferPort25(text) {
  if (/25[^a-z0-9]{0,12}(open|开放|通)/i.test(text)) return "开放";
  if (/25[^a-z0-9]{0,12}(closed|blocked|关闭|阻断|封锁)/i.test(text)) return "关闭 / 阻断";
  return "";
}

function renderUnlockSummary(summary) {
  const rows = UNLOCK_FIELDS.map(([key, label]) => `
    <div class="unlock-result-row">
      <span>${label}</span>
      <strong>${escapeHtml(summary[key] || "未识别")}</strong>
    </div>
  `).join("");
  $("unlockPreview").innerHTML = `
    <div class="unlock-preview-head">
      <strong>已识别 JSON 检测结果</strong>
      <span>请确认结果无误后生成分享报告</span>
    </div>
    <div class="unlock-result-grid">${rows}</div>
  `;
}

function renderUnlockText(raw) {
  $("unlockPreview").innerHTML = `
    <div class="unlock-preview-head">
      <strong>已作为纯文本报告保存</strong>
      <span>没有识别到标准 JSON，会在报告中展示原始文本。</span>
    </div>
    <pre class="unlock-text-preview">${escapeHtml(raw.slice(0, 3000))}</pre>
  `;
}

function renderUnlockEmpty(message) {
  $("unlockPreview").innerHTML = `<div class="text-soft">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function runAll() {
  $("rerunBtn").disabled = true;
  $("reportLink").classList.add("disabled");
  $("reportLink").setAttribute("aria-disabled", "true");

  try {
    setProgress(0, "准备开始检测...");
    await getIpInfo();
    await runWebRtcTest();
    await runLatencyTest();
    await runDownloadTest();
    await runUploadTest();
    calculateScore();
    await saveResult();
    setProgress(100, "检测完成，可以查看或发送报告链接。");
  } catch (error) {
    console.error(error);
    setProgress(100, "检测过程中出现异常，请稍后重新检测。");
  } finally {
    $("rerunBtn").disabled = false;
  }
}

$("rerunBtn").addEventListener("click", runAll);
setupUnlockTools();
window.addEventListener("load", runAll);

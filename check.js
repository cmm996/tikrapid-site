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
  browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  browser_languages: (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).filter(Boolean).join(" / "),
  user_agent: navigator.userAgent
};

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
window.addEventListener("load", runAll);

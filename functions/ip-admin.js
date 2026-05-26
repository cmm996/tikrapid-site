import { requireAdmin } from "./_ip-utils.js";

const PAGE = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IP 管理后台 - tikrapid</title>
<style>
*{box-sizing:border-box}
:root{font-family:Inter,Arial,"Microsoft YaHei",sans-serif;color:#18212f;background:#f5f7fb}
body{margin:0;min-height:100vh;background:#f5f7fb}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:22px clamp(16px,5vw,46px);background:#fff;border-bottom:1px solid #dde5ef}
.brand{display:flex;flex-direction:column;gap:5px}
.brand small{color:#64748b;font-weight:800;text-transform:uppercase}
h1,h2{margin:0;letter-spacing:0}
h1{font-size:clamp(26px,4vw,36px)}
h2{font-size:18px}
.top-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.layout{width:min(1220px,calc(100% - 32px));margin:22px auto 48px;display:grid;gap:18px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.stat,.panel{background:#fff;border:1px solid #dde5ef;border-radius:8px;box-shadow:0 12px 34px rgba(20,33,51,.06)}
.stat{padding:17px}
.stat span{display:block;color:#64748b;font-size:13px;font-weight:800}
.stat strong{display:block;margin-top:6px;font-size:29px}
.panel{padding:20px}
.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
.grid-form{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr auto;gap:12px;align-items:end}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
label{display:grid;gap:7px;color:#475569;font-size:13px;font-weight:800}
input,select,textarea{width:100%;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#18212f;padding:10px 11px;outline:none}
input:focus,select:focus,textarea:focus{border-color:#147d64;box-shadow:0 0 0 3px rgba(20,125,100,.16)}
button,.button{border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#18212f;min-height:40px;padding:9px 13px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;white-space:nowrap;font-weight:800}
button:disabled{opacity:.58;cursor:not-allowed}
.primary{background:#147d64;border-color:#147d64;color:#fff}
.danger{background:#fff7f7;border-color:#fecaca;color:#a12626}
.muted-button{background:#f8fafc}
.small{min-height:34px;padding:7px 10px;font-size:13px}
.alert{display:none;border-radius:6px;padding:12px 14px;font-weight:800}
.alert.show{display:block}
.alert.success{background:#ecfdf5;color:#05603a;border:1px solid #b7ebd0}
.alert.error{background:#fff1f2;color:#a12626;border:1px solid #fecdd3}
.table-wrap{overflow-x:auto}
table{width:100%;min-width:1080px;border-collapse:collapse}
th,td{border-top:1px solid #edf1f5;padding:10px;text-align:left;vertical-align:middle;font-size:14px}
th{color:#64748b;font-size:12px;text-transform:uppercase}
td input{min-width:140px}
.pill{display:inline-flex;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900}
.pill.on{background:#e8faf2;color:#067647}
.pill.off{background:#eef2f6;color:#52606d}
.pill.expired{background:#fff1f2;color:#a12626}
.pill.soon{background:#fffbeb;color:#a16207}
.expires-cell{display:grid;gap:6px}
.days-left{color:#64748b;font-size:12px;font-weight:800}
.days-left.expired{color:#a12626}
.days-left.soon{color:#a16207}
.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.check{display:inline-flex;align-items:center;gap:6px}
.check input{width:auto}
.empty{text-align:center;color:#64748b;padding:28px}
.token-box{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.token-box input{width:240px}
@media(max-width:900px){
  .topbar{align-items:flex-start;flex-direction:column}
  .stats,.grid-form{grid-template-columns:1fr}
  .section-head{align-items:flex-start;flex-direction:column}
}
</style>
</head>
<body>
<header class="topbar">
  <div class="brand">
    <small>go.tikrapid.top</small>
    <h1>IP 管理后台</h1>
  </div>
  <div class="top-actions">
    <a class="button muted-button" href="/admin.html">工单后台</a>
    <div class="token-box">
      <input id="adminToken" type="password" placeholder="ADMIN_TOKEN，可选">
      <button class="muted-button" type="button" onclick="saveToken()">保存密钥</button>
    </div>
  </div>
</header>

<main class="layout">
  <div id="notice" class="alert"></div>

  <section class="stats">
    <div class="stat"><span>全部</span><strong id="totalCount">0</strong></div>
    <div class="stat"><span>有效</span><strong id="enabledCount">0</strong></div>
    <div class="stat"><span>停用</span><strong id="disabledCount">0</strong></div>
    <div class="stat"><span>已到期</span><strong id="expiredCount">0</strong></div>
  </section>

  <section class="panel">
    <h2>添加客户 IP</h2>
    <form class="grid-form" id="createForm">
      <label>IP / CIDR<input name="address" placeholder="1.2.3.4 或 1.2.3.0/24" required></label>
      <label>客户 / 标签<input name="label" placeholder="客户名、节点、用途"></label>
      <label>到期时间<input name="expires_at" type="date"></label>
      <label>备注<input name="note" placeholder="套餐、联系方式、订单号"></label>
      <button class="primary" id="createButton" type="submit">添加</button>
    </form>
  </section>

  <section class="panel">
    <div class="section-head">
      <h2>客户 IP 列表</h2>
      <div class="toolbar">
        <input id="search" placeholder="搜索 IP、客户、备注">
        <select id="status">
          <option value="">全部状态</option>
          <option value="enabled">启用</option>
          <option value="disabled">停用</option>
          <option value="expired">已到期</option>
        </select>
        <button class="primary" type="button" onclick="loadIPs()">搜索</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>状态</th>
            <th>IP / CIDR</th>
            <th>客户 / 标签</th>
            <th>到期时间 / 剩余</th>
            <th>备注</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="ipBody">
          <tr><td colspan="7" class="empty">加载中...</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</main>

<script>
let currentIPs = [];

const tokenInput = document.getElementById("adminToken");
tokenInput.value = localStorage.getItem("tikrapid_admin_token") || "";

function saveToken(){
  localStorage.setItem("tikrapid_admin_token", tokenInput.value.trim());
  showNotice("密钥已保存", "success");
  loadIPs();
}

function headers(){
  const token = localStorage.getItem("tikrapid_admin_token") || "";
  const h = {"Content-Type":"application/json"};
  if(token) h["x-admin-token"] = token;
  return h;
}

async function requestJSON(url, options = {}){
  const res = await fetch(url, {
    ...options,
    headers: {...headers(), ...(options.headers || {})}
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function loadIPs(){
  const url = new URL("/api/admin/ips", location.origin);
  const q = document.getElementById("search").value.trim();
  const status = document.getElementById("status").value;
  if(q) url.searchParams.set("q", q);
  if(status) url.searchParams.set("status", status);

  try{
    const data = await requestJSON(url);
    currentIPs = data.ips || [];
    renderStats(currentIPs);
    renderTable(currentIPs);
  }catch(err){
    showNotice(err.message === "unauthorized" ? "请填写正确的 ADMIN_TOKEN" : err.message, "error");
  }
}

document.getElementById("createForm").addEventListener("submit", async (event)=>{
  event.preventDefault();
  const formEl = event.currentTarget;
  const form = new FormData(formEl);
  const button = document.getElementById("createButton");
  button.disabled = true;
  try{
    await requestJSON("/api/admin/ips", {
      method:"POST",
      body:JSON.stringify(Object.fromEntries(form.entries()))
    });
    formEl.reset();
    document.getElementById("search").value = "";
    document.getElementById("status").value = "";
    await loadIPs();
    showNotice("IP 已添加", "success");
  }catch(err){
    showNotice(err.message, "error");
  }finally{
    button.disabled = false;
  }
});

function renderStats(ips){
  const expired = ips.filter(item=>isExpired(item.expires_at)).length;
  const active = ips.filter(item=>Number(item.enabled) === 1 && !isExpired(item.expires_at)).length;
  const disabled = ips.filter(item=>Number(item.enabled) !== 1).length;
  document.getElementById("totalCount").textContent = ips.length;
  document.getElementById("enabledCount").textContent = active;
  document.getElementById("disabledCount").textContent = disabled;
  document.getElementById("expiredCount").textContent = expired;
}

function renderTable(ips){
  const body = document.getElementById("ipBody");
  body.innerHTML = "";
  if(!ips.length){
    body.innerHTML = '<tr><td colspan="7" class="empty">还没有 IP 记录</td></tr>';
    return;
  }

  for(const item of ips){
    const enabled = Number(item.enabled) === 1;
    const expired = isExpired(item.expires_at);
    const soon = !expired && isExpiringSoon(item.expires_at);
    const status = expired
      ? '<span class="pill expired">已到期</span>'
      : enabled
        ? (soon ? '<span class="pill soon">快到期</span>' : '<span class="pill on">启用</span>')
        : '<span class="pill off">停用</span>';

    body.innerHTML +=
      '<tr>' +
        '<td>' + status + '</td>' +
        '<td><input id="address-' + item.id + '" value="' + escapeHtml(item.address) + '"></td>' +
        '<td><input id="label-' + item.id + '" value="' + escapeHtml(item.label || "") + '"></td>' +
        '<td><div class="expires-cell"><input id="expires-' + item.id + '" type="date" value="' + escapeHtml(item.expires_at || "") + '">' + daysLeftHTML(item.expires_at) + '</div></td>' +
        '<td><input id="note-' + item.id + '" value="' + escapeHtml(item.note || "") + '"></td>' +
        '<td>' + escapeHtml(item.updated_at || "-") + '</td>' +
        '<td>' +
          '<div class="actions">' +
            '<label class="check"><input id="enabled-' + item.id + '" type="checkbox" ' + (enabled ? "checked" : "") + '>启用</label>' +
            '<button class="small primary" type="button" onclick="updateIP(' + item.id + ')">保存</button>' +
            '<button class="small muted-button" type="button" onclick="renewIP(' + item.id + ',1)">续 1 月</button>' +
            '<button class="small muted-button" type="button" onclick="renewIP(' + item.id + ',3)">续 1 季</button>' +
            '<button class="small muted-button" type="button" onclick="renewIP(' + item.id + ',6)">续半年</button>' +
            '<button class="small muted-button" type="button" onclick="renewIP(' + item.id + ',12)">续 1 年</button>' +
            '<button class="small muted-button" type="button" onclick="toggleIP(' + item.id + ')">' + (enabled ? "停用" : "启用") + '</button>' +
            '<button class="small danger" type="button" onclick="deleteIP(' + item.id + ')">删除</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
  }
}

async function updateIP(id){
  try{
    await requestJSON("/api/admin/ip", {
      method:"POST",
      body:JSON.stringify({
        id,
        action:"update",
        address:document.getElementById("address-" + id).value,
        label:document.getElementById("label-" + id).value,
        expires_at:document.getElementById("expires-" + id).value,
        note:document.getElementById("note-" + id).value,
        enabled:document.getElementById("enabled-" + id).checked
      })
    });
    await loadIPs();
    showNotice("IP 已更新", "success");
  }catch(err){
    showNotice(err.message, "error");
  }
}

async function toggleIP(id){
  await mutateIP({id, action:"toggle"}, "状态已切换");
}

async function renewIP(id, months){
  const label = months === 1 ? "1 个月" : months === 3 ? "1 个季度" : months === 6 ? "半年" : "1 年";
  await mutateIP({id, action:"renew", months}, "已续费 " + label);
}

async function deleteIP(id){
  if(!confirm("确认删除这条 IP 记录？")) return;
  await mutateIP({id, action:"delete"}, "IP 已删除");
}

async function mutateIP(payload, message){
  try{
    await requestJSON("/api/admin/ip", {method:"POST", body:JSON.stringify(payload)});
    await loadIPs();
    showNotice(message, "success");
  }catch(err){
    showNotice(err.message, "error");
  }
}

function isExpired(value){
  return Boolean(value) && value < todayISO();
}

function isExpiringSoon(value){
  if(!value) return false;
  const today = new Date(todayISO() + "T00:00:00");
  const expires = new Date(value + "T00:00:00");
  return expires >= today && (expires - today) / 86400000 <= 7;
}

function daysLeftHTML(value){
  if(!value) return '<span class="days-left">长期有效</span>';
  const today = new Date(todayISO() + "T00:00:00");
  const expires = new Date(value + "T00:00:00");
  const days = Math.ceil((expires - today) / 86400000);
  if(days < 0) return '<span class="days-left expired">已到期 ' + Math.abs(days) + ' 天</span>';
  if(days === 0) return '<span class="days-left soon">今天到期</span>';
  if(days <= 7) return '<span class="days-left soon">剩余 ' + days + ' 天</span>';
  return '<span class="days-left">剩余 ' + days + ' 天</span>';
}

function todayISO(){
  return new Date().toISOString().slice(0,10);
}

function showNotice(message, type){
  const el = document.getElementById("notice");
  el.textContent = message;
  el.className = "alert " + type + " show";
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

loadIPs();
</script>
</body>
</html>`;

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context.request, context.env, { basic: true });
  if (unauthorized) return unauthorized;

  return new Response(PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

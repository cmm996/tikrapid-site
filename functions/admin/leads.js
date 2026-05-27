import { requireAdmin } from "../_ip-utils.js";

export async function onRequestGet({ request, env }) {
  const auth = requireAdmin(request, env, { basic: true });
  if (auth) return auth;

  return new Response(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>出海诊断线索后台 - tikrapid</title>
  <link href="/diagnosis.css" rel="stylesheet">
</head>
<body>
  <main class="dx-shell">
    <section class="dx-cover">
      <div>
        <p class="dx-kicker">TikRapid Admin</p>
        <h1>出海诊断线索后台</h1>
        <p class="dx-muted">查看诊断报告、客户阶段、预算和跟进状态。</p>
      </div>
      <div class="dx-score dx-score-static"><span id="leadCount">0</span><strong>线索</strong><small>最近 200 条</small></div>
    </section>

    <section class="dx-panel">
      <div class="dx-admin-form">
        <input id="q" placeholder="搜索报告编号 / 联系方式 / 业务">
        <select id="status">
          <option value="">全部状态</option>
          <option value="new">新线索</option>
          <option value="contacted">已联系</option>
          <option value="qualified">有效线索</option>
          <option value="closed">已成交/关闭</option>
        </select>
        <button onclick="loadLeads()">刷新</button>
      </div>
    </section>

    <section class="dx-panel">
      <div class="dx-table-wrap">
        <table class="dx-table">
          <thead>
            <tr>
              <th>报告编号</th><th>客户</th><th>联系方式</th><th>类型</th><th>市场</th><th>目标</th><th>评分</th><th>状态</th><th>时间</th><th>操作</th>
            </tr>
          </thead>
          <tbody id="leadBody"><tr><td colspan="10">加载中...</td></tr></tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    async function loadLeads(){
      const url = new URL('/api/admin/leads', location.origin);
      const q = document.getElementById('q').value.trim();
      const status = document.getElementById('status').value;
      if(q) url.searchParams.set('q', q);
      if(status) url.searchParams.set('status', status);
      const res = await fetch(url);
      const data = await res.json();
      const leads = data.leads || [];
      document.getElementById('leadCount').textContent = leads.length;
      document.getElementById('leadBody').innerHTML = leads.length ? leads.map(row).join('') : '<tr><td colspan="10">暂无线索</td></tr>';
    }

    function row(item){
      return '<tr>' +
        '<td>' + esc(item.report_id) + '</td>' +
        '<td>' + esc(item.name || '-') + '</td>' +
        '<td>' + esc(item.contact || '-') + '</td>' +
        '<td>' + esc(item.business_type || '-') + '</td>' +
        '<td>' + esc(item.target_market || '-') + '</td>' +
        '<td>' + esc(item.business_goal || '-') + '</td>' +
        '<td>' + esc(item.total_score || '-') + '</td>' +
        '<td>' + esc(item.status || 'new') + '</td>' +
        '<td>' + esc(item.created_at || '-') + '</td>' +
        '<td><a href="/admin/report/' + encodeURIComponent(item.report_id) + '">查看</a></td>' +
      '</tr>';
    }

    function esc(value){
      return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
    }

    loadLeads();
  </script>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const q = url.searchParams.get("q") || "";
  const status = url.searchParams.get("status") || "";

  let sql = `
    SELECT id, wechat, type, region, message, status, created_at
    FROM tickets
  `;

  const where = [];
  const params = [];

  if (q) {
    where.push(`(wechat LIKE ? OR region LIKE ? OR message LIKE ? OR type LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (status) {
    where.push(`status = ?`);
    params.push(status);
  }

  if (where.length) {
    sql += ` WHERE ` + where.join(" AND ");
  }

  sql += ` ORDER BY id DESC LIMIT 100`;

  const result = await env.DB.prepare(sql).bind(...params).all();

  return Response.json({
    tickets: result.results || []
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const data = await request.json();

  if (!data.id || !data.action) {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  if (data.action === "close") {
    await env.DB.prepare(
      "UPDATE tickets SET status = 'closed' WHERE id = ?"
    ).bind(data.id).run();
  }

  if (data.action === "open") {
    await env.DB.prepare(
      "UPDATE tickets SET status = 'open' WHERE id = ?"
    ).bind(data.id).run();
  }

  if (data.action === "delete") {
    await env.DB.prepare(
      "DELETE FROM tickets WHERE id = ?"
    ).bind(data.id).run();
  }

  return Response.json({ success: true });
}

export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // API
    if (url.pathname === "/api/tickets") {

      return Response.json({
        ok: true,
        message: "tickets api working"
      });

    }

    // 首页
    return env.ASSETS.fetch(request);
  }
}

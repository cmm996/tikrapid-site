export async function onRequestPost(context) {

  const { request, env } = context;

  try {

    const data = await request.json();

    if (
      !data.wechat ||
      !data.type ||
      !data.message
    ) {

      return Response.json({
        error: "missing fields"
      }, {
        status: 400
      });

    }

    await env.DB
      .prepare(`
        INSERT INTO tickets
        (
          wechat,
          type,
          region,
          message
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        data.wechat,
        data.type,
        data.region || "",
        data.message
      )
      .run();

    return Response.json({
      success: true
    });

  } catch(err) {

    return Response.json({
      error: err.message
    }, {
      status: 500
    });

  }

}

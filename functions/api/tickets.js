export async function onRequestPost(context) {

  const { request, env } = context;

  try {

    const data = await request.json();

    // 参数校验
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

    // 写入数据库
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

    // Telegram 通知
    try {

      await fetch(
        `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({

            chat_id: env.TG_CHAT_ID,

            text:
`📩 新工单通知

👤 微信：
${data.wechat}

📌 类型：
${data.type}

🌍 地区：
${data.region || "-"}

📝 内容：
${data.message}

⏰ 时间：
${new Date().toLocaleString("zh-CN")}`

          })

        }
      );

    } catch (tgErr) {

      console.log(
        "Telegram notify failed:",
        tgErr.message
      );

    }

    // 返回成功
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

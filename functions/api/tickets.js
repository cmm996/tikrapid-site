export async function onRequest() {
  return Response.json({
    ok: true,
    message: "tickets api is working"
  });
}

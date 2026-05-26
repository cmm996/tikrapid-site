import { json } from "../_check-utils.js";

export async function onRequestPost({ request }) {
  const started = Date.now();
  let bytes = 0;

  if (request.body) {
    const reader = request.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
    }
  }

  return json({
    ok: true,
    bytes,
    server_ms: Date.now() - started,
  });
}

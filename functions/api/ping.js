import { json } from "../_check-utils.js";

export async function onRequestGet() {
  return json({
    ok: true,
    server_time: Date.now(),
  });
}

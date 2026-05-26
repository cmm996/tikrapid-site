const TEST_SIZE = 10 * 1024 * 1024;
const CHUNK_SIZE = 256 * 1024;

export async function onRequestGet() {
  const body = new ReadableStream({
    start(controller) {
      let sent = 0;

      while (sent < TEST_SIZE) {
        const size = Math.min(CHUNK_SIZE, TEST_SIZE - sent);
        const chunk = new Uint8Array(size);
        for (let i = 0; i < size; i += 1) {
          chunk[i] = (sent + i) % 251;
        }
        controller.enqueue(chunk);
        sent += size;
      }

      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(TEST_SIZE),
      "Cache-Control": "no-store",
    },
  });
}

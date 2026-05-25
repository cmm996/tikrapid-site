export function adminHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: adminHeaders(),
  });
}

export function requireAdmin(request, env, options = {}) {
  if (!env.ADMIN_TOKEN) return null;

  const authorization = request.headers.get("authorization") || "";
  const headerToken =
    request.headers.get("x-admin-token") ||
    authorization.replace(/^Bearer\s+/i, "") ||
    "";

  if (headerToken === env.ADMIN_TOKEN) return null;
  if (basicPassword(authorization) === env.ADMIN_TOKEN) return null;

  if (options.basic) {
    return new Response("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="tikrapid IP Admin"',
        "Cache-Control": "no-store",
      },
    });
  }

  return json({ error: "unauthorized" }, 401);
}

function basicPassword(authorization) {
  if (!authorization.toLowerCase().startsWith("basic ")) return "";

  try {
    const decoded = atob(authorization.slice(6).trim());
    const index = decoded.indexOf(":");
    return index >= 0 ? decoded.slice(index + 1) : decoded;
  } catch {
    return "";
  }
}

export async function ensureIpTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ip_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

export function normalizeRule(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("IP or CIDR is required");

  const [ipText, prefixText] = input.split("/");
  const version = ipText.includes(":") ? 6 : 4;
  const ipValue = parseIP(ipText);

  if (!ipValue || ipValue.version !== version) {
    throw new Error("Invalid IP address");
  }

  if (prefixText === undefined) {
    return canonicalIP(ipValue);
  }

  if (!/^\d+$/.test(prefixText)) {
    throw new Error("Invalid CIDR prefix");
  }

  const maxPrefix = version === 4 ? 32 : 128;
  const prefix = Number(prefixText);
  if (prefix < 0 || prefix > maxPrefix) {
    throw new Error("Invalid CIDR prefix");
  }

  const network = maskIP(ipValue.value, prefix, maxPrefix);
  return `${canonicalIP({ version, value: network })}/${prefix}`;
}

export function clientIP(request) {
  for (const header of ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const value = request.headers.get(header);
    if (!value) continue;
    const ip = value.split(",")[0].trim();
    if (parseIP(ip)) return ip;
  }
  return "";
}

export function ruleMatches(ruleAddress, ipText) {
  const ip = parseIP(ipText);
  if (!ip) return false;

  const [ruleIPText, prefixText] = String(ruleAddress || "").split("/");
  const ruleIP = parseIP(ruleIPText);
  if (!ruleIP || ruleIP.version !== ip.version) return false;

  if (prefixText === undefined) {
    return ruleIP.value === ip.value;
  }

  const maxPrefix = ip.version === 4 ? 32 : 128;
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
    return false;
  }

  return maskIP(ruleIP.value, prefix, maxPrefix) === maskIP(ip.value, prefix, maxPrefix);
}

function parseIP(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  if (value.includes(":")) return parseIPv6(value);
  return parseIPv4(value);
}

function parseIPv4(text) {
  const parts = text.split(".");
  if (parts.length !== 4) return null;

  let value = 0n;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    value = (value << 8n) + BigInt(n);
  }

  return { version: 4, value };
}

function parseIPv6(text) {
  const lower = text.toLowerCase();
  if (lower.includes(".")) return null;

  const halves = lower.split("::");
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (left.some((p) => p === "") || right.some((p) => p === "")) return null;

  const missing = 8 - left.length - right.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing < 1) return null;

  const groups = [...left, ...Array(Math.max(missing, 0)).fill("0"), ...right];
  if (groups.length !== 8) return null;

  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << 16n) + BigInt(parseInt(group, 16));
  }

  return { version: 6, value };
}

function canonicalIP(ip) {
  if (ip.version === 4) {
    const parts = [];
    for (let shift = 24n; shift >= 0n; shift -= 8n) {
      parts.push(Number((ip.value >> shift) & 255n));
    }
    return parts.join(".");
  }

  const groups = [];
  for (let shift = 112n; shift >= 0n; shift -= 16n) {
    groups.push(Number((ip.value >> shift) & 65535n).toString(16));
  }
  return compressIPv6(groups);
}

function compressIPv6(groups) {
  let bestStart = -1;
  let bestLen = 0;
  let currentStart = -1;
  let currentLen = 0;

  for (let i = 0; i <= groups.length; i++) {
    if (groups[i] === "0") {
      if (currentStart === -1) currentStart = i;
      currentLen++;
      continue;
    }
    if (currentLen > bestLen && currentLen > 1) {
      bestStart = currentStart;
      bestLen = currentLen;
    }
    currentStart = -1;
    currentLen = 0;
  }

  if (bestStart === -1) return groups.join(":");

  const before = groups.slice(0, bestStart).join(":");
  const after = groups.slice(bestStart + bestLen).join(":");
  if (!before && !after) return "::";
  if (!before) return `::${after}`;
  if (!after) return `${before}::`;
  return `${before}::${after}`;
}

function maskIP(value, prefix, bits) {
  if (prefix === 0) return 0n;
  const hostBits = BigInt(bits - prefix);
  return (value >> hostBits) << hostBits;
}

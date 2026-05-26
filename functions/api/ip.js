import { clientIP, countryName, json } from "../_check-utils.js";

export async function onRequestGet({ request }) {
  const cf = request.cf || {};
  const ip = clientIP(request);
  const asn = cf.asn ? `AS${cf.asn}` : "未知";

  return json({
    ip,
    country: countryName(cf.country),
    city: cf.city || "未知",
    asn,
    isp: cf.asOrganization || "未知",
    colo: cf.colo || "",
  });
}

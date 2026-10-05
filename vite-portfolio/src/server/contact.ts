import { createHmac } from "node:crypto";
import { emptyFields, escapeHtml, formMarkup, type ContactFields } from "../contactMarkup.ts";

export interface ContactServices {
  hash(value: string): string;
  reserve(id: string, ip: string, email: string): Promise<"reserved" | "sent" | "busy" | "limited">;
  complete(id: string): Promise<void>;
  release(id: string): Promise<void>;
  send(fields: ContactFields, id: string): Promise<void>;
}
const maxBody = 65_536;
function result(request: Request, status: number, message: string, fields = emptyFields, sent = false) {
  const fragment = `<p>${escapeHtml(message)}</p>${sent ? "" : '<p>Alternativ: <a href="mailto:codecraftingpro@gmail.com">direkt per E-Mail schreiben</a>.</p>'}`;
  const partial = request.headers.get("HX-Request") === "true";
  const body = partial ? fragment : `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Kontakt – Stefan Dukic</title><style>body{max-width:36rem;margin:8vh auto;padding:1rem;font:1rem/1.6 system-ui;background:#032737;color:#f0f2e6}a{color:#edc59c}form{display:grid;gap:1rem}.contact-field{display:grid;gap:.4rem}input,textarea,button{box-sizing:border-box;font:inherit;padding:.6rem;max-width:100%}.contact-honeypot,.htmx-indicator{display:none}.contact-privacy{font-size:.8rem}</style><main><h1>${sent ? "Danke für deine Nachricht." : "Nachricht noch nicht versendet."}</h1><div role="status">${fragment}</div>${sent ? "" : formMarkup(fields)}<p><a href="/">Zurück zur Website</a></p></main></html>`;
  return new Response(body, { status, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Vary": "HX-Request",
    "X-Content-Type-Options": "nosniff", "X-Contact-Response": "1", "X-Contact-Sent": sent ? "1" : "0",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...(status === 429 ? { "Retry-After": "60" } : {}),
  } });
}
async function readBody(request: Request) {
  if (Number(request.headers.get("Content-Length")) > maxBody) throw new Error("size");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBody) { await reader.cancel(); throw new Error("size"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
export async function handleContact(request: Request, services: ContactServices | null, clientIp: string) {
  const origin = new URL(request.url).origin;
  let source = request.headers.get("Origin");
  if (!source && request.headers.get("Referer")) {
    try { source = new URL(request.headers.get("Referer")!).origin; } catch { /* Invalid provenance is rejected. */ }
  }
  if (source !== origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return result(request, 403, "Bitte öffne das Formular auf meiner Website und versuche es dort erneut.");
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") return result(request, 415, "Das Formularformat wird nicht unterstützt.");
  let params: URLSearchParams;
  try { params = new URLSearchParams(await readBody(request)); }
  catch { return result(request, 413, "Die Nachricht ist zu gross. Bitte kürze sie auf höchstens 5000 Zeichen."); }
  const fields = { ...emptyFields };
  for (const key of Object.keys(fields) as (keyof ContactFields)[]) {
    if (params.getAll(key).length > 1) return result(request, 400, "Ein Formularfeld wurde mehrfach übertragen.");
    fields[key] = (params.get(key) ?? "").trim();
  }
  // Native HTML forms encode textarea newlines as CRLF; HTMX can send LF.
  // Normalize before validation, hashing and delivery so retries remain identical.
  fields.message = fields.message.replace(/\r\n?/g, "\n");
  // Silently discard bot submissions. Never call the provider or create a relay.
  if (fields.website) return result(request, 200, "Danke für deine Anfrage.");
  /* eslint-disable no-control-regex -- explicitly reject control bytes in visitor input */
  const emailValid = /^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/.test(fields.email);
  if (!fields.name || fields.name.length > 100 || /[\x00-\x1f\x7f]/.test(fields.name) || !emailValid || fields.email.length > 254 || fields.message.length < 10 || fields.message.length > 5000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(fields.message)) {
    // The response is escaped and values are bounded even on a malformed POST.
    fields.name = fields.name.slice(0, 100); fields.email = fields.email.slice(0, 254); fields.message = fields.message.slice(0, 5000);
    return result(request, 422, "Bitte prüfe Name, E-Mail-Adresse und Nachricht (10–5000 Zeichen).", fields);
  }
  if (!services) return result(request, 503, "Der Formularversand ist momentan nicht verfügbar. Deine Nachricht wurde nicht versendet.", fields);
  const id = services.hash(JSON.stringify([fields.name, fields.email, fields.message]));
  let reserved = false;
  try {
    const reservation = await services.reserve(id, services.hash(`ip:${clientIp}`), services.hash(`email:${fields.email.toLowerCase()}`));
    if (reservation === "sent") return result(request, 200, "Diese Nachricht wurde bereits zum Versand angenommen. Du brauchst sie nicht nochmals zu senden.", fields, true);
    if (reservation !== "reserved") return result(request, 429, reservation === "busy" ? "Diese Nachricht wird gerade verarbeitet. Bitte warte kurz, bevor du es erneut versuchst." : "Es wurden gerade zu viele Nachrichten angefragt. Bitte versuche es später erneut.", fields);
    reserved = true;
    await services.send(fields, id);
    // A state-store outage after provider acceptance must not turn success into a retry loop.
    await services.complete(id).catch(() => {
      console.error("Contact delivery accepted but completion state could not be saved.");
    });
    return result(request, 200, "Deine Nachricht wurde zum Versand angenommen. Danke, dass du dich meldest!", fields, true);
  } catch {
    if (reserved) await services.release(id).catch(() => {});
    return result(request, 503, "Der Versand konnte nicht bestätigt werden. Bitte versuche es später erneut. Doppelte Übertragungen werden abgefangen.", fields);
  }
}

// Atomic, shared limits across all serverless instances. Only HMAC hashes and counts
// are retained, never IP addresses, email addresses or message content.
export const reserveScript = `
local sent = redis.call('GET', KEYS[1])
if sent == 'sent' then return 'sent' end
if sent then return 'busy' end
for i = 2, 4 do
  local limit = i == 4 and 30 or 3
  if tonumber(redis.call('GET', KEYS[i]) or '0') >= limit then return 'limited' end
end
for i = 2, 4 do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], 3600) end
end
redis.call('SET', KEYS[1], 'sending', 'EX', 60)
return 'reserved'`;

export function createServices(env: Record<string, string | undefined>, fetcher: typeof fetch = fetch): ContactServices | null {
  const { RESEND_API_KEY, CONTACT_FROM, CONTACT_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = env;
  if (!RESEND_API_KEY || !CONTACT_FROM || /[\r\n]/.test(CONTACT_FROM) || !CONTACT_SECRET || CONTACT_SECRET.length < 32 || !UPSTASH_REDIS_REST_URL?.startsWith("https://") || !UPSTASH_REDIS_REST_TOKEN) return null;
  const prefix = `portfolio-contact:${env.VERCEL_ENV === "production" ? "production" : "preview"}:`;
  async function redis(command: (string | number)[]) {
    const response = await fetcher(UPSTASH_REDIS_REST_URL!, { method: "POST", headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(command), signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("state unavailable");
    const data = await response.json() as { result?: unknown; error?: unknown };
    if (data.error || !("result" in data)) throw new Error("state unavailable");
    return data.result;
  }
  return {
    hash: value => createHmac("sha256", CONTACT_SECRET).update(value).digest("hex"),
    async reserve(id, ip, email) {
      const response = await redis(["EVAL", reserveScript, 4, prefix + id, prefix + ip, prefix + email, prefix + "all"]);
      if (!["reserved", "sent", "busy", "limited"].includes(String(response))) throw new Error("invalid reservation");
      return response as "reserved" | "sent" | "busy" | "limited";
    },
    async complete(id) { await redis(["SET", prefix + id, "sent", "EX", 86400]); },
    async release(id) { await redis(["EVAL", "if redis.call('GET', KEYS[1]) == 'sending' then return redis.call('DEL', KEYS[1]) end return 0", 1, prefix + id]); },
    async send(fields, id) {
      const response = await fetcher("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `${prefix}${id}` }, body: JSON.stringify({ from: CONTACT_FROM, to: ["codecraftingpro@gmail.com"], reply_to: fields.email, subject: "Neue Nachricht über stefandukic.com", text: `Name: ${fields.name}\nE-Mail: ${fields.email}\n\n${fields.message}` }), signal: AbortSignal.timeout(7000) });
      if (!response.ok) throw new Error("provider unavailable");
      const data = await response.json() as { id?: string };
      if (typeof data.id !== "string" || !data.id) throw new Error("provider did not confirm");
    },
  };
}

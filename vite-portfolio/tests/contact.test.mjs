import test from 'node:test';
import assert from 'node:assert/strict';
import { handleContact, createServices, reserveScript } from '../src/server/contact.ts';

const fields = { name: 'Stefan Test', email: 'visitor@example.com', message: 'Eine kontrollierte Testnachricht.' };
const request = (data = fields, headers = {}) => new Request('https://portfolio.example/api/contact', {
  method: 'POST', headers: { Origin: 'https://portfolio.example', 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
  body: new URLSearchParams(data),
});
function fixture() {
  let sent = 0; const saved = new Map();
  const services = {
    hash: value => value,
    async reserve(id) { if (saved.has(id)) return saved.get(id); saved.set(id, 'busy'); return 'reserved'; },
    async complete(id) { saved.set(id, 'sent'); },
    async release(id) { saved.delete(id); },
    async send() { sent++; },
  };
  return { services, count: () => sent };
}
test('native POST sends once and preserves a fixed success response on repeat', async () => {
  const { services, count } = fixture();
  for (let i = 0; i < 2; i++) {
    const response = await handleContact(request(), services, '192.0.2.1');
    assert.equal(response.status, 200); assert.equal(response.headers.get('X-Contact-Sent'), '1');
    assert.match(await response.text(), /<!doctype html>/);
  }
  assert.equal(count(), 1);
});
test('HTMX and native form line endings identify the same multiline submission', async () => {
  const { services, count } = fixture();
  const message = 'Erste Zeile der Nachricht.\nZweite Zeile der Nachricht.';
  const first = await handleContact(request({ ...fields, message }, { 'HX-Request': 'true' }), services, 'a');
  assert.equal(first.status, 200);
  for (const separator of ['\r\n', '\r']) {
    const repeat = await handleContact(request({ ...fields, message: message.replaceAll('\n', separator) }), services, 'a');
    assert.equal(repeat.status, 200);
    assert.match(await repeat.text(), /bereits zum Versand angenommen/);
  }
  assert.equal(count(), 1);
});
test('concurrent duplicate remains pending while first provider call is in flight', async () => {
  const { services } = fixture(); let release;
  services.send = () => new Promise(resolve => { release = resolve; });
  const first = handleContact(request(), services, 'a');
  while (!release) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await handleContact(request(), services, 'a')).status, 429);
  release(); assert.equal((await first).status, 200);
});
test('validation blocks injection, invalid email, limits and duplicate fields', async () => {
  const { services, count } = fixture();
  for (const data of [{ ...fields, email: 'a@example.com\r\nBcc:b@example.com' }, { ...fields, name: 'a\nInjected' }, { ...fields, message: 'short' }, { ...fields, message: 'x'.repeat(5001) }, { ...fields, email: 'not-email' }]) {
    assert.equal((await handleContact(request(data), services, 'a')).status, 422);
  }
  const duplicate = new URLSearchParams(fields); duplicate.append('email', 'extra@example.com');
  assert.equal((await handleContact(request(duplicate), services, 'a')).status, 400);
  assert.equal(count(), 0);
});
test('native validation keeps escaped values for correction without executing markup', async () => {
  const response = await handleContact(request({ ...fields, name: '<img src=x onerror=alert(1)>', message: '</textarea><script>alert(1)</script>', email: 'invalid' }), fixture().services, 'a');
  const body = await response.text(); assert.equal(response.status, 422);
  assert.match(body, /&lt;img/); assert.doesNotMatch(body, /<script>|<img src=x/); assert.match(body, /<form/);
});
test('HTMX receives an HTML fragment with explicit error metadata', async () => {
  const response = await handleContact(request({ ...fields, message: 'short' }, { 'HX-Request': 'true' }), fixture().services, 'a');
  assert.equal(response.status, 422); assert.equal(response.headers.get('X-Contact-Response'), '1');
  assert.doesNotMatch(await response.text(), /<!doctype|<form/);
});
test('cross-origin, oversized body and unsupported formats never reach sender', async () => {
  const { services, count } = fixture();
  assert.equal((await handleContact(request(fields, { Origin: 'https://evil.example' }), services, 'a')).status, 403);
  assert.equal((await handleContact(request(fields, { 'Content-Type': 'application/json' }), services, 'a')).status, 415);
  assert.equal((await handleContact(request({ ...fields, message: 'x'.repeat(70000) }), services, 'a')).status, 413);
  assert.equal(count(), 0);
});
test('honeypot is discarded and missing config fails closed', async () => {
  const { services, count } = fixture();
  await handleContact(request({ ...fields, website: 'bot.example' }), services, 'a');
  assert.equal(count(), 0);
  const response = await handleContact(request(), null, 'a'); assert.equal(response.status, 503);
  assert.equal(response.headers.get('X-Contact-Sent'), '0'); assert.equal(createServices({}), null);
});
test('shared limit and state-store failure prevent provider call', async () => {
  const { services, count } = fixture();
  services.reserve = async () => 'limited';
  assert.equal((await handleContact(request(), services, 'a')).status, 429);
  services.reserve = async () => { throw Error('store down'); };
  assert.equal((await handleContact(request(), services, 'a')).status, 503);
  assert.equal(count(), 0);
});
test('provider failure releases reservation and never returns false success', async () => {
  const { services } = fixture(); let attempts = 0;
  services.send = async () => { attempts++; throw Error('provider error'); };
  for (let i = 0; i < 2; i++) assert.equal((await handleContact(request(), services, 'a')).status, 503);
  assert.equal(attempts, 2);
});
test('provider acceptance still reported if completion storage fails', async () => {
  const { services } = fixture(); services.complete = async () => { throw Error('store down'); };
  assert.equal((await handleContact(request(), services, 'a')).headers.get('X-Contact-Sent'), '1');
});
const env = { RESEND_API_KEY: 'test-key', CONTACT_FROM: 'Stefan <contact@example.com>', CONTACT_SECRET: 'x'.repeat(32), UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'test-redis' };
test('provider adapter fixes recipient, uses Reply-To and deterministic idempotency; Redis stores hashes only', async () => {
  const calls = [];
  const services = createServices(env, async (url, options) => {
    calls.push({ url, options }); return Response.json(url.includes('redis') ? { result: 'reserved' } : { id: 'confirmed' });
  });
  const id = services.hash(JSON.stringify(fields));
  assert.equal(id, services.hash(JSON.stringify(fields))); assert.equal(id.length, 64);
  await services.reserve(id, services.hash('ip:192.0.2.1'), services.hash('email:visitor@example.com'));
  await services.send(fields, id); await services.send(fields, id);
  assert.equal(calls[0].options.body.includes('visitor@example.com'), false);
  assert.equal(calls[0].options.body.includes('192.0.2.1'), false);
  assert.equal(JSON.parse(calls[0].options.body)[1], reserveScript);
  const mail = JSON.parse(calls[1].options.body);
  assert.deepEqual(mail.to, ['codecraftingpro@gmail.com']); assert.equal(mail.reply_to, fields.email);
  assert.equal(calls[1].options.headers['Idempotency-Key'], calls[2].options.headers['Idempotency-Key']);
});
test('provider HTTP error, timeout and missing confirmation are all failures', async () => {
  for (const sender of [async () => new Response('no', { status: 429 }), async () => { throw new DOMException('timeout', 'TimeoutError'); }, async () => Response.json({})]) {
    await assert.rejects(() => createServices(env, sender).send(fields, 'test'));
  }
});

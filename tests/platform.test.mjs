import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlatformClient, leaderboardPath, platformEnabled, platformHosted, randomVisit } from '../src/platform.js';

function fakeDocument() {
  const listeners = new Map();
  return {
    visibilityState: 'visible',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); },
  };
}

const response = (body = {}, ok = true, status = ok ? 200 : 401) => ({ ok, status, json: async () => body });

function setup(fetchImpl) {
  let time = 0;
  let interval = null;
  const documentObject = fakeDocument();
  const client = createPlatformClient({
    version: '1.6.0', fetchImpl, documentObject,
    locationObject: { hostname: 'bens-games.de', pathname: '/games/royal-blocks/', protocol: 'https:' },
    navigatorObject: { globalPrivacyControl: false },
    cryptoObject: { getRandomValues(bytes) { bytes.forEach((_, index) => { bytes[index] = index; }); } },
    now: () => time,
    setIntervalImpl(callback, milliseconds) { interval = { callback, milliseconds }; return 1; },
    clearIntervalImpl() {},
  });
  return { client, documentObject, advance(milliseconds) { time += milliseconds; }, interval: () => interval };
}

test('nur Releases ohne Global Privacy Control senden', () => {
  const deployed = { hostname: 'bens-games.de', pathname: '/games/royal-blocks/', protocol: 'https:' };
  assert.equal(platformHosted('1.6.0', deployed), true);
  assert.equal(platformEnabled('1.6.0', {}, deployed), true);
  assert.equal(platformEnabled('dev', {}, deployed), false);
  assert.equal(platformEnabled('test', {}, deployed), false);
  assert.equal(platformEnabled('1.6.0-test', {}, deployed), false);
  assert.equal(platformEnabled('1.6.0', {}, { ...deployed, hostname: 'localhost' }), false);
  assert.equal(platformEnabled('1.6.0', {}, { ...deployed, pathname: '/' }), false);
  assert.equal(platformEnabled('1.6.0', {}, { ...deployed, protocol: 'file:' }), false);
  assert.equal(platformEnabled('1.6.0', { globalPrivacyControl: true }, deployed), false);
  assert.equal(platformHosted('1.6.0', deployed), true, 'GPC blendet nur Telemetrie aus, nicht die Kontoanzeige');
});

test('Hub und Ranglisten-Link verwenden die dokumentierten Spiel-Endpunkte', async () => {
  const calls = [];
  const env = setup(async (url, options) => {
    calls.push({ url, options });
    return response({ user: null, announcements: [], links: { login: '/anmelden/' } });
  });
  const hub = await env.client.fetchHub();
  assert.equal(calls[0].url, '/api/games/royal-blocks/hub');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.ok(calls[0].options.signal);
  assert.equal(hub.links.login, '/anmelden/');
  assert.equal(leaderboardPath('klassisch'), '/ranglisten/?spiel=royal-blocks&liste=klassisch');
  assert.equal(leaderboardPath('ungültig!'), '/ranglisten/?spiel=royal-blocks');
});

test('optionale Hub-Anfrage endet nach drei Sekunden ohne Fehler im Spiel', async () => {
  let timeout;
  let milliseconds;
  const client = createPlatformClient({
    version: '1.6.0', navigatorObject: {},
    locationObject: { hostname: 'bens-games.de', pathname: '/games/royal-blocks/', protocol: 'https:' },
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('abgebrochen')));
    }),
    setTimeoutImpl(callback, delay) { timeout = callback; milliseconds = delay; return 1; },
    clearTimeoutImpl() {},
  });
  const result = client.fetchHub();
  assert.equal(milliseconds, 3_000);
  timeout();
  assert.equal(await result, null);
});

test('visit ist pro Client zufällig, 32-stellig hexadezimal und bleibt im Speicher', () => {
  const a = randomVisit({ getRandomValues(bytes) { bytes.fill(0xab); } });
  const b = randomVisit({ getRandomValues(bytes) { bytes.fill(0xcd); } });
  assert.equal(a, 'ab'.repeat(16));
  assert.equal(b, 'cd'.repeat(16));
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test('start, sichtbare Heartbeats und Levelereignisse werden gebündelt gesendet', async () => {
  const calls = [];
  const env = setup(async (url, options) => { calls.push({ url, options }); return response({ stored: 3 }); });
  assert.equal(env.client.start(), true);
  assert.equal(env.interval().milliseconds, 60_000);
  assert.equal(env.client.beginLevel('klassisch'), true);

  env.advance(61_500);
  await env.client.heartbeat();
  const first = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].url, '/api/events');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(first.app, 'royal-blocks');
  assert.match(first.visit, /^[0-9a-f]{32}$/);
  assert.deepEqual(first.events, [
    { type: 'start' },
    { type: 'level_start', level: 'klassisch' },
    { type: 'heartbeat', seconds: 61 },
  ]);

  env.advance(4_500);
  env.documentObject.visibilityState = 'hidden';
  env.documentObject.dispatch('visibilitychange');
  await new Promise((resolve) => setImmediate(resolve));
  const hidden = JSON.parse(calls[1].options.body);
  assert.equal(calls[1].options.keepalive, true);
  assert.deepEqual(hidden.events, [{ type: 'heartbeat', seconds: 5 }]);

  env.advance(120_000);
  await env.client.heartbeat();
  assert.equal(calls.length, 2, 'versteckte Zeit erzeugt keinen Heartbeat');

  env.documentObject.visibilityState = 'visible';
  env.documentObject.dispatch('visibilitychange');
  env.advance(3_000);
  assert.equal(env.client.endLevel({ result: 'lose', score: 1234, stars: 0, data: { lines: 7, hand_flush: 2 } }), true);
  await env.client.flush();
  const ended = JSON.parse(calls[2].options.body).events[0];
  assert.deepEqual(ended, {
    type: 'level_end', level: 'klassisch', result: 'lose', score: 1234, stars: 0, seconds: 69,
    data: { lines: 7, hand_flush: 2 },
  });
});

test('Ereignisdaten lassen keine Freitexte oder ungültigen Werte durch', () => {
  const env = setup(async () => response());
  env.client.start();
  env.client.beginLevel('taeglich');
  env.client.endLevel({
    result: 'abort', score: -4, stars: 99,
    data: { lines: 3, hero: 'vega', note: 'Freier Text!', BadKey: 4, negative: -1, float: 1.5 },
  });
  const ended = env.client.pending().at(-1);
  assert.equal(ended.score, 0);
  assert.equal(ended.stars, 10);
  assert.deepEqual(ended.data, { lines: 3, hero: 'vega' });
});

test('Ranglisten melden nur mit CSRF-Token eines angemeldeten Kontos', async () => {
  const calls = [];
  const env = setup(async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/account/me') return response({ csrf_token: 'token-123' });
    return response({ week: { rank: 4, score: 12500 }, all: { rank: 17, score: 12500 }, listed: true });
  });
  env.client.start();
  const result = await env.client.submitScore('klassisch', 12500);
  assert.equal(result.week.rank, 4);
  assert.equal(calls[0].url, '/api/account/me');
  assert.equal(calls[1].url, '/api/games/royal-blocks/scores');
  assert.equal(calls[1].options.headers['X-CSRF-Token'], 'token-123');
  assert.deepEqual(JSON.parse(calls[1].options.body), { board: 'klassisch', score: 12500 });
});

test('Konto-Spielstand lädt und speichert mit CSRF, Zeitstempel und Erfolgen', async () => {
  const calls = [];
  const env = setup(async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/account/me') return response({ csrf: 'save-token', user: { display_name: 'Ben' } });
    if (url.endsWith('/save/put')) return response({ status: 'saved', t: 123 });
    return response({ save: { data: '{"version":1,"values":{}}', t: 100 }, achievements: ['royal_flush'] });
  });
  const loaded = await env.client.loadCloudSave();
  assert.equal(loaded.save.t, 100);
  const saved = await env.client.putCloudSave('{"version":1,"values":{}}', 123, ['royal_flush', 'ungültig!']);
  assert.equal(saved.ok, true);
  const put = calls.find((call) => call.url.endsWith('/save/put'));
  assert.equal(put.options.headers['X-CSRF-Token'], 'save-token');
  assert.deepEqual(JSON.parse(put.options.body), {
    data: '{"version":1,"values":{}}', t: 123, achievements: ['royal_flush'],
  });
});

test('neuerer Konto-Spielstand wird als Konflikt zurückgegeben', async () => {
  const env = setup(async (url) => {
    if (url === '/api/account/me') return response({ csrf: 'token' });
    return response({ error: 'newer_save', save: { data: '{}', t: 999 } }, false, 409);
  });
  const result = await env.client.putCloudSave('{}', 100, []);
  assert.equal(result.conflict, true);
  assert.equal(result.save.t, 999);
});

test('ohne Konto oder Netz bleiben Statistik und Rangliste folgenlos', async () => {
  const calls = [];
  const env = setup(async (url) => {
    calls.push(url);
    if (url === '/api/account/me') return response({}, false);
    throw new Error('offline');
  });
  env.client.start();
  assert.equal(await env.client.submitScore('klassisch', 100), null);
  assert.deepEqual(calls, ['/api/account/me']);
  assert.equal(await env.client.flush(), null);

  let disabledCalls = 0;
  const disabled = createPlatformClient({
    version: 'dev', fetchImpl: async () => { disabledCalls++; },
    locationObject: { hostname: 'localhost', pathname: '/games/royal-blocks/', protocol: 'http:' },
  });
  disabled.start();
  disabled.beginLevel('klassisch');
  disabled.endLevel({ result: 'lose', score: 10 });
  await disabled.flush();
  await disabled.submitScore('klassisch', 10);
  await disabled.fetchHub();
  assert.equal(disabledCalls, 0);
});

test('eine spätere Anmeldung wird nach einer anonym gestarteten Runde erkannt', async () => {
  let accountChecks = 0;
  let scorePosts = 0;
  const env = setup(async (url) => {
    if (url === '/api/account/me') {
      accountChecks++;
      return response(accountChecks === 1 ? {} : { csrf_token: 'spaeter-angemeldet' }, accountChecks > 1);
    }
    scorePosts++;
    return response({ listed: false, week: { rank: null } });
  });
  env.client.start();
  assert.equal(await env.client.prepareAccount(), null);
  assert.equal((await env.client.submitScore('klassisch', 42)).listed, false);
  assert.equal(accountChecks, 2);
  assert.equal(scorePosts, 1);
});

test('Fehlermeldungen nur auf der Plattform, nur diese Felder, höchstens 5 und jeden Fehler nur einmal', async () => {
  const calls = [];
  const env = setup(async (url, options) => {
    calls.push({ url, options });
    return response({}, false, 500);
  });
  assert.equal(env.client.reportError({ message: 'Boom', source: 'main.js', line: 7, col: 3, stack: 'x'.repeat(5000) }), true);
  assert.equal(env.client.reportError({ message: 'Boom', line: 7 }), false, 'gleicher Fehler nur einmal');
  for (let k = 0; k < 10; k++) env.client.reportError({ message: `Fehler ${k}` });
  assert.equal(calls.length, 5, 'höchstens 5 Meldungen pro Besuch');
  assert.equal(calls[0].url, '/api/errors');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.keepalive, true);
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(Object.keys(body).sort(), ['app', 'col', 'line', 'message', 'source', 'stack']);
  assert.equal(body.app, 'royal-blocks');
  assert.equal(body.stack.length, 3000);

  const local = [];
  const offline = createPlatformClient({
    version: 'dev', fetchImpl: async (url) => { local.push(url); return response(); },
    locationObject: { hostname: 'localhost', pathname: '/games/royal-blocks/', protocol: 'http:' },
  });
  assert.equal(offline.reportError({ message: 'lokal' }), false);
  const gpc = createPlatformClient({
    version: '1.7.0', fetchImpl: async (url) => { local.push(url); return response(); },
    locationObject: { hostname: 'bens-games.de', pathname: '/games/royal-blocks/', protocol: 'https:' },
    navigatorObject: { globalPrivacyControl: true },
  });
  assert.equal(gpc.reportError({ message: 'gpc' }), false);
  assert.equal(local.length, 0, 'lokal und mit GPC wird nichts gesendet');
});

test('Fehler und abgelehnte Versprechen werden abgefangen', () => {
  const calls = [];
  const env = setup(async (url, options) => { calls.push(JSON.parse(options.body)); return response(); });
  const listeners = {};
  assert.equal(env.client.watchErrors({ addEventListener(type, fn) { listeners[type] = fn; } }), true);
  listeners.error({ message: 'Kaputt', filename: 'game.js', lineno: 3, colno: 4, error: { stack: 'trace' } });
  listeners.unhandledrejection({ reason: new Error('Versprechen') });
  assert.deepEqual(calls.map((c) => c.message), ['Kaputt', 'Versprechen']);
  assert.equal(env.client.watchErrors({}), false, 'ohne addEventListener kein Absturz');
});

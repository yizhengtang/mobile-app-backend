require('dotenv').config();
const axios = require('axios');

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const TEST_USER = { name: 'Test User', email: `test_${Date.now()}@example.com`, password: 'password123' };

let token, userId, tripId, planId, versionId;
let passed = 0, failed = 0;

const check = (label, condition, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
};

const api = (method, path, data, auth = false) =>
  axios({ method, url: `${BASE}${path}`, data,
    headers: auth ? { Authorization: `Bearer ${token}` } : {},
  }).catch((e) => e.response);

const run = async () => {
  console.log(`\nRunning tests against ${BASE}\n`);

  // ── Health ──────────────────────────────────────────────────────
  console.log('[ Health ]');
  const health = await api('get', '/health');
  check('GET /health returns 200', health?.status === 200);
  check('status is ok',            health?.data?.status === 'ok');

  // ── Auth ────────────────────────────────────────────────────────
  console.log('\n[ Auth ]');

  const reg = await api('post', '/api/auth/register', TEST_USER);
  check('POST /auth/register → 201',       reg?.status === 201);
  check('returns token',                   !!reg?.data?.token);
  check('returns user without password',   reg?.data?.user && !reg?.data?.user?.password);
  token = reg?.data?.token;
  userId = reg?.data?.user?._id;

  const dupReg = await api('post', '/api/auth/register', TEST_USER);
  check('duplicate email → 409',           dupReg?.status === 409);

  const badReg = await api('post', '/api/auth/register', { email: 'notanemail', password: '123' });
  check('invalid body → 400',              badReg?.status === 400);
  check('validation errors present',       Array.isArray(badReg?.data?.errors));

  const login = await api('post', '/api/auth/login', { email: TEST_USER.email, password: TEST_USER.password });
  check('POST /auth/login → 200',          login?.status === 200);
  check('returns token',                   !!login?.data?.token);
  token = login?.data?.token;

  const badLogin = await api('post', '/api/auth/login', { email: TEST_USER.email, password: 'wrongpass' });
  check('wrong password → 401',            badLogin?.status === 401);

  const me = await api('get', '/api/auth/me', null, true);
  check('GET /auth/me → 200',              me?.status === 200);
  check('returns correct user',            me?.data?.user?.email === TEST_USER.email);

  const noToken = await api('get', '/api/auth/me');
  check('no token → 401',                  noToken?.status === 401);

  // ── Trips ────────────────────────────────────────────────────────
  console.log('\n[ Trips ]');

  const tripBody = {
    name: 'Tokyo Test Trip', destination: { city: 'Tokyo', country: 'Japan' },
    startDate: '2026-06-01', endDate: '2026-06-03',
    pace: 'moderate', budgetPerDay: 150,
    transportModes: ['walk', 'transit'],
    attractions: ['Senso-ji Temple', 'Shibuya Crossing'],
  };

  const create = await api('post', '/api/trips', tripBody, true);
  check('POST /trips → 201',               create?.status === 201);
  check('status is pending',               create?.data?.trip?.status === 'pending');
  check('linked to user',                  create?.data?.trip?.user === userId);
  tripId = create?.data?.trip?._id;

  const badTrip = await api('post', '/api/trips', { name: 'Bad', startDate: '2026-06-05', endDate: '2026-06-01' }, true);
  check('end before start → 400',          badTrip?.status === 400);

  const list = await api('get', '/api/trips', null, true);
  check('GET /trips → 200',                list?.status === 200);
  check('count is 1',                      list?.data?.count === 1);

  const getOne = await api('get', `/api/trips/${tripId}`, null, true);
  check('GET /trips/:id → 200',            getOne?.status === 200);
  check('plan is null before generation',  getOne?.data?.plan === null);

  const patch = await api('patch', `/api/trips/${tripId}`, { pace: 'relaxed' }, true);
  check('PATCH /trips/:id → 200',          patch?.status === 200);
  check('pace updated',                    patch?.data?.trip?.pace === 'relaxed');

  const notFound = await api('get', '/api/trips/000000000000000000000000', null, true);
  check('unknown id → 404',               notFound?.status === 404);

  // ── Plan Generation ──────────────────────────────────────────────
  console.log('\n[ Plan Generation ]');
  if (!process.env.OPENAI_API_KEY) {
    console.log('  ⚠  OPENAI_API_KEY not set — skipping generation tests');
  } else {
    console.log('  (calling OpenAI — may take 10–20s)');
    const gen = await api('post', `/api/trips/${tripId}/generate`, null, true);
    check('POST /trips/:id/generate → 201', gen?.status === 201);
    check('plan has days',                  gen?.data?.plan?.days?.length > 0);
    check('version is 1',                   gen?.data?.plan?.version === 1);
    check('isCurrent is true',              gen?.data?.plan?.isCurrent === true);
    check('totalBudget > 0',                gen?.data?.plan?.totalBudget > 0);
    planId = gen?.data?.plan?._id;

    const getPlan = await api('get', `/api/trips/${tripId}/plan`, null, true);
    check('GET /trips/:id/plan → 200',      getPlan?.status === 200);

    const tripWithPlan = await api('get', `/api/trips/${tripId}`, null, true);
    check('GET /trips/:id includes plan',   !!tripWithPlan?.data?.plan);

    // ── Versions ─────────────────────────────────────────────────
    console.log('\n[ Versions ]');
    const versions = await api('get', `/api/trips/${tripId}/versions`, null, true);
    check('GET /trips/:id/versions → 200',  versions?.status === 200);
    check('1 version exists',               versions?.data?.count === 1);
    versionId = versions?.data?.versions?.[0]?._id;

    const gen2 = await api('post', `/api/trips/${tripId}/generate`, null, true);
    check('second generate → version 2',    gen2?.data?.plan?.version === 2);

    const versions2 = await api('get', `/api/trips/${tripId}/versions`, null, true);
    check('now 2 versions',                 versions2?.data?.count === 2);

    const revert = await api('post', `/api/trips/${tripId}/revert/${versionId}`, null, true);
    check('POST /revert/:versionId → 200',  revert?.status === 200);
    check('reverted plan is version 3',     revert?.data?.plan?.version === 3);

    // ── Chat ──────────────────────────────────────────────────────
    console.log('\n[ Chat ]');
    console.log('  (calling OpenAI — may take 10–20s)');
    const chat = await api('post', `/api/trips/${tripId}/chat`, { message: 'Add a visit to Meiji Shrine on day 1' }, true);
    check('POST /trips/:id/chat → 200',     chat?.status === 200);
    check('reply is a string',             typeof chat?.data?.reply === 'string');
    check('updated plan returned',          !!chat?.data?.plan?._id);

    const history = await api('get', `/api/trips/${tripId}/chat`, null, true);
    check('GET /trips/:id/chat → 200',      history?.status === 200);
    check('2 messages (user + assistant)',  history?.data?.count === 2);
  }

  // ── Push Token ───────────────────────────────────────────────────
  console.log('\n[ Push Token ]');
  const pushSave = await api('post', '/api/users/push-token', { pushToken: 'ExponentPushToken[test123]' }, true);
  check('POST /users/push-token → 200',    pushSave?.status === 200);

  const noPush = await api('post', '/api/users/push-token', {}, true);
  check('missing token → 400',             noPush?.status === 400);

  const pushDel = await api('delete', '/api/users/push-token', null, true);
  check('DELETE /users/push-token → 200',  pushDel?.status === 200);

  // ── Cleanup ──────────────────────────────────────────────────────
  console.log('\n[ Cleanup ]');
  const del = await api('delete', `/api/trips/${tripId}`, null, true);
  check('DELETE /trips/:id → 200',         del?.status === 200);
  const gone = await api('get', `/api/trips/${tripId}`, null, true);
  check('trip gone after delete',          gone?.status === 404);

  // ── Summary ──────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);
  if (failed === 0) console.log('  All tests passed ✓');
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => { console.error('Test runner crashed:', err.message); process.exit(1); });

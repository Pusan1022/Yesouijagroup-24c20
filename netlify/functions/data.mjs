// 숙소 스케줄 클라우드 저장소 (Netlify Blobs)
// 아래 주소에서 열린 앱의 요청만 받습니다.
import { getStore } from '@netlify/blobs';

const ALLOWED_ORIGINS = [
  'https://calm-choux-1ed2c5.netlify.app',
];

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  let from = origin;
  if (!from && referer) { try { from = new URL(referer).origin; } catch {} }
  const allowed = ALLOWED_ORIGINS.includes(from);
  const CORS = {
    'access-control-allow-origin': allowed ? from : 'null',
    'access-control-allow-methods': 'GET, PUT, PATCH, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'origin',
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!allowed) return new Response('forbidden', { status: 403, headers: CORS });

  const store = getStore({ name: 'schedule', consistency: 'strong' });

  if (req.method === 'GET') {
    if (new URL(req.url).searchParams.get('meta')) {
      const meta = await store.get('meta', { type: 'json' });
      if (meta) return json({ savedAt: meta.savedAt || null });
      const rec = await store.get('data', { type: 'json' });
      return json({ savedAt: rec ? rec.savedAt || null : null });
    }
    const record = await store.get('data', { type: 'json' });
    return json({ record: record || null });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    let body;
    try { body = await req.json(); } catch { return new Response('bad json', { status: 400, headers: CORS }); }
    if (!body || body.v !== 2) return new Response('bad data', { status: 400, headers: CORS });
    const prev = await store.get('data', { type: 'json' });
    // 보낸 항목만 바꾸고 나머지는 그대로 둠 (다른 기기 변경·예전 버전 앱이 모르는 항목 보존)
    const next = prev ? { ...prev, ...body } : body;
    if (!next.savedAt) next.savedAt = new Date().toISOString();
    if (prev) {
      await store.setJSON('prev', prev); // 직전 버전
      const day = 'backup-' + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      if (!(await store.get(day))) await store.setJSON(day, prev); // 하루 1번 백업
    }
    await store.setJSON('data', next);
    await store.setJSON('meta', { savedAt: next.savedAt });
    return json({ ok: true, savedAt: next.savedAt, prevSavedAt: prev ? prev.savedAt || null : null });
  }

  return new Response('method not allowed', { status: 405, headers: CORS });
};

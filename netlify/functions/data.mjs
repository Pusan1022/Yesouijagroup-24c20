// 숙소 스케줄 클라우드 저장소 (Netlify Blobs)
// 아래 주소에서 열린 앱의 요청만 받습니다.
import { getStore } from '@netlify/blobs';

const ALLOWED_ORIGINS = [
  'https://calm-choux-1ed2c5.netlify.app',
  'https://pusan1022.github.io', // 예전 주소 - 데이터 이전이 끝나면 삭제
];

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const from = origin || (referer ? new URL(referer).origin : '');
  const allowed = ALLOWED_ORIGINS.includes(from);
  const CORS = {
    'access-control-allow-origin': allowed ? from : 'null',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'origin',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!allowed) return new Response('forbidden', { status: 403, headers: CORS });

  const store = getStore({ name: 'schedule', consistency: 'strong' });

  if (req.method === 'GET') {
    const record = await store.get('data', { type: 'json' });
    return new Response(JSON.stringify({ record: record || null }), {
      headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return new Response('bad json', { status: 400, headers: CORS }); }
    if (!body || body.v !== 2) return new Response('bad data', { status: 400, headers: CORS });
    const prev = await store.get('data', { type: 'json' });
    if (prev) await store.setJSON('prev', prev); // 직전 버전 백업
    await store.setJSON('data', body);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  return new Response('method not allowed', { status: 405, headers: CORS });
};

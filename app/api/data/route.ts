import { NextResponse } from 'next/server';

const DATA_KEY = 'finance_dashboard_v1';

// Dynamically import @vercel/kv to avoid crashing if env vars aren't set
async function getKV() {
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const kv = await getKV();
    if (!kv) return NextResponse.json(null);
    const data = await kv.get(DATA_KEY);
    if (!data) return NextResponse.json(null);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(request: Request) {
  try {
    const kv = await getKV();
    if (!kv) return NextResponse.json({ ok: false, reason: 'kv_not_configured' });
    const body = await request.json();
    await kv.set(DATA_KEY, JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

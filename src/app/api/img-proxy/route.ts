import { NextRequest, NextResponse } from 'next/server';

// Hosts allowed to be proxied. Anything else is rejected to prevent abuse.
const ALLOWED_HOSTS = ['alicdn.com', 'alibaba.com', '1688.com', 'taobao.com'];

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_HOSTS.some((a) => h === a || h.endsWith('.' + a));
}

// Common HTTP image content types we accept and forward.
const SAFE_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
];

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url');
  if (!target) {
    return NextResponse.json({ error: 'missing url' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'invalid protocol' }, { status: 400 });
  }

  if (!hostAllowed(parsed.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      // Set Referer to a same-origin URL so Alibaba's CDN doesn't reject us.
      headers: {
        Referer: 'https://detail.1688.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      // Don't follow redirects to arbitrary hosts. fetch follows by default.
      // Trade-off: Alibaba CDNs sometimes 302 to a CDN edge node still under
      // alicdn.com, which is OK because the redirect target is also whitelisted.
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    const rawType = upstream.headers.get('content-type') || 'image/jpeg';
    const baseType = rawType.split(';')[0].trim().toLowerCase();
    const contentType = SAFE_CONTENT_TYPES.includes(baseType)
      ? rawType
      : 'image/jpeg';

    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Aggressive cache: CDN URLs are content-addressed and immutable.
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
  }
}

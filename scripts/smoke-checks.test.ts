import { describe, expect, it } from 'vitest';
import { runSmoke } from './smoke-checks';

function fakeFetch(routes: Record<string, { status: number; body?: string; location?: string }>) {
  return async (url: string) => {
    const path = new URL(url).pathname;
    const r = routes[path] || { status: 404 };
    return new Response(r.body ?? '', { status: r.status, headers: r.location ? { location: r.location } : {} });
  };
}

describe('test de fumée', () => {
  it('CI conforme', async () => {
    const f = fakeFetch({
      '/api/health': { status: 200, body: JSON.stringify({ ok: true, country: 'CI', buildCountry: 'CI', database: 'ok' }) },
      '/bio': { status: 200, body: '<h1>Oh My Cot</h1>' },
      '/': { status: 307, location: 'https://x.test/bio' },
      '/admin': { status: 200 },
    });
    const checks = await runSmoke('CI', 'https://x.test', f);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it('détecte un build CI compilé comme le Gabon', async () => {
    const f = fakeFetch({
      '/api/health': { status: 503, body: JSON.stringify({ ok: false, country: 'CI', buildCountry: 'GA', database: 'ok' }) },
      '/bio': { status: 200, body: 'Oh My Cot' },
      '/': { status: 307, location: '/bio' },
      '/admin': { status: 200 },
    });
    const bad = (await runSmoke('CI', 'https://x.test', f)).filter((c) => !c.ok).map((c) => c.name);
    expect(bad).toContain('pays du build (code navigateur)');
    expect(bad).toContain('santé');
  });

  it('Gabon : l’accueil doit répondre 200', async () => {
    const f = fakeFetch({
      '/api/health': { status: 200, body: JSON.stringify({ ok: true, country: 'GA', buildCountry: 'GA', database: 'ok' }) },
      '/bio': { status: 200, body: 'TWINSK Oh My Gab' },
      '/': { status: 307, location: '/bio' },
      '/admin': { status: 200 },
    });
    const bad = (await runSmoke('GA', 'https://x.test', f)).filter((c) => !c.ok).map((c) => c.name);
    expect(bad).toEqual(['accueil']);
  });
});

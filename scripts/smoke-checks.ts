// Contrôles du test de fumée (séparés du lanceur pour être testés).
import { COUNTRIES, type CountryCode } from '../src/config/countries';

export interface SmokeCheck { name: string; ok: boolean; detail?: string }
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export async function runSmoke(code: CountryCode, base: string, fetchImpl: Fetch = fetch): Promise<SmokeCheck[]> {
  const country = COUNTRIES[code];
  const out: SmokeCheck[] = [];
  const get = (path: string) => fetchImpl(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });

  try {
    const r = await get('/api/health?deep=1');
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; country?: string; buildCountry?: string; database?: string };
    out.push({ name: 'santé', ok: r.status === 200 && j.ok === true, detail: `HTTP ${r.status}` });
    out.push({ name: 'pays à l’exécution', ok: j.country === code, detail: String(j.country) });
    out.push({ name: 'pays du build (code navigateur)', ok: j.buildCountry === code, detail: String(j.buildCountry) });
    out.push({ name: 'base de données', ok: j.database === 'ok', detail: String(j.database) });
  } catch (e) {
    out.push({ name: 'santé', ok: false, detail: e instanceof Error ? e.message : 'injoignable' });
  }

  try {
    const r = await get('/bio');
    const html = r.status === 200 ? await r.text() : '';
    out.push({ name: '/bio', ok: r.status === 200, detail: `HTTP ${r.status}` });
    out.push({ name: `/bio affiche « ${country.brand} »`, ok: html.includes(country.brand) });
  } catch (e) {
    out.push({ name: '/bio', ok: false, detail: e instanceof Error ? e.message : 'injoignable' });
  }

  try {
    const r = await get('/');
    const loc = r.headers.get('location') || '';
    if (country.modules.twinsk) out.push({ name: 'accueil', ok: r.status === 200, detail: `HTTP ${r.status}` });
    else out.push({ name: 'accueil → /bio (option B)', ok: r.status >= 300 && r.status < 400 && /\/bio$/.test(loc), detail: `HTTP ${r.status} ${loc}` });
  } catch (e) {
    out.push({ name: 'accueil', ok: false, detail: e instanceof Error ? e.message : 'injoignable' });
  }

  try {
    const r = await get('/admin');
    out.push({ name: '/admin répond', ok: r.status === 200 || (r.status >= 300 && r.status < 400), detail: `HTTP ${r.status}` });
  } catch (e) {
    out.push({ name: '/admin répond', ok: false, detail: e instanceof Error ? e.message : 'injoignable' });
  }
  return out;
}

/**
 * § 11.2.4 — Chaque route /api/sourcing hors « shared » doit répondre 401 sans
 * cookie admin valide.
 *
 * Les routes sont DÉCOUVERTES sur le disque, pas listées à la main : toute route
 * ajoutée plus tard est couverte automatiquement, et une garde oubliée fait
 * échouer la suite au lieu de passer inaperçue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';

const API_DIR = path.join(process.cwd(), 'src/app/api/sourcing');
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Route publique volontairement non gardée : son jeton EST son contrôle d'accès. */
const PUBLIC_SEGMENT = 'shared';

function findRouteFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findRouteFiles(full));
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out.sort();
}

const routeFiles = findRouteFiles(API_DIR).filter(
  (f) => !path.relative(API_DIR, f).split(path.sep).includes(PUBLIC_SEGMENT),
);

/** Contexte générique : couvre [id] comme [token] sans connaître la route. */
interface RouteContext {
  params: Promise<{ id: string; token: string }>;
}
const ctx = (): RouteContext => ({
  params: Promise.resolve({
    id: 'ffffffff-0000-0000-0000-000000000000',
    token: 'jeton-de-test',
  }),
});

type Handler = (req: NextRequest, context: RouteContext) => Promise<Response>;

const cases: Array<{ label: string; method: string; handler: Handler }> = [];

beforeAll(async () => {
  // Un mot de passe est défini pour que le scénario « mauvais cookie » soit réel.
  process.env.ADMIN_PASSWORD = 'mot-de-passe-de-test';
  for (const file of routeFiles) {
    const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    const rel = path.relative(API_DIR, file).replace(/[/\\]route\.ts$/, '');
    for (const method of HTTP_METHODS) {
      const handler = mod[method];
      if (typeof handler === 'function') {
        cases.push({ label: `${method} /api/sourcing/${rel}`, method, handler: handler as Handler });
      }
    }
  }
});

function request(method: string, cookie?: string) {
  return new NextRequest('http://localhost/api/sourcing/test', {
    method,
    ...(cookie ? { headers: { cookie } } : {}),
  });
}

describe('authentification des routes /api/sourcing', () => {
  it('des routes ont bien été découvertes', () => {
    // Garde-fou : un test qui ne trouve aucune route passerait sans rien vérifier.
    expect(routeFiles.length).toBeGreaterThanOrEqual(12);
    expect(cases.length).toBeGreaterThanOrEqual(16);
  });

  it('aucune requête sans cookie ne passe', async () => {
    const failures: string[] = [];
    for (const c of cases) {
      const res = await c.handler(request(c.method), ctx());
      if (res.status !== 401) failures.push(`${c.label} → ${res.status}`);
      else {
        const body = await res.json();
        if (body?.error !== 'Non autorisé') failures.push(`${c.label} → corps inattendu`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('aucune requête avec un mauvais cookie ne passe', async () => {
    const failures: string[] = [];
    for (const c of cases) {
      const res = await c.handler(request(c.method, 'admin_token=mauvais'), ctx());
      if (res.status !== 401) failures.push(`${c.label} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('un cookie vide ne passe pas', async () => {
    const failures: string[] = [];
    for (const c of cases) {
      const res = await c.handler(request(c.method, 'admin_token='), ctx());
      if (res.status !== 401) failures.push(`${c.label} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('un cookie de collaborateur ne suffit pas : le module est réservé à l’admin', async () => {
    const failures: string[] = [];
    for (const c of cases) {
      const res = await c.handler(request(c.method, 'collab_token=peu-importe'), ctx());
      if (res.status !== 401) failures.push(`${c.label} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('aucun cookie ne passe si ADMIN_PASSWORD n’est pas configuré', async () => {
    const saved = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    try {
      const failures: string[] = [];
      for (const c of cases) {
        for (const cookie of ['admin_token=', 'admin_token=undefined', 'admin_token=null']) {
          const res = await c.handler(request(c.method, cookie), ctx());
          if (res.status !== 401) failures.push(`${c.label} (${cookie}) → ${res.status}`);
        }
      }
      expect(failures).toEqual([]);
    } finally {
      process.env.ADMIN_PASSWORD = saved;
    }
  });
});

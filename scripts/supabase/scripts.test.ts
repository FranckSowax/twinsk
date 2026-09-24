import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUCKETS, bucketDiff } from './buckets';
import { isProtected, targetFromEnv } from './target';

describe('buckets', () => {
  const spec = BUCKETS[0];
  it('request-images : réglages du Gabon', () => {
    expect(spec).toEqual({
      id: 'request-images', public: true, fileSizeLimit: 52428800,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],
    });
  });
  it('conforme → aucune différence, ordre des types indifférent', () => {
    expect(bucketDiff(spec, { public: true, file_size_limit: 52428800, allowed_mime_types: ['video/mp4', 'image/gif', 'image/webp', 'image/png', 'image/jpeg'] })).toEqual([]);
  });
  it('signale visibilité, taille et types', () => {
    expect(bucketDiff(spec, { public: false, file_size_limit: null, allowed_mime_types: null })).toHaveLength(3);
  });
  it('config.toml déclare le même bucket', () => {
    const toml = readFileSync('supabase/config.toml', 'utf8');
    expect(toml).toContain('[storage.buckets.request-images]');
    expect(toml).toContain('allowed_mime_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]');
  });
});

describe('garde-fou des projets protégés', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('le Gabon est protégé', () => {
    expect(isProtected('qaemzzpyrmoopfkiciki')).toBe(true);
    expect(isProtected('autreprojet')).toBe(false);
    process.env.GA_PROJECT_REF = 'autreprojet';
    expect(isProtected('autreprojet')).toBe(true);
  });
  it('refuse l’écriture sur un projet protégé, autorise la lecture', () => {
    process.env.SUPABASE_PROJECT_REF = 'qaemzzpyrmoopfkiciki';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'factice';
    expect(() => targetFromEnv('', { write: true })).toThrow(/protégé/);
    expect(targetFromEnv('', { write: false }).url).toBe('https://qaemzzpyrmoopfkiciki.supabase.co');
  });
  it('exige les variables', () => {
    delete process.env.SUPABASE_PROJECT_REF;
    expect(() => targetFromEnv('', { write: false })).toThrow(/manquantes/);
  });
});

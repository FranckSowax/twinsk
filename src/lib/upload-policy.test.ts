import { describe, expect, it } from 'vitest';
import { checkUploadFile, clientIp, RateLimiter } from './upload-policy';

describe('checkUploadFile', () => {
  it('équipe : images et vidéos', () => {
    expect(checkUploadFile(true, 'video/mp4').ok).toBe(true);
    expect(checkUploadFile(true, 'image/jpeg').ok).toBe(true);
  });
  it('visiteur : images seulement', () => {
    expect(checkUploadFile(false, 'image/png').ok).toBe(true);
    const r = checkUploadFile(false, 'video/mp4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});

describe('RateLimiter', () => {
  it('bloque au-delà de la limite puis libère après la fenêtre', () => {
    const rl = new RateLimiter(5, 1000);
    expect(rl.take('ip', 3, 0)).toBe(true);
    expect(rl.take('ip', 2, 10)).toBe(true);
    expect(rl.take('ip', 1, 20)).toBe(false);
    expect(rl.take('autre-ip', 5, 20)).toBe(true);
    expect(rl.take('ip', 5, 1015)).toBe(true);
  });
  it('un refus ne consomme rien', () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.take('ip', 4, 0)).toBe(false);
    expect(rl.take('ip', 3, 1)).toBe(true);
  });
});

describe('clientIp', () => {
  it('première adresse de x-forwarded-for', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '41.158.1.2, 10.0.0.1' }))).toBe('41.158.1.2');
    expect(clientIp(new Headers({ 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4');
    expect(clientIp(new Headers())).toBe('inconnue');
  });
});

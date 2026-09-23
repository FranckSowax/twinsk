import { describe, expect, it } from 'vitest';
import { isFetchableUrl, isPrivateAddress, parseOpenGraph } from './link-preview';

describe('parseOpenGraph — image, titre et description de partage', () => {
  it('lit les balises og, décode les entités, résout une image relative', () => {
    const html = `<html><head><title>Titre page</title>
      <meta property="og:title" content="Canap&eacute;s &amp; Salons"/>
      <meta content="Collection Fin 2026" property='og:description'>
      <meta property="og:image" content="/bio/top-bio-web.jpg">
      <meta property="og:site_name" content="Oh My Gab">`;
    const p = parseOpenGraph(html, 'https://twinsk-production.up.railway.app/bio');
    expect(p.title).toBe('Canap&eacute;s & Salons'); // entité non standard laissée telle quelle, &amp; décodé
    expect(p.description).toBe('Collection Fin 2026');
    expect(p.image).toBe('https://twinsk-production.up.railway.app/bio/top-bio-web.jpg');
    expect(p.site).toBe('Oh My Gab');
  });
  it('se replie sur <title> et twitter:image ; refuse une image non http', () => {
    const p = parseOpenGraph('<title>Ma page</title><meta name="twitter:image" content="https://x.io/i.png">', 'https://x.io/');
    expect(p.title).toBe('Ma page');
    expect(p.image).toBe('https://x.io/i.png');
    expect(parseOpenGraph('<meta property="og:image" content="javascript:alert(1)">', 'https://x.io/').image).toBeNull();
  });
});

describe('garde réseau (SSRF)', () => {
  it('bloque les adresses privées, locales et réservées', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress('104.21.3.4')).toBe(false);
    expect(isPrivateAddress('2606:4700::1')).toBe(false);
  });
  it('n’accepte que http(s) sur port standard, hors hôtes locaux', () => {
    expect(isFetchableUrl('https://tr.ee/uOj5ga')).toBe(true);
    expect(isFetchableUrl('http://localhost/x')).toBe(false);
    expect(isFetchableUrl('https://intranet/x')).toBe(false);
    expect(isFetchableUrl('https://x.io:8080/')).toBe(false);
    expect(isFetchableUrl('file:///etc/passwd')).toBe(false);
  });
});

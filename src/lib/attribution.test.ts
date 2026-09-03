import { describe, expect, it } from 'vitest';
import {
  deserializeAttribution,
  describeTouchPoint,
  mergeAttribution,
  parseTouchPoint,
  serializeAttribution,
  type TouchPoint,
} from './attribution';

const NOW = new Date('2026-09-02T10:00:00.000Z');

describe('parseTouchPoint', () => {
  it('extrait les UTM et le chemin d’atterrissage', () => {
    const touch = parseTouchPoint(
      '?utm_source=meta&utm_medium=paid&utm_campaign=omg-communaute&utm_content=video-chambre',
      { path: '/offer/abc', now: NOW },
    );
    expect(touch).toMatchObject({
      utm_source: 'meta',
      utm_medium: 'paid',
      utm_campaign: 'omg-communaute',
      utm_content: 'video-chambre',
      landing_path: '/offer/abc',
      at: NOW.toISOString(),
    });
  });

  it('retient fbclid seul (cas d’un clic Meta sans UTM)', () => {
    const touch = parseTouchPoint('?fbclid=IwAR123', { now: NOW });
    expect(touch?.fbclid).toBe('IwAR123');
  });

  it('accepte une query sans point d’interrogation', () => {
    expect(parseTouchPoint('utm_source=meta', { now: NOW })?.utm_source).toBe('meta');
  });

  it('renvoie null sur une visite directe — ne doit pas écraser l’attribution', () => {
    expect(parseTouchPoint('', { now: NOW })).toBeNull();
    expect(parseTouchPoint('?page=2', { now: NOW })).toBeNull();
  });

  it('traite un referrer externe comme un signal', () => {
    const touch = parseTouchPoint('', { referrer: 'https://l.wl.co/', now: NOW });
    expect(touch?.referrer).toBe('https://l.wl.co/');
  });

  it('borne les valeurs trop longues', () => {
    const touch = parseTouchPoint(`?utm_campaign=${'x'.repeat(500)}`, { now: NOW });
    expect(touch?.utm_campaign).toHaveLength(200);
  });
});

describe('mergeAttribution', () => {
  const first: TouchPoint = { utm_source: 'meta', utm_campaign: 'omg-video', at: '2026-08-29T00:00:00.000Z' };
  const second: TouchPoint = { utm_source: 'whatsapp', utm_campaign: 'relance', at: '2026-09-02T00:00:00.000Z' };

  it('initialise first et last au premier contact', () => {
    expect(mergeAttribution(null, first)).toEqual({ first, last: first });
  });

  it('fige first et remplace last aux contacts suivants', () => {
    const merged = mergeAttribution({ first, last: first }, second);
    expect(merged.first).toEqual(first);
    expect(merged.last).toEqual(second);
  });
});

describe('sérialisation', () => {
  it('fait un aller-retour sans perte', () => {
    const attribution = mergeAttribution(null, { utm_source: 'meta', at: NOW.toISOString() });
    expect(deserializeAttribution(serializeAttribution(attribution))).toEqual(attribution);
  });

  it('résiste à un cookie corrompu ou absent', () => {
    expect(deserializeAttribution(null)).toBeNull();
    expect(deserializeAttribution('pas-du-json')).toBeNull();
    expect(deserializeAttribution(encodeURIComponent('{"first":{}}'))).toBeNull();
  });
});

describe('describeTouchPoint', () => {
  it('combine source et campagne', () => {
    expect(describeTouchPoint({ utm_source: 'meta', utm_campaign: 'omg-communaute', at: '' }))
      .toBe('meta · omg-communaute');
  });

  it('déduit meta depuis un fbclid nu', () => {
    expect(describeTouchPoint({ fbclid: 'IwAR1', at: '' })).toBe('meta');
  });

  it('retombe sur le domaine du referrer', () => {
    expect(describeTouchPoint({ referrer: 'https://chat.whatsapp.com/x', at: '' }))
      .toBe('chat.whatsapp.com');
  });

  it('dit « direct » quand il n’y a aucun signal', () => {
    expect(describeTouchPoint(null)).toBe('direct');
    expect(describeTouchPoint({ at: '' })).toBe('direct');
  });
});

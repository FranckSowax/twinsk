import { describe, expect, it } from 'vitest';
import { parseContactCheck } from './whapi';

describe('parseContactCheck — compte WhatsApp réel d’un numéro (29 sept. 2026)', () => {
  it('nouveau format ivoirien : WhatsApp renvoie l’identifiant de l’ancien format', () => {
    const r = parseContactCheck('2250712345615', { contacts: [{ input: '2250712345615', status: 'valid', wa_id: '22512345615@s.whatsapp.net' }] });
    expect(r).toEqual({ input: '2250712345615', status: 'valid', waId: '22512345615' });
  });
  it('numéro inconnu ou réponse vide', () => {
    expect(parseContactCheck('2250712345615', { contacts: [{ input: '2250712345615', status: 'invalid' }] })).toEqual({ input: '2250712345615', status: 'invalid', waId: null });
    expect(parseContactCheck('24177123456', null)).toEqual({ input: '24177123456', status: 'unknown', waId: null });
  });
});

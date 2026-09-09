import { describe, expect, it } from 'vitest';
import { buildAckMessage, buildSalonNote, extractInboundText, isSalonCandidate, isSalonNote, normalizeSalonConfig, requestNumber, salonNoteMessageId } from './salon';

const G = '120363431660727284@g.us';

describe('salon', () => {
  it('numéro de demande stable', () => {
    expect(requestNumber('7176bcac-e106-4001-b8fc-f591d1d5743e')).toBe('R-7176BCAC');
  });
  it('note salon : marque + id de message', () => {
    const n = buildSalonNote('wamid.1', G);
    expect(isSalonNote(n)).toBe(true);
    expect(salonNoteMessageId(n)).toBe('wamid.1');
    expect(isSalonNote('Commande CMD-1')).toBe(false);
  });
  it('candidats : bon groupe, pas de nous, contenu suffisant', () => {
    expect(isSalonCandidate({ type: 'text', chat_id: G, text: { body: 'Je cherche un four à pizza 2 étages' } }, G)).toBe(true);
    expect(isSalonCandidate({ type: 'text', chat_id: G, from_me: true, text: { body: 'Je cherche un four' } }, G)).toBe(false);
    expect(isSalonCandidate({ type: 'text', chat_id: 'autre@g.us', text: { body: 'Je cherche un four' } }, G)).toBe(false);
    expect(isSalonCandidate({ type: 'text', chat_id: G, text: { body: 'ok' } }, G)).toBe(false);
    expect(isSalonCandidate({ type: 'image', chat_id: G, image: { caption: '' } }, G)).toBe(true);
    expect(isSalonCandidate({ type: 'poll_update', chat_id: G }, G)).toBe(false);
  });
  it('texte entrant : corps ou légende', () => {
    expect(extractInboundText({ type: 'image', image: { caption: ' Ce modèle ' } })).toBe('Ce modèle');
    expect(extractInboundText({ type: 'text', text: { body: 'x' } })).toBe('x');
  });
  it('config : défauts et garde du group_id', () => {
    expect(normalizeSalonConfig(null).group_id).toBe(G);
    expect(normalizeSalonConfig({ group_id: 'nimporte' }).group_id).toBe(G);
    expect(normalizeSalonConfig({ group_id: '1203634@g.us', enabled: false }).enabled).toBe(false);
  });
  it('accusé de réception mentionne le client et la référence', () => {
    const m = buildAckMessage('R-ABCD1234', '24107425560');
    expect(m).toContain('R-ABCD1234');
    expect(m).toContain('@24107425560');
  });
});

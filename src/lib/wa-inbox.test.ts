import { describe, expect, it } from 'vitest';
import { conversationPatch, describeMessage, extractContext, sourceFromContext, mergeReceipt, normalizeReceipt, fillTemplate, formatPhone, isIgnoredType, isPrivateChat, messageSentAt, normalizeQuickReplies, phoneFromChatId, previewText, splitLinks, summarizeThread } from './wa-inbox';

describe('isPrivateChat — seules les conversations clients entrent dans la messagerie', () => {
  it('accepte un numéro, refuse groupes, chaînes et vide', () => {
    expect(isPrivateChat('24106871309@s.whatsapp.net')).toBe(true);
    expect(isPrivateChat('120363@g.us')).toBe(false);
    expect(isPrivateChat('1203@newsletter')).toBe(false);
    expect(isPrivateChat(undefined)).toBe(false);
    expect(phoneFromChatId('24106871309@s.whatsapp.net')).toBe('24106871309');
  });
});

describe('describeMessage — contenu d’un message webhook', () => {
  it('texte, photo avec légende, vocal, document ; ignore les votes', () => {
    expect(describeMessage({ type: 'text', text: { body: '  Bonjour ' } })?.text).toBe('Bonjour');
    const img = describeMessage({ type: 'image', image: { caption: 'ça ?', link: 'https://x/a.jpg' } });
    expect(img).toMatchObject({ media_kind: 'image', media_url: 'https://x/a.jpg', text: 'ça ?' });
    expect(describeMessage({ type: 'voice', voice: { link: 'https://x/v.ogg' } })).toMatchObject({ type: 'audio', media_kind: 'audio' });
    expect(describeMessage({ type: 'document', document: { link: 'https://x/d.pdf', filename: 'devis.pdf' } })?.filename).toBe('devis.pdf');
    expect(describeMessage({ type: 'poll_update' })).toBeNull();
    expect(describeMessage({ type: 'reaction' })).toBeNull();
  });
  it('aperçu court avec icône', () => {
    expect(previewText({ type: 'image', text: '', media_url: 'u', media_kind: 'image', filename: null })).toBe('📷 Photo');
    expect(previewText({ type: 'text', text: 'x'.repeat(120), media_url: null, media_kind: null, filename: null })).toHaveLength(90);
  });
  it('date : timestamp WHAPI en secondes, sinon maintenant', () => {
    expect(messageSentAt({ timestamp: 1790000000 })).toBe('2026-09-21T14:13:20.000Z');
    const now = new Date('2026-09-23T10:00:00Z');
    expect(messageSentAt({}, now)).toBe(now.toISOString());
  });
});

describe('conversationPatch — suivi « à répondre »', () => {
  const d = { type: 'text', text: 'Prix du canapé ?', media_url: null, media_kind: null, filename: null };
  it('message client : non-lus +1, rouvre même une conversation clôturée, prend le nom WhatsApp', () => {
    const p = conversationPatch({ status: 'closed', unread_count: 2, name: null }, { from_name: 'Hermine' }, d, '2026-09-23T10:00:00Z');
    expect(p).toMatchObject({ unread_count: 3, status: 'open', name: 'Hermine', last_inbound_at: '2026-09-23T10:00:00Z' });
  });
  it('notre réponse : non-lus à 0, statut répondue (clôturée reste clôturée)', () => {
    expect(conversationPatch({ status: 'open', unread_count: 3, name: 'H' }, { from_me: true }, d, 't')).toMatchObject({ unread_count: 0, status: 'replied' });
    expect(conversationPatch({ status: 'closed', unread_count: 0, name: 'H' }, { from_me: true }, d, 't')).toMatchObject({ status: 'closed' });
  });
});

describe('phrases rapides et modèles', () => {
  it('normalise, dédoublonne les ids, ignore les vides', () => {
    const q = normalizeQuickReplies([{ id: 'a', label: 'A', text: 'x' }, { id: 'a', text: 'y' }, { text: '' }, { text: 'sans id ni label' }]);
    expect(q.map((x) => x.id)).toEqual(['a', 'a_', 'q3']);
    expect(q[2].label).toBe('sans id ni label');
  });
  it('remplit nom, prénom et numéro', () => {
    expect(fillTemplate('Bonjour {prenom} ({nom}) {numero}', { name: 'Hermine Prisca', phone: '24106871309' })).toBe('Bonjour Hermine (Hermine Prisca) +24106871309');
    expect(fillTemplate('Bonjour {nom} 👋', { name: null })).toBe('Bonjour 👋');
  });
  it('formate un numéro gabonais', () => {
    expect(formatPhone('24106871309')).toBe('+241 06 87 13 09');
    expect(formatPhone('33612345678')).toBe('+33612345678');
  });
});

describe('messages avec lien et autres types (24 sept. 2026)', () => {
  it('link_preview : texte complet avec le lien, URL et titre gardés', () => {
    const d = describeMessage({
      type: 'link_preview',
      link_preview: { body: 'Notre catalogue : https://twinsk-production.up.railway.app/offer/e577', url: 'https://twinsk-production.up.railway.app/offer/e577', title: 'Canapés Salon Collection Fin 2026' },
    });
    expect(d).toMatchObject({ type: 'link_preview', text: 'Notre catalogue : https://twinsk-production.up.railway.app/offer/e577', media_url: 'https://twinsk-production.up.railway.app/offer/e577', filename: 'Canapés Salon Collection Fin 2026' });
    expect(previewText(d!)).toMatch(/^🔗 Notre catalogue/);
  });
  it('lien seul sans texte : le lien devient le texte', () => {
    expect(describeMessage({ type: 'link_preview', link_preview: { url: 'https://x.io/a' } })?.text).toBe('https://x.io/a');
  });
  it('gif, réponse à bouton, type inconnu avec texte ; réactions ignorées', () => {
    expect(describeMessage({ type: 'gif', gif: { link: 'https://x/a.mp4' } })).toMatchObject({ type: 'video', media_kind: 'video' });
    expect(describeMessage({ type: 'reply', reply: { buttons_reply: { title: 'Oui, je commande' } } })?.text).toBe('Oui, je commande');
    expect(describeMessage({ type: 'nouveau_type', ...({ nouveau_type: { body: 'texte' } } as object) })?.text).toBe('texte');
    expect(describeMessage({ type: 'action' })).toBeNull();
    expect(isIgnoredType('action')).toBe(true);
    expect(isIgnoredType('nouveau_type')).toBe(false);
  });
});

describe('splitLinks — liens cliquables dans les bulles', () => {
  it('isole les liens, sans la ponctuation finale', () => {
    expect(splitLinks('Voir https://a.io/x?p=1. Merci')).toEqual([{ text: 'Voir ' }, { text: 'https://a.io/x?p=1', href: 'https://a.io/x?p=1' }, { text: '. Merci' }]);
    expect(splitLinks('sans lien')).toEqual([{ text: 'sans lien' }]);
  });
});

describe('summarizeThread — résumé recalculé après récupération de l’historique', () => {
  const msg = (from_me: boolean, sent_at: string, text = 'x') => ({ from_me, sent_at, type: 'text', text, media_url: null, media_kind: null, filename: null });
  it('non-lus = messages client après notre dernière réponse', () => {
    const r = summarizeThread([msg(false, '2026-09-23T10:00'), msg(true, '2026-09-23T10:05'), msg(false, '2026-09-23T10:10', 'Et le prix ?'), msg(false, '2026-09-23T10:11', 'Allô')], 'replied');
    expect(r).toMatchObject({ unread_count: 2, status: 'open', last_message_preview: 'Allô', last_inbound_at: '2026-09-23T10:11', last_outbound_at: '2026-09-23T10:05' });
  });
  it('dernier mot à nous : répondue ; clôturée : reste clôturée, sans non-lus', () => {
    expect(summarizeThread([msg(false, 'a'), msg(true, 'b')], 'open')).toMatchObject({ unread_count: 0, status: 'replied' });
    expect(summarizeThread([msg(true, 'a'), msg(false, 'b')], 'closed')).toMatchObject({ unread_count: 0, status: 'closed' });
    expect(summarizeThread([], 'open')).toBeNull();
  });
});

describe('mergeReceipt — coches WhatsApp', () => {
  it('progresse envoyé → reçu → lu, sans jamais reculer', () => {
    expect(mergeReceipt(null, 'sent')).toBe('sent');
    expect(mergeReceipt('sent', 'delivered')).toBe('delivered');
    expect(mergeReceipt('delivered', 'read')).toBe('read');
    expect(mergeReceipt('read', 'delivered')).toBe('read'); // accusés arrivés dans le désordre
    expect(mergeReceipt('read', 'played')).toBe('played');
  });
  it('échec : seulement si le message n’est pas parvenu ; inconnus ignorés', () => {
    expect(mergeReceipt('sent', 'failed')).toBe('failed');
    expect(mergeReceipt('delivered', 'failed')).toBe('delivered');
    expect(mergeReceipt('failed', 'sent')).toBe('sent');
    expect(mergeReceipt('read', 'deleted')).toBe('read');
    expect(normalizeReceipt('deleted')).toBeNull();
  });
});

describe('extractContext — d’où vient le client, à quoi il répond', () => {
  it('pub Facebook « Envoyer un message WhatsApp » : titre, texte, image, lien, id', () => {
    const ctx = extractContext({
      context: {
        conversion: { source: 'FB_Ads' },
        ad: {
          title: 'Pizzeria clé en main — Libreville',
          body: '🍕 Ajoutez une pizzeria dans votre quartier !',
          media_type: 'video',
          preview_url: 'https://scontent.xx.fbcdn.net/p.jpg',
          media_url: 'https://facebook.com/ads/v',
          source: { id: '120253338342900019', type: 'ad', url: 'https://fb.me/6q1KgsrDN' },
        },
      },
    });
    expect(ctx?.ad).toEqual({
      title: 'Pizzeria clé en main — Libreville',
      body: '🍕 Ajoutez une pizzeria dans votre quartier !',
      image: 'https://scontent.xx.fbcdn.net/p.jpg',
      media_type: 'video',
      url: 'https://fb.me/6q1KgsrDN',
      ad_id: '120253338342900019',
      platform: 'FB_Ads',
    });
    expect(sourceFromContext(ctx, '2026-09-24T01:10:00Z')).toMatchObject({ type: 'ad', title: 'Pizzeria clé en main — Libreville', ad_id: '120253338342900019', url: 'https://fb.me/6q1KgsrDN' });
  });
  it('message cité : texte, légende ou type à défaut', () => {
    expect(extractContext({ context: { quoted_id: 'q1', quoted_author: '24106', quoted_content: { body: 'Le canapé gris ?' }, quoted_type: 'text' } })?.quoted).toEqual({ id: 'q1', author: '24106', text: 'Le canapé gris ?', type: 'text' });
    expect(extractContext({ context: { quoted_id: 'q2', quoted_type: 'image', quoted_content: {} } })?.quoted?.text).toBe('📷 Photo');
  });
  it('sans contexte utile : null ; pas de pub, pas d’origine', () => {
    expect(extractContext({})).toBeNull();
    expect(extractContext({ context: {} })).toBeNull();
    expect(sourceFromContext(null, 't')).toBeNull();
  });
});

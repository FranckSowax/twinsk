import { describe, expect, it } from 'vitest';
import { buildRfqMessages, fillPlaceholders, mailtoLink, quantitiesFromLines, quantitiesZhFromLines, remainingPlaceholders, rfqLotFor, shortQuantity, whatsappLink } from './rfq';
import { DOM_TOM_TEMPLATE } from './templates/dom-tom';
import { contactSystemPrompt, validateContactFind, validateGeneratedTemplate } from './ai';

describe('messages RFQ prêts à partir (EN + ZH)', () => {
  const gazon = rfqLotFor('Gazon', DOM_TOM_TEMPLATE);
  const texts = buildRfqMessages(gazon, DOM_TOM_TEMPLATE.rfq_context);
  it('matière du modèle reprise : produit EN/ZH, quantités, exigences communes + du lot', () => {
    expect(gazon.product_zh).toContain('免填充足球草');
    expect(texts.email_subject_en).toMatch(/^RFQ — Non-infill football turf 30 mm .* qty 5,800 m² — 8 five-a-side/);
    expect(texts.email_body_en).toContain('Dear [Factory] team,');
    expect(texts.email_body_en).toContain('- UV ≥ 5,000 h test report');
    expect(texts.email_body_en).toContain('- PU coating preferred over SBR latex');
    expect(texts.email_body_en).toContain('30% deposit max');
    expect(texts.short_en).toContain('Hello [Contact], this is [Name] from [Company].');
    expect(texts.short_zh).toContain('您好 [称呼]');
    expect(texts.short_zh).toContain('FOB 价格');
    expect(DOM_TOM_TEMPLATE.lots.every((l) => DOM_TOM_TEMPLATE.rfq!.some((r) => r.lot === l))).toBe(true);
  });
  it('lot sans matière : composé depuis les lignes de devis, unités traduites', () => {
    const t = { quote_lines: [{ lot: 'Fours', label: 'Deck oven 3 trays', unit: 'pièce', quantity: 3, unit_price: null, optional: false, phase: null }, { lot: 'Fours', label: 'Proofer', unit: 'kit', quantity: 2, unit_price: null, optional: false, phase: null }] };
    const m = rfqLotFor('Fours', t);
    expect(m).toMatchObject({ product_en: 'Fours', product_zh: 'Fours', quantities_en: 'Deck oven 3 trays — approx. 3 pcs; Proofer — approx. 2 sets', requirements_en: [] });
    expect(quantitiesZhFromLines(t.quote_lines)).toBe('约 3 件、约 2 套');
    expect(quantitiesFromLines([])).toBe('');
    const x = buildRfqMessages(m, undefined, { quantities_zh: quantitiesZhFromLines(t.quote_lines) });
    expect(x.short_zh).toContain('数量约 3 件、约 2 套');
    expect(x.email_body_en).toContain('a turnkey equipment program');
    expect(shortQuantity('approx. 5,800 m² turf + 4,800 m² shockpad total')).toBe('5,800 m²');
    expect(shortQuantity('8 sets total, 4 sets per phase')).toBe('8 sets');
    expect(shortQuantity('')).toBe('TBC');
  });
  it('crochets remplis avec l’usine et la signature ; ceux qui restent sont listés', () => {
    const filled = fillPlaceholders(texts.short_zh + '\n' + texts.email_body_en, { factory: 'Taishan Turf', contact: 'Lily', sender: { name: 'Franck', company: 'Twinsk', whatsapp: '+241 00 00 00 00', email: 'f@twinsk.com' } });
    expect(filled).toContain('您好 Lily，我是 Twinsk 的 Franck');
    expect(filled).toContain('Dear Taishan Turf team,');
    expect(filled).toContain('WhatsApp/WeChat: +241 00 00 00 00');
    expect(remainingPlaceholders(filled)).toEqual([]);
    expect(remainingPlaceholders(fillPlaceholders(texts.short_en, { sender: { name: 'Franck' } }))).toEqual(['[Contact]', '[Company]']);
  });
  it('liens WhatsApp et e-mail préremplis ; null sans numéro ou adresse valide', () => {
    expect(whatsappLink('+86 158-8939-3968', 'Hello')).toBe('https://wa.me/8615889393968?text=Hello');
    expect(whatsappLink('', 'x')).toBeNull();
    expect(mailtoLink('info@mecree.com', 'RFQ', 'Body')).toBe('mailto:info@mecree.com?subject=RFQ&body=Body');
    expect(mailtoLink('site web', 'a', 'b')).toBeNull();
  });
});

describe('plan IA : matière RFQ par lot et recherche de contacts', () => {
  it('rfq rattachés aux lots (rapprochement tolérant), doublons écartés, contexte repris', () => {
    const t = validateGeneratedTemplate({
      title: 'P', steps: [{ title: 'S', tasks: [{ title: 'T' }] }],
      quote_lines: [{ lot: 'Fours', label: 'Four', quantity: 2 }], lots: ['Fours', 'Vitrines'],
      rfq_context: { project_en: '3 bakeries in Libreville, Gabon (hot and humid)', project_zh: '加蓬利伯维尔的 3 家面包店', requirements_en: ['230 V / 50 Hz'] },
      rfq: [{ lot: 'fours', product_en: 'Deck oven', product_zh: '层炉', quantities_en: '2 pcs', requirements_en: ['Gas + electric'] }, { lot: 'Fours', product_en: 'dup' }, { lot: 'Inconnu', product_en: 'x' }],
    }, { currency: 'XAF', title: 'x' })!;
    expect(t.rfq_context).toEqual({ project_en: '3 bakeries in Libreville, Gabon (hot and humid)', project_zh: '加蓬利伯维尔的 3 家面包店', requirements_en: ['230 V / 50 Hz'] });
    expect(t.rfq).toEqual([{ lot: 'Fours', product_en: 'Deck oven', product_zh: '层炉', quantities_en: '2 pcs', requirements_en: ['Gas + electric'] }]);
    const m = buildRfqMessages(rfqLotFor('Vitrines', t), t.rfq_context);
    expect(m.short_en).toContain('Interested in Vitrines');
    expect(m.email_body_en).toContain('- 230 V / 50 Hz');
  });
  it('contacts trouvés validés : e-mail et WhatsApp plausibles seulement, canal borné, rien → null', () => {
    const c = validateContactFind({ contact_name: 'Lily', email: 'sales@taishanturf.com', whatsapp: '+86 158 8939 3968', wechat: null, phone: 'n/a', website: 'https://taishanturf.com', preferred_channel: 'WhatsApp', source: 'https://taishanturf.com/contact', confidence: 'HIGH', notes: 'Page contact officielle.' })!;
    expect(c).toMatchObject({ contact_name: 'Lily', email: 'sales@taishanturf.com', whatsapp: '+86 158 8939 3968', preferred_channel: 'whatsapp', confidence: 'high' });
    expect(validateContactFind({ email: 'pas une adresse', whatsapp: '123' })).toBeNull();
    expect(validateContactFind({ email: 'x@y.cn', preferred_channel: 'fax', confidence: '?' })).toMatchObject({ preferred_channel: 'email', confidence: 'low' });
    expect(contactSystemPrompt()).toContain('Ne jamais inventer un contact');
  });
});

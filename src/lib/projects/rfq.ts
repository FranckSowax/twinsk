// Messages RFQ « prêts à partir » vers les usines, par lot : e-mail détaillé en
// anglais, message court de premier contact en anglais et en chinois (WeChat,
// WhatsApp). Composés à la création du projet (modèle déclaratif ou plan IA),
// modifiables ensuite par l'équipe. Pure : aucun accès base ni réseau.
//
// Les crochets ([Factory], [Name], [Nom]…) sont remplis au moment de l'envoi
// avec l'usine choisie et la signature du projet (fillPlaceholders).

import type { QuoteLineTemplate, RfqContext, RfqLotTemplate, RfqSender } from './types';

export interface RfqTexts {
  email_subject_en: string;
  email_body_en: string;
  short_en: string;
  short_zh: string;
}

/** Contexte par défaut quand le modèle n'en fournit pas (programme générique). */
export const DEFAULT_RFQ_CONTEXT: RfqContext = {
  project_en: 'a turnkey equipment program',
  project_zh: '一个交钥匙设备项目',
  requirements_en: [
    'Tropical climate: UV resistance test report, corrosion protection (hot-dip galvanized + powder coating or stainless steel where relevant)',
    'Execution drawings and technical data sheets in English',
    'Installation manual (English, French if available)',
  ],
};

const UNIT_EN: Record<string, string> = { 'm²': 'm²', m2: 'm²', pièce: 'pcs', piece: 'pcs', pièces: 'pcs', kit: 'sets', kits: 'sets', forfait: 'lot', lot: 'lot', ml: 'linear m', m: 'm', unité: 'units', unite: 'units' };
const UNIT_ZH: Record<string, string> = { 'm²': '平方米', m2: '平方米', pièce: '件', piece: '件', pièces: '件', kit: '套', kits: '套', forfait: '项', lot: '项', ml: '延米', m: '米', unité: '台', unite: '台' };
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

/** Ligne de quantités composée depuis les lignes de devis d'un lot (repli quand le modèle n'en donne pas). */
export function quantitiesFromLines(lines: Pick<QuoteLineTemplate, 'label' | 'unit' | 'quantity'>[]): string {
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => `${l.label} — approx. ${fmt(l.quantity)} ${UNIT_EN[l.unit.toLowerCase()] || l.unit}`)
    .join('; ');
}
/** Quantité résumée en chinois (« 约 5,800 平方米 ») depuis les lignes de devis. */
export function quantitiesZhFromLines(lines: Pick<QuoteLineTemplate, 'unit' | 'quantity'>[]): string {
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => `约 ${fmt(l.quantity)} ${UNIT_ZH[l.unit.toLowerCase()] || l.unit}`)
    .join('、');
}

/** Matière RFQ d'un lot : celle du modèle si elle existe, sinon composée depuis les lignes de devis du lot. */
export function rfqLotFor(lot: string, template: { rfq?: RfqLotTemplate[]; quote_lines: QuoteLineTemplate[] }): RfqLotTemplate {
  const given = template.rfq?.find((r) => r.lot === lot);
  const lines = template.quote_lines.filter((l) => l.lot === lot);
  return {
    lot,
    product_en: given?.product_en || lot,
    product_zh: given?.product_zh || lot,
    quantities_en: given?.quantities_en || quantitiesFromLines(lines) || 'quantities to be confirmed',
    requirements_en: given?.requirements_en?.length ? given.requirements_en : [],
  };
}

/** Compose les trois messages d'un lot. Les crochets restent à remplir à l'envoi. */
export function buildRfqMessages(lot: RfqLotTemplate, ctx: RfqContext = DEFAULT_RFQ_CONTEXT, opts: { quantities_zh?: string } = {}): RfqTexts {
  const reqs = [...ctx.requirements_en, ...lot.requirements_en].filter(Boolean);
  const qtyShort = shortQuantity(lot.quantities_en);
  const email_subject_en = `RFQ — ${lot.product_en}, qty ${qtyShort} — ${ctx.project_en}`;
  const email_body_en = [
    'Dear [Factory] team,',
    '',
    `We are a project developer preparing ${ctx.project_en}. We are sourcing from Chinese factories and are now shortlisting partners for a framework agreement with volume-based pricing.`,
    '',
    `Product: ${lot.product_en}.`,
    `Estimated quantities: ${lot.quantities_en}.`,
    '',
    'Mandatory requirements:',
    ...reqs.map((r) => `- ${r}`),
    '',
    'Please reply with:',
    '1) FOB price (port of loading) and, if possible, CIF/DAP price to destination, with volume discount tiers;',
    "2) packing list (weight and m³ per 40' HC);",
    '3) production lead time;',
    '4) certificates (ISO, CE, SGS test reports);',
    '5) 2–3 export references (tropical climate preferred);',
    '6) supervision option: cost for 1 technician on site (days, daily rate, what is included) and remote support (CAD, 3D video, photo checkpoints);',
    '7) warranty terms and spare parts availability (5 years).',
    '',
    'Payment via LC at sight or Alibaba Trade Assurance, 30% deposit max, balance after pre-shipment inspection by SGS/BV. A factory audit will be scheduled before order.',
    '',
    'Best regards,',
    '[Name]',
    '[Company]',
    'WhatsApp/WeChat: [WhatsApp/WeChat ID]',
    'E-mail: [E-mail]',
  ].join('\n');
  const short_en = `Hello [Contact], this is [Name] from [Company]. We are preparing ${ctx.project_en}. Interested in ${lot.product_en} — ${lot.quantities_en}. Could you share FOB price, packing per 40' HC, lead time, certificates (ISO/CE/SGS) and on-site supervision option? Full RFQ by e-mail. Thanks!`;
  const short_zh = `您好 [称呼]，我是 [Company] 的 [Name]。我们正在筹备${ctx.project_zh}。想采购${lot.product_zh}，数量${opts.quantities_zh || `：${lot.quantities_en}`}。请提供 FOB 价格、每 40 尺高柜装箱量、交期、证书（ISO/CE/SGS 检测报告）以及现场安装指导方案和报价。详细询价单将通过邮件发送。谢谢！`;
  return { email_subject_en, email_body_en, short_en, short_zh };
}

/** Quantité abrégée pour l'objet de l'e-mail (« approx. 5,800 m² total » → « 5,800 m² »). */
export function shortQuantity(q: string): string {
  const m = /([\d,.]+\s*(?:m²|m2|sets?|pcs|units?|kits?|lots?|linear m)?)/i.exec(q.replace(/approx\.?\s*/i, ''));
  return (m?.[1] || q).trim().slice(0, 40) || 'TBC';
}

/** Remplit les crochets avec l'usine et la signature ; ceux qui restent inconnus sont laissés tels quels. */
export function fillPlaceholders(text: string, v: { factory?: string | null; contact?: string | null; sender?: Partial<RfqSender> | null }): string {
  const s = v.sender || {};
  const id = [s.whatsapp, s.wechat].filter(Boolean).join(' / ');
  const rep: [RegExp, string | undefined][] = [
    [/\[Factory\]/g, v.factory || undefined],
    [/\[Contact\]|\[称呼\]/g, v.contact || undefined],
    [/\[Name\]|\[Nom\]/g, s.name || undefined],
    [/\[Company\]|\[Société\]/g, s.company || undefined],
    [/\[WhatsApp\/WeChat ID\]/g, id || undefined],
    [/\[E-mail\]/g, s.email || undefined],
  ];
  let out = text;
  for (const [re, val] of rep) if (val) out = out.replace(re, val);
  return out;
}
/** Crochets encore présents (à compléter avant envoi). */
export function remainingPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]{1,40}\]/g) || [])];
}

/** Lien WhatsApp avec le texte prérempli ; null si le numéro est vide. */
export function whatsappLink(number: string | null | undefined, text: string): string | null {
  const digits = (number || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
export function mailtoLink(email: string | null | undefined, subject: string, body: string): string | null {
  const e = (email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return `mailto:${e}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

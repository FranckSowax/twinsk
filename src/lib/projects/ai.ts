// Assistants IA de l'onglet « Projets » — partie pure, testée (prompts,
// validation des réponses). Trois usages, décidés par Franck le 30 sept. 2026 :
//   1. créer un plan de projet depuis un brief libre (Kimi K2.6 via OpenRouter) ;
//   2. résumer une capture d'échange avec une usine (GLM 5.3 Flash, lit l'image) ;
//   3. préparer la mise à jour du jour du journal (GLM 5.3 Flash), à relire.
// Les appels réseau sont dans ai-server.ts.

import type { ProjectTemplate, TaskOwner } from './types';
import { validateExtractedOffer, type ExtractedOffer } from './offers';

// Kimi K2 (0905, sans phase de réflexion) : K2.6 consomme tout le budget de sortie à réfléchir.
export const PLAN_MODEL = process.env.PROJECT_PLAN_MODEL || 'moonshotai/kimi-k2-0905';
export const FLASH_MODEL = process.env.PROJECT_FLASH_MODEL || 'z-ai/glm-5.3-flash';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'x';

// ---- 1. Plan depuis un brief ----
export function planSystemPrompt(currency: string): string {
  return [
    'Tu es chef de projet chez un importateur qui livre des programmes clé en main (équipements sourcés en Chine, transport maritime ou aérien, installation supervisée) à des clients en Afrique et dans les DOM-TOM.',
    'À partir du brief du client, construis un plan d’action complet et réaliste, en français, sous forme de JSON strict :',
    `{"title":"titre court","description":"2 phrases","phases":[{"id":"phase1","name":"Phase 1 — …","sites":["site"]}],`,
    `"durations":{"transit":{"site":[min_jours,max_jours]},"production":[min,max],"technician_visa":[min,max],"padel_slab_cure":0},`,
    `"steps":[{"title":"Étape 0 — …","description":"…","tasks":[{"title":"…","description":"…","owner":"team|client","due_weeks":entier,"phase":"phase1|null","checklist":["point 1","point 2"]}]}],`,
    `"quote_lines":[{"lot":"…","label":"…","unit":"m²|pièce|kit|forfait","quantity":nombre,"optional":false,"phase":"phase1|null"}],`,
    `"lots":["…"],`,
    `"rfq_context":{"project_en":"the program in one sentence, in English (sites, climate)","project_zh":"same sentence in Chinese","requirements_en":["common mandatory requirements, English, 3 to 5"]},`,
    `"rfq":[{"lot":"one entry per lot","product_en":"product name with key specs, English","product_zh":"same in Chinese","quantities_en":"approx. quantities with phasing, English","requirements_en":["lot-specific requirements, English, 2 to 4"]}]}`,
    'Règles : 6 à 9 étapes dans l’ordre cadrage → consultation des usines par lot → due diligence et audits → devis et validation → production et contrôle qualité → logistique → montage et réception → rapport final ; 2 à 6 tâches par étape ; owner "client" pour ce que seul le client peut décider ou fournir (plans, validation, paiements, taxes locales) ; due_weeks croissants et cohérents avec les durées ; une ligne de devis par équipement ou service, quantités estimées depuis le brief, options marquées optional ; phases seulement si le brief découpe le programme (sinon une seule phase) ;',
    `montants absents (les prix sont chiffrés ensuite par l’équipe) ; devise ${currency} ; rfq_context et rfq en anglais et en chinois simplifié (ils servent aux messages envoyés aux usines), un rfq par lot ; ne rien inventer qui contredise le brief ; JSON seul, sans commentaire.`,
  ].join('\n');
}

/** Réponse du modèle → modèle de projet valide (défauts, plafonds, jamais d'exception). */
export function validateGeneratedTemplate(raw: unknown, fallback: { currency: string; title: string }): ProjectTemplate | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const phasesRaw = arr(r.phases).slice(0, 6);
  const phases = phasesRaw.map((p, i) => {
    const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const id = slug(str(o.id, 40) || `phase${i + 1}`);
    return { id, name: str(o.name, 120) || `Phase ${i + 1}`, order: i + 1, sites: arr(o.sites).map((x) => str(x, 60)).filter(Boolean).slice(0, 10) };
  });
  if (!phases.length) phases.push({ id: 'phase1', name: 'Phase unique', order: 1, sites: [] });
  // Rapprochement tolérant : « phase-2 », « Phase 2 » et « phase2 » désignent la même phase.
  const norm = (x: string) => slug(x).replace(/-/g, '');
  const phaseByNorm = new Map(phases.map((p) => [norm(p.id), p.id]));
  phases.forEach((p) => phaseByNorm.set(norm(p.name), p.id));
  const phaseRef = (v: unknown): string | null => phaseByNorm.get(norm(str(v, 120))) ?? null;
  const d = (r.durations && typeof r.durations === 'object' ? r.durations : {}) as Record<string, unknown>;
  const pair = (v: unknown, def: [number, number]): [number, number] => {
    const a = arr(v);
    const lo = num(a[0], def[0], 0, 365);
    const hi = num(a[1], def[1], lo, 400);
    return [lo, hi];
  };
  const transit: Record<string, [number, number]> = {};
  for (const [k, v] of Object.entries((d.transit && typeof d.transit === 'object' ? d.transit : {}) as Record<string, unknown>)) {
    const key = str(k, 60);
    if (key) transit[key] = pair(v, [30, 60]);
  }
  const steps = arr(r.steps)
    .slice(0, 12)
    .map((s, si) => {
      const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      const title = str(o.title, 140) || `Étape ${si}`;
      const tasks = arr(o.tasks)
        .slice(0, 10)
        .map((t, ti) => {
          const x = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
          const tt = str(x.title, 140);
          if (!tt) return null;
          return {
            key: `${slug(title).slice(0, 20)}-${si}-${ti}`,
            title: tt,
            description: str(x.description, 500),
            owner: (x.owner === 'client' ? 'client' : 'team') as TaskOwner,
            due_weeks: num(x.due_weeks, si * 3 + ti, 0, 260),
            checklist: arr(x.checklist).map((c) => str(c, 120)).filter(Boolean).slice(0, 8),
            phase: phaseRef(x.phase),
          };
        })
        .filter((t): t is NonNullable<typeof t> => !!t);
      return { key: `${slug(title).slice(0, 24)}-${si}`, title, description: str(o.description, 300), tasks };
    })
    .filter((s) => s.tasks.length);
  if (!steps.length) return null;
  const quote_lines = arr(r.quote_lines)
    .slice(0, 60)
    .map((l) => {
      const x = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
      const label = str(x.label, 160);
      if (!label) return null;
      return { lot: str(x.lot, 60) || 'Divers', label, unit: str(x.unit, 20) || 'pièce', quantity: num(x.quantity, 1, 0, 1_000_000), unit_price: null, optional: x.optional === true, phase: phaseRef(x.phase) };
    })
    .filter((l): l is NonNullable<typeof l> => !!l);
  const lots = [...new Set([...arr(r.lots).map((x) => str(x, 60)).filter(Boolean), ...quote_lines.map((l) => l.lot)])].slice(0, 20);
  const rc = (r.rfq_context && typeof r.rfq_context === 'object' ? r.rfq_context : {}) as Record<string, unknown>;
  const rfq_context = str(rc.project_en, 400) ? { project_en: str(rc.project_en, 400), project_zh: str(rc.project_zh, 400) || str(rc.project_en, 400), requirements_en: arr(rc.requirements_en).map((x) => str(x, 200)).filter(Boolean).slice(0, 6) } : undefined;
  const lotByNorm = new Map(lots.map((l) => [norm(l), l]));
  const rfq = arr(r.rfq)
    .slice(0, 20)
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const lot = lotByNorm.get(norm(str(o.lot, 60))) || '';
      if (!lot) return null;
      return { lot, product_en: str(o.product_en, 200) || lot, product_zh: str(o.product_zh, 200) || str(o.product_en, 200) || lot, quantities_en: str(o.quantities_en, 200), requirements_en: arr(o.requirements_en).map((q) => str(q, 200)).filter(Boolean).slice(0, 6) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .filter((x, i, a) => a.findIndex((y) => y.lot === x.lot) === i);
  return {
    key: `ia-${slug(str(r.title, 60) || fallback.title)}`,
    title: str(r.title, 120) || fallback.title,
    description: str(r.description, 600),
    currency: fallback.currency,
    phases,
    durations: { transit, production: pair(d.production, [21, 42]), technician_visa: pair(d.technician_visa, [28, 56]), padel_slab_cure: num(d.padel_slab_cure, 0, 0, 90) },
    lots,
    steps,
    quote_lines,
    business_trip: { title: 'Voyage d’audit des usines', days: [] },
    final_report_checklist: ['Dossier des ouvrages exécutés (plans, certificats)', 'Rapports de tests et de réception', 'Contrats de garantie', 'Manuel d’exploitation en français et formation', 'Bilan financier vs devis'],
    rfq_context,
    rfq,
  };
}

// ---- 4. Recherche des contacts d'une usine (modèle avec recherche web) ----
export function contactSystemPrompt(): string {
  return (
    'Tu aides une équipe d’import à trouver comment joindre une usine chinoise. On te donne le nom de l’usine, éventuellement son site web, sa ville et son produit. ' +
    'Cherche sur le web (site officiel, page contact, Alibaba, Made-in-China, LinkedIn) et réponds UNIQUEMENT par un JSON : ' +
    '{"contact_name":"nom du commercial export ou null","email":"adresse e-mail ou null","wechat":"identifiant WeChat ou null","whatsapp":"numéro WhatsApp international (+86…) ou null","phone":"téléphone ou null","website":"site officiel ou null","preferred_channel":"email|wechat|whatsapp|alibaba|website|phone","source":"URL où le contact a été trouvé","confidence":"high|medium|low","notes":"1 phrase en français : ce qui a été vérifié ou pas"}. ' +
    'Ne jamais inventer un contact : null si rien n’est trouvé. Préférer l’adresse générique du site officiel (sales@, info@) à une adresse trouvée sur un annuaire tiers.'
  );
}
export interface ContactFind {
  contact_name: string | null;
  email: string | null;
  wechat: string | null;
  whatsapp: string | null;
  phone: string | null;
  website: string | null;
  preferred_channel: 'email' | 'wechat' | 'whatsapp' | 'alibaba' | 'website' | 'phone';
  source: string | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}
export function validateContactFind(raw: unknown): ContactFind | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const opt = (v: unknown, max: number) => str(v, max) || null;
  const email = opt(r.email, 120);
  const whatsapp = opt(r.whatsapp, 40);
  const out: ContactFind = {
    contact_name: opt(r.contact_name, 80),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    wechat: opt(r.wechat, 60),
    whatsapp: whatsapp && whatsapp.replace(/\D/g, '').length >= 8 ? whatsapp : null,
    phone: opt(r.phone, 40),
    website: opt(r.website, 200),
    preferred_channel: (['email', 'wechat', 'whatsapp', 'alibaba', 'website', 'phone'] as const).find((c) => c === str(r.preferred_channel, 20).toLowerCase()) || 'email',
    source: opt(r.source, 300),
    confidence: (['high', 'medium', 'low'] as const).find((c) => c === str(r.confidence, 10).toLowerCase()) || 'low',
    notes: str(r.notes, 300),
  };
  if (!out.email && !out.wechat && !out.whatsapp && !out.phone && !out.website) return null;
  return out;
}

// ---- 2. Résumé d'une capture d'échange ----
export const EXCHANGE_SYSTEM_PROMPT =
  'Tu assistes une équipe d’import qui négocie avec des usines en Chine. On te donne des captures d’écran de conversation (WeChat, WhatsApp, e-mail), parfois en chinois ou en anglais, et éventuellement des notes. ' +
  'Réponds UNIQUEMENT par un JSON : {"summary":"résumé en français, 3 à 6 phrases : qui, quoi, prix ou délais cités, engagements pris de chaque côté","next_action":"la prochaine action concrète pour l’équipe ou null","next_action_days":entier ou null,"channel":"wechat|email|whatsapp|phone|other","language":"zh|en|fr|autre","key_figures":["prix, MOQ, délais cités, tels quels"]}. ' +
  'Traduis en français ce qui est en chinois ou en anglais ; ne rien inventer ; si l’image est illisible, dis-le dans summary.';
export interface ExchangeSummary {
  summary: string;
  next_action: string | null;
  next_action_days: number | null;
  channel: string;
  language: string;
  key_figures: string[];
}
export function validateExchangeSummary(raw: unknown): ExchangeSummary | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const summary = typeof r.summary === 'string' ? r.summary.trim().slice(0, 2000) : '';
  if (!summary) return null;
  const ch = str(r.channel, 20).toLowerCase();
  return {
    summary,
    next_action: str(r.next_action, 300) || null,
    next_action_days: r.next_action_days == null ? null : num(r.next_action_days, 3, 0, 90),
    channel: ['wechat', 'email', 'whatsapp', 'phone', 'visit', 'other'].includes(ch) ? ch : 'other',
    language: str(r.language, 10) || 'autre',
    key_figures: arr(r.key_figures).map((x) => str(x, 120)).filter(Boolean).slice(0, 10),
  };
}

// ---- 3. Brouillon de la mise à jour du jour ----
export const UPDATE_SYSTEM_PROMPT =
  'Tu rédiges, pour le client d’un programme d’équipement clé en main, la mise à jour du jour de son espace projet, à partir des faits fournis (tâches terminées, commandes, questions, documents, échanges usines résumés). ' +
  'Français clair, ton professionnel et rassurant, 4 à 8 phrases ou une courte liste, sans jargon interne, sans nom d’usine ni prix d’achat (parler de « notre fournisseur » ou « l’usine retenue »). ' +
  'Réponds UNIQUEMENT par un JSON : {"title":"titre court","body":"texte"}. Si rien de notable, propose une mise à jour brève sur ce qui est en cours.';
export interface UpdateFacts {
  projectTitle: string;
  since: string;
  tasksDone: string[];
  tasksDue: string[];
  orders: string[];
  questionsAnswered: string[];
  questionsOpen: string[];
  documents: string[];
  exchanges: string[];
  progressPct: number;
}
export function updateFactsPrompt(f: UpdateFacts): string {
  const list = (label: string, items: string[]) => (items.length ? `${label} :\n${items.slice(0, 12).map((x) => `- ${x}`).join('\n')}` : `${label} : aucun`);
  return [
    `Projet : ${f.projectTitle}. Avancement : ${f.progressPct} %. Période : depuis ${f.since}.`,
    list('Tâches terminées', f.tasksDone),
    list('Tâches à échéance dans les 7 jours', f.tasksDue),
    list('Commandes (statut)', f.orders),
    list('Questions du client traitées', f.questionsAnswered),
    list('Questions encore ouvertes', f.questionsOpen),
    list('Documents déposés', f.documents),
    list('Échanges avec les usines (résumés internes, à reformuler sans nom d’usine)', f.exchanges),
  ].join('\n\n');
}
export function validateUpdateDraft(raw: unknown): { title: string; body: string } | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const title = str(r.title, 140);
  const body = typeof r.body === 'string' ? r.body.trim().slice(0, 4000) : '';
  return title && body ? { title, body } : null;
}

// ---- 5. Analyse d'un échange avec une usine : réponse proposée et questions pour le client ----
export interface ExchangeContext {
  company: string;
  project: string | null;
  lot: string | null;
  factory: string | null;
  product: string | null;
  quantities: string | null;
  requirements: string[];
  history: string[];
  sender: string | null;
}
export function exchangeAnalysisPrompt(c: ExchangeContext): string {
  return [
    `Tu es acheteur senior chez ${c.company}, importateur qui source en Chine des équipements pour des programmes clé en main. Tu négocies avec une usine pour le compte d'un client (le « porteur de projet »), qui ne doit jamais connaître le nom ni les contacts de l'usine.`,
    'On te donne un échange avec cette usine (captures d’écran WeChat, WhatsApp ou e-mail, ou texte collé, en chinois, anglais ou français) et le contexte ci-dessous. Analyse-le comme un acheteur expérimenté, puis réponds UNIQUEMENT par un JSON :',
    '{"summary":"résumé en français, 3 à 6 phrases : ce que dit l’usine, prix, délais, conditions, engagements",',
    '"key_figures":["prix, MOQ, délais, conditions cités, tels quels"],',
    '"language":"zh|en|fr|autre","channel":"wechat|email|whatsapp|phone|other",',
    '"analysis":"explication et réflexion en français, 5 à 10 phrases : ce qui est solide, ce qui est flou ou manquant, les risques (négociant déguisé, prix anormal, certificats non fournis…), le levier de négociation, ce qu’il faut obtenir avant d’avancer, et pourquoi la réponse proposée est formulée ainsi",',
    '"reply_en":"réponse proposée en anglais, prête à envoyer : professionnelle, courtoise, précise ; remercie, reprend les points obtenus, demande ce qui manque (documents, prix détaillés, délais, conditions), répond aux questions de l’usine que l’équipe peut traiter seule, indique que les autres seront confirmées sous peu ; signée [Name]",',
    '"reply_fr":"la même réponse traduite en français, pour relecture",',
    '"reply_zh":"la même réponse en chinois simplifié si l’usine écrit en chinois, sinon null",',
    '"factory_questions":[{"original":"question posée par l’usine, telle quelle","fr":"la question reformulée en français comme une question de NOTRE équipe AU client : vouvoiement, claire, autonome, sans « nous » désignant l’usine (parler du « fabricant »), SANS nom, marque, ville ni contact de l’usine","needs_client":true,"why":"pourquoi seul le client peut répondre, ou comment l’équipe peut y répondre seule"}],',
    '"next_action":"prochaine action concrète pour l’équipe ou null","next_action_days":entier ou null,',
    '"price_offer": null si le message ne contient AUCUN prix ; sinon {"currency":"USD|CNY|EUR…","incoterm":"FOB|EXW|CIF|DAP… ou null","port":"port ou null","valid_until":"AAAA-MM-JJ ou null","lead_time":"délai ou null","moq":"minimum de commande ou null","payment_terms":"conditions de paiement ou null","notes":"conditions importantes (ce qui est inclus ou exclu) ou null","items":[{"kind":"base|option|fee","label":"produit ou option","variant":{"caractéristique":"valeur"},"unit":"m²|set|pcs|kit|forfait…","price":nombre ou null,"tiers":[{"min_qty":nombre,"price":nombre}],"per":"unit|order"}]}}',
    'Pour price_offer : une ligne « base » par produit ou par variante (hauteur, couleur, épaisseur… dans variant) ; « tiers » quand le prix dépend de la quantité ; « option » pour les suppléments ; « fee » pour les frais fixes (moule, échantillons, transport local), per "order" s’ils sont payés une fois ; clés de variant en français (Hauteur, Couleur, Épaisseur, Dimensions…) ; prix exactement comme écrits, en nombres (4.9, pas « 4,9 $ ») ; valid_until dans l’année en cours si l’année n’est pas précisée ; devise d’après le symbole (¥, RMB → CNY ; $ → USD) ; ne jamais inventer un prix.',
    'Règles : ne rien inventer (prix, délais, quantités, certifications) ; la réponse proposée ne prend AUCUN engagement non décidé (pas de commande, de prix cible ni de quantité ferme qui ne figurent pas dans le contexte) ; needs_client=true seulement pour ce que le client est seul à savoir ou décider (dimensions et plans des sites, couleurs, quantités définitives, options, budget, calendrier des chantiers, normes ou contraintes locales, logos) ; needs_client=false pour ce que l’équipe traite seule en tant qu’acheteur (conditions de paiement à l’usine, incoterm, port, logistique, emballage, documents et certificats, échantillons) ; si l’usine ne pose aucune question, factory_questions = [] ; si une capture est illisible, dis-le dans summary.',
    '',
    'Contexte :',
    `- Programme : ${c.project || 'non précisé'}`,
    `- Lot : ${c.lot || 'non précisé'}${c.product ? ` — produit demandé : ${c.product}` : ''}${c.quantities ? ` — quantités : ${c.quantities}` : ''}`,
    c.requirements.length ? `- Exigences communiquées à l’usine : ${c.requirements.join(' ; ')}` : '',
    `- Usine (interne, ne jamais la nommer côté client) : ${c.factory || 'non précisée'}`,
    c.history.length ? `- Échanges précédents avec cette usine (plus récent d’abord) :\n${c.history.map((h) => `  • ${h}`).join('\n')}` : '- Pas d’échange précédent enregistré.',
    `- Signature : ${c.sender || '[Name]'}`,
  ].filter(Boolean).join('\n');
}
export interface FactoryQuestion {
  original: string;
  fr: string;
  needs_client: boolean;
  why: string;
}
export interface ExchangeAnalysis extends ExchangeSummary {
  /** Prix trouvés dans le message, structurés (à relire avant d'enregistrer l'offre). */
  price_offer?: ExtractedOffer | null;
  analysis: string;
  reply_en: string;
  reply_fr: string;
  reply_zh: string | null;
  factory_questions: FactoryQuestion[];
  /** Posé quand la réponse proposée est partie (e-mail de la plateforme ou envoi noté à la main). */
  reply_sent?: { at: string; channel: string; via: 'platform' | 'manual'; by: string } | null;
}
const longText = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim().slice(0, max) : '');
export function validateExchangeAnalysis(raw: unknown): ExchangeAnalysis | null {
  const base = validateExchangeSummary(raw);
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const reply_en = longText(r.reply_en, 6000);
  if (!base || !reply_en) return null;
  const zh = longText(r.reply_zh, 6000);
  return {
    ...base,
    analysis: longText(r.analysis, 4000),
    reply_en,
    reply_fr: longText(r.reply_fr, 6000),
    reply_zh: zh && zh.toLowerCase() !== 'null' ? zh : null,
    price_offer: validateExtractedOffer(r.price_offer),
    factory_questions: arr(r.factory_questions)
      .map((q) => {
        const o = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>;
        const fr = longText(o.fr, 600);
        if (!fr) return null;
        return { original: longText(o.original, 600), fr, needs_client: o.needs_client === true || o.needs_client === 'true', why: longText(o.why, 400) };
      })
      .filter((q): q is FactoryQuestion => !!q)
      .slice(0, 12),
  };
}

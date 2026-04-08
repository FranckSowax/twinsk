// Kimi (Moonshot) API client for Chinese -> French translation

const KIMI_BASE_URL = 'https://api.moonshot.ai/v1/chat/completions';
// Use moonshot-v1-32k as primary (officially available, supports JSON mode + larger context)
// Fallback to moonshot-v1-8k if 32k unavailable
const KIMI_MODEL = 'moonshot-v1-32k';
const KIMI_FALLBACK_MODEL = 'moonshot-v1-8k';

export interface TranslationItem {
  id: string;
  title?: string;
  description?: string;
  seller?: string;
}

export interface TranslatedFields {
  title?: string;
  description?: string;
  seller?: string;
}

export type TranslationMap = Record<string, TranslatedFields>;

const SYSTEM_PROMPT = `Tu es un traducteur chinois→français spécialisé dans l'e-commerce et les fiches produits.
Règles strictes :
- Retourne UNIQUEMENT un JSON valide, sans aucun texte avant ou après.
- Format exact attendu : {"id1": {"title": "...", "description": "...", "seller": "..."}, "id2": {...}}
- Ne traduis pas les noms de marques ni les numéros de modèle.
- Pour le seller, traduis seulement si c'est un nom commun chinois ; garde tel quel si c'est un nom propre.
- Si un champ est absent dans l'entrée, omets-le dans la sortie.
- Reste concis et fidèle au sens.`;

async function callKimi(
  model: string,
  payload: object,
  signal?: AbortSignal
): Promise<Response> {
  return fetch(KIMI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
    },
    body: JSON.stringify({ model, ...payload }),
    signal,
  });
}

const CHUNK_SIZE = 6; // Translate at most 6 items per call to stay within max_tokens safely

// ============================================================
// Factory / supplier search via Kimi (web-aware sourcing expert)
// ============================================================

export interface FactorySupplier {
  name: string; // company/factory name (in English or translated)
  city: string | null;
  years_experience: number | null;
  specialties: string | null; // short description of what they produce
  contact: {
    phone?: string | null;
    email?: string | null;
    wechat?: string | null;
    whatsapp?: string | null;
    website?: string | null;
  };
  reviews_summary: string | null; // short quality / reputation summary
  estimated_price_cny: number | null; // estimated unit price for the queried product
  moq: number | null;
  why: string; // short reason why this factory is a good match
}

const FACTORY_SEARCH_SYSTEM_PROMPT = `Tu es un expert du sourcing en Chine, spécialiste des usines et entreprises manufacturières chinoises.
Tu connais parfaitement :
- Le paysage industriel de chaque région (Guangdong, Zhejiang, Fujian, Jiangsu, Shandong, etc.)
- Les plateformes B2B chinoises : 1688.com, Alibaba.com, Made-in-China.com, HCTM, Chinabrands
- Les réseaux sociaux et annuaires chinois (WeChat officiel, DingTalk, Tianyancha, Qichacha)
- Les salons professionnels (Canton Fair, Yiwu Market)
- La réputation, l'ancienneté et la capacité de production des fournisseurs

MISSION : Pour un produit donné, recommande 3 à 5 USINES ou ENTREPRISES manufacturières chinoises réputées capables de produire ce produit.

CRITÈRES STRICTS :
1. Privilégier les entreprises avec PLUSIEURS ANNÉES D'EXPÉRIENCE (idéalement 5+ ans)
2. Avec de BONNES ÉVALUATIONS et une réputation solide
3. Qui acceptent les commandes export et ont de l'expérience avec des clients étrangers
4. IMPÉRATIF : tu dois fournir AU MOINS UN MOYEN DE CONTACT réel (téléphone, email, WeChat, WhatsApp, ou site web). Si tu ne peux pas fournir de contact pour une entreprise, NE L'INCLUS PAS et passe à une autre.

RÉPONSE : UNIQUEMENT un JSON valide, format exact :
{
  "factories": [
    {
      "name": "Nom de l'entreprise (en anglais si possible)",
      "city": "Ville, Province",
      "years_experience": 12,
      "specialties": "Ce qu'ils produisent principalement",
      "contact": {
        "phone": "+86...",
        "email": "...@...",
        "wechat": "...",
        "whatsapp": "+86...",
        "website": "https://..."
      },
      "reviews_summary": "Résumé court sur leur réputation",
      "estimated_price_cny": 15.50,
      "moq": 500,
      "why": "Pourquoi cette usine est recommandée pour ce produit précis"
    }
  ]
}

Règles supplémentaires :
- Tous les champs du JSON doivent être présents (utilise null si inconnu)
- "contact" doit contenir AU MOINS UNE valeur non-null
- Si tu ne connais aucune usine fiable avec contact pour ce produit, retourne {"factories": []}
- Reste factuel : ne fabrique pas de contacts fictifs`;

export async function findFactories(
  productDescription: string
): Promise<FactorySupplier[]> {
  if (!process.env.KIMI_API_KEY) {
    console.warn('[Kimi] KIMI_API_KEY missing — skipping factory search');
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await callKimi(
      'moonshot-v1-32k',
      {
        messages: [
          { role: 'system', content: FACTORY_SEARCH_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Produit recherché : ${productDescription}\n\nTrouve-moi des usines/entreprises chinoises capables de fournir ce produit en gros.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 4000,
      },
      controller.signal
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Kimi] findFactories failed: ${res.status} ${errText.slice(0, 300)}`);
      return [];
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    try {
      const parsed = JSON.parse(content) as { factories?: FactorySupplier[] };
      const factories = parsed.factories || [];

      // Strict filter: keep only factories with at least one contact method
      const filtered = factories.filter((f) => {
        if (!f || typeof f !== 'object') return false;
        const c = f.contact || {};
        const hasContact = !!(c.phone || c.email || c.wechat || c.whatsapp || c.website);
        return hasContact && !!f.name?.trim();
      });

      console.log(`[Kimi] findFactories: ${factories.length} found, ${filtered.length} with contacts`);
      return filtered;
    } catch (parseErr) {
      console.error('[Kimi] findFactories JSON parse failed:', parseErr);
      return [];
    }
  } catch (err) {
    console.error('[Kimi] findFactories error:', err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// Translate French (or any language) to Chinese for search queries
export async function translateToChinese(text: string): Promise<string> {
  if (!text.trim()) return '';
  if (!process.env.KIMI_API_KEY) {
    console.warn('[Kimi] KIMI_API_KEY missing — returning original text');
    return text;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await callKimi(
      'moonshot-v1-8k',
      {
        messages: [
          {
            role: 'system',
            content:
              'Tu es un traducteur. Traduis le texte en chinois simplifié, format optimal pour une recherche e-commerce sur Taobao/1688. Retourne UNIQUEMENT la traduction, sans explication.',
          },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_tokens: 200,
      },
      controller.signal
    );

    if (!res.ok) {
      console.error(`[Kimi] translateToChinese failed: ${res.status}`);
      return text;
    }

    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    return translated || text;
  } catch (err) {
    console.error('[Kimi] translateToChinese error:', err);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function translateBatch(items: TranslationItem[]): Promise<TranslationMap> {
  if (!items.length) return {};

  if (!process.env.KIMI_API_KEY) {
    console.error('[Kimi] KIMI_API_KEY env var is missing — translation skipped');
    return {};
  }

  // Split into chunks to avoid response truncation
  if (items.length > CHUNK_SIZE) {
    console.log(`[Kimi] Splitting ${items.length} items into chunks of ${CHUNK_SIZE}`);
    const merged: TranslationMap = {};
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const chunkResult = await translateBatchInternal(chunk);
      Object.assign(merged, chunkResult);
    }
    return merged;
  }

  return translateBatchInternal(items);
}

async function translateBatchInternal(items: TranslationItem[]): Promise<TranslationMap> {

  // Truncate long fields to keep the response within token limits
  const truncate = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

  const userPayload = items.reduce<Record<string, Omit<TranslationItem, 'id'>>>((acc, item) => {
    const fields: Omit<TranslationItem, 'id'> = {};
    if (item.title) fields.title = truncate(item.title, 200);
    if (item.description) fields.description = truncate(item.description, 400);
    if (item.seller) fields.seller = truncate(item.seller, 80);
    if (Object.keys(fields).length > 0) acc[item.id] = fields;
    return acc;
  }, {});

  if (Object.keys(userPayload).length === 0) {
    console.warn('[Kimi] No fields to translate');
    return {};
  }

  console.log(`[Kimi] Translating ${Object.keys(userPayload).length} entries via ${KIMI_MODEL}`);

  const payload = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Traduis en français les champs suivants. Entrée :\n${JSON.stringify(userPayload)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 16000,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    let res = await callKimi(KIMI_MODEL, payload, controller.signal);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Kimi] Primary model ${KIMI_MODEL} failed (${res.status}): ${errText.slice(0, 200)} — trying fallback`);
      res = await callKimi(KIMI_FALLBACK_MODEL, payload, controller.signal);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Kimi] Both models failed: ${res.status} ${errText.slice(0, 500)}`);
      return {};
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[Kimi] Empty response content', data);
      return {};
    }

    try {
      const parsed = JSON.parse(content) as TranslationMap;
      console.log(`[Kimi] Successfully translated ${Object.keys(parsed).length} entries`);
      return parsed;
    } catch (parseErr) {
      console.error('[Kimi] JSON parse failed:', parseErr, 'content:', content.slice(0, 300));
      return {};
    }
  } catch (err) {
    console.error('[Kimi] Translation error:', err);
    return {};
  } finally {
    clearTimeout(timeout);
  }
}
